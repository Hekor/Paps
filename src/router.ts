import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';
import Home from './components/Home.vue';
import Callback from './components/Callback.vue';
import PlaylistManager from './components/PlaylistManager.vue';
import PlaylistDetail from './components/PlaylistDetail.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/callback',
    name: 'Callback',
    component: Callback
  },
  {
    path: '/playlists',
    name: 'PlaylistManager',
    component: PlaylistManager,
    meta: { requiresAuth: true }
  },
  {
    path: '/playlist/:id',
    name: 'PlaylistDetail',
    component: PlaylistDetail,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard to check authentication for protected routes
import { useAuthStore } from './stores/auth';

router.beforeEach((to, _, next) => {
  const authStore = useAuthStore();

  // Check if the route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // If not authenticated, redirect to home page
    next({ name: 'Home' });
  } else {
    // Otherwise proceed normally
    next();
  }
});

export default router;
