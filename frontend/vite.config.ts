import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createServerConfig } from './src/api/server-config';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const server = createServerConfig(env.VITE_API_BASE_URL);
  const dev = command === 'serve';
  const csp = [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${new URL(server.apiUrl).origin}`,
    `connect-src 'self' ${server.apiUrl} ${new URL(server.websocketUrl).origin}${dev ? ' ws://localhost:5173' : ''}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'none'"
  ].join('; ');
  return {
    base: './',
    plugins: [react(), {
      name: 'desktop-content-security-policy',
      transformIndexHtml: {
        order: 'post',
        handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }]
      }
    }],
    server: { host: 'localhost', port: 5173, strictPort: true },
    preview: { host: 'localhost', port: 5173, strictPort: true }
  };
});
