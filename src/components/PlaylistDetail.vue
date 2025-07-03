<template>
  <div class="playlist-detail">
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading...</p>
    </div>

    <div v-else-if="playlist">
      <div class="back-navigation">
        <router-link to="/playlists" class="back-button">← Back to Playlists</router-link>
      </div>
      <div class="playlist-header">
        <div class="playlist-image">
          <img 
            v-if="playlist.images && playlist.images.length > 0" 
            :src="playlist.images[0].url" 
            :alt="playlist.name"
          >
          <div v-else class="no-image">No Image</div>
        </div>
        <div class="playlist-info">
          <h1>{{ playlist.name }}</h1>
          <p v-if="playlist.description">{{ playlist.description }}</p>
          <p class="playlist-meta">
            {{ playlist.tracks.total }} tracks • 
            {{ playlist.public ? 'Public' : 'Private' }}
            {{ playlist.collaborative ? '• Collaborative' : '' }}
          </p>
          <p class="playlist-owner">
            Created by: {{ playlist.owner.display_name || playlist.owner.id }}
          </p>
          <SpotifyButton 
            :url="playlist.external_urls.spotify" 
          />
        </div>
      </div>

      <div class="tabs">
        <button 
          :class="{ active: activeTab === 'tracks' }" 
          @click="activeTab = 'tracks'"
        >
          Tracks
        </button>
        <button 
          :class="{ active: activeTab === 'stats' }" 
          @click="activeTab = 'stats'"
        >
          Stats
        </button>
      </div>

      <div v-if="activeTab === 'tracks'" class="tab-content">
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
              <h4>
                <a 
                  href="#" 
                  @click.prevent="openSpotifyUrl(item.track.external_urls.spotify)"
                  class="track-link"
                >
                  {{ item.track.name }}
                </a>
              </h4>
              <p>
                <template v-for="(artist, i) in item.track.artists" :key="artist.id">
                  <a 
                    href="#" 
                    @click.prevent="openSpotifyUrl(artist.external_urls.spotify)"
                    class="artist-link"
                  >
                    {{ artist.name }}
                  </a>{{ i < item.track.artists.length - 1 ? ', ' : '' }}
                </template>
              </p>
              <p class="track-duration">{{ formatDuration(item.track.duration_ms) }}</p>
              <p class="added-by">
                Added by: {{ getUserDisplayName(item.added_by) }}
                <img 
                  v-if="userProfiles[item.added_by.id]?.images && (userProfiles[item.added_by.id]?.images || []).length > 0"
                  :src="userProfiles[item.added_by.id]!.images![0].url"
                  class="user-avatar"
                  alt="User avatar"
                >
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'stats'" class="tab-content">
        <div class="stats-container">
          <div class="stats-summary">
            <div class="stat-item">
              <h3>Total Tracks</h3>
              <p>{{ totalTracks }}</p>
            </div>
            <div class="stat-item">
              <h3>Total Duration</h3>
              <p>{{ formatDuration(totalDuration) }}</p>
            </div>
          </div>

          <div class="stats-chart">
            <h3>Time Distribution by User</h3>
            <canvas ref="pieChart" width="400" height="400"></canvas>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="not-found">
      <p>Playlist not found</p>
      <router-link to="/playlists" class="back-button">Back to Playlists</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SpotifyApi } from '../services/spotify';
import { spotifyApiService } from '../services/spotify';
import Chart from 'chart.js/auto';
import SpotifyButton from './SpotifyButton.vue';

// State
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);
const playlist = ref<SpotifyApi.SinglePlaylistResponse | null>(null);
const tracks = ref<SpotifyApi.PlaylistTrack[]>([]);
const totalTracks = ref(0);
const trackOffset = ref(0);
const trackLimit = ref(50);
const activeTab = ref('tracks');
const userProfiles = ref<Record<string, SpotifyApi.UserProfile>>({});
const pieChart = ref<HTMLCanvasElement | null>(null);
const chartInstance = ref<Chart | null>(null);

// Computed properties
const totalDuration = computed(() => {
  return tracks.value.reduce((total, item) => total + item.track.duration_ms, 0);
});

const userDurations = computed(() => {
  const durations: Record<string, number> = {};

  tracks.value.forEach(item => {
    const userId = item.added_by.id;
    if (!durations[userId]) {
      durations[userId] = 0;
    }
    durations[userId] += item.track.duration_ms;
  });

  return durations;
});

// Load playlist on component mount
onMounted(async () => {
  const playlistId = route.params.id as string;
  if (!playlistId) {
    router.push('/playlists');
    return;
  }

  try {
    await fetchPlaylist(playlistId);
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
});

// Watch for tab changes to update the chart
watch(activeTab, async (newTab) => {
  if (newTab === 'stats') {
    await nextTick();
    renderPieChart();
  }
});

// Watch for tracks changes to update user profiles and chart
watch(tracks, async () => {
  await fetchUserProfiles();
  if (activeTab.value === 'stats') {
    renderPieChart();
  }
});

// Fetch playlist data
async function fetchPlaylist(playlistId: string) {
  try {
    loading.value = true;

    // Fetch the full playlist
    const playlistData = await spotifyApiService.getPlaylist(playlistId);
    playlist.value = playlistData;

    // Set tracks from the initial response
    tracks.value = playlistData.tracks.items;
    totalTracks.value = playlistData.tracks.total;

    // If there are more tracks than what's in the initial response, we need to fetch them separately
    if (playlistData.tracks.total > tracks.value.length) {
      await fetchPlaylistTracks(playlistId);
    }

    // Fetch user profiles for the tracks
    await fetchUserProfiles();
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

// Fetch playlist tracks with pagination
async function fetchPlaylistTracks(playlistId: string) {
  if (!playlist.value) return;

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
  if (!playlist.value) return;

  if (trackOffset.value + trackLimit.value < totalTracks.value) {
    trackOffset.value += trackLimit.value;
    fetchPlaylistTracks(playlist.value.id);
  }
}

function fetchPreviousTracks() {
  if (!playlist.value) return;

  if (trackOffset.value > 0) {
    trackOffset.value = Math.max(0, trackOffset.value - trackLimit.value);
    fetchPlaylistTracks(playlist.value.id);
  }
}

// Fetch user profiles for all users who added tracks
async function fetchUserProfiles() {
  const userIds = new Set<string>();

  // Collect all unique user IDs
  tracks.value.forEach(item => {
    if (item.added_by && item.added_by.id) {
      userIds.add(item.added_by.id);
    }
  });

  // Fetch user profiles for each user ID
  for (const userId of userIds) {
    if (!userProfiles.value[userId]) {
      try {
        const userProfile = await spotifyApiService.getUserById(userId);
        userProfiles.value[userId] = userProfile;
      } catch (err) {
        console.error(`Failed to fetch user profile for ${userId}:`, err);
        // Continue with other users even if one fails
      }
    }
  }
}

// Get display name for a user
function getUserDisplayName(user: SpotifyApi.UserProfile): string {
  if (userProfiles.value[user.id]) {
    return userProfiles.value[user.id].display_name || user.id;
  }
  return user.display_name || user.id;
}

// Format duration from milliseconds to MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Render pie chart for user duration distribution
function renderPieChart() {
  if (!pieChart.value) return;

  // Destroy previous chart instance if it exists
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  const ctx = pieChart.value.getContext('2d');
  if (!ctx) return;

  const durations = userDurations.value;
  const labels = Object.keys(durations).map(userId => {
    return getUserDisplayName({ id: userId, display_name: null, external_urls: { spotify: '' }, href: '', type: 'user', uri: '' });
  });

  const data = Object.values(durations);

  // Generate random colors for each user
  const colors = Object.keys(durations).map(() => {
    return `hsl(${Math.random() * 360}, 70%, 50%)`;
  });

  chartInstance.value = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              const percentage = ((value / totalDuration.value) * 100).toFixed(1);
              return `${context.label}: ${formatDuration(value)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Open Spotify URL in a new tab
function openSpotifyUrl(url: string) {
  window.open(url, '_blank');
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
.playlist-detail {
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

.loading, .not-found {
  text-align: center;
  padding: 40px;
  color: var(--color-textPrimary);
}

.playlist-header {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.playlist-image img {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.no-image {
  width: 200px;
  height: 200px;
  background-color: var(--color-background);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-textSecondary);
  border-radius: 8px;
}

.playlist-info {
  flex: 1;
}

.playlist-info h1 {
  margin: 0 0 10px 0;
  font-size: 32px;
  color: var(--color-textPrimary);
}

.playlist-meta, .playlist-owner {
  color: var(--color-textSecondary);
  margin: 5px 0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-surface);
  margin-bottom: 20px;
}

.tabs button {
  padding: 10px 20px;
  background: none;
  border: none;
  color: var(--color-textSecondary);
  font-size: 16px;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tabs button:hover {
  color: var(--color-textPrimary);
}

.tabs button.active {
  color: var(--color-accent);
}

.tabs button.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--color-accent);
}

.tab-content {
  padding: 20px 0;
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

.track-duration {
  color: var(--color-textSecondary);
  font-size: 12px;
  margin-top: 2px !important;
}

.added-by {
  font-size: 12px !important;
  color: var(--color-textSecondary) !important;
  margin-top: 5px !important;
  display: flex;
  align-items: center;
  gap: 5px;
}

.user-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.stats-summary {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item h3 {
  margin-bottom: 5px;
  color: var(--color-textSecondary);
}

.stat-item p {
  font-size: 24px;
  font-weight: bold;
  color: var(--color-accent);
}

.stats-chart {
  margin: 0 auto;
  max-width: 600px;
  text-align: center;
}

.stats-chart h3 {
  margin-bottom: 20px;
  color: var(--color-textSecondary);
}

.back-navigation {
  margin-bottom: 20px;
}

.back-button {
  display: inline-block;
  margin-top: 0;
  padding: 10px 20px;
  background-color: var(--color-accent);
  color: var(--color-textPrimary);
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: var(--color-gradientStart);
}

.not-found .back-button {
  margin-top: 20px;
}


.track-link, .artist-link {
  color: var(--color-textPrimary);
  text-decoration: none;
  transition: color 0.2s;
}

.track-link:hover, .artist-link:hover {
  color: #1ED760;
  text-decoration: underline;
}
</style>
