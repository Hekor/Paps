<template>
  <button 
    class="spotify-button"
    @click="openSpotifyUrl"
  >
    <img src="/spotify-icon-black.svg" alt="Spotify" class="spotify-icon" />
    Open in Spotify
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  url: string;
  stopPropagation?: boolean;
}>();

function openSpotifyUrl(event: Event) {
  if (props.stopPropagation) {
    event.stopPropagation();
  }
  window.open(props.url, '_blank');
}
</script>

<style scoped>
.spotify-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 10px;
  padding: 4px 8px;
  background-color: #1ED760;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.spotify-button:hover {
  background-color: #1DB954;
}

.spotify-icon {
  width: 12px;
  height: 12px;
}
</style>
