import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(process.env.ELECTRON === 'true'
        ? [
            electron({
              main: {
                entry: 'electron/main.ts',
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
      proxy: {
        '/api/igdb': 'http://localhost:3002',
        '/api/image': 'http://localhost:3001',
      },
    },
  };
});
