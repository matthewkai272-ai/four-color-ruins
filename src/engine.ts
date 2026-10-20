import { cardPool, COLORS, findCard } from './data'
import type { BattleState, CardDefinition, Color, GameConfig, MonsterDefinition } from './types'

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5)
const blankProgress = () => Object.fromEntries(COLORS.map(c => [c, 0])) as Record<Color, number>
const addLog = (state: BattleState, message: string) => ({ ...state, logs: [message, ...state.logs].slice(0, 60) })
const partHpKey = (state: BattleState, part: { id: string; color: Color }) => Object.prototype.hasOwnProperty.call(state.partHp, part.id) ? part.id : part.color

export function monsterFor(config: GameConfig, monsterId?: string): MonsterDefinition {
  return config.monsters.find(monster => monster.id === monsterId) ?? config.monsters[0]
}

export function createBattle(config: GameConfig, monsterId?: string): BattleState {
  const monster = monsterFor(config, monsterId)
  let state: BattleState = { monsterId: monster.id, phase: 'player', turn: 1, energy: config.rules.energyPerTurn, heroHp: config.hero.maxHp, block: 0, drawPile: shuffle(cardPool(config)), hand: [], discard: [], board: { red: [], yellow: [], blue: [], green: [] }, regionProgress: blankProgress(), partHp: Object.fromEntries(monster.parts.map(p => [p.id, p.maxHp])), nextColors: [], logs: [`${monster.name}守在遗迹之前。`] }
  return drawCards(config, state, config.rules.cardsPerTurn)
}

function drawCards(config: GameConfig, raw: BattleState, amount: number): BattleState {
  let state = raw, drawn = 0
  while (drawn < amount && (state.drawPile.length || state.discard.length)) {
    if (!state.drawPile.length) state = { ...state, drawPile: shuffle(state.discard), discard: [] }
    const [id, ...rest] = state.drawPile
    if (!id) break
    state = { ...state, drawPile: rest, hand: [...state.hand, id] }; drawn++
  }
  return addLog(state, `第 ${state.turn} 回合抽取 ${drawn} 张牌。`)
}

export function cardFor(config: GameConfig, id: string): CardDefinition | undefined { return findCard(config, id) }
export function currentAttack(config: GameConfig, turn: number, monsterId?: string) {
  const monster = monsterFor(config, monsterId)
  const pattern = monster?.attacks?.filter(a => a.enabled && a.turn > 0) ?? []
  if (!pattern.length) return undefined
  const cycleLength = Math.max(...pattern.map(a => a.turn), 1)
  const cycleTurn = ((turn - 1) % cycleLength) + 1
  return pattern.find(a => a.turn === cycleTurn)
}
export function canPlay(config: GameConfig, state: BattleState, id: string) { const card = findCard(config, id); return Boolean(card && state.phase === 'player' && state.energy >= card.cost && state.hand.includes(id)) }

export function useSkill(config: GameConfig, state: BattleState, id: string): BattleState {
  const card = findCard(config, id); if (!card || !canPlay(config, state, id) || card.type !== 'skill') return state
  let next = { ...state, energy: state.energy - card.cost, hand: state.hand.filter((_, index) => index !== state.hand.indexOf(id)), discard: [...state.discard, id] }
  if (card.effect === 'block') next = { ...next, block: next.block + card.amount }
  if (card.effect === 'modifyNextLocationColors') next = { ...next, nextColors: [...card.nextColors] }
  if (card.effect === 'draw') next = drawCards(config, next, card.draw)
  return addLog(next, `使用「${card.name}」。`)
}

export function useUtilityLocation(config: GameConfig, state: BattleState, id: string): BattleState {
  const card = findCard(config, id)
  if (!card || card.type !== 'location' || card.colors.length > 0 || card.effect !== 'draw' || !canPlay(config, state, id)) return state
  let next = { ...state, energy: state.energy - card.cost, hand: state.hand.filter((_, index) => index !== state.hand.indexOf(id)), discard: [...state.discard, id] }
  next = drawCards(config, next, card.draw)
  return addLog(next, `使用「${card.name}」，抽取 ${card.draw} 张牌。`)
}

export function useLocation(config: GameConfig, state: BattleState, id: string, mode: 'place' | 'attack', target: Color | string): BattleState {
  const card = findCard(config, id); if (!card || card.type !== 'location' || !canPlay(config, state, id)) return state
  const monster = monsterFor(config, state.monsterId)
  const colors = state.nextColors.length ? state.nextColors : card.colors
  if (mode === 'place' && (!COLORS.includes(target as Color) || !colors.includes(target as Color))) return state
  if (mode === 'attack' && !colors.includes(targetPartColor(monster, target)!)) return state
  const targetPart = mode === 'attack' ? monster.parts.find(part => part.id === target && part.color === targetPartColor(monster, target)) ?? monster.parts.find(part => part.color === target) : undefined
  if (mode === 'attack' && (!targetPart || state.partHp[partHpKey(state, targetPart)] <= 0)) return state
  const hand = state.hand.filter((_, index) => index !== state.hand.indexOf(id))
  let next: BattleState = { ...state, energy: state.energy - card.cost, hand, nextColors: [] }
  if (mode === 'place') {
    const region = target as Color
    next = { ...next, board: { ...next.board, [region]: [...next.board[region], id] }, regionProgress: { ...next.regionProgress, [region]: next.regionProgress[region] + card.placement }, discard: card.afterUse === 'discard' ? [...next.discard] : next.discard }
    next = addLog(next, `将「${card.name}」放入${target}区域。`)
  } else {
    const damage = card.attackDamage ?? config.rules.baseLocationDamage
    const hpKey = partHpKey(next, targetPart!)
    const hp = Math.max(0, next.partHp[hpKey] - damage)
    next = { ...next, discard: [...next.discard, id], partHp: { ...next.partHp, [hpKey]: hp } }
    next = addLog(next, `「${card.name}」攻击${targetPart!.name}，造成 ${damage} 点伤害。${hp === 0 ? ' 部位已死亡。' : ''}`)
  }
  if (mode === 'place' && COLORS.every(color => next.regionProgress[color] >= monster.regions.find(r => r.color === color)!.requirement) && config.rules.immediateVictory) return { ...next, phase: 'victory', outcome: `四境封印完成，${monster.name}退去了！` }
  return next
}

function targetPartColor(monster: MonsterDefinition, target: Color | string): Color | undefined {
  return monster.parts.find(part => part.id === target)?.color ?? (COLORS.includes(target as Color) ? target as Color : undefined)
}

export function endTurn(config: GameConfig, raw: BattleState): BattleState {
  if (raw.phase !== 'player') return raw
  let state: BattleState = { ...raw, phase: 'enemy', discard: [...raw.discard, ...raw.hand], hand: [] }
  const monster = monsterFor(config, state.monsterId)
  const attack = currentAttack(config, state.turn, monster.id)
  if (attack) {
    const deadPartBehavior = monster.deadPartBehavior ?? config.rules.exhaustedAttackBehavior
    const source = monster.parts.find(part => part.id === attack.partId)
    const target = source && state.partHp[partHpKey(state, source)] > 0 ? source : deadPartBehavior === 'retarget' ? monster.parts.find(part => state.partHp[partHpKey(state, part)] > 0) : undefined
    if (!target) state = addLog(state, `${source?.name ?? attack.partId}已死亡，本回合攻击跳过。`)
    else {
      const blocked = Math.min(state.block, attack.damage), taken = attack.damage - blocked
      state = { ...state, block: state.block - blocked, heroHp: Math.max(0, state.heroHp - taken) }
      state = addLog(state, `${monster.name}由${target.name}发动${attack.color}色攻击：${attack.damage} 伤害，守护抵消 ${blocked}。`)
    }
  }
  if (state.heroHp <= 0) return { ...state, phase: 'defeat', outcome: '你倒下了。' }
  state = { ...state, turn: state.turn + 1, phase: 'player', energy: config.rules.energyPerTurn, block: config.rules.blockDuration === 'turn' ? 0 : state.block }
  return drawCards(config, state, config.rules.cardsPerTurn)
}
