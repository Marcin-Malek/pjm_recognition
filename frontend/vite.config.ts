import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import babel from '@rolldown/plugin-babel'

// Nowoczesny sposób na zdobycie "bezwzględnej ścieżki" w ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      '@mediapipe/hands': path.resolve(__dirname, './src/mock-mediapipe.ts')
    }
  }
})
