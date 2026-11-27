// The admin runs as Vite's dev server on 127.0.0.1: Svelte for the UI, server/api.js for the repository.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { api } from './server/api.js';

export default defineConfig({
  plugins: [svelte(), api()],
  server: { host: '127.0.0.1', port: 5178, open: !process.env.CI },
});
