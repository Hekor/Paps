# Playtime Aware Playlist Shuffle

This application helps you shuffle your Spotify playlists based on playtime awareness. It uses the Spotify Web API with Authorization Code Flow with PKCE for secure authentication.

## Features

- Secure Spotify authentication using Authorization Code Flow with PKCE
- User login/logout functionality
- Token management (access token, refresh token)
- Responsive UI with Tailwind CSS

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Spotify Developer account

### Spotify API Configuration

1. Create a Spotify Developer account at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new app in the Spotify Developer Dashboard
3. Get your Client ID from the app settings
4. Add `http://localhost:5173/callback` to the Redirect URIs in your app settings
5. Copy your Client ID to the `.env` file:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`

## Development

This project is built with:
- Vue 3 with Composition API and `<script setup>`
- TypeScript
- Vite as the build tool
- Pinia for state management
- Vue Router for routing
- Tailwind CSS for styling

### Authentication Flow

The application implements the Authorization Code Flow with PKCE (Proof Key for Code Exchange) as recommended by Spotify for client-side applications. This flow consists of the following steps:

1. Generate a code verifier and code challenge
2. Redirect the user to the Spotify authorization page
3. Handle the callback with the authorization code
4. Exchange the code for access and refresh tokens
5. Use the access token for API calls
6. Refresh the token when it expires

The authentication logic is implemented in the auth store (`src/stores/auth.ts`).

## Favicon Setup

To create the favicon for the application:

1. Make a copy of `public/logo.png` and name it `public/favicon.png`
2. Resize the `favicon.png` to 32x32 pixels while maintaining the aspect ratio
3. The application is already configured to use this file as the favicon in `index.html`
