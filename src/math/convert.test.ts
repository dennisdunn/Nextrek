import { describe, expect, it } from 'vitest'
import * as Convert from './convert'
import type { Rect } from './types'
import Vector from './vector'

const polarPole = { r: 0, theta: 0 }
const polarI = { r: 1, theta: Math.PI / 4 }
const polarII = { r: 1, theta: (Math.PI * 3) / 4 }
const polarIII = { r: 1, theta: (Math.PI * 5) / 4 }
const polarIV = { r: 1, theta: (Math.PI * 7) / 4 }

const rectI = { x: 0.70711, y: 0.70711 }
const rectII = { x: -0.70711, y: 0.70711 }
const rectIII = { x: -0.70711, y: -0.70711 }
const rectIV = { x: 0.70711, y: -0.70711 }

const canvasBounds = { height: 200, width: 200 }
const canvasCenter = { x: 100, y: 100 }
const canvasI = { x: 200, y: 0 }
const canvasII = { x: 0, y: 0 }
const canvasIII = { x: 0, y: 200 }
const canvasIV = { x: 200, y: 200 }

function pointsClose(a: Rect, b: Rect) {
  expect(a.x).toBeCloseTo(b.x, 4)
  expect(a.y).toBeCloseTo(b.y, 4)
}

describe('convert coordinates', () => {
  it('polar -> rect QI', () => {
    const a = Convert.polar2rect(polarI)
    expect(a.x).toBeCloseTo(rectI.x, 5)
    expect(a.y).toBeCloseTo(rectI.y, 5)
  })
  it('rect -> polar QI', () => {
    const a = Convert.rect2polar(rectI)
    expect(a.r).toBeCloseTo(polarI.r, 5)
    expect(a.theta).toBeCloseTo(polarI.theta, 5)
  })
  it('polar -> rect QII', () => {
    const a = Convert.polar2rect(polarII)
    expect(a.x).toBeCloseTo(rectII.x, 5)
    expect(a.y).toBeCloseTo(rectII.y, 5)
  })
  it('rect -> polar QII', () => {
    const a = Convert.rect2polar(rectII)
    expect(a.r).toBeCloseTo(polarII.r, 5)
    expect(a.theta).toBeCloseTo(polarII.theta, 5)
  })
  it('polar -> rect QIII', () => {
    const a = Convert.polar2rect(polarIII)
    expect(a.x).toBeCloseTo(rectIII.x, 5)
    expect(a.y).toBeCloseTo(rectIII.y, 5)
  })
  it('rect -> polar QIII', () => {
    const a = Convert.rect2polar(rectIII)
    expect(a.r).toBeCloseTo(polarIII.r, 5)
    expect(a.theta).toBeCloseTo(polarIII.theta, 5)
  })
  it('polar -> rect QIV', () => {
    const a = Convert.polar2rect(polarIV)
    expect(a.x).toBeCloseTo(rectIV.x, 5)
    expect(a.y).toBeCloseTo(rectIV.y, 5)
  })
  it('rect -> polar QIV', () => {
    const a = Convert.rect2polar(rectIV)
    expect(a.r).toBeCloseTo(polarIV.r, 5)
    expect(a.theta).toBeCloseTo(polarIV.theta, 5)
  })
})

describe('polar vector ops', () => {
  it('translates from QI to QII', () => {
    const a = Vector.Polar.sum(polarI, { r: Math.SQRT2, theta: Math.PI })
    expect(a.r).toBeCloseTo(polarII.r, 5)
    expect(a.theta).toBeCloseTo(polarII.theta, 5)
  })
  it('scales', () => {
    const a = Vector.Polar.scale({ r: 2, theta: Math.PI }, 2)
    expect(a.r).toBe(4)
  })
  it('negates by rotating a half turn', () => {
    const a = Vector.Polar.negate({ r: 3, theta: 0 })
    expect(a.r).toBeCloseTo(3)
    expect(a.theta).toBeCloseTo(Math.PI)
  })
})

describe('canvas conversions', () => {
  it('canvas center -> pole', () => {
    const a = Convert.canvas2polar(canvasCenter, canvasBounds)
    expect(a.r).toBeCloseTo(0)
  })
  it('canvas I -> polar I', () => {
    const a = Convert.canvas2polar(canvasI, canvasBounds)
    expect(a.r).toBeCloseTo(Math.SQRT2)
    expect(a.theta).toBeCloseTo(Math.PI / 4)
  })
  it('canvas II -> polar II', () => {
    const a = Convert.canvas2polar(canvasII, canvasBounds)
    expect(a.r).toBeCloseTo(Math.SQRT2)
    expect(a.theta).toBeCloseTo((Math.PI * 3) / 4)
  })
  it('canvas III -> polar III', () => {
    const a = Convert.canvas2polar(canvasIII, canvasBounds)
    expect(a.r).toBeCloseTo(Math.SQRT2)
    expect(a.theta).toBeCloseTo((Math.PI * 5) / 4)
  })
  it('canvas IV -> polar IV', () => {
    const a = Convert.canvas2polar(canvasIV, canvasBounds)
    expect(a.r).toBeCloseTo(Math.SQRT2)
    expect(a.theta).toBeCloseTo((Math.PI * 7) / 4)
  })
  it('pole -> canvas center', () => {
    const a = Convert.polar2canvas(polarPole, canvasBounds)
    pointsClose(a, canvasCenter)
  })
  it('polar I -> canvas I', () => {
    const a = Convert.polar2canvas(Vector.Polar.scale(polarI, Math.SQRT2), canvasBounds)
    pointsClose(a, canvasI)
  })
  it('polar II -> canvas II', () => {
    const a = Convert.polar2canvas(Vector.Polar.scale(polarII, Math.SQRT2), canvasBounds)
    pointsClose(a, canvasII)
  })
  it('polar III -> canvas III', () => {
    const a = Convert.polar2canvas(Vector.Polar.scale(polarIII, Math.SQRT2), canvasBounds)
    pointsClose(a, canvasIII)
  })
  it('polar IV -> canvas IV', () => {
    const a = Convert.polar2canvas(Vector.Polar.scale(polarIV, Math.SQRT2), canvasBounds)
    pointsClose(a, canvasIV)
  })
})
