import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { spotifyApiService, type SpotifyApi } from '../services/spotify';

export const usePlaylistStore = defineStore('playlist', () => {
  // State
  const playlistTracks = ref<Record<string, SpotifyApi.PlaylistTrack[]>>({});
  const isLoading = ref<Record<string, boolean>>({});
  const hasAllTracks = ref<Record<string, boolean>>({});

  // Getters
  const getPlaylistTracks = computed(() => {
    return (playlistId: string) => playlistTracks.value[playlistId] || [];
  });

  const getIsLoading = computed(() => {
    return (playlistId: string) => isLoading.value[playlistId] || false;
  });

  const getHasAllTracks = computed(() => {
    return (playlistId: string) => hasAllTracks.value[playlistId] || false;
  });

  // Actions
  /**
   * Loads the next batch of tracks for a playlist
   * @param playlistId The Spotify ID of the playlist
   * @param limit Number of tracks to fetch per request
   * @param offset Starting position of the tracks to fetch
   * @param append Whether to append the tracks to existing ones or replace them
   * @returns The fetched tracks
   */
  const loadPlaylistTracks = async (
    playlistId: string,
    limit = 50,
    offset = 0,
    append = true
  ) => {
    if (isLoading.value[playlistId]) return [];
    if (hasAllTracks.value[playlistId]) return playlistTracks.value[playlistId] || [];

    try {
      isLoading.value = { ...isLoading.value, [playlistId]: true };

      const response = await spotifyApiService.getPlaylistTracks(
        playlistId,
        limit,
        offset
      );

      // If this is the first load or we're not appending, replace the tracks
      if (!playlistTracks.value[playlistId] || !append) {
        playlistTracks.value = {
          ...playlistTracks.value,
          [playlistId]: response.items
        };
      } else {
        // Otherwise append the new tracks
        playlistTracks.value = {
          ...playlistTracks.value,
          [playlistId]: [...playlistTracks.value[playlistId], ...response.items]
        };
      }

      // Check if we've loaded all tracks
      const currentTracks = playlistTracks.value[playlistId] || [];
      hasAllTracks.value = {
        ...hasAllTracks.value,
        [playlistId]: currentTracks.length >= response.total
      };

      return response.items;
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      return [];
    } finally {
      isLoading.value = { ...isLoading.value, [playlistId]: false };
    }
  };

  /**
   * Loads all tracks for a playlist
   * @param playlistId The Spotify ID of the playlist
   * @returns All tracks in the playlist
   */
  const loadAllPlaylistTracks = async (playlistId: string) => {
    if (hasAllTracks.value[playlistId]) {
      return playlistTracks.value[playlistId];
    }

    try {
      isLoading.value = { ...isLoading.value, [playlistId]: true };

      // First, get the playlist to know the total number of tracks
      const playlist = await spotifyApiService.getPlaylist(playlistId);
      const totalTracks = playlist.tracks.total;
      
      // Initialize with the tracks from the initial response
      let allTracks = [...playlist.tracks.items];
      
      // If we need more tracks, fetch them in batches
      if (totalTracks > allTracks.length) {
        const batchSize = 100; // Maximum allowed by Spotify API
        
        // Calculate how many additional requests we need
        const additionalRequests = Math.ceil((totalTracks - allTracks.length) / batchSize);
        
        for (let i = 0; i < additionalRequests; i++) {
          const offset = allTracks.length;
          const response = await spotifyApiService.getPlaylistTracks(
            playlistId,
            batchSize,
            offset
          );
          
          allTracks = [...allTracks, ...response.items];
          
          // Break if we've got all tracks or if the response is empty
          if (allTracks.length >= totalTracks || response.items.length === 0) {
            break;
          }
        }
      }
      
      // Update the store
      playlistTracks.value = {
        ...playlistTracks.value,
        [playlistId]: allTracks
      };
      
      hasAllTracks.value = {
        ...hasAllTracks.value,
        [playlistId]: true
      };
      
      return allTracks;
    } catch (error) {
      console.error('Error loading all playlist tracks:', error);
      return playlistTracks.value[playlistId] || [];
    } finally {
      isLoading.value = { ...isLoading.value, [playlistId]: false };
    }
  };

  /**
   * Clears the tracks for a specific playlist or all playlists
   * @param playlistId Optional playlist ID to clear
   */
  const clearTracks = (playlistId?: string) => {
    if (playlistId) {
      const { [playlistId]: _, ...rest } = playlistTracks.value;
      playlistTracks.value = rest;
      
      const { [playlistId]: __, ...restLoading } = isLoading.value;
      isLoading.value = restLoading;
      
      const { [playlistId]: ___, ...restHasAll } = hasAllTracks.value;
      hasAllTracks.value = restHasAll;
    } else {
      playlistTracks.value = {};
      isLoading.value = {};
      hasAllTracks.value = {};
    }
  };

  return {
    playlistTracks,
    isLoading,
    hasAllTracks,
    getPlaylistTracks,
    getIsLoading,
    getHasAllTracks,
    loadPlaylistTracks,
    loadAllPlaylistTracks,
    clearTracks
  };
});