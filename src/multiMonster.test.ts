import { describe, expect, it } from 'vitest'
import { cloneConfig, defaultConfig } from './data'
import { createBattle, currentAttack, endTurn, useLocation } from './engine'
import { validateConfig } from './storage'
import type { BattleState, Color } from './types'

const baseState = (monsterId: string, partHp: Record<string, number>, hand: string[] = ['yellow-site']): BattleState => ({
  monsterId, phase: 'player', turn: 1, energy: 3, heroHp: 40, block: 0, drawPile: [], hand, discard: [],
  board: { red: [], yellow: [], blue: [], green: [] }, regionProgress: { red: 0, yellow: 0, blue: 0, green: 0 },
  partHp, nextColors: [], logs: [],
})

describe('多怪物配置与战斗隔离', () => {
  it('默认配置包含四只可校验的小怪', () => {
    const config = validateConfig(cloneConfig(defaultConfig))
    expect(config.monsters.map(monster => monster.id)).toEqual(['stone-snail', 'mist-lamp-wraith', 'moss-frog', 'four-arm-guard'])
  })

  it('灰岩蜗兽只有一个部位，且躯干可以作为攻击来源', () => {
    const config = cloneConfig(defaultConfig)
    const battle = createBattle(config, 'stone-snail')
    expect(config.monsters[0].parts).toHaveLength(1)
    expect(battle.monsterId).toBe('stone-snail')
    expect(currentAttack(config, 1, 'stone-snail')?.partId).toBe('stone-body')
  })

  it('雾灯魇拥有两个部位，选择它会创建对应战斗', () => {
    const config = cloneConfig(defaultConfig)
    expect(config.monsters.find(monster => monster.id === 'mist-lamp-wraith')?.parts).toHaveLength(2)
    expect(createBattle(config, 'mist-lamp-wraith').monsterId).toBe('mist-lamp-wraith')
    expect(currentAttack(config, 1, 'mist-lamp-wraith')?.partId).toBe('mist-core')
  })

  it('生命值为 1 的部位会被一次地点攻击击杀', () => {
    const config = cloneConfig(defaultConfig)
    const state = baseState('mist-lamp-wraith', { 'mist-body': 2, 'mist-core': 1 }, ['blue-site'])
    const next = useLocation(config, state, 'blue-site', 'attack', 'mist-core')
    expect(next.partHp['mist-core']).toBe(0)
    expect(next.discard).toEqual(['blue-site'])
  })

  it('地点卡不能放入不匹配的区域', () => {
    const config = cloneConfig(defaultConfig)
    const state = baseState('stone-snail', { 'stone-body': 3 }, ['red-site'])
    expect(useLocation(config, state, 'red-site', 'place', 'blue')).toBe(state)
    expect(useLocation(config, state, 'red-site', 'place', 'red').regionProgress.red).toBe(1)
  })

  it('攻击来源部位死亡后跳过攻击，四臂守卫其他手臂仍能攻击', () => {
    const config = cloneConfig(defaultConfig)
    const deadRed = baseState('four-arm-guard', { 'red-arm': 0, 'blue-arm': 1, 'green-arm': 1, 'guard-body': 2 })
    expect(endTurn(config, deadRed).heroHp).toBe(40)
    const blueTurn = endTurn(config, { ...deadRed, turn: 2 })
    expect(blueTurn.heroHp).toBe(38)
    const greenTurn = endTurn(config, { ...deadRed, turn: 3 })
    expect(greenTurn.heroHp).toBe(38)
  })

  it('不同怪物的生命、部位和攻击循环不会串台，重新进入会重置状态', () => {
    const config = cloneConfig(defaultConfig)
    const snail = createBattle(config, 'stone-snail')
    const guard = createBattle(config, 'four-arm-guard')
    expect(snail.monsterId).toBe('stone-snail')
    expect(guard.monsterId).toBe('four-arm-guard')
    expect(snail.partHp).toEqual({ 'stone-body': 3 })
    expect(guard.partHp).toEqual({ 'red-arm': 1, 'blue-arm': 1, 'green-arm': 1, 'guard-body': 2 })
    expect(createBattle(config, 'mist-lamp-wraith').heroHp).toBe(config.hero.maxHp)
    expect(createBattle(config, 'mist-lamp-wraith').partHp['mist-core']).toBe(1)
  })

  it('兼容没有 partId 的旧攻击配置，并拒绝无部位却有攻击的配置', () => {
    const config = cloneConfig(defaultConfig)
    const legacy = config.monsters[0] as unknown as { attacks: Array<Record<string, unknown>> }
    delete legacy.attacks[0].partId
    expect(validateConfig(config).monsters[0].attacks[0].partId).toBe('stone-body')
    const invalid = cloneConfig(defaultConfig)
    invalid.monsters[0].parts = []
    expect(() => validateConfig(invalid)).toThrow('攻击来源')
  })
})
