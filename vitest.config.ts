/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': resolve(projectRoot, 'src'),
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/**/*.{test,spec}.{ts,tsx}'],
		exclude: ['tests/e2e/**'],
		alias: {
			'@': resolve(projectRoot, 'src'),
		},
	},
});
