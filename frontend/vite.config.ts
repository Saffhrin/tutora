import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';
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

/** "0", "false", "no", "off" and "" all mean off — "0" is a truthy string in JS. */
function asFlag(value: string | undefined) {
  return value != null && !['', '0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function portOf(url: string, fallback: number) {
  try {
    const parsed = new URL(url);
    // A URL without an explicit port still has one: 80 for http, 443 for https.
    return asPort(parsed.port, parsed.protocol === 'https:' ? 443 : 80);
  } catch {
    return fallback;
  }
}

/**
 * http-proxy prepends the target path, it does not replace the matched prefix:
 * target `http://host:8001/prefix` + `/api/health` becomes `/prefix/api/health`.
 * The probe has to follow the same rule or it would warn about a healthy proxy.
 */
function healthUrl(target: string) {
  const base = target.endsWith('/') ? target : `${target}/`;
  return new URL('api/health', base).toString();
}

/**
 * Say out loud what /api points at. Another project listening on the default port
 * would otherwise answer the proxy silently and the UI would show foreign data.
 */
function apiHealthCheck(target: string): Plugin {
  return {
    name: 'tutora-api-health',
    apply: 'serve',
    configureServer() {
      let url: string;
      try {
        url = healthUrl(target);
      } catch {
        console.warn(
          `\n  ⚠  TUTORA_API_URL (${target}) is not a URL the dev server can probe.` +
          `\n     /api is still proxied to it, but check the value.\n`,
        );
        return;
      }
      const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(2000) : undefined;
      fetch(url, signal ? { signal } : undefined)
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (response.ok && body?.status === 'ok') {
            console.log(`  ➜  Tutora API:  ${target}  (health ok, proxying /api here)`);
            return;
          }
          console.warn(
            `\n  ⚠  ${target} answered /api/health, but not like the Tutora API.` +
            `\n     Another project probably owns that port: stop it, or set TUTORA_API_PORT` +
            `\n     to the port this API really listens on (./scripts/dev.sh picks free ports).\n`,
          );
        })
        .catch(() => {
          console.warn(
            `\n  ⚠  No Tutora API on ${target} yet. Start it with: python -m backend.main` +
            `\n     (it skips busy ports — if it moves, set TUTORA_API_PORT to the port it prints).\n`,
          );
        });
    },
  };
}

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, projectRoot, '');
  const read = (...names: string[]) =>
    names.map((name) => process.env[name] ?? env[name]).find((value) => value != null && value !== '');

  // Another project on 8000 must not break the page: scripts/dev.sh passes the free
  // API port it found, and an explicit TUTORA_API_URL wins over the port entirely.
  const apiUrl = read('TUTORA_API_URL');
  const apiPort = apiUrl
    ? portOf(apiUrl, DEFAULT_API_PORT)
    : asPort(read('TUTORA_API_PORT'), DEFAULT_API_PORT);
  const apiTarget = apiUrl ?? `http://${DEFAULT_HOST}:${apiPort}`;
  const webPort = asPort(read('TUTORA_WEB_PORT', 'PORT'), DEFAULT_WEB_PORT);

  return {
    root: uiRoot,
    plugins: [react(), apiHealthCheck(apiTarget)],
    // Used by the "API is not reachable" banner so it names the port /api really goes to.
    // Defined on import.meta.env (not a bare identifier) because Vite replaces those in dev.
    define: { 'import.meta.env.TUTORA_API_PORT': JSON.stringify(String(apiPort)) },
    server: {
      port: webPort,
      // Vite already takes the next free port when this one is busy; say so explicitly
      // so a second project on 5173 cannot stop the dev server from starting.
      strictPort: asFlag(read('TUTORA_STRICT_PORT')),
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
