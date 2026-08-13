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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            icons: ['@phosphor-icons/react'],
            markdown: ['react-markdown'],
            storage: ['dexie', 'dexie-react-hooks'],
            ui: [
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
            ],
            vendor: [
              '@dnd-kit/core',
              '@dnd-kit/sortable',
              '@dnd-kit/utilities',
              'class-variance-authority',
              'clsx',
              'jszip',
              'react-error-boundary',
              'sonner',
              'tailwind-merge',
              'zod',
              'zustand',
            ],
          },
        },
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
