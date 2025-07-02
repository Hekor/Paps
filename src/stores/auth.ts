import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  // State
  const accessToken = ref<string | null>(localStorage.getItem('access_token'));
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'));
  const expiresAt = ref<number>(Number(localStorage.getItem('expires_at')) || 0);
  const isAuthenticating = ref(false);

  // Getters
  const isAuthenticated = computed(() => {
    return !!accessToken.value && Date.now() < expiresAt.value;
  });

  // Code verifier generation
  const generateRandomString = (length: number): string => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  // SHA-256 hashing
  const sha256 = async (plain: string): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  // Base64 encoding
  const base64encode = (input: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  // Login function
  const login = async () => {
    isAuthenticating.value = true;
    
    try {
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
      
      if (!clientId || !redirectUri) {
        throw new Error('Missing Spotify client ID or redirect URI in environment variables');
      }
      
      // Generate code verifier
      const codeVerifier = generateRandomString(64);
      localStorage.setItem('code_verifier', codeVerifier);
      
      // Generate code challenge
      const hashed = await sha256(codeVerifier);
      const codeChallenge = base64encode(hashed);
      
      // Define scopes
      const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
      
      // Build authorization URL
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      const params = {
        response_type: 'code',
        client_id: clientId,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
      };
      
      authUrl.search = new URLSearchParams(params).toString();
      
      // Redirect to Spotify authorization page
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Login error:', error);
      isAuthenticating.value = false;
    }
  };

  // Handle callback from Spotify
  const handleCallback = async (code: string) => {
    isAuthenticating.value = true;
    
    try {
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
      const codeVerifier = localStorage.getItem('code_verifier');
      
      if (!clientId || !redirectUri || !codeVerifier) {
        throw new Error('Missing required parameters for token exchange');
      }
      
      // Exchange code for tokens
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store tokens
      accessToken.value = data.access_token;
      refreshToken.value = data.refresh_token;
      expiresAt.value = Date.now() + data.expires_in * 1000;
      
      // Save to localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('expires_at', expiresAt.value.toString());
      
      // Clean up code verifier
      localStorage.removeItem('code_verifier');
      
      return true;
    } catch (error) {
      console.error('Token exchange error:', error);
      return false;
    } finally {
      isAuthenticating.value = false;
    }
  };

  // Refresh token
  const refreshAccessToken = async () => {
    if (!refreshToken.value) {
      return false;
    }
    
    try {
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken.value,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update tokens
      accessToken.value = data.access_token;
      expiresAt.value = Date.now() + data.expires_in * 1000;
      
      // If a new refresh token is provided, update it
      if (data.refresh_token) {
        refreshToken.value = data.refresh_token;
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      
      // Save to localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('expires_at', expiresAt.value.toString());
      
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    accessToken.value = null;
    refreshToken.value = null;
    expiresAt.value = 0;
    
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('code_verifier');
  };

  return {
    accessToken,
    isAuthenticated,
    isAuthenticating,
    login,
    handleCallback,
    refreshAccessToken,
    logout,
  };
});