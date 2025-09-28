import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: '/static/dist/', /* Comment out if you are working on vite dev server */
  server: {
    proxy: {
      '/formSubmission': 'http://localhost:5000',
      '/loginUser': 'http://localhost:5000',
      '/post': 'http://localhost:5000',
      '/uploadImg': 'http://localhost:5000',
      '/getUserData': 'http://localhost:5000',
      '/updateProfilePicture': 'http://localhost:5000',
      '/profileInfo': 'http://localhost:5000',
      '/addLike': 'http://localhost:5000',
      '/addComment': 'http://localhost:5000',
      '/postComment': 'http://localhost:5000'
    }
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
      }
    }
  }
})
