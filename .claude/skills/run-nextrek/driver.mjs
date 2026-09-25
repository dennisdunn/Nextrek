// Headless-Chromium driver for Subspace Wumpus (see SKILL.md in this
// directory). Assumes the dev server is already running - see SKILL.md's
// "Run (agent path)" section for how to start it.
//
// Usage: node .claude/skills/run-nextrek/driver.mjs [outDir] [port]
//   outDir defaults to .claude/skills/run-nextrek/screenshots
//   port   defaults to 5193
//
// This environment provides Playwright globally rather than as a project
// dependency (the project itself has no playwright devDependency) - see
// SKILL.md's Gotchas for what to do if that global install isn't present.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'

const outDir = process.argv[2] ?? new URL('./screenshots', import.meta.url).pathname
const port = process.argv[3] ?? '5193'
mkdirSync(outDir, { recursive: true })

function log(msg) {
  console.log(`[driver] ${msg}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${outDir}/01-start-screen.png` })
  log('start screen rendered')

  // The one real user flow: pick Normal, confirm the hunt-phase HUD comes
  // up with the expected starting stats, then confirm the Sciences map
  // (the default station) actually rendered a sector diamond.
  await page.click('.start-screen__option--normal')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outDir}/02-hunt-phase.png` })

  const reserve = await page.locator('.panel--engineering .stat-grid .stat').nth(0).locator('.stat__value').textContent()
  const quota = await page.locator('.stat-grid .stat').nth(3).locator('.stat__value').textContent()
  const sectorCount = await page.locator('.galaxy-map__svg path.sector').count()
  log(`reserve power: ${reserve} (expect 1000 for Normal)`)
  log(`hostiles-destroyed/quota readout: ${quota} (expect 0 / 15 for Normal)`)
  log(`sciences map shapes rendered: ${sectorCount}`)

  if (errors.length > 0) {
    log(`CONSOLE ERRORS:\n${errors.join('\n')}`)
    process.exitCode = 1
  } else {
    log('no console errors')
  }

  await browser.close()
}

main()
