import type { CardDefinition, Color, GameConfig } from './types'

export const COLORS: Color[] = ['red', 'yellow', 'blue', 'green']
export const COLOR_META: Record<Color, { label: string; glyph: string }> = {
  red: { label: '赤', glyph: '◆' }, yellow: { label: '黄', glyph: '●' }, blue: { label: '蓝', glyph: '▲' }, green: { label: '绿', glyph: '■' },
}

const card = (data: Partial<CardDefinition> & Pick<CardDefinition, 'id' | 'name' | 'type'>): CardDefinition => ({
  cost: 0, colors: [], symbol: '✦', copies: 1, description: '', effect: 'none', amount: 0, attackDamage: 0, draw: 0, placement: 0, nextColors: [], afterUse: 'discard', ...data,
})

export const defaultConfig: GameConfig = {
  version: 1,
  cards: [
    card({ id: 'guard', name: '坚壁', nameEn: 'STEADFAST', type: 'skill', cost: 1, symbol: '▣', copies: 4, description: '获得 4 点格挡', effect: 'block', amount: 4 }),
    card({ id: 'red-site', name: '赤焰圣所', nameEn: 'EMBER SHRINE', type: 'location', cost: 2, colors: ['red'], symbol: '◆', description: '落入赤境，或攻击赤色部位', effect: 'place', placement: 1, attackDamage: 1 }),
    card({ id: 'yellow-site', name: '曜石圣所', nameEn: 'SUNSTONE SHRINE', type: 'location', cost: 2, colors: ['yellow'], symbol: '●', description: '落入曜境，或攻击黄色部位', effect: 'place', placement: 1, attackDamage: 1 }),
    card({ id: 'blue-site', name: '潮痕圣所', nameEn: 'TIDEMARK SHRINE', type: 'location', cost: 2, colors: ['blue'], symbol: '▲', description: '落入潮境，或攻击蓝色部位', effect: 'place', placement: 1, attackDamage: 1 }),
    card({ id: 'green-site', name: '苔语圣所', nameEn: 'MOSSWHISPER SHRINE', type: 'location', cost: 2, colors: ['green'], symbol: '■', description: '落入森境，或攻击绿色部位', effect: 'place', placement: 1, attackDamage: 1 }),
    card({ id: 'scout', name: '寻光卷轴', nameEn: 'SCROLL OF SEEKING', type: 'location', cost: 0, symbol: '○', copies: 1, description: '抽 1 张牌；无色遗址不可入境', effect: 'draw', draw: 1 }),
    card({ id: 'prism', name: '四相启示', nameEn: 'PRISMATIC AWAKENING', type: 'skill', cost: 0, symbol: '✧', copies: 1, description: '使下一张遗址卡获得四相颜色', effect: 'modifyNextLocationColors', nextColors: COLORS }),
  ],
  monsters: [
    {
      id: 'stone-snail', name: '灰岩蜗兽', regions: COLORS.map(color => ({ color, requirement: 1 })),
      parts: [{ id: 'stone-body', color: 'yellow', maxHp: 3, name: '石壳躯干' }],
      attacks: [{ partId: 'stone-body', color: 'yellow', damage: 4, turn: 1, enabled: true }, { partId: 'stone-body', color: 'yellow', damage: 4, turn: 3, enabled: true }], deadPartBehavior: 'skip',
    },
    {
      id: 'mist-lamp-wraith', name: '雾灯魇', regions: COLORS.map(color => ({ color, requirement: 1 })),
      parts: [{ id: 'mist-body', color: 'blue', maxHp: 2, name: '雾影躯干' }, { id: 'mist-core', color: 'blue', maxHp: 1, name: '雾灯核' }],
      attacks: [{ partId: 'mist-core', color: 'blue', damage: 3, turn: 1, enabled: true }, { partId: 'mist-core', color: 'blue', damage: 3, turn: 2, enabled: true }, { partId: 'mist-core', color: 'blue', damage: 3, turn: 4, enabled: true }], deadPartBehavior: 'skip',
    },
    {
      id: 'moss-frog', name: '苔背巨蛙', regions: COLORS.map(color => ({ color, requirement: 1 })),
      parts: [{ id: 'moss-body', color: 'green', maxHp: 2, name: '苔背躯干' }, { id: 'tongue-blade', color: 'red', maxHp: 1, name: '舌刃' }],
      attacks: [{ partId: 'moss-body', color: 'green', damage: 3, turn: 1, enabled: true }, { partId: 'tongue-blade', color: 'red', damage: 2, turn: 2, enabled: true }, { partId: 'moss-body', color: 'green', damage: 3, turn: 3, enabled: true }, { partId: 'tongue-blade', color: 'red', damage: 2, turn: 4, enabled: true }], deadPartBehavior: 'skip',
    },
    {
      id: 'four-arm-guard', name: '四臂守卫', regions: COLORS.map(color => ({ color, requirement: 1 })),
      parts: [{ id: 'red-arm', color: 'red', maxHp: 1, name: '赤臂' }, { id: 'blue-arm', color: 'blue', maxHp: 1, name: '潮臂' }, { id: 'green-arm', color: 'green', maxHp: 1, name: '苔臂' }, { id: 'guard-body', color: 'yellow', maxHp: 2, name: '守卫躯干' }],
      attacks: [{ partId: 'red-arm', color: 'red', damage: 2, turn: 1, enabled: true }, { partId: 'blue-arm', color: 'blue', damage: 2, turn: 2, enabled: true }, { partId: 'green-arm', color: 'green', damage: 2, turn: 3, enabled: true }, { partId: 'red-arm', color: 'red', damage: 2, turn: 4, enabled: true }, { partId: 'blue-arm', color: 'blue', damage: 2, turn: 5, enabled: true }, { partId: 'green-arm', color: 'green', damage: 2, turn: 6, enabled: true }], deadPartBehavior: 'skip',
    },
  ],
  hero: { name: '引路人', className: '赤印战士', color: 'red', maxHp: 40, cards: { guard: 4, 'red-site': 1, 'yellow-site': 1, 'blue-site': 1, 'green-site': 1, scout: 1, prism: 1 } },
  rules: { energyPerTurn: 3, cardsPerTurn: 5, blockDuration: 'turn', baseLocationDamage: 1, immediateVictory: true, exhaustedAttackBehavior: 'skip' },
}

export function cloneConfig(config: GameConfig): GameConfig { return JSON.parse(JSON.stringify(config)) }
export function findCard(config: GameConfig, id: string) { return config.cards.find(card => card.id === id) }
export function cardPool(config: GameConfig): string[] { return Object.entries(config.hero.cards).flatMap(([id, qty]) => Array.from({ length: Math.max(0, qty) }, () => id)) }
