import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
        "@components": "/src/components",
        "@data": "/src/data",
        "@leaflet": "/src/leaflet",
    }
  }
})
