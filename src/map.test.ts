import { describe, expect, it } from 'vitest'
import { defaultConfig } from './data'
import { generateRouteMap, isRouteNodeUnlocked } from './map'

describe('seeded route map', () => {
  const monsterIds = defaultConfig.monsters.map(monster => monster.id)

  it('generates the same nodes and edges for the same seed', () => {
    expect(generateRouteMap(123456, monsterIds)).toEqual(generateRouteMap(123456, monsterIds))
  })

  it('allows different seeds to produce different routes', () => {
    expect(generateRouteMap(123456, monsterIds)).not.toEqual(generateRouteMap(654321, monsterIds))
  })

  it('keeps every configured monster in the route', () => {
    const route = generateRouteMap(123456, monsterIds)
    expect(route.nodes.filter(node => node.kind === 'monster')).toHaveLength(8)
    expect(route.nodes.filter(node => node.kind === 'monster').every(node => monsterIds.includes(node.monsterId!))).toBe(true)
    expect(route.nodes.find(node => node.id === 'start')?.kind).toBe('start')
    expect(route.nodes.find(node => node.id === 'boss')?.kind).toBe('boss')
    expect(route.nodes.filter(node => node.layer === 1)).toHaveLength(3)
    expect(route.nodes.filter(node => node.layer === 2)).toHaveLength(2)
    expect(route.nodes.filter(node => node.layer === 3)).toHaveLength(3)
    expect(new Set(route.edges.map(edge => `${edge.from}-${edge.to}`)).size).toBe(route.edges.length)
  })

  it('unlocks only nodes connected to completed nodes', () => {
    const route = generateRouteMap(123456, monsterIds)
    const firstLayer = route.nodes.filter(node => node.layer === 1)
    const laterLayer = route.nodes.find(node => node.layer === 2)!
    const boss = route.nodes.find(node => node.kind === 'boss')!
    expect(isRouteNodeUnlocked(route, ['start'], firstLayer[0].id)).toBe(true)
    expect(isRouteNodeUnlocked(route, ['start'], laterLayer.id)).toBe(false)
    expect(isRouteNodeUnlocked(route, ['start', firstLayer[0].id], laterLayer.id)).toBe(true)
    expect(isRouteNodeUnlocked(route, ['start'], boss.id)).toBe(false)
    expect(isRouteNodeUnlocked(route, ['start', ...route.nodes.filter(node => node.kind === 'monster').map(node => node.id)], boss.id)).toBe(true)
  })
})
