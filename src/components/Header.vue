<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { spotifyApiService } from '../services/spotify';

const authStore = useAuthStore();
const router = useRouter();
const username = ref<string | null>(null);
const loading = ref(false);

// Fetch the current user's profile when the component is mounted
onMounted(async () => {
  if (authStore.isAuthenticated) {
    try {
      loading.value = true;
      const user = await spotifyApiService.getCurrentUser();
      username.value = user.display_name;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      loading.value = false;
    }
  }
});

// Handle logout
const handleLogout = () => {
  authStore.logout();
  router.push('/');
};
</script>

<template>
  <header class="bg-surface shadow-md">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between">
      <!-- Logo and App Name -->
      <div class="flex items-center">
        <router-link to="/" class="flex items-center">
          <img src="/logo.png" alt="PAPS Logo" class="h-10 w-auto mr-3" />
          <span class="text-2xl font-bold text-textPrimary">PAPS</span>
          <span class="text-sm text-textSecondary mx-2">powered by</span>
          <img src="/spotify-logo-green.svg" alt="Spotify" class="h-6 w-auto" />
        </router-link>
      </div>

      <!-- Navigation Links -->
      <nav class="hidden md:flex items-center space-x-6">
        <router-link 
          to="/" 
          class="text-textPrimary hover:text-accent transition-colors duration-200"
        >
          Home
        </router-link>
        <router-link 
          v-if="authStore.isAuthenticated" 
          to="/playlists" 
          class="text-textPrimary hover:text-accent transition-colors duration-200"
        >
          Playlists
        </router-link>
      </nav>

      <!-- User Info and Logout -->
      <div class="flex items-center">
        <template v-if="authStore.isAuthenticated">
          <div v-if="loading" class="text-textSecondary mr-4">Loading...</div>
          <div v-else-if="username" class="text-textPrimary mr-4">{{ username }}</div>
          <button 
            @click="handleLogout" 
            class="bg-accent hover:bg-gradientStart text-textPrimary px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200"
          >
            Logout
          </button>
        </template>
        <button 
          v-else 
          @click="authStore.login" 
          class="bg-accent hover:bg-gradientStart text-textPrimary px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200"
          :disabled="authStore.isAuthenticating"
        >
          {{ authStore.isAuthenticating ? 'Connecting...' : 'Login' }}
        </button>
      </div>
    </div>
  </header>
</template>
