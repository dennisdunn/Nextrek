import { describe, expect, it } from 'vitest'
import * as Convert from './convert'

const polarI = { r: 1, theta: Math.PI / 4 }
const polarII = { r: 1, theta: (Math.PI * 3) / 4 }
const polarIII = { r: 1, theta: (Math.PI * 5) / 4 }
const polarIV = { r: 1, theta: (Math.PI * 7) / 4 }

const rectI = { x: 0.70711, y: 0.70711 }
const rectII = { x: -0.70711, y: 0.70711 }
const rectIII = { x: -0.70711, y: -0.70711 }
const rectIV = { x: 0.70711, y: -0.70711 }

describe('polar2rect', () => {
  it('polar -> rect QI', () => {
    const a = Convert.polar2rect(polarI)
    expect(a.x).toBeCloseTo(rectI.x, 5)
    expect(a.y).toBeCloseTo(rectI.y, 5)
  })
  it('polar -> rect QII', () => {
    const a = Convert.polar2rect(polarII)
    expect(a.x).toBeCloseTo(rectII.x, 5)
    expect(a.y).toBeCloseTo(rectII.y, 5)
  })
  it('polar -> rect QIII', () => {
    const a = Convert.polar2rect(polarIII)
    expect(a.x).toBeCloseTo(rectIII.x, 5)
    expect(a.y).toBeCloseTo(rectIII.y, 5)
  })
  it('polar -> rect QIV', () => {
    const a = Convert.polar2rect(polarIV)
    expect(a.x).toBeCloseTo(rectIV.x, 5)
    expect(a.y).toBeCloseTo(rectIV.y, 5)
  })
})
