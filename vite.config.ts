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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Subspace Wumpus',
        short_name: 'Wumpus',
        description: 'Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC Star Trek',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          // PNGs alongside the SVG - iOS's "Add to Home Screen" doesn't read
          // the manifest at all (see index.html's apple-touch-icon link),
          // but Android/desktop PWA installability checks specifically want
          // 192/512 PNGs rather than trusting the SVG's "any" size alone.
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
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
