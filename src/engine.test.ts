import { describe, expect, it } from 'vitest'
import { cardPool, cloneConfig, defaultConfig, COLORS } from './data'
import { createBattle, endTurn, useLocation, useSkill, useUtilityLocation } from './engine'
import type { BattleState, Color } from './types'

const stateWith = (patch: Partial<BattleState> = {}): BattleState => ({
  phase: 'player', turn: 1, energy: 3, heroHp: 40, block: 0, drawPile: [], hand: [], discard: [],
  board: { red: [], yellow: [], blue: [], green: [] }, regionProgress: { red: 0, yellow: 0, blue: 0, green: 0 },
  partHp: { 'stone-body': 3 }, nextColors: [], logs: [], ...patch,
})

const place = (config: typeof defaultConfig, state: BattleState, id: string, color: Color) => useLocation(config, state, id, 'place', color)

describe('default configuration', () => {
  it('contains exactly ten cards with the required composition', () => {
    expect(cardPool(defaultConfig)).toHaveLength(10)
    expect(cardPool(defaultConfig).filter(id => id === 'guard')).toHaveLength(4)
    expect(cardPool(defaultConfig).filter(id => id.endsWith('-site'))).toHaveLength(4)
    expect(cardPool(defaultConfig).filter(id => id === 'scout')).toHaveLength(1)
    expect(cardPool(defaultConfig).filter(id => id === 'prism')).toHaveLength(1)
  })
})

describe('battle rules', () => {
  it('starts with configured energy and rejects an over-cost play', () => {
    const config = cloneConfig(defaultConfig)
    const state = stateWith({ hand: ['red-site'] })
    expect(createBattle(config).energy).toBe(3)
    expect(place(config, state, 'red-site', 'red').energy).toBe(1)
    expect(place(config, { ...state, energy: 1 }, 'red-site', 'red')).toEqual({ ...state, energy: 1 })
  })

  it('supports attacking a single torso and sends the location to discard', () => {
    const config = cloneConfig(defaultConfig)
    const attacked = useLocation(config, stateWith({ hand: ['yellow-site'] }), 'yellow-site', 'attack', 'stone-body')
    expect(attacked.discard).toEqual(['yellow-site'])
    expect(attacked.partHp['stone-body']).toBe(2)
    expect(attacked.board.red).toEqual([])
  })

  it('uses the colorless draw location without requiring a region target', () => {
    const config = cloneConfig(defaultConfig)
    const state = useUtilityLocation(config, stateWith({ hand: ['scout'], drawPile: ['guard'] }), 'scout')
    expect(state.energy).toBe(3)
    expect(state.hand).toEqual(['guard'])
    expect(state.discard).toEqual(['scout'])
  })

  it('rejects an attack against an already dead body part', () => {
    const config = cloneConfig(defaultConfig)
    const state = stateWith({ hand: ['yellow-site'], partHp: { 'stone-body': 0 } })
    expect(useLocation(config, state, 'yellow-site', 'attack', 'stone-body')).toBe(state)
  })

  it('wins only when the last region reaches its requirement', () => {
    const config = cloneConfig(defaultConfig)
    const state = place(config, stateWith({ regionProgress: { red: 1, yellow: 1, blue: 1, green: 0 }, hand: ['green-site'] }), 'green-site', 'green')
    expect(state.phase).toBe('victory')
    const incomplete = place(config, stateWith({ hand: ['red-site'], regionProgress: { red: 1, yellow: 0, blue: 0, green: 0 } }), 'red-site', 'red')
    expect(incomplete.phase).toBe('player')
  })

  it('keeps the battle running when the only body part is dead', () => {
    const state = useLocation(cloneConfig(defaultConfig), stateWith({ hand: ['yellow-site'], partHp: { 'stone-body': 1 } }), 'yellow-site', 'attack', 'stone-body')
    expect(state.partHp['stone-body']).toBe(0)
    expect(state.phase).toBe('player')
  })

  it('applies the previewed torso attack and clears block after enemy action', () => {
    const config = cloneConfig(defaultConfig)
    const state = endTurn(config, stateWith({ block: 1, board: { red: ['red-site'], yellow: [], blue: [], green: [] } }))
    expect(state.heroHp).toBe(37)
    expect(state.board.red).toEqual(['red-site'])
    expect(state.block).toBe(0)
  })

  it('retargets a dead scheduled body part only when the rule is enabled', () => {
    const config = cloneConfig(defaultConfig)
    config.monsters[0].parts.push({ id: 'backup-body', color: 'red', maxHp: 1, name: '备用躯干' })
    config.monsters[0].deadPartBehavior = 'retarget'
    const state = endTurn(config, stateWith({ partHp: { 'stone-body': 0, 'backup-body': 1 } }))
    expect(state.heroHp).toBe(36)
    expect(state.logs.some(log => log.includes('备用躯干'))).toBe(true)
  })

  it('clears prism colors only after the next location is actually used', () => {
    const config = cloneConfig(defaultConfig)
    const primed = useSkill(config, stateWith({ hand: ['prism', 'red-site'] }), 'prism')
    expect(primed.nextColors).toEqual(COLORS)
    const used = place(config, primed, 'red-site', 'blue')
    expect(used.board.blue).toEqual(['red-site'])
    expect(used.nextColors).toEqual([])
  })

  it('shuffles discard into the draw pile instead of creating cards', () => {
    const config = cloneConfig(defaultConfig)
    config.rules.cardsPerTurn = 1
    const state = endTurn(config, stateWith({ discard: ['guard'] }))
    expect(state.hand).toEqual(['guard'])
    expect(state.drawPile).toEqual([])
    expect(state.discard).toEqual([])
  })

  it('enters defeat at zero health and a new battle resets transient state', () => {
    const config = cloneConfig(defaultConfig)
    const defeated = endTurn(config, stateWith({ heroHp: 2 }))
    expect(defeated.phase).toBe('defeat')
    const restarted = createBattle(config)
    expect(restarted.phase).toBe('player')
    expect(restarted.heroHp).toBe(40)
    expect(restarted.block).toBe(0)
    expect(restarted.nextColors).toEqual([])
  })
})
