import { defineConfig } from 'vitest/config'

// Standalone config for src/__balanceSim.test.ts (see its header comment) -
// a manual difficulty-tuning tool, not a real test, so it's excluded from
// the default suite in vite.config.ts and run on purpose instead:
// npm run sim:balance
export default defineConfig({
  test: {
    include: ['src/__balanceSim.test.ts'],
    testTimeout: 120_000,
  },
})
