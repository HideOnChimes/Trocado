import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento o site roda na 5173 e repassa /api para o servidor local na 3333.
// Em uso normal o próprio servidor entrega o site já gerado (web/dist).
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3333' } },
})
