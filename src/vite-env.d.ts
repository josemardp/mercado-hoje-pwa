/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_BASE: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_MH_SECRET_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
