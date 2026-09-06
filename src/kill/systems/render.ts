import { query } from 'bitecs'
import type { KillWorld } from '../world'

const TWO_PI = Math.PI * 2

/** Draw every positioned entity as a heading-oriented triangle onto a 2D canvas. */
export function renderSystem(world: KillWorld, ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height)
  const { Position, Heading, Radius, Player, Hostile, Weapon } = world.components

  for (const eid of query(world, [Position, Radius])) {
    const x = Position.x[eid]
    const y = Position.y[eid]
    const r = Radius[eid]
    const heading = Heading[eid] ?? 0

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((heading * Math.PI) / 180)

    if (Weapon[eid]) {
      ctx.fillStyle = '#8ce8ff'
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, TWO_PI)
      ctx.fill()
    } else {
      ctx.strokeStyle = Player[eid] ? '#8cffb0' : Hostile[eid] ? '#ff6b6b' : '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -r)
      ctx.lineTo(r * 0.7, r)
      ctx.lineTo(-r * 0.7, r)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }
}
