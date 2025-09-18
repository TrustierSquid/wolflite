import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/formSubmission': 'http://localhost:5000',
      '/loginUser': 'http://localhost:5000',
      '/post': 'http://localhost:5000',
      '/uploadImg': 'http://localhost:5000',
      '/getUserData': 'http://localhost:5000',
      '/updateProfilePicture': 'http://localhost:5000',
      '/profileInfo': 'http://localhost:5000',
      '/addLike': 'http://localhost:5000'
    }
  },

  build: {
    rollupOptions: {
      input: {
        blog: 'blog.html',
        create: 'create.html'
      }
    }
  }
})
