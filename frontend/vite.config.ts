import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const DEFAULT_API_PORT = 8000;
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_HOST = '127.0.0.1';

const uiRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('..', import.meta.url)); // .env lives here

function asPort(value: string | undefined, fallback: number) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, projectRoot, '');
  const read = (...names: string[]) =>
    names.map((name) => process.env[name] ?? env[name]).find((value) => value != null && value !== '');

  // Another project on 8000 must not break the page: scripts/dev.sh passes the free
  // API port it found, and an explicit TUTORA_API_URL wins over the port entirely.
  const apiPort = asPort(read('TUTORA_API_PORT'), DEFAULT_API_PORT);
  const apiTarget = read('TUTORA_API_URL') ?? `http://${DEFAULT_HOST}:${apiPort}`;
  const webPort = asPort(read('TUTORA_WEB_PORT', 'PORT'), DEFAULT_WEB_PORT);

  return {
    root: uiRoot,
    plugins: [react()],
    // Used by the "API is not reachable" banner so it names the right port. Defined on
    // import.meta.env (not a bare identifier) because Vite replaces those in dev too.
    define: { 'import.meta.env.TUTORA_API_PORT': JSON.stringify(String(apiPort)) },
    server: {
      port: webPort,
      // Vite already takes the next free port when this one is busy; say so explicitly
      // so a second project on 5173 cannot stop the dev server from starting.
      strictPort: Boolean(read('TUTORA_STRICT_PORT')),
      proxy: { '/api': apiTarget },
    },
    preview: {
      port: webPort,
      strictPort: false,
      proxy: { '/api': apiTarget },
    },
    build: { outDir: 'dist', emptyOutDir: true },
  };
});