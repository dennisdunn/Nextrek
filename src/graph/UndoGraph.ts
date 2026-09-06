export type NodeId = string

export interface Edge<E = unknown> {
  from: NodeId
  to: NodeId
  data?: E
}

export type UndoFn = () => void

/**
 * A graph whose node set and edge set are each a stack of snapshots rather
 * than a single mutable list. Getters read the top of the stack (current
 * configuration). Every mutation pushes a new snapshot and, in lockstep,
 * pushes the inverse operation onto a shared undo stack so Undo() can pop
 * back to the previous configuration.
 *
 * This is the mechanism behind warp drive (push a fast toroidal edge-set,
 * Undo() to fall back to normal space) and subspace anomalies (chambers,
 * wells, conduits, gates) - see anomalies.ts.
 */
export class UndoGraph<N = unknown, E = unknown> {
  private nodeStack: ReadonlyMap<NodeId, N>[]
  private edgeStack: ReadonlyArray<Edge<E>>[]
  private undoStack: UndoFn[] = []

  constructor(
    initialNodes: Iterable<readonly [NodeId, N]> = [],
    initialEdges: Iterable<Edge<E>> = [],
  ) {
    this.nodeStack = [new Map(initialNodes)]
    this.edgeStack = [[...initialEdges]]
  }

  get nodes(): ReadonlyMap<NodeId, N> {
    return this.nodeStack[this.nodeStack.length - 1]
  }

  get edges(): ReadonlyArray<Edge<E>> {
    return this.edgeStack[this.edgeStack.length - 1]
  }

  get undoDepth(): number {
    return this.undoStack.length
  }

  hasNode(id: NodeId): boolean {
    return this.nodes.has(id)
  }

  getNode(id: NodeId): N | undefined {
    return this.nodes.get(id)
  }

  /** Ids reachable by a single outgoing edge from `id`. */
  neighbors(id: NodeId): NodeId[] {
    return this.edges.filter((e) => e.from === id).map((e) => e.to)
  }

  outgoingEdges(id: NodeId): Edge<E>[] {
    return this.edges.filter((e) => e.from === id)
  }

  incomingEdges(id: NodeId): Edge<E>[] {
    return this.edges.filter((e) => e.to === id)
  }

  private pushNodeSnapshot(next: Map<NodeId, N>): void {
    this.nodeStack.push(next)
    this.undoStack.push(() => {
      this.nodeStack.pop()
    })
  }

  private pushEdgeSnapshot(next: Edge<E>[]): void {
    this.edgeStack.push(next)
    this.undoStack.push(() => {
      this.edgeStack.pop()
    })
  }

  /** Push an entirely new node set (e.g. spawning/removing many nodes at once). */
  replaceNodes(nodes: Iterable<readonly [NodeId, N]>): void {
    this.pushNodeSnapshot(new Map(nodes))
  }

  /** Push an entirely new edge set (e.g. engaging warp drive). */
  replaceEdges(edges: Iterable<Edge<E>>): void {
    this.pushEdgeSnapshot([...edges])
  }

  setNode(id: NodeId, data: N): void {
    const next = new Map(this.nodes)
    next.set(id, data)
    this.pushNodeSnapshot(next)
  }

  removeNode(id: NodeId): void {
    const next = new Map(this.nodes)
    next.delete(id)
    this.pushNodeSnapshot(next)
  }

  addEdge(edge: Edge<E>): void {
    this.pushEdgeSnapshot([...this.edges, edge])
  }

  removeEdges(predicate: (edge: Edge<E>) => boolean): void {
    this.pushEdgeSnapshot(this.edges.filter((e) => !predicate(e)))
  }

  /**
   * Run `mutator`, then collapse every undo entry it pushed into a single
   * entry so one Undo() call reverts the whole thing. Anomalies that touch
   * several edges at once (conduit, gate) are built on this.
   */
  transaction<T>(mutator: () => T): T {
    const startDepth = this.undoStack.length
    const result = mutator()
    const pushed = this.undoStack.length - startDepth
    if (pushed > 1) {
      const fns = this.undoStack.splice(startDepth, pushed)
      this.undoStack.push(() => {
        for (let i = fns.length - 1; i >= 0; i--) fns[i]()
      })
    }
    return result
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** Pop the undo stack and invoke it, reverting to the previous configuration. Returns false if there was nothing to undo. */
  undo(): boolean {
    const fn = this.undoStack.pop()
    if (!fn) return false
    fn()
    return true
  }
}
