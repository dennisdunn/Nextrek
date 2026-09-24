export interface Rect {
  x: number
  y: number
}

export interface Polar {
  r: number
  theta: number
}

export interface BoundingArc {
  inner: Polar
  outer: Polar
}
