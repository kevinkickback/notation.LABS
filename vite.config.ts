import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { resolve } from 'node:path';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, projectRoot, 'TWITCH_');

	return {
		plugins: [
			react(),
			tailwindcss(),
			electron({
				main: {
					entry: 'electron/main.ts',
					vite: {
						define: {
							'process.env.TWITCH_CLIENT_ID': JSON.stringify(
								env.TWITCH_CLIENT_ID || '',
							),
							'process.env.TWITCH_CLIENT_SECRET': JSON.stringify(
								env.TWITCH_CLIENT_SECRET || '',
							),
						},
					},
				},
				preload: {
					input: 'electron/preload.ts',
				},
			}),
		],
		resolve: {
			alias: {
				'@': resolve(projectRoot, 'src'),
			},
		},
	};
});
