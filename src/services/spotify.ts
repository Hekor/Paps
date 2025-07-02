import { useAuthStore } from '../stores/auth';

/**
 * Spotify API Service
 * 
 * This service handles all interactions with the Spotify Web API.
 * It includes methods for playlist management, track operations,
 * and handles authentication, error handling, rate limiting, and caching.
 */
export class SpotifyApiService {
  private baseUrl = 'https://api.spotify.com/v1';
  private cache = new Map<string, { data: any; etag: string }>();

  // Lazy getter for authStore to ensure it's only accessed after Pinia is initialized
  private get authStore() {
    return useAuthStore();
  }

  /**
   * Makes an authenticated request to the Spotify API with error handling,
   * rate limiting, and caching support.
   * 
   * @param endpoint - The API endpoint (without base URL)
   * @param options - Fetch options (method, body, etc.)
   * @param useCache - Whether to use cache for this request
   * @returns The response data
   * @throws Error if the request fails
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true
  ): Promise<T> {
    // Ensure we have a valid access token
    if (!this.authStore.isAuthenticated) {
      const refreshed = await this.authStore.refreshAccessToken();
      if (!refreshed) {
        throw new Error('Authentication required. Please log in.');
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${url}:${JSON.stringify(options.body || '')}`;

    // Set up headers with authentication
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.authStore.accessToken}`);

    // Add If-None-Match header for caching if we have a cached response
    if (useCache && this.cache.has(cacheKey)) {
      headers.set('If-None-Match', this.cache.get(cacheKey)!.etag);
    }

    // Prepare the request
    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    // Implement retry logic for rate limiting
    const maxRetries = 3;
    let retries = 0;

    while (true) {
      try {
        const response = await fetch(url, requestOptions);

        // Handle 304 Not Modified (use cached data)
        if (response.status === 304 && useCache && this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey)!.data;
        }

        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          if (retries >= maxRetries) {
            throw new Error('Rate limit exceeded. Too many requests.');
          }

          // Get retry delay from header or use exponential backoff
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retries) * 1000;

          console.warn(`Rate limit exceeded. Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          continue;
        }

        // Handle authentication errors
        if (response.status === 401) {
          // Try to refresh the token once
          const refreshed = await this.authStore.refreshAccessToken();
          if (refreshed) {
            // Update the Authorization header with the new token
            headers.set('Authorization', `Bearer ${this.authStore.accessToken}`);
            requestOptions.headers = headers;
            continue; // Retry the request with the new token
          } else {
            throw new Error('Authentication failed. Please log in again.');
          }
        }

        // Handle other errors
        if (!response.ok) {
          let errorMessage = `Spotify API error: ${response.status} ${response.statusText}`;

          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = `${errorMessage} - ${errorData.error.message || JSON.stringify(errorData.error)}`;
            }
          } catch (e) {
            // Ignore JSON parsing errors in error responses
          }

          throw new Error(errorMessage);
        }

        // Parse successful response
        const data = await response.json() as T;

        // Cache the response if it has an ETag header
        const etag = response.headers.get('ETag');
        if (useCache && etag) {
          this.cache.set(cacheKey, { data, etag });
        }

        return data;
      } catch (error) {
        if (retries >= maxRetries || !(error instanceof Error && error.message.includes('Rate limit'))) {
          throw error;
        }

        // Exponential backoff for network errors
        const delay = Math.pow(2, retries) * 1000;
        console.warn(`Request failed. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
  }

  /**
   * Fetches the current user's playlists (owned, collaborative, and followed)
   * with pagination support.
   * 
   * @param limit - Number of playlists to return (default: 20, max: 50)
   * @param offset - Index of the first playlist to return (default: 0)
   * @returns Paginated playlist data
   */
  async getUserPlaylists(limit = 20, offset = 0) {
    return this.apiRequest<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Fetches a specific playlist by ID.
   * 
   * @param playlistId - The Spotify ID of the playlist
   * @returns The playlist data
   */
  async getPlaylist(playlistId: string) {
    return this.apiRequest<SpotifyApi.SinglePlaylistResponse>(
      `/playlists/${playlistId}`
    );
  }

  /**
   * Fetches tracks from a specific playlist with pagination support.
   * Includes information about who added each track.
   * 
   * @param playlistId - The Spotify ID of the playlist
   * @param limit - Number of tracks to return (default: 100, max: 100)
   * @param offset - Index of the first track to return (default: 0)
   * @returns Paginated playlist tracks data
   */
  async getPlaylistTracks(playlistId: string, limit = 100, offset = 0) {
    return this.apiRequest<SpotifyApi.PlaylistTrackResponse>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Reorders tracks in a playlist.
   * 
   * @param playlistId - The Spotify ID of the playlist
   * @param rangeStart - The position of the first track to be reordered
   * @param insertBefore - The position where the tracks should be inserted
   * @param rangeLength - The number of tracks to be reordered (default: 1)
   * @param snapshotId - The playlist's snapshot ID (optional)
   * @returns The new snapshot ID of the playlist
   */
  async reorderPlaylistTracks(
    playlistId: string,
    rangeStart: number,
    insertBefore: number,
    rangeLength = 1,
    snapshotId?: string
  ) {
    const body: any = {
      range_start: rangeStart,
      insert_before: insertBefore,
      range_length: rangeLength
    };

    if (snapshotId) {
      body.snapshot_id = snapshotId;
    }

    return this.apiRequest<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      false // Don't use cache for modifications
    );
  }

  /**
   * Removes tracks from a playlist.
   * 
   * @param playlistId - The Spotify ID of the playlist
   * @param trackUris - Array of Spotify track URIs to remove
   * @param snapshotId - The playlist's snapshot ID (optional)
   * @returns The new snapshot ID of the playlist
   */
  async removePlaylistTracks(
    playlistId: string,
    trackUris: string[],
    snapshotId?: string
  ) {
    const body: any = {
      tracks: trackUris.map(uri => ({ uri }))
    };

    if (snapshotId) {
      body.snapshot_id = snapshotId;
    }

    return this.apiRequest<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      false // Don't use cache for modifications
    );
  }

  /**
   * Adds tracks to a playlist.
   * 
   * @param playlistId - The Spotify ID of the playlist
   * @param trackUris - Array of Spotify track URIs to add
   * @param position - Position to insert the tracks (optional)
   * @returns The new snapshot ID of the playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    position?: number
  ) {
    const body: any = {
      uris: trackUris
    };

    if (position !== undefined) {
      body.position = position;
    }

    return this.apiRequest<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      false // Don't use cache for modifications
    );
  }

  /**
   * Fetches user details by user ID.
   * 
   * @param userId - The Spotify ID of the user
   * @returns The user profile data
   */
  async getUserById(userId: string) {
    return this.apiRequest<SpotifyApi.UserProfile>(
      `/users/${userId}`
    );
  }

  /**
   * Fetches the current user's profile.
   * 
   * @returns The current user's profile data
   */
  async getCurrentUser() {
    return this.apiRequest<SpotifyApi.UserProfile>(
      `/me`
    );
  }

  /**
   * Clears the cache for a specific endpoint or the entire cache if no endpoint is provided.
   * 
   * @param endpoint - The API endpoint to clear cache for (optional)
   */
  clearCache(endpoint?: string) {
    if (endpoint) {
      const url = `${this.baseUrl}${endpoint}`;
      // Clear all cache entries that start with this URL
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${url}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear the entire cache
      this.cache.clear();
    }
  }
}

// Create a singleton instance
export const spotifyApiService = new SpotifyApiService();

// Export types for TypeScript support
export namespace SpotifyApi {
  export interface ExternalUrls {
    spotify: string;
  }

  export interface Image {
    url: string;
    height: number | null;
    width: number | null;
  }

  export interface UserProfile {
    display_name: string | null;
    external_urls: ExternalUrls;
    href: string;
    id: string;
    type: 'user';
    uri: string;
    images?: Image[];
    followers?: Followers;
  }

  export interface Followers {
    href: string | null;
    total: number;
  }

  export interface PlaylistTrack {
    added_at: string;
    added_by: UserProfile;
    is_local: boolean;
    track: Track;
  }

  export interface PlaylistTrackResponse {
    href: string;
    items: PlaylistTrack[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  }

  export interface SimplifiedPlaylist {
    collaborative: boolean;
    description: string | null;
    external_urls: ExternalUrls;
    href: string;
    id: string;
    images: Image[];
    name: string;
    owner: UserProfile;
    public: boolean | null;
    snapshot_id: string;
    tracks: {
      href: string;
      total: number;
    };
    type: 'playlist';
    uri: string;
  }

  export interface SinglePlaylistResponse extends SimplifiedPlaylist {
    followers: Followers;
    tracks: PlaylistTrackResponse;
  }

  export interface ListOfCurrentUsersPlaylistsResponse {
    href: string;
    items: SimplifiedPlaylist[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  }

  export interface Artist {
    external_urls: ExternalUrls;
    href: string;
    id: string;
    name: string;
    type: 'artist';
    uri: string;
  }

  export interface Album {
    album_type: string;
    artists: Artist[];
    available_markets: string[];
    external_urls: ExternalUrls;
    href: string;
    id: string;
    images: Image[];
    name: string;
    release_date: string;
    release_date_precision: string;
    total_tracks: number;
    type: 'album';
    uri: string;
  }

  export interface Track {
    album: Album;
    artists: Artist[];
    available_markets: string[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    external_ids: {
      isrc: string;
      ean: string;
      upc: string;
    };
    external_urls: ExternalUrls;
    href: string;
    id: string;
    is_playable: boolean;
    linked_from: {
      external_urls: ExternalUrls;
      href: string;
      id: string;
      type: string;
      uri: string;
    };
    restrictions: {
      reason: string;
    };
    name: string;
    popularity: number;
    preview_url: string | null;
    track_number: number;
    type: 'track';
    uri: string;
    is_local: boolean;
  }
}
