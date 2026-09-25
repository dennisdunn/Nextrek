import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://dennisdunn.github.io/Nextrek/ on GitHub Pages, not
  // the domain root - GITHUB_ACTIONS is set automatically by the deploy
  // workflow, so local dev/preview still run at "/".
  base: process.env.GITHUB_ACTIONS ? '/Nextrek/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Subspace Wumpus',
        short_name: 'Wumpus',
        description: 'Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC Star Trek',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    // __balanceSim.test.ts is a manual difficulty-tuning tool, not a real
    // test (no assertions, ~20s runtime) - keep it out of the default
    // suite/CI run. Invoke it on purpose: npm run sim:balance
    // (vitest.sim.config.ts), which points at just that file.
    exclude: [...configDefaults.exclude, 'src/__balanceSim.test.ts'],
  },
})
