export interface Rect {
  x: number
  y: number
}

export interface Polar {
  r: number
  theta: number
}

export interface Bounds {
  width: number
  height: number
}

export interface BoundingBox {
  lowerLeft: Rect
  upperRight: Rect
}

export interface BoundingArc {
  inner: Polar
  outer: Polar
}

export interface BoundingCircle {
  center: Polar
  radius: number
}
