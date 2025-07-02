<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <div class="flex flex-col items-center justify-center p-4 py-16">
    <div class="max-w-md w-full flex flex-col items-center">
      <!-- App Title -->
      <h1 class="text-4xl font-bold text-textPrimary mb-8 text-center">Playtime Aware Playlist Shuffle</h1>

      <div v-if="authStore.isAuthenticated">
        <!-- User is logged in -->
        <p class="text-textPrimary mb-4">You are logged in to Spotify</p>
        <div class="flex flex-col gap-4 mb-4">
          <router-link 
            to="/playlists"
            class="bg-accent hover:bg-gradientStart text-textPrimary font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105 text-center"
          >
            Manage Playlists
          </router-link>
          <button 
            @click="authStore.logout"
            class="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105"
          >
            Logout from Spotify
          </button>
        </div>
      </div>
      <div v-else>
        <!-- User is not logged in -->
        <button 
          @click="authStore.login"
          class="bg-accent hover:bg-gradientStart text-textPrimary font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105"
          :disabled="authStore.isAuthenticating"
        >
          {{ authStore.isAuthenticating ? 'Connecting...' : 'Login to Spotify' }}
        </button>
      </div>
    </div>
  </div>
</template>
