/// <reference types="vite/client" />

/**
 * Port the dev-server proxy sends `/api` to, injected by
 * `frontend/vite.config.ts` (from TUTORA_API_PORT / TUTORA_API_URL), so the UI can
 * tell the user where the API is expected when it is not reachable.
 */
interface ImportMetaEnv {
  readonly TUTORA_API_PORT: string;
}
