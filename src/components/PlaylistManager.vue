<template>
  <div class="playlist-manager">
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading...</p>
    </div>

    <div v-else>
      <div class="pagination">
        <button 
          :disabled="playlistOffset === 0" 
          @click="fetchPreviousPlaylists"
        >
          Previous
        </button>
        <span>{{ playlistOffset + 1 }}-{{ Math.min(playlistOffset + playlistLimit, totalPlaylists) }} of {{ totalPlaylists }}</span>
        <button 
          :disabled="playlistOffset + playlistLimit >= totalPlaylists" 
          @click="fetchNextPlaylists"
        >
          Next
        </button>
      </div>

      <div class="playlists-grid">
        <div 
          v-for="playlist in playlists" 
          :key="playlist.id" 
          class="playlist-card"
          @click="selectPlaylist(playlist.id)"
        >
          <img 
            v-if="playlist.images && playlist.images.length > 0" 
            :src="playlist.images[0].url" 
            :alt="playlist.name"
          >
          <div v-else class="no-image">No Image</div>
          <div class="playlist-info">
            <h3>{{ playlist.name }}</h3>
            <p>{{ playlist.tracks.total }} tracks</p>
            <p class="playlist-type">
              {{ playlist.public ? 'Public' : 'Private' }}
              {{ playlist.collaborative ? '• Collaborative' : '' }}
            </p>
            <SpotifyButton 
              :url="playlist.external_urls.spotify" 
              :stop-propagation="true" 
            />
          </div>
        </div>
      </div>

      <div v-if="selectedPlaylist" class="selected-playlist">
        <h2>{{ selectedPlaylist.name }}</h2>
        <p v-if="selectedPlaylist.description">{{ selectedPlaylist.description }}</p>

        <div class="pagination">
          <button 
            :disabled="trackOffset === 0" 
            @click="fetchPreviousTracks"
          >
            Previous
          </button>
          <span>{{ trackOffset + 1 }}-{{ Math.min(trackOffset + trackLimit, totalTracks) }} of {{ totalTracks }}</span>
          <button 
            :disabled="trackOffset + trackLimit >= totalTracks" 
            @click="fetchNextTracks"
          >
            Next
          </button>
        </div>

        <div class="tracks-list">
          <div v-for="(item, index) in tracks" :key="index" class="track-item">
            <div class="track-info">
              <h4>{{ item.track.name }}</h4>
              <p>{{ item.track.artists.map(a => a.name).join(', ') }}</p>
              <p class="added-by">Added by: {{ item.added_by.display_name || item.added_by.id }}</p>
            </div>
            <div class="track-actions">
              <button @click="moveTrackUp(index)" :disabled="index === 0">Move Up</button>
              <button @click="moveTrackDown(index)" :disabled="index === tracks.length - 1">Move Down</button>
              <button @click="removeTrack(item.track.uri)">Remove</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { SpotifyApi } from '../services/spotify';
import { spotifyApiService } from '../services/spotify';
import SpotifyButton from './SpotifyButton.vue';

const router = useRouter();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const playlists = ref<SpotifyApi.SimplifiedPlaylist[]>([]);
const totalPlaylists = ref(0);
const playlistOffset = ref(0);
const playlistLimit = ref(20);

const selectedPlaylist = ref<SpotifyApi.SinglePlaylistResponse | null>(null);
const tracks = ref<SpotifyApi.PlaylistTrack[]>([]);
const totalTracks = ref(0);
const trackOffset = ref(0);
const trackLimit = ref(50);
const currentSnapshotId = ref<string | null>(null);

// Load playlists on component mount
onMounted(async () => {
  try {
    await fetchPlaylists();
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
});

// Fetch playlists with pagination
async function fetchPlaylists() {
  try {
    loading.value = true;
    const response = await spotifyApiService.getUserPlaylists(
      playlistLimit.value, 
      playlistOffset.value
    );

    playlists.value = response.items;
    totalPlaylists.value = response.total;
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

// Pagination handlers for playlists
function fetchNextPlaylists() {
  if (playlistOffset.value + playlistLimit.value < totalPlaylists.value) {
    playlistOffset.value += playlistLimit.value;
    fetchPlaylists();
  }
}

function fetchPreviousPlaylists() {
  if (playlistOffset.value > 0) {
    playlistOffset.value = Math.max(0, playlistOffset.value - playlistLimit.value);
    fetchPlaylists();
  }
}

// Select a playlist and navigate to its detail page
function selectPlaylist(playlistId: string) {
  router.push({ name: 'PlaylistDetail', params: { id: playlistId } });
}

// Fetch playlist tracks with pagination
async function fetchPlaylistTracks(playlistId: string) {
  if (!selectedPlaylist.value) return;

  try {
    loading.value = true;

    const response = await spotifyApiService.getPlaylistTracks(
      playlistId,
      trackLimit.value,
      trackOffset.value
    );

    tracks.value = response.items;
    totalTracks.value = response.total;
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

// Pagination handlers for tracks
function fetchNextTracks() {
  if (!selectedPlaylist.value) return;

  if (trackOffset.value + trackLimit.value < totalTracks.value) {
    trackOffset.value += trackLimit.value;
    fetchPlaylistTracks(selectedPlaylist.value.id);
  }
}

function fetchPreviousTracks() {
  if (!selectedPlaylist.value) return;

  if (trackOffset.value > 0) {
    trackOffset.value = Math.max(0, trackOffset.value - trackLimit.value);
    fetchPlaylistTracks(selectedPlaylist.value.id);
  }
}

// Track reordering
async function moveTrackUp(index: number) {
  if (!selectedPlaylist.value || index === 0) return;

  try {
    loading.value = true;

    // Calculate the actual position in the playlist
    const actualIndex = trackOffset.value + index;

    // Reorder the track (move it one position up)
    const response = await spotifyApiService.reorderPlaylistTracks(
      selectedPlaylist.value.id,
      actualIndex,
      actualIndex - 1,
      1,
      currentSnapshotId.value || undefined
    );

    // Update the snapshot ID
    currentSnapshotId.value = response.snapshot_id;

    // Refresh the tracks to show the updated order
    await fetchPlaylistTracks(selectedPlaylist.value.id);
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

async function moveTrackDown(index: number) {
  if (!selectedPlaylist.value || index === tracks.value.length - 1) return;

  try {
    loading.value = true;

    // Calculate the actual position in the playlist
    const actualIndex = trackOffset.value + index;

    // Reorder the track (move it one position down)
    const response = await spotifyApiService.reorderPlaylistTracks(
      selectedPlaylist.value.id,
      actualIndex,
      actualIndex + 2, // +2 because we want to insert after the next track
      1,
      currentSnapshotId.value || undefined
    );

    // Update the snapshot ID
    currentSnapshotId.value = response.snapshot_id;

    // Refresh the tracks to show the updated order
    await fetchPlaylistTracks(selectedPlaylist.value.id);
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

// Remove a track
async function removeTrack(trackUri: string) {
  if (!selectedPlaylist.value) return;

  try {
    loading.value = true;

    // Remove the track
    const response = await spotifyApiService.removePlaylistTracks(
      selectedPlaylist.value.id,
      [trackUri],
      currentSnapshotId.value || undefined
    );

    // Update the snapshot ID
    currentSnapshotId.value = response.snapshot_id;

    // Refresh the tracks to show the updated list
    await fetchPlaylistTracks(selectedPlaylist.value.id);
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}


// Error handling
function handleError(err: unknown) {
  console.error('Spotify API error:', err);
  if (err instanceof Error) {
    error.value = err.message;
  } else {
    error.value = 'An unknown error occurred';
  }
}
</script>

<style scoped>
.playlist-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  color: var(--color-textPrimary);
}

.error-message {
  background-color: rgba(216, 87, 42, 0.2); /* accent with opacity */
  color: var(--color-accent);
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message button {
  background-color: var(--color-accent);
  color: var(--color-textPrimary);
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.loading {
  text-align: center;
  padding: 20px;
  color: var(--color-textPrimary);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20px 0;
  gap: 10px;
}

.pagination button {
  padding: 5px 10px;
  background-color: var(--color-accent);
  color: var(--color-textPrimary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.pagination button:hover:not(:disabled) {
  background-color: var(--color-gradientStart);
}

.pagination button:disabled {
  background-color: var(--color-surface);
  color: var(--color-textSecondary);
  cursor: not-allowed;
}

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.playlist-card {
  background-color: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-card:hover {
  transform: translateY(-5px);
}

.playlist-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 200px;
  background-color: var(--color-background);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-textSecondary);
}

.playlist-info {
  padding: 15px;
}

.playlist-info h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-textPrimary);
}

.playlist-info p {
  margin: 5px 0;
  font-size: 14px;
  color: var(--color-textSecondary);
}

.playlist-type {
  font-size: 12px !important;
}

.selected-playlist {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--color-surface);
}

.tracks-list {
  margin-top: 20px;
}

.track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--color-surface);
}

.track-info {
  flex: 1;
}

.track-info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: var(--color-textPrimary);
}

.track-info p {
  margin: 0;
  font-size: 14px;
  color: var(--color-textSecondary);
}

.added-by {
  font-size: 12px !important;
  color: var(--color-textSecondary) !important;
  margin-top: 5px !important;
}

.track-actions {
  display: flex;
  gap: 5px;
}

.track-actions button {
  padding: 5px 10px;
  background-color: var(--color-primary);
  color: var(--color-textPrimary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.track-actions button:hover:not(:disabled) {
  background-color: var(--color-accent);
}

.track-actions button:disabled {
  background-color: var(--color-background);
  color: var(--color-textSecondary);
  cursor: not-allowed;
}

</style>
