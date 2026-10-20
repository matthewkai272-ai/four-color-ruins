import { COLORS, defaultConfig, cloneConfig } from './data'
import { generateRouteMap } from './map'
import type { Color, GameConfig } from './types'
import type { MapRun } from './map'
const KEY = 'four-color-roguelike-config-v1'
const MAP_KEY = 'four-color-roguelike-map-v1'
function migrateMonsterBatch(config: GameConfig): GameConfig {
  if (config.monsters.length !== 1) return config
  const defaults = cloneConfig(defaultConfig).monsters
  const current = config.monsters[0]
  const hasKnownId = defaults.some(monster => monster.id === current.id)
  const monsters = hasKnownId ? [current, ...defaults.filter(monster => monster.id !== current.id)] : defaults
  const migrated = { ...config, monsters }
  try { localStorage.setItem(KEY, JSON.stringify(migrated)) } catch {}
  return migrated
}
export function loadConfig(): GameConfig { try { const raw = localStorage.getItem(KEY); if (raw) return migrateMonsterBatch(validateConfig(JSON.parse(raw))); } catch {} return cloneConfig(defaultConfig) }
export function saveConfig(config: GameConfig) { try { localStorage.setItem(KEY, JSON.stringify(config)) } catch { /* 文件模式仍可继续使用 */ } }
export function resetConfig() { const config = cloneConfig(defaultConfig); saveConfig(config); return config }
export function saveMapRun(run: MapRun) { try { localStorage.setItem(MAP_KEY, JSON.stringify(run)) } catch { /* 无法写入时仍可继续当前会话 */ } }
export function loadMapRun(monsterIds: string[], bossId = monsterIds[monsterIds.length - 1]): MapRun | null {
  try {
    const raw = localStorage.getItem(MAP_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { route?: { seed?: unknown }; completedNodeIds?: unknown }
    if (!value.route || typeof value.route.seed !== 'number' || !Number.isFinite(value.route.seed) || !Array.isArray(value.completedNodeIds)) return null
    const route = generateRouteMap(value.route.seed, monsterIds, bossId)
    const validIds = new Set(route.nodes.map(node => node.id))
    const completedNodeIds = value.completedNodeIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    return { route, completedNodeIds: ['start', ...completedNodeIds.filter(id => id !== 'start')] }
  } catch { return null }
}
const isColor = (value: unknown): value is Color => typeof value === 'string' && COLORS.includes(value as Color)
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

export function validateConfig(value: unknown): GameConfig {
  if (!value || typeof value !== 'object') throw new Error('配置必须是 JSON 对象。')
  const x = value as Partial<GameConfig>
  if (x.version !== 1 || !Array.isArray(x.cards) || !Array.isArray(x.monsters) || !x.hero || !x.rules) throw new Error('配置缺少 version、cards、monsters、hero 或 rules。')
  if (!x.monsters.length) throw new Error('至少需要一个怪物。')
  if (!x.hero.cards || Array.isArray(x.hero.cards) || typeof x.hero.cards !== 'object') throw new Error('英雄 cards 必须是对象。')
  if (!isNumber(x.hero.maxHp) || x.hero.maxHp < 1) throw new Error('英雄初始生命必须是大于 0 的数字。')
  if (!isNumber(x.rules.energyPerTurn) || !isNumber(x.rules.cardsPerTurn)) throw new Error('全局费用和抽牌数量必须是数字。')
  const cardIds = new Set<string>()
  for (const card of x.cards) {
    if (!card || typeof card.id !== 'string' || typeof card.name !== 'string' || !isNumber(card.cost) || !Array.isArray(card.colors) || !card.colors.every(isColor)) throw new Error('卡牌必须包含有效的 id、名称、费用和颜色数组。')
    if (cardIds.has(card.id)) throw new Error(`卡牌 id 重复：${card.id}。`)
    cardIds.add(card.id)
  }
  for (const monster of x.monsters) {
    if (!monster || typeof monster.name !== 'string' || !Array.isArray(monster.regions) || !Array.isArray(monster.parts) || !Array.isArray(monster.attacks)) throw new Error('怪物必须包含名称、regions、parts 和 attacks。')
    if (monster.regions.length !== 4) throw new Error('怪物必须包含红、黄、蓝、绿四个区域。')
    if (!monster.regions.every(region => isColor(region.color) && isNumber(region.requirement) && region.requirement >= 0) || new Set(monster.regions.map(region => region.color)).size !== 4) throw new Error('怪物区域配置无效，必须分别包含红、黄、蓝、绿四种颜色。')
    const parts = monster.parts as unknown as Array<Record<string, unknown>>
    if (!parts.every(part => typeof part.name === 'string' && isColor(part.color) && isNumber(part.maxHp) && Number(part.maxHp) >= 0)) throw new Error('怪物身体部位配置无效：名称、颜色和生命值必须有效。')
    const ids = parts.map((part, index) => typeof part.id === 'string' && part.id ? part.id : `${monster.id}-part-${index}`)
    if (new Set(ids).size !== ids.length) throw new Error('怪物身体部位 id 不能重复。')
    monster.parts = parts.map((part, index) => ({ ...part, id: ids[index] })) as never
    if (!monster.attacks.every(attack => isColor(attack.color) && isNumber(attack.damage) && isNumber(attack.turn) && typeof attack.enabled === 'boolean')) throw new Error('怪物攻击配置无效。')
    if (monster.attacks.length && !ids.length) throw new Error(`怪物「${monster.name}」有攻击行动，但没有可作为攻击来源的身体部位。`)
    monster.attacks = monster.attacks.map((attack, index) => ({ ...attack, partId: typeof attack.partId === 'string' && attack.partId ? attack.partId : ids.find(id => id.endsWith(`-${attack.color}`)) ?? ids[index % ids.length] })) as never
    if (!monster.attacks.every(attack => ids.includes(attack.partId))) throw new Error('怪物攻击必须指向现有身体部位。')
  }
  return value as GameConfig
}
