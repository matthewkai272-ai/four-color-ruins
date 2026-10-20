export type Color = 'red' | 'yellow' | 'blue' | 'green'
export type CardType = 'skill' | 'location'
export type EffectType = 'block' | 'draw' | 'place' | 'damagePart' | 'modifyNextLocationColors' | 'none'
export type Pile = 'discard' | 'board'

export interface CardDefinition {
  id: string; name: string; nameEn?: string; type: CardType; cost: number; colors: Color[]; symbol: string; copies: number
  description: string; effect: EffectType; amount: number; attackDamage: number; draw: number; placement: number
  nextColors: Color[]; afterUse: Pile
}
export interface RegionDefinition { color: Color; requirement: number }
export interface BodyPartDefinition { id: string; color: Color; maxHp: number; name: string }
export interface AttackPattern { partId: string; color: Color; damage: number; turn: number; enabled: boolean }
export interface MonsterDefinition { id: string; name: string; regions: RegionDefinition[]; parts: BodyPartDefinition[]; attacks: AttackPattern[]; deadPartBehavior: 'skip' | 'retarget' }
export interface HeroDefinition { name: string; className: string; color: Color; maxHp: number; cards: Record<string, number> }
export interface GlobalRules { energyPerTurn: number; cardsPerTurn: number; blockDuration: 'turn' | 'round'; baseLocationDamage: number; immediateVictory: boolean; exhaustedAttackBehavior: 'skip' | 'retarget' }
export interface GameConfig { version: 1; cards: CardDefinition[]; monsters: MonsterDefinition[]; hero: HeroDefinition; rules: GlobalRules }

export interface BattleState {
  monsterId?: string; phase: 'player' | 'enemy' | 'victory' | 'defeat'; turn: number; energy: number; heroHp: number; block: number
  drawPile: string[]; hand: string[]; discard: string[]; board: Record<Color, string[]>; regionProgress: Record<Color, number>
  partHp: Record<string, number>; nextColors: Color[]; logs: string[]; selectedCardId?: string; selectionMode?: 'use' | 'place' | 'attack'; outcome?: string
}
