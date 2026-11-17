import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// Flask dev server. Every API route and /static (uploads, images) is proxied here
// so the browser only ever talks to the Vite dev server (same origin, cookies work).
// Override with the FLASK_URL environment variable if Flask runs elsewhere (e.g. port 5000 is taken).
const FLASK_DEV_SERVER = process.env.FLASK_URL || 'http://localhost:5000'

const proxiedPaths = [
  '/formSubmission',
  '/loginUser',
  '/logout',
  '/getUserData',
  '/post',
  '/profileInfo',
  '/dens', // API only; the /den page itself is served by Vite
  '/notifications',
  '/search',
  '/dm', // direct messages API; the /messages page itself is served by Vite
  '/upload', // chunked uploads (big videos)
  '/static',
]

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],

  // Production build is served by Flask from /static/dist/, dev server serves from /
  base: command === 'build' ? '/static/dist/' : '/',

  server: {
    proxy: Object.fromEntries(proxiedPaths.map((path) => [path, FLASK_DEV_SERVER])),
  },

  build: {
    outDir: '../../server/static/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
        blog: 'blog.html',
        create: 'create.html',
        profile: 'profile.html',
        settings: 'settings.html',
        den: 'den.html',
        messages: 'messages.html'
      }
    }
  }
}))
