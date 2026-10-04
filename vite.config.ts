import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron/simple';
import packageJson from './package.json';
import { bundleLicenseNotices } from './scripts/bundle-license-notices.mjs';
import { DEPLOYED_ENDPOINTS } from './src/lib/providers/endpoints';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, [
    'NOTATION_',
    'VITE_USE_LOCAL_PROVIDERS',
  ]);
  const localProviders = env.VITE_USE_LOCAL_PROVIDERS === 'true';
  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      bundleLicenseNotices(),
      ...(process.env.ELECTRON === 'true'
        ? [
            electron({
              main: {
                entry: 'electron/main.ts',
                vite: { plugins: [bundleLicenseNotices()] },
              },
              preload: {
                input: 'electron/preload.ts',
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src'),
      },
    },
    server: {
      // Packaged validation profiles contain locked databases and generated files.
      watch: {
        ignored: ['**/.tmp/**', '**/release/**', '**/dist-electron/**'],
      },
      proxy: {
        '/api/igdb': {
          target:
            env.NOTATION_IGDB_PROXY_TARGET ||
            (localProviders
              ? 'http://localhost:3002'
              : DEPLOYED_ENDPOINTS.igdb),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/igdb/, ''),
        },
        '/api/image': {
          target: env.NOTATION_IMAGE_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/image/, ''),
        },
      },
    },
  };
});
