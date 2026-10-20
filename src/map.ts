export type RouteNodeKind = 'start' | 'monster' | 'boss'

export interface RouteMapNode {
  id: string
  kind: RouteNodeKind
  layer: number
  slot: number
  x: number
  y: number
  monsterId?: string
}

export interface RouteMapEdge {
  from: string
  to: string
}

export interface RouteMap {
  seed: number
  nodes: RouteMapNode[]
  edges: RouteMapEdge[]
}

export interface MapRun {
  route: RouteMap
  completedNodeIds: string[]
}

function createRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function lanePositions(count: number, random: () => number) {
  if (count === 1) return [50 + Math.round((random() - .5) * 8)]
  const spread = 24 + Math.round(random() * 7)
  return Array.from({ length: count }, (_, index) => 50 - spread + (index * spread * 2) / (count - 1))
}

/** Creates a 3-2-3-1 route. The same seed, monster ids and boss id always produce the same route. */
export function generateRouteMap(seed: number, monsterIds: string[], bossId = monsterIds[monsterIds.length - 1]): RouteMap {
  const random = createRandom(seed)
  const pool = shuffle(monsterIds.filter(id => id !== bossId), random)
  const fallbackPool = pool.length ? pool : shuffle(monsterIds, random)
  const layers = [3, 2, 3].map(count => Array.from({ length: count }, () => fallbackPool[Math.floor(random() * fallbackPool.length)]).filter(Boolean))

  const nodes: RouteMapNode[] = [
    { id: 'start', kind: 'start', layer: 0, slot: 0, x: 7, y: 50 },
  ]
  const layerX = [25, 47, 69]
  layers.forEach((layer, layerIndex) => {
    const positions = lanePositions(layer.length, random)
    layer.forEach((monsterId, slot) => {
      nodes.push({
        id: `monster-${layerIndex}-${slot}`,
        kind: 'monster',
        layer: layerIndex + 1,
        slot,
        x: layerX[layerIndex] + Math.round((random() - .5) * 4),
        y: positions[slot],
        monsterId,
      })
    })
  })
  const bossLayer = layers.length + 1
  nodes.push({ id: 'boss', kind: 'boss', layer: bossLayer, slot: 0, x: 94, y: 50, monsterId: bossId })

  const edges: RouteMapEdge[] = []
  const byLayer = (layer: number) => nodes.filter(node => node.layer === layer)
  const start = nodes.find(node => node.id === 'start')!
  const first = byLayer(1)
  first.forEach(node => edges.push({ from: start.id, to: node.id }))
  for (let layer = 1; layer < bossLayer - 1; layer += 1) {
    const current = byLayer(layer)
    const next = byLayer(layer + 1)
    current.forEach(source => next.forEach(target => edges.push({ from: source.id, to: target.id })))
  }
  const last = byLayer(bossLayer - 1)
  last.forEach(source => edges.push({ from: source.id, to: 'boss' }))

  return { seed: seed >>> 0, nodes, edges }
}

export function isRouteNodeUnlocked(route: RouteMap, completedNodeIds: string[], nodeId: string) {
  if (nodeId === 'start') return true
  const completed = new Set(completedNodeIds)
  return route.edges.some(edge => edge.to === nodeId && completed.has(edge.from))
}

export function randomMapSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
