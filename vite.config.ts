import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  test: {
    // Integration tests in tests/ need the non-VITE_ secret too.
    env: loadEnv(mode, process.cwd(), ''),
    // They talk to the hosted project; an Edge Function cold start alone can take a few seconds.
    testTimeout: 20_000,
  },
}))
