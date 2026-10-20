import { describe, expect, it } from 'vitest'
import { cloneConfig, defaultConfig } from './data'
import { validateConfig } from './storage'

describe('configuration validation', () => {
  it('accepts the default configuration', () => {
    expect(validateConfig(cloneConfig(defaultConfig)).version).toBe(1)
  })

  it('rejects null card maps instead of allowing a later runtime crash', () => {
    const config = cloneConfig(defaultConfig)
    config.hero.cards = null as unknown as Record<string, number>
    expect(() => validateConfig(config)).toThrow('英雄 cards 必须是对象')
  })

  it('rejects duplicate card ids', () => {
    const config = cloneConfig(defaultConfig)
    config.cards[1].id = config.cards[0].id
    expect(() => validateConfig(config)).toThrow('卡牌 id 重复')
  })

  it('allows monsters with fewer than four body parts but rejects duplicate body ids', () => {
    const config = cloneConfig(defaultConfig)
    config.monsters[0].parts = [config.monsters[0].parts[0]]
    config.monsters[0].attacks = []
    expect(validateConfig(config).monsters[0].parts).toHaveLength(1)
    config.monsters[0].parts.push({ ...config.monsters[0].parts[0] })
    expect(() => validateConfig(config)).toThrow('id 不能重复')
  })
})
