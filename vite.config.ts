// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // ← importante

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),           // ← este plugin hace la magia
  ],
})