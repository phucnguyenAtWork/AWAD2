import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@services': fileURLToPath(new URL('./src/services', import.meta.url)),
			'@types': fileURLToPath(new URL('./src/types', import.meta.url)),
			'@components': fileURLToPath(new URL('./src/components', import.meta.url)),
			'@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		open: false,
		proxy: {
			// Forward API calls to the gateway during local dev
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
