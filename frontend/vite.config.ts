import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // GitHub Pages serves this project site from https://saffhrin.github.io/tutora/,
  // so the production build must emit /tutora/assets/... . Local dev, preview and
  // the tests keep "/". The deploy workflow sets VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
  preview: { proxy: { '/api': 'http://localhost:8000' } },
  build: { outDir: 'dist', emptyOutDir: true },
});