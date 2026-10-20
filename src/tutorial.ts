export type TutorialTarget =
  | 'map-node'
  | 'battle-hud'
  | 'enemy-intent'
  | 'hand-area'
  | 'location-card'
  | 'body-parts'
  | 'zones'
  | 'end-turn'

export interface TutorialStep {
  id: string
  title: string
  text: string
  target?: TutorialTarget
  mapOnly?: boolean
}

export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: 'map-node',
    title: '先选择一条路',
    text: '地图路线由种子生成。点击带有绿色边框的未知节点进入战斗，完成当前节点后，后方相连的路线会解锁。',
    target: 'map-node',
    mapOnly: true,
  },
  {
    id: 'battle-hud',
    title: '先看顶部资源',
    text: '生命决定你还能承受多少伤害，格挡会优先抵消攻击，费用用于打出卡牌。每回合未使用的费用不会保留。',
    target: 'battle-hud',
  },
  {
    id: 'enemy-intent',
    title: '读懂敌人意图',
    text: '怪物的剑图标和数字表示下一次攻击。意图会显示在对应身体部位旁；部位死亡后，配置中的攻击会被跳过。',
    target: 'enemy-intent',
  },
  {
    id: 'hand-area',
    title: '手牌就是你的行动',
    text: '先观察费用和卡牌图标。格挡卡可以保护英雄，地点卡可以推进区域，也可以攻击身体部位。',
    target: 'hand-area',
  },
  {
    id: 'location-card',
    title: '地点卡有两种用途',
    text: '点击有颜色的地点卡后，选择“放置”或“攻击”。一张地点卡只能选择一种用途。',
    target: 'location-card',
  },
  {
    id: 'target',
    title: '选择合法目标',
    text: '放置时选择对应颜色的区域；攻击时选择同色且仍然存活的身体部位。灰色的死亡部位不能再次被攻击。',
    target: 'body-parts',
  },
  {
    id: 'end-turn',
    title: '结束回合',
    text: '准备好后结束回合。怪物会执行当前预告的行动，格挡先抵消伤害，敌方行动结束后再按规则清除格挡。',
    target: 'end-turn',
  },
  {
    id: 'victory-rule',
    title: '四色封印才是胜利条件',
    text: '四个区域分别计算填充进度。只有红、黄、蓝、绿四个区域全部达标，战斗才会胜利；身体部位全部死亡也不会替代这个条件。',
    target: 'zones',
  },
]

const TUTORIAL_KEY = 'four-color-roguelike-tutorial-v1'

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'seen'
  } catch {
    return false
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'seen')
  } catch {
    // The guide remains usable for this session when storage is unavailable.
  }
}
