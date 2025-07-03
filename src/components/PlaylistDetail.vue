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
        <button 
          :class="{ active: activeTab === 'playtimeShuffle' }" 
          @click="activeTab = 'playtimeShuffle'"
        >
          Playtime Shuffle
        </button>
      </div>

      <div v-if="activeTab === 'tracks'" class="tab-content">
        <div class="tracks-info">
          <span>{{ tracks.length }} of {{ totalTracks }} tracks loaded</span>
        </div>

        <div class="tracks-list">
          <div v-for="(item, index) in tracks" :key="index" class="track-item">
            <div class="track-number">
              {{ index + 1 }}
            </div>
            <div class="track-info-left">
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
            </div>
            <div class="track-info-right">
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

          <!-- Loading trigger element for infinite scrolling -->
          <div 
            ref="loadingTrigger" 
            class="loading-trigger"
            v-if="!hasAllTracks"
          >
            <div v-if="isLoadingMore || isStoreLoading" class="loading-indicator">
              Loading more tracks...
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

          <div class="stats-chart">
            <h3>Track Count by User</h3>
            <canvas ref="barChart" width="400" height="400"></canvas>
          </div>

          <div class="stats-chart">
            <h3>Cumulative Track Duration by Position</h3>
            <canvas ref="lineChart" width="400" height="400"></canvas>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'playtimeShuffle'" class="tab-content">
        <div class="shuffle-container">
          <div class="shuffle-actions">
            <button 
              v-if="!isShuffling && !isShuffled" 
              @click="shufflePlaylist" 
              class="shuffle-button"
            >
              Shuffle
            </button>
            <template v-else-if="isShuffled">
              <button 
                @click="commitShuffledPlaylist" 
                class="commit-button"
                :disabled="isCommitting"
              >
                {{ isCommitting ? 'Committing...' : 'Commit' }}
              </button>
              <button 
                @click="discardShuffledPlaylist" 
                class="discard-button"
                :disabled="isCommitting"
              >
                Discard
              </button>
            </template>
            <div v-else class="shuffling-indicator">
              Shuffling playlist...
            </div>
          </div>

          <div v-if="shuffleStatus" class="shuffle-status">
            {{ shuffleStatus }}
          </div>

          <div class="tracks-list">
            <div v-for="(item, index) in displayedTracks" :key="index" class="track-item">
              <div class="track-number">
                {{ index + 1 }}
              </div>
              <div class="track-info-left">
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
              </div>
              <div class="track-info-right">
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
      </div>
    </div>
    <div v-else class="not-found">
      <p>Playlist not found</p>
      <router-link to="/playlists" class="back-button">Back to Playlists</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SpotifyApi } from '../services/spotify';
import { spotifyApiService } from '../services/spotify';
import Chart from 'chart.js/auto';
import SpotifyButton from './SpotifyButton.vue';
import { usePlaylistStore } from '../stores/playlist';

// State
const route = useRoute();
const router = useRouter();
const playlistStore = usePlaylistStore();
const loading = ref(true);
const error = ref<string | null>(null);
const playlist = ref<SpotifyApi.SinglePlaylistResponse | null>(null);
const activeTab = ref('tracks');
const userProfiles = ref<Record<string, SpotifyApi.UserProfile>>({});
const pieChart = ref<HTMLCanvasElement | null>(null);
const barChart = ref<HTMLCanvasElement | null>(null);
const lineChart = ref<HTMLCanvasElement | null>(null);
const chartInstance = ref<Chart | null>(null);
const barChartInstance = ref<Chart | null>(null);
const lineChartInstance = ref<Chart | null>(null);
const isLoadingMore = ref(false);
const observer = ref<IntersectionObserver | null>(null);
const loadingTrigger = ref<HTMLElement | null>(null);

// Playtime Shuffle state
const isShuffling = ref(false);
const isShuffled = ref(false);
const isCommitting = ref(false);
const shuffleStatus = ref<string | null>(null);
const shuffledTracks = ref<SpotifyApi.PlaylistTrack[]>([]);
const originalTracks = ref<SpotifyApi.PlaylistTrack[]>([]);
const trackMoves = ref<{from: number, to: number}[]>([]);

// Computed properties
const tracks = computed(() => {
  return playlist.value ? playlistStore.getPlaylistTracks(playlist.value.id) : [];
});

const totalTracks = computed(() => {
  return playlist.value?.tracks.total || 0;
});

const hasAllTracks = computed(() => {
  return playlist.value ? playlistStore.getHasAllTracks(playlist.value.id) : false;
});

const isStoreLoading = computed(() => {
  return playlist.value ? playlistStore.getIsLoading(playlist.value.id) : false;
});

const totalDuration = computed(() => {
  return tracks.value.reduce((total, item) => total + item.track.duration_ms, 0);
});

// Displayed tracks based on whether we're showing shuffled tracks or original tracks
const displayedTracks = computed(() => {
    return isShuffled.value ? shuffledTracks.value : tracks.value;
});

const userDurations = computed(() => {
  const durations: Record<string, number> = {};

  displayedTracks.value.forEach(item => {
    const userId = item.added_by.id;
    if (!durations[userId]) {
      durations[userId] = 0;
    }
    durations[userId] += item.track.duration_ms;
  });

  return durations;
});

// Computed property for track counts by user
const userTrackCounts = computed(() => {
  const counts: Record<string, number> = {};

  displayedTracks.value.forEach(item => {
    const userId = item.added_by.id;
    if (!counts[userId]) {
      counts[userId] = 0;
    }
    counts[userId]++;
  });

  return counts;
});

// Computed property for cumulative track durations by track number per user
const cumulativeTrackDurations = computed(() => {
  const userDurationsByTrack: Record<string, number[]> = {};

  // Initialize arrays for each user
  const userIds = new Set<string>();
  displayedTracks.value.forEach(item => userIds.add(item.added_by.id));

  userIds.forEach(userId => {
    userDurationsByTrack[userId] = [];
  });

  // Sort tracks by their position in the playlist
  const sortedTracks = [...displayedTracks.value].sort((a, b) => {
    return (a.track.track_number || 0) - (b.track.track_number || 0);
  });

  // Calculate cumulative durations for each user
  sortedTracks.forEach((item, index) => {
    const userId = item.added_by.id;
    const previousDuration = index > 0 ? userDurationsByTrack[userId][index - 1] || 0 : 0;
    userDurationsByTrack[userId][index] = previousDuration + item.track.duration_ms;

    // Fill in zeros for other users at this track position
    userIds.forEach(id => {
      if (id !== userId && userDurationsByTrack[id][index] === undefined) {
        userDurationsByTrack[id][index] = userDurationsByTrack[id][index - 1] || 0;
      }
    });
  });

  return userDurationsByTrack;
});

// Setup intersection observer for infinite scrolling
function setupInfiniteScroll() {
  // Disconnect previous observer if it exists
  if (observer.value) {
    observer.value.disconnect();
  }

  // Create a new IntersectionObserver
  observer.value = new IntersectionObserver(async (entries) => {
    // If the loading trigger is visible and we're not already loading more
    if (entries[0].isIntersecting && !isLoadingMore.value && !isStoreLoading.value && playlist.value) {
      await loadMoreTracks();
    }
  }, {
    root: null, // Use the viewport as the root
    rootMargin: '0px',
    threshold: 0.1 // Trigger when 10% of the element is visible
  });

  // Start observing the loading trigger element
  nextTick(() => {
    if (loadingTrigger.value && observer.value) {
      observer.value.observe(loadingTrigger.value);
    }
  });
}

// Load playlist on component mount
onMounted(async () => {
  const playlistId = route.params.id as string;
  if (!playlistId) {
    router.push('/playlists');
    return;
  }

  try {
    await fetchPlaylist(playlistId);
    setupInfiniteScroll();
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
});

// Cleanup on component unmount
onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});

// Watch for tab changes to update the charts and load all tracks if needed
watch(activeTab, async (newTab) => {
  if ((newTab === 'stats' || newTab == 'playtimeShuffle') && playlist.value) {
    // Load all tracks if we're viewing stats and don't have all tracks yet
    if (!hasAllTracks.value) {
      try {
        loading.value = true;
        await playlistStore.loadAllPlaylistTracks(playlist.value.id);
        await fetchUserProfiles();
      } catch (err) {
        handleError(err);
      } finally {
        loading.value = false;
      }
    }

    await nextTick();
    if (newTab === 'stats') {
      renderPieChart();
      renderBarChart();
      renderLineChart();
    }
  }
});

// Watch for tracks changes to update user profiles and charts
watch(tracks, async () => {
  await fetchUserProfiles();
  if (activeTab.value === 'stats') {
    renderPieChart();
    renderBarChart();
    renderLineChart();
  }
});

// Fetch playlist data
async function fetchPlaylist(playlistId: string) {
  try {
    loading.value = true;

    // Fetch the full playlist
    const playlistData = await spotifyApiService.getPlaylist(playlistId);
    playlist.value = playlistData;

    // Load initial tracks from the store
    await playlistStore.loadPlaylistTracks(playlistId, 50, 0, false);

    // Fetch user profiles for the tracks
    await fetchUserProfiles();
  } catch (err) {
    handleError(err);
  } finally {
    loading.value = false;
  }
}

// Load more tracks for infinite scrolling
async function loadMoreTracks() {
  if (!playlist.value || isLoadingMore.value || hasAllTracks.value) return;

  try {
    isLoadingMore.value = true;
    const currentTracks = tracks.value;

    // Load the next batch of tracks
    await playlistStore.loadPlaylistTracks(
      playlist.value.id,
      50,
      currentTracks.length,
      true
    );

    // Fetch user profiles for the new tracks
    await fetchUserProfiles();
  } catch (err) {
    handleError(err);
  } finally {
    isLoadingMore.value = false;
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

// Render bar chart for track count by user
function renderBarChart() {
  if (!barChart.value) return;

  // Destroy previous chart instance if it exists
  if (barChartInstance.value) {
    barChartInstance.value.destroy();
  }

  const ctx = barChart.value.getContext('2d');
  if (!ctx) return;

  const counts = userTrackCounts.value;
  const labels = Object.keys(counts).map(userId => {
    return getUserDisplayName({ id: userId, display_name: null, external_urls: { spotify: '' }, href: '', type: 'user', uri: '' });
  });

  const data = Object.values(counts);

  // Generate random colors for each user
  const colors = Object.keys(counts).map(() => {
    return `hsl(${Math.random() * 360}, 70%, 50%)`;
  });

  barChartInstance.value = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Track Count',
        data,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0 // Only show whole numbers
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              const percentage = ((value / totalTracks.value) * 100).toFixed(1);
              return `${context.label}: ${value} tracks (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Render line chart for cumulative track duration by track number per user
function renderLineChart() {
  if (!lineChart.value) return;

  // Destroy previous chart instance if it exists
  if (lineChartInstance.value) {
    lineChartInstance.value.destroy();
  }

  const ctx = lineChart.value.getContext('2d');
  if (!ctx) return;

  const cumulativeDurations = cumulativeTrackDurations.value;
  const userIds = Object.keys(cumulativeDurations);

  // Generate labels for track numbers (1, 2, 3, ...)
  const maxTrackCount = Math.max(...userIds.map(userId => cumulativeDurations[userId].length));
  const labels = Array.from({ length: maxTrackCount }, (_, i) => `${i + 1}`);

  // Generate datasets for each user
  const datasets = userIds.map(userId => {
    const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
    const displayName = getUserDisplayName({ id: userId, display_name: null, external_urls: { spotify: '' }, href: '', type: 'user', uri: '' });

    return {
      label: displayName,
      data: cumulativeDurations[userId],
      borderColor: color,
      backgroundColor: color,
      fill: false,
      tension: 0.1
    };
  });

  lineChartInstance.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatDuration(value as number)
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw as number;
              return `${context.dataset.label}: ${formatDuration(value)}`;
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

// Playtime Shuffle methods

/**
 * Shuffles the playlist using the special algorithm
 * that balances track time among users
 */
async function shufflePlaylist() {
  if (!playlist.value || isShuffling.value) return;

  try {
    isShuffling.value = true;
    shuffleStatus.value = "Loading all tracks...";

    // Make sure we have all tracks
    if (!hasAllTracks.value) {
      await playlistStore.loadAllPlaylistTracks(playlist.value.id);
      await fetchUserProfiles();
    }

    // Store original tracks
    originalTracks.value = [...tracks.value];

    // Initialize shuffled tracks with a copy of the original tracks
    shuffledTracks.value = [...tracks.value];

    shuffleStatus.value = "Calculating user playtimes...";

    // Calculate initial user playtimes
    const userPlaytimes: Record<string, number> = {};
    const userTrackCounts: Record<string, number> = {};

    // Initialize user playtimes to 0
    tracks.value.forEach(item => {
      const userId = item.added_by.id;
      if (!userPlaytimes[userId]) {
        userPlaytimes[userId] = 0;
        userTrackCounts[userId] = -1;
      }
    });

    // Track the moves for later use with the Spotify API
    trackMoves.value = [];

    // Shuffle the playlist
    shuffleStatus.value = "Shuffling playlist...";

    const remaining = [...shuffledTracks.value];

    // For each position in the result playlist
    for (let currentIndex = 0; currentIndex < originalTracks.value.length; currentIndex++) {
      // Find users with the minimum playtime
      const minPlaytime = Math.min(...Object.values(userPlaytimes));
      const usersWithMinPlaytime = Object.keys(userPlaytimes).filter(
        userId => (userTrackCounts[userId] == -1 || userTrackCounts[userId] > 0) && userPlaytimes[userId] === minPlaytime // Track count -1 => not yet used
      );

      // Randomly select a user from those with minimum playtime
      const selectedUserId = usersWithMinPlaytime[Math.floor(Math.random() * usersWithMinPlaytime.length)];

      // Find tracks from this user
      const userTracks = remaining.filter(item => item.added_by.id === selectedUserId);
      userTrackCounts[selectedUserId] = userTracks.length;

      let selectedTrack: SpotifyApi.PlaylistTrack;
      if (userTracks.length === 0) {
        // If no tracks from this user, select a random track
        const randomIndex = Math.floor(Math.random() * remaining.length);
        selectedTrack = remaining[randomIndex];
      } else {
        // Randomly select a track from this user
        const randomUserTrackIndex = Math.floor(Math.random() * userTracks.length);
        selectedTrack = userTracks[randomUserTrackIndex];
        userTrackCounts[selectedUserId]--;
      }

      // Update shuffled tracks with the selected track
      const shuffledIndex = shuffledTracks.value.findIndex(
          item => item.track.id === selectedTrack.track.id
      );
      shuffledTracks.value.splice(currentIndex, 0, selectedTrack);
      shuffledTracks.value.splice(shuffledIndex + 1, 1);

      // Remove the track from remaining
      const selectedTrackIndex = remaining.findIndex(
          item => item.track.id === selectedTrack.track.id
      );
      remaining.splice(selectedTrackIndex, 1);

      // Update playtimes for all users
      const trackDuration = selectedTrack.track.duration_ms;

      // Increase playtime for the selected user
      userPlaytimes[selectedUserId] += trackDuration;

      // Decrease playtime for all other users
      Object.keys(userPlaytimes).forEach(userId => {
        if (userId !== selectedUserId) {
          userPlaytimes[userId] -= trackDuration;
        }
      });

      // Record the move
      trackMoves.value.push({ from: shuffledIndex, to: currentIndex });
    }

    // Update status
    isShuffled.value = true;
    shuffleStatus.value = "Playlist shuffled successfully!";
  } catch (err) {
    handleError(err);
    shuffleStatus.value = "Error shuffling playlist.";
  } finally {
    isShuffling.value = false;
  }
}

/**
 * Commits the shuffled playlist to Spotify
 */
async function commitShuffledPlaylist() {
  if (!playlist.value || !isShuffled.value || isCommitting.value) return;

  try {
    isCommitting.value = true;
    shuffleStatus.value = "Committing changes to Spotify...";

    // Use the reorderPlaylistTracks method to apply each move
    let snapshotId = playlist.value.snapshot_id;
    for (const move of trackMoves.value) {
      snapshotId = (await spotifyApiService.reorderPlaylistTracks(
          playlist.value.id,
          move.from,
          move.to, 1, snapshotId
      )).snapshot_id;
    }

    // Update the original tracks to match the shuffled tracks
    originalTracks.value = [...shuffledTracks.value];

    // Clear the playlist store cache to force a refresh on next load
    // playlistStore.clearTracks(playlist.value.id);
    playlistStore.playlistTracks[playlist.value.id] = originalTracks.value;

    shuffleStatus.value = "Changes committed successfully!";

    // Reset shuffle state
    isShuffled.value = false;
    trackMoves.value = [];
  } catch (err) {
    handleError(err);
    shuffleStatus.value = "Error committing changes.";
  } finally {
    isCommitting.value = false;
  }
}

/**
 * Discards the shuffled playlist and reverts to the original
 */
function discardShuffledPlaylist() {
  if (!isShuffled.value || isCommitting.value) return;

  // Reset shuffle state
  isShuffled.value = false;
  shuffledTracks.value = [];
  originalTracks.value = [];
  trackMoves.value = [];
  shuffleStatus.value = null;
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

.track-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  margin-right: 10px;
  color: var(--color-textSecondary);
  font-size: 14px;
}

.track-info-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.track-info-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 150px;
}

.track-info-left h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: var(--color-textPrimary);
}

.track-info-left p, .track-info-right p {
  margin: 0;
  font-size: 14px;
  color: var(--color-textSecondary);
}

.track-duration {
  color: var(--color-textSecondary);
  font-size: 12px;
  margin-bottom: 5px !important;
}

.added-by {
  font-size: 12px !important;
  color: var(--color-textSecondary) !important;
  display: flex;
  align-items: center;
  justify-content: flex-end;
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

.tracks-info {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 10px;
  padding: 5px 10px;
  color: var(--color-textSecondary);
  font-size: 14px;
}

.loading-trigger {
  padding: 20px;
  text-align: center;
}

.loading-indicator {
  display: inline-block;
  padding: 10px 20px;
  background-color: var(--color-surface);
  border-radius: 20px;
  color: var(--color-textSecondary);
  font-size: 14px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
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

/* Playtime Shuffle styles */
.shuffle-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.shuffle-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-start;
  margin-bottom: 10px;
}

.shuffle-button, .commit-button, .discard-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.shuffle-button {
  background-color: var(--color-accent);
  color: var(--color-textPrimary);
}

.shuffle-button:hover {
  background-color: var(--color-gradientStart);
}

.commit-button {
  background-color: #1DB954; /* Spotify green */
  color: white;
}

.commit-button:hover:not(:disabled) {
  background-color: #1ED760;
}

.discard-button {
  background-color: #E74C3C; /* Red */
  color: white;
}

.discard-button:hover:not(:disabled) {
  background-color: #FF5E52;
}

.commit-button:disabled, .discard-button:disabled {
  background-color: var(--color-surface);
  color: var(--color-textSecondary);
  cursor: not-allowed;
}

.shuffling-indicator {
  padding: 10px 20px;
  background-color: var(--color-surface);
  border-radius: 4px;
  color: var(--color-textSecondary);
  animation: pulse 1.5s infinite;
}

.shuffle-status {
  padding: 10px;
  background-color: var(--color-surface);
  border-radius: 4px;
  color: var(--color-textPrimary);
  margin-bottom: 10px;
}
</style>
