import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import babel from '@rolldown/plugin-babel'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    watch: {
      ignored: ['!**/node_modules/@pjm/shared/**']
    }
  },
  resolve: {
    alias: {
      '@mediapipe/hands': path.resolve(__dirname, './src/mock-mediapipe.ts')
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
  }
})