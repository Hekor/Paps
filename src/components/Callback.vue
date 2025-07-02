<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const error = ref<string | null>(null);
const processing = ref(true);

onMounted(async () => {
  // Get the authorization code from URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const errorParam = urlParams.get('error');

  if (errorParam) {
    error.value = `Authentication failed: ${errorParam}`;
    processing.value = false;
    return;
  }

  if (!code) {
    error.value = 'No authorization code found in the URL';
    processing.value = false;
    return;
  }

  try {
    // Exchange the code for tokens
    const success = await authStore.handleCallback(code);
    
    if (success) {
      // Redirect to home page or dashboard
      router.push('/');
    } else {
      error.value = 'Failed to exchange authorization code for tokens';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
  } finally {
    processing.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-background p-4">
    <div class="max-w-md w-full flex flex-col items-center">
      <h1 class="text-2xl font-bold text-textPrimary mb-4">Spotify Authentication</h1>
      
      <div v-if="processing" class="text-center">
        <p class="text-textPrimary mb-4">Processing authentication...</p>
        <!-- You can add a loading spinner here -->
      </div>
      
      <div v-else-if="error" class="text-center">
        <p class="text-red-500 mb-4">{{ error }}</p>
        <button 
          @click="router.push('/')"
          class="bg-accent hover:bg-gradientStart text-textPrimary font-bold py-2 px-4 rounded-full"
        >
          Return to Home
        </button>
      </div>
      
      <div v-else class="text-center">
        <p class="text-green-500 mb-4">Authentication successful!</p>
        <p class="text-textPrimary mb-4">Redirecting to home page...</p>
      </div>
    </div>
  </div>
</template>