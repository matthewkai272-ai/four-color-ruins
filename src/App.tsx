import { useRef, useState } from 'react'
import { COLORS, COLOR_META, findCard } from './data'
import { cardFor, createBattle, endTurn, useLocation, useSkill, useUtilityLocation, currentAttack } from './engine'
import { generateRouteMap, isRouteNodeUnlocked, randomMapSeed } from './map'
import { loadConfig, loadMapRun, resetConfig, saveConfig, saveMapRun, validateConfig } from './storage'
import { openJsonFile, saveJsonFile } from './localFiles'
import { hasSeenTutorial, markTutorialSeen, tutorialSteps } from './tutorial'
import type { BattleState, CardDefinition, Color, GameConfig, MonsterDefinition } from './types'
import type { MapRun, RouteMapNode } from './map'

type Screen = 'menu' | 'map' | 'battle' | 'editor'
type TutorialMode = 'intro' | 'guide' | null
type BattleFxKind = 'card-play' | 'region-fill' | 'part-hit' | 'part-death' | 'enemy-attack' | 'block' | 'draw'
interface BattleFx { kind: BattleFxKind; target?: string; key: number }
const colorClass = (color: Color) => `color-${color}`
const CARD_ASSET_ROOT = '/assets/cards'
const CARD_ART: Record<string, string> = {
  guard: `${CARD_ASSET_ROOT}/card-art-guard.png`,
  'red-site': `${CARD_ASSET_ROOT}/card-art-red-site.png`,
  'yellow-site': `${CARD_ASSET_ROOT}/card-art-yellow-site.png`,
  'blue-site': `${CARD_ASSET_ROOT}/card-art-blue-site.png`,
  'green-site': `${CARD_ASSET_ROOT}/card-art-green-site.png`,
  scout: `${CARD_ASSET_ROOT}/card-art-scout.png`,
  prism: `${CARD_ASSET_ROOT}/card-art-prism.png`,
}
const CARD_FRAME = {
  neutral: `${CARD_ASSET_ROOT}/card-frame-neutral.png`,
  location: `${CARD_ASSET_ROOT}/card-frame-location.png`,
}
const DECOR_ROOT = '/assets/decor'
const REGION_ART: Record<Color, string> = {
  red: `${DECOR_ROOT}/region-red.png`,
  yellow: `${DECOR_ROOT}/region-yellow.png`,
  blue: `${DECOR_ROOT}/region-blue.png`,
  green: `${DECOR_ROOT}/region-green.png`,
}
const CARD_ICON_ART: Record<string, string> = {
  guard: `${DECOR_ROOT}/icon-oath-shield.png`,
  scout: `${DECOR_ROOT}/icon-trail-compass.png`,
  prism: `${DECOR_ROOT}/icon-four-prism.png`,
}
const CARD_NAME_EN: Record<string, string> = {
  guard: 'STEADFAST',
  'red-site': 'EMBER SHRINE',
  'yellow-site': 'SUNSTONE SHRINE',
  'blue-site': 'TIDEMARK SHRINE',
  'green-site': 'MOSSWHISPER SHRINE',
  scout: 'SCROLL OF SEEKING',
  prism: 'PRISMATIC AWAKENING',
}

export default function App() {
  const [config, setConfig] = useState<GameConfig>(() => loadConfig()); const mapMonsterIds = config.monsters.slice(0, 4).map(monster => monster.id); const bossMonsterId = config.monsters.find(monster => monster.id === 'four-arm-guard')?.id ?? mapMonsterIds[mapMonsterIds.length - 1]; const initialMapRun = loadMapRun(mapMonsterIds, bossMonsterId); const [mapRun, setMapRun] = useState<MapRun | null>(() => initialMapRun); const [screen, setScreen] = useState<Screen>(() => initialMapRun ? 'map' : 'menu'); const [battle, setBattle] = useState<BattleState | null>(null); const [activeMapNodeId, setActiveMapNodeId] = useState<string | undefined>(); const [toast, setToast] = useState(''); const [tutorialMode, setTutorialMode] = useState<TutorialMode>(() => hasSeenTutorial() ? null : 'intro'); const [tutorialStep, setTutorialStep] = useState(0); const victoryReturnTimer = useRef<number | undefined>(undefined); const toastTimer = useRef<number | undefined>(undefined)
  const notice = (message: string) => { if (toastTimer.current) window.clearTimeout(toastTimer.current); setToast(message); toastTimer.current = window.setTimeout(() => { setToast(''); toastTimer.current = undefined }, 2600) }
  const start = (monsterId?: string) => { setBattle(createBattle(config, monsterId)); setScreen('battle') }
  const beginRun = () => { const route = generateRouteMap(randomMapSeed(), mapMonsterIds, bossMonsterId); const nextRun = { route, completedNodeIds: ['start'] }; setMapRun(nextRun); saveMapRun(nextRun); setActiveMapNodeId(undefined); setScreen('map') }
  const dismissTutorial = () => { markTutorialSeen(); setTutorialMode(null) }
  const openTutorial = () => { setTutorialStep(0); setTutorialMode('intro') }
  const startRegularRun = () => { dismissTutorial(); beginRun() }
  const startGuidedRun = () => { setTutorialStep(0); setTutorialMode('guide'); beginRun() }
  const advanceTutorial = () => { if (tutorialStep >= tutorialSteps.length - 1) dismissTutorial(); else setTutorialStep(step => step + 1) }
  const enterMapNode = (node: RouteMapNode) => { if ((node.kind !== 'monster' && node.kind !== 'boss') || !node.monsterId || !mapRun || !isRouteNodeUnlocked(mapRun.route, mapRun.completedNodeIds, node.id) || mapRun.completedNodeIds.includes(node.id)) return; setActiveMapNodeId(node.id); start(node.monsterId); if (tutorialMode === 'guide' && tutorialSteps[tutorialStep]?.id === 'map-node') setTutorialStep(1) }
  const updateBattle = (next: BattleState) => { if (victoryReturnTimer.current) window.clearTimeout(victoryReturnTimer.current); victoryReturnTimer.current = undefined; setBattle(next); if (next.phase === 'victory' && activeMapNodeId && mapRun) { const nextRun = { ...mapRun, completedNodeIds: mapRun.completedNodeIds.includes(activeMapNodeId) ? mapRun.completedNodeIds : [...mapRun.completedNodeIds, activeMapNodeId] }; setMapRun(nextRun); saveMapRun(nextRun); victoryReturnTimer.current = window.setTimeout(() => setScreen('map'), 1400) } }
  const updateConfig = (next: GameConfig, message = '') => { setConfig(next); saveConfig(next); if (message) notice(message) }
  const tutorial = tutorialSteps[tutorialStep]
  return <main className="app-shell" data-tutorial-step={tutorialMode === 'guide' ? tutorial?.id : undefined}>
    <header className="topbar"><button className="brand" onClick={() => { setTutorialMode(null); setScreen('menu') }} aria-label="返回色域遗迹主菜单"><span className="brand-mark">✦</span><span>色域遗迹<small>四色区域试炼</small></span></button><nav aria-label="全局导航"><button className={screen === 'editor' ? 'nav-active' : ''} aria-current={screen === 'editor' ? 'page' : undefined} onClick={() => { setTutorialMode(null); setScreen('editor') }}>规则工坊</button><button onClick={() => { setTutorialMode(null); setScreen('menu') }}>返回营地</button></nav></header>
    {screen === 'menu' && <Menu onStart={startRegularRun} onEditor={() => setScreen('editor')} onTutorial={openTutorial} config={config} />}
    {screen === 'map' && mapRun && <Map run={mapRun} onBattle={enterMapNode} onBack={() => setScreen('menu')} />}
    {screen === 'battle' && battle && <Battle config={config} state={battle} setState={updateBattle} onMap={() => setScreen('map')} onRestart={() => start(battle.monsterId)} notice={notice} />}
    {screen === 'editor' && <Editor config={config} update={updateConfig} onBack={() => setScreen('menu')} notice={notice} />}
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    {tutorialMode === 'intro' && <TutorialIntro onStart={startGuidedRun} onSkip={startRegularRun} />}
    {tutorialMode === 'guide' && tutorial && <TutorialGuide step={tutorial} stepIndex={tutorialStep} total={tutorialSteps.length} screen={screen} onNext={advanceTutorial} onSkip={dismissTutorial} />}
  </main>
}

function Menu({ onStart, onEditor, onTutorial, config }: { onStart: () => void; onEditor: () => void; onTutorial: () => void; config: GameConfig }) { const deckCount = Object.values(config.hero.cards).reduce((total, count) => total + count, 0); return <section className="menu-page page-pad"><div className="menu-backdrop" aria-hidden="true" /><div className="hero-copy"><p className="eyebrow">MVP 0.1 · 第一关试炼</p><h1>色域遗迹<br /><em>四色封印，寻找生路</em></h1><p className="lede">填满四色区域，完成遗迹试炼；也可以攻击守门者的身体部位，在有限费用和敌人意图之间找到突破口。</p><div className="menu-actions"><button className="primary-btn" onClick={onStart}>开始游戏 <span>→</span></button><button className="secondary-btn" onClick={onEditor}>规则编辑器</button></div><button className="tutorial-link" onClick={onTutorial}>？ 查看新手引导</button><p className="menu-goal">选择地点 · 管理费用 · 看穿下一次攻击</p></div><div className="menu-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="monster-glyph">✣</div><div className="floating-note note-a">赤 · 黄 · 蓝 · 绿</div><div className="floating-note note-b">四色封印</div></div><div className="feature-strip"><div><strong>{deckCount}</strong><span>张启程卡牌</span></div><div><strong>{config.monsters.length}</strong><span>个敌影档案</span></div><div><strong>3—2—3—1</strong><span>随机路线</span></div><div className="config-state"><span className="status-dot" /> 本地规则已保存 · {config.cards.length} 种卡牌</div></div><p className="menu-footer">单人卡组构筑原型 · 配置保存在当前浏览器</p></section> }

function TutorialIntro({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return <div className="tutorial-intro-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-intro-title">
    <div className="tutorial-intro-card">
      <span className="tutorial-seal" aria-hidden="true">✦</span>
      <p className="eyebrow">第一次进入遗迹</p>
      <h2 id="tutorial-intro-title">用几步看懂四色封印</h2>
      <p>引导会用纸张风格文本框提示地图、费用、敌人意图、地点卡和胜利条件。它不会改变战斗规则。</p>
      <div className="tutorial-intro-actions"><button className="primary-btn" onClick={onStart}>开始引导 <span>→</span></button><button className="secondary-btn" onClick={onSkip}>直接开始</button></div>
    </div>
  </div>
}

function TutorialGuide({ step, stepIndex, total, screen, onNext, onSkip }: { step: (typeof tutorialSteps)[number]; stepIndex: number; total: number; screen: Screen; onNext: () => void; onSkip: () => void }) {
  const waitingForMap = step.mapOnly && screen === 'map'
  const isLast = stepIndex === total - 1
  return <aside className={'tutorial-guide ' + (waitingForMap ? 'is-waiting' : '')} role="dialog" aria-label="新手引导">
    <div className="tutorial-guide-pin" aria-hidden="true">✦</div>
    <div className="tutorial-guide-body"><div className="tutorial-guide-meta"><span>新手引导</span><b>{stepIndex + 1} / {total}</b></div><h2>{step.title}</h2><p>{step.text}</p>{waitingForMap && <small className="tutorial-guide-hint">请先点击地图中带绿色边框的未知节点</small>}</div>
    <div className="tutorial-guide-actions"><button className="tutorial-skip" onClick={onSkip}>跳过引导</button><button className="tutorial-next" disabled={waitingForMap} onClick={onNext}>{isLast ? '完成' : waitingForMap ? '选择节点' : '下一步'}<span>→</span></button></div>
  </aside>
}

const MONSTER_ART: Record<string, string> = {
  'stone-snail': '/assets/monsters/stone-snail.png',
  'mist-lamp-wraith': '/assets/monsters/mist-lamp-wraith.png',
  'moss-frog': '/assets/monsters/moss-frog.png',
  'four-arm-guard': '/assets/monsters/four-arm-guard.png',
}
function Map({ run, onBattle, onBack }: { run: MapRun; onBattle: (node: RouteMapNode) => void; onBack: () => void }) {
  const completed = new Set(run.completedNodeIds)
  const nodeById = new globalThis.Map(run.route.nodes.map(node => [node.id, node]))
  const routeComplete = completed.has('boss')
  return <section className="map-page page-pad"><div className="map-backdrop" aria-hidden="true" /><div className="section-kicker"><span>首境 · 遗迹入口</span><span>命运路线 · 3—2—3—1</span></div><div className="map-heading"><div><p className="eyebrow">遗迹路线</p><h2>{routeComplete ? '守望者已陨落' : '选择你的试炼路径'}</h2><small className="map-seed">命运种子 {run.route.seed.toString(16).padStart(8, '0')}</small></div><button className="text-btn" onClick={onBack}>← 返回营地</button></div><div className="map-canvas map-route map-route-random"><svg className="map-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{run.route.edges.map(edge => { const from = nodeById.get(edge.from)!; const to = nodeById.get(edge.to)!; const active = completed.has(edge.from); return <line key={`${edge.from}-${edge.to}`} className={active ? 'map-connection is-active' : 'map-connection'} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> })}</svg>{run.route.nodes.map(node => { const isCompleted = completed.has(node.id); const unlocked = isRouteNodeUnlocked(run.route, run.completedNodeIds, node.id); if (node.kind === 'start') return <div className={'route-node start-route-node ' + (isCompleted ? 'is-completed' : '')} key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }}><span>启程</span><b>✦</b></div>; if (node.kind === 'boss') return <button className={'route-node random-monster-node boss-route-node ' + (isCompleted ? 'is-completed' : unlocked ? 'is-unlocked' : 'is-locked')} key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} disabled={!unlocked || isCompleted} onClick={() => onBattle(node)} aria-label={isCompleted ? '守望者已击败' : unlocked ? '进入终局试炼' : '终局试炼尚未解锁'}><span className="node-ring"><b>{isCompleted ? '✓' : unlocked ? '◆' : '·'}</b></span><strong>{isCompleted ? '守望者已败' : '终局试炼'}</strong><small>{unlocked ? '最终战 · 可进入' : '终局封印'}</small>{unlocked && !isCompleted && <i>进入终局 →</i>}</button>; return <button className={'route-node random-monster-node ' + (isCompleted ? 'is-completed' : unlocked ? 'is-unlocked' : 'is-locked')} key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} disabled={!unlocked || isCompleted} onClick={() => onBattle(node)} aria-label={isCompleted ? '该节点已完成' : unlocked ? '进入遗迹战斗' : '该节点尚未解锁'}><span className="node-ring"><b>{isCompleted ? '✓' : unlocked ? '?' : '·'}</b></span><strong>{isCompleted ? '已完成' : '未知战斗'}</strong><small>{unlocked ? '可达 · 尚未探索' : '尚未解锁'}</small>{unlocked && !isCompleted && <i>踏入战斗 →</i>}</button> })}<div className="map-caption">每次启程都会生成新的路线 · 完成节点后解锁相连道路</div></div></section>
}
function Battle({ config, state, setState, onMap, onRestart, notice }: { config: GameConfig; state: BattleState; setState: (s: BattleState) => void; onMap: () => void; onRestart: () => void; notice: (s: string) => void }) {
  const [selected, setSelected] = useState<string | undefined>()
  const [mode, setMode] = useState<'place' | 'attack' | undefined>()
  const [showLogs, setShowLogs] = useState(false)
  const [fx, setFx] = useState<BattleFx | undefined>()
  const fxTimer = useRef<number | undefined>(undefined)
  const monster = config.monsters.find(item => item.id === state.monsterId) ?? config.monsters[0]
  const attack = currentAttack(config, state.turn, state.monsterId)
  const attackSource = attack ? monster.parts.find(part => part.id === attack.partId) : undefined
  const attackSourceHp = attackSource ? (state.partHp[attackSource.id] ?? state.partHp[attackSource.color] ?? 0) : 0
  const attackSkipped = Boolean(attack && (!attackSource || attackSourceHp <= 0))
  const selectedCard = selected ? cardFor(config, selected) : undefined
  const targetColors = selectedCard ? (state.nextColors.length ? state.nextColors : selectedCard.colors) : []
  const playArea = state.phase === 'player' && Boolean(selectedCard && selectedCard.type === 'location')
  const playFx = (kind: BattleFxKind, target?: string) => { if (fxTimer.current) window.clearTimeout(fxTimer.current); const nextFx = { kind, target, key: Date.now() }; setFx(nextFx); fxTimer.current = window.setTimeout(() => { setFx(undefined); fxTimer.current = undefined }, 360) }
  const chooseCard = (id: string) => {
    const card = findCard(config, id)
    if (!card) return
    if (state.energy < card.cost) return notice('费用不足，还差 ' + (card.cost - state.energy) + ' 点。')
    if (card.type === 'skill') {
      setSelected(undefined)
      setMode(undefined)
      const next = useSkill(config, state, id)
      playFx(card.effect === 'block' ? 'block' : card.effect === 'draw' ? 'draw' : 'card-play')
      setState(next)
    } else if (card.type === 'location' && card.colors.length === 0 && card.effect === 'draw') {
      setSelected(undefined)
      setMode(undefined)
      playFx('draw')
      setState(useUtilityLocation(config, state, id))
    } else {
      setSelected(id)
      setMode(undefined)
    }
  }
  const finishTurn = () => {
    setSelected(undefined)
    setMode(undefined)
    const next = endTurn(config, state)
    const source = attack?.partId
    if (next.heroHp < state.heroHp) playFx('enemy-attack', source)
    else if (next.block < state.block) playFx('block')
    setState(next)
  }
  const useAt = (target: Color | string, selectedMode = mode) => {
    if (!selected || !selectedMode) return
    const next = useLocation(config, state, selected, selectedMode, target)
    if (next === state) return notice('这个目标不合法，或对应部位已经死亡。')
    if (selectedMode === 'place') playFx('region-fill', target)
    else playFx(next.partHp[target] <= 0 ? 'part-death' : 'part-hit', target)
    setState(next)
    setSelected(undefined)
    setMode(undefined)
  }
  const cardIcon = (card: CardDefinition) => card.effect === 'block' ? '⬟' : card.effect === 'draw' ? '▤' : card.effect === 'modifyNextLocationColors' ? '◉' : card.effect === 'place' ? '⌂' : card.effect === 'damagePart' ? '⚔' : '✦'
  const cardSummary = (card: CardDefinition) => card.effect === 'block' ? (card.amount ?? 0) + ' 点守护' : card.effect === 'draw' ? '寻回 ' + (card.draw ?? 0) + ' 张' : card.effect === 'modifyNextLocationColors' ? '唤醒四相' : card.type === 'location' && card.colors.length > 0 ? '落境或破部' : '技艺'
  const cardEffectDetail = (card: CardDefinition) => card.effect === 'block' ? `获得 ${card.amount ?? 0} 点格挡。` : card.effect === 'draw' ? `抽取 ${card.draw ?? 0} 张牌。` : card.effect === 'modifyNextLocationColors' ? '使下一张地点卡获得全部四色，可选择一个区域或部位使用。' : card.type === 'location' && card.colors.length > 0 ? `放入对应区域，或攻击对应部位，造成 ${card.attackDamage ?? config.rules.baseLocationDamage} 点伤害。` : card.description
  const cardTypeLabel = (card: CardDefinition) => card.type === 'skill' ? '技能卡' : '地点卡'
  const cardEnglishName = (card: CardDefinition) => card.nameEn || CARD_NAME_EN[card.id] || 'UNTITLED RELIC'
  const partButton = (part: GameConfig['monsters'][number]['parts'][number], index: number) => {
    const hp = state.partHp[part.id] ?? 0
    const isTarget = Boolean(selected && mode === 'attack' && targetColors.includes(part.color) && hp > 0)
    const intent = attack?.partId === part.id
    const fxHit = fx?.target === part.id && (fx.kind === 'part-hit' || fx.kind === 'part-death')
    const fxSource = fx?.target === part.id && fx.kind === 'enemy-attack'
    return <button key={part.id} className={'body-part part-index-' + index + ' ' + colorClass(part.color) + (hp <= 0 ? ' is-dead' : '') + (selected && mode === 'attack' ? ' is-selecting' : '') + (isTarget ? ' is-target' : '') + (fxHit ? ' is-fx-' + fx?.kind : '') + (fxSource ? ' is-fx-source' : '')} disabled={!isTarget} onClick={() => useAt(part.id, 'attack')} title={part.name} aria-label={part.name + ' ' + (hp <= 0 ? '已死亡' : hp + '/' + part.maxHp)}>
      <span className="part-glyph">{hp <= 0 ? '×' : COLOR_META[part.color].glyph}</span>
      <span className="part-data"><b>{hp <= 0 ? '熄灭' : hp + '/' + part.maxHp}</b><small>{part.name}</small></span>
      {intent && <span className="part-intent" title={hp > 0 ? '当前攻击意图' : '该部位已死亡'}>{hp > 0 ? '⚔ ' + attack.damage : '×'}</span>}
    </button>
  }
  return <section className="battle-page battle-v2" data-battle-fx={fx?.kind} data-battle-fx-target={fx?.target}>
    <div className="battle-backdrop" aria-hidden="true" />
    <div className="battle-hud">
      <div className="hud-title"><span className="hud-dot" /><div><strong>{monster.name}</strong><small>色域试炼</small></div></div>
      <div className="hud-stats">
        <div className={'hud-stat hp-stat' + (fx?.kind === 'enemy-attack' ? ' is-fx-hit' : '')}><span>♥</span><b>{state.heroHp}</b><small>生命</small></div>
        <div className={'hud-stat block-stat' + (fx?.kind === 'block' ? ' is-fx-block' : '')}><span>⬟</span><b>{state.block}</b><small>格挡</small></div>
        <div className="hud-stat energy-stat"><span>✦</span><b>{state.energy}</b><small>/ {config.rules.energyPerTurn} 费用</small></div>
      </div>
      <div className="hud-actions"><span className="turn-badge">回合 {state.turn}</span></div>
    </div>
    <div className="arena-shell">
      <div className="arena-topline"><span>四境封印</span></div>
      <div className="arena">
        <div className="battle-board">
        <svg className="battle-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="link-red" d="M 15 18 C 24 23, 29 30, 39 39" />
          <path className="link-yellow" d="M 85 18 C 76 23, 71 30, 61 39" />
          <path className="link-blue" d="M 15 82 C 24 77, 29 70, 39 61" />
          <path className="link-green" d="M 85 82 C 76 77, 71 70, 61 61" />
        </svg>
        <div className="zone-ring">
          {COLORS.map(color => {
            const region = monster.regions.find(r => r.color === color)
            const progress = state.regionProgress[color]
            const requirement = region?.requirement ?? 0
            const completed = progress >= requirement
            const isTarget = Boolean(playArea && mode === 'place' && targetColors.includes(color))
            return <button key={color} className={'zone-node ' + colorClass(color) + (completed ? ' is-complete' : '') + (playArea && mode === 'place' ? ' is-selecting' : '') + (isTarget ? ' is-target' : '') + (fx?.kind === 'region-fill' && fx.target === color ? ' is-fx-fill' : '')} disabled={playArea ? !isTarget : true} onClick={() => useAt(color, 'place')} aria-label={COLOR_META[color].label + '色区域 ' + progress + '/' + requirement}>
              <img className="region-art" src={REGION_ART[color]} alt="" aria-hidden="true" /><span className="zone-glyph">{completed ? '✓' : COLOR_META[color].glyph}</span><span className="zone-count">{progress}<i>/{requirement}</i></span><span className="zone-stack">{state.board[color].slice(-3).map((id, index) => <i key={id + '-' + index}>{findCard(config, id)?.symbol ?? '·'}</i>)}</span>
            </button>
          })}
        </div>
        <div className={'monster-stage' + (fx?.kind === 'enemy-attack' ? ' is-fx-enemy-attack' : '')} aria-label={monster.name}>
          <div className={'monster-intent' + (attackSkipped ? ' is-skipped' : '')}>{attack ? <><span className={colorClass(attack.color)}>{attackSkipped ? '×' : COLOR_META[attack.color].glyph}</span><strong>{attackSkipped ? '跳过' : '⚔ ' + attack.damage}</strong><small>{attackSource?.name ?? '攻击来源'}</small></> : <><span>◯</span><small>暂无行动</small></>}</div>
          <img className="warden-illustration" src={MONSTER_ART[monster.id] ?? `${DECOR_ROOT}/warden.png`} alt={monster.name} />
          <svg className="monster-figure-art" viewBox="0 0 240 300" role="img" aria-label={monster.name + '的手绘石像轮廓'}>
            <path className="monster-base-shadow" d="M42 278 Q120 258 198 278 Q120 300 42 278Z" />
            <path className="monster-leg" d="M91 208 L78 266 Q78 279 99 279 L112 213" />
            <path className="monster-leg" d="M128 213 L141 279 Q162 279 162 266 L149 208" />
            <path className="monster-arm" d="M84 119 Q45 130 48 176 Q50 198 70 204 L86 180" />
            <path className="monster-arm" d="M156 119 Q195 130 192 176 Q190 198 170 204 L154 180" />
            <path className="monster-torso" d="M83 108 Q120 92 157 108 L169 204 Q120 231 71 204Z" />
            <path className="monster-neck" d="M105 103 L105 87 L135 87 L135 103" />
            <path className="monster-head" d="M84 48 L99 23 L113 36 Q120 31 127 36 L141 23 L156 48 L151 91 Q120 108 89 91Z" />
            <path className="monster-face" d="M101 68 Q120 78 139 68 M111 86 Q120 91 129 86" />
            <circle className="monster-eye" cx="105" cy="61" r="3" /><circle className="monster-eye" cx="135" cy="61" r="3" />
            <path className="monster-mark" d="M120 111 L120 190 M103 145 Q120 155 137 145" />
          </svg>
          <div className="monster-stage-label"><span>✣</span><b>{monster.name}</b></div>
          <div className="body-parts">
            {monster.parts.map((part, index) => { const colorIndex = monster.parts.slice(0, index).filter(item => item.color === part.color).length; return <div className={'part-slot part-index-' + index + ' part-color-index-' + colorIndex + ' color-slot-' + part.color} key={part.id}>{partButton(part, index)}</div> })}
          </div>
        </div>
        {fx && (fx.kind === 'card-play' || fx.kind === 'draw') && <span key={fx.key} className={'battle-fx-mark ' + fx.kind} aria-hidden="true">{fx.kind === 'draw' ? '▤' : '✦'}</span>}
        </div>
      </div>
      <div className="latest-event"><button className="log-trigger" onClick={() => setShowLogs(true)} aria-label="打开战斗纪事"><span className="event-mark">▤</span><span>战斗纪事</span><b>{state.logs.length}</b></button></div>
    </div>
    <div className="hand-area hand-table">
      <div className="hand-heading"><div><strong>手中卡牌</strong><small>{state.hand.length} 张 · 选择一张卡牌</small></div><div className="hand-heading-tools"><div className="pile-counts"><span className="pile-stack" title={`牌库 ${state.drawPile.length} 张`} aria-label={`牌库 ${state.drawPile.length} 张`}><i>▤</i><b>{state.drawPile.length}</b><small>牌库</small></span><span className="pile-stack discard-pile" title={`弃牌堆 ${state.discard.length} 张`} aria-label={`弃牌堆 ${state.discard.length} 张`}><i>▧</i><b>{state.discard.length}</b><small>弃牌</small></span></div><button className="end-turn-compact hand-end-turn" disabled={state.phase !== 'player'} onClick={finishTurn}>结束回合 <span>↗</span></button></div></div>
      <div className="hand-scroll">
        {state.hand.map((id, index) => {
          const card = findCard(config, id)!
          const affordable = state.energy >= card.cost
          const colors = card.colors.map(color => <span key={color} className={'color-token ' + colorClass(color)}>{COLOR_META[color].glyph}</span>)
          return <button key={id + '-' + index} className={'battle-card ' + card.type + (selected === id ? ' is-selected' : '') + (!affordable ? ' is-unplayable' : '')} onClick={() => chooseCard(id)} title={card.description} aria-label={card.name + '，' + cardEnglishName(card) + '，费用 ' + card.cost}>
            <span className="card-frame-art" style={{ backgroundImage: `url(${card.type === 'location' ? CARD_FRAME.location : CARD_FRAME.neutral})` }} aria-hidden="true" />
            <span className="card-topline"><span className="card-cost-compact">{card.cost}</span><span className="card-type-mark">{CARD_ICON_ART[card.id] ? <img className="card-type-art" src={CARD_ICON_ART[card.id]} alt="" aria-hidden="true" /> : <span className="card-type-icon">{cardIcon(card)}</span>}</span><span className="card-colors">{colors}</span></span>
            <span className="card-art-window">{CARD_ART[card.id] ? <img className="card-art-image" src={CARD_ART[card.id]} alt="" aria-hidden="true" /> : <span className="card-art-fallback">{cardIcon(card)}</span>}</span>
            <span className="card-copy"><strong>{card.name}</strong><span className="card-name-en">{cardEnglishName(card)}</span></span>
            <span className="card-tooltip" role="tooltip"><span className="tooltip-heading"><b>{card.name}</b><small>{cardEnglishName(card)}</small></span><span className="tooltip-meta"><i>{cardTypeLabel(card)}</i><i>费用 {card.cost}</i></span><span className="tooltip-description">{cardEffectDetail(card)}</span><span className="tooltip-footer">{card.type === 'location' && card.colors.length > 0 ? '选择：注入色域 / 攻击部位' : '使用后进入弃牌堆'}</span></span>
          </button>
        })}
        {state.hand.length === 0 && <div className="empty-hand">手牌已清空 · 结束回合继续</div>}
      </div>
    </div>
    {playArea && <div className="action-tray">
      <div className="action-tray-copy"><b>{selectedCard?.name}</b><small>{mode ? '选择一个高亮目标' : '选择使用方式'}</small></div>
      <button className={mode === 'place' ? 'action-choice is-active' : 'action-choice'} onClick={() => setMode('place')} title="放入区域" aria-label="放入区域"><span>⌂</span></button>
      <button className={mode === 'attack' ? 'action-choice is-active' : 'action-choice'} onClick={() => setMode('attack')} title="攻击部位" aria-label="攻击部位"><span>⚔</span></button>
      <button className="action-cancel" onClick={() => { setSelected(undefined); setMode(undefined) }}>取消</button>
    </div>}
    {showLogs && <div className="log-overlay" onClick={() => setShowLogs(false)}><aside className="log-drawer" onClick={e => e.stopPropagation()}><div><strong>战斗纪事</strong><button onClick={() => setShowLogs(false)}>×</button></div>{state.logs.map((log, i) => <p key={log + '-' + i}><i>{state.logs.length - i}</i>{log}</p>)}</aside></div>}
    {(state.phase === 'victory' || state.phase === 'defeat') && <div className={'result-modal ' + state.phase}><div className="result-card"><img className="result-art" src={`${DECOR_ROOT}/scene-${state.phase === 'victory' ? 'victory' : 'defeat'}.png`} alt="" aria-hidden="true" /><div className="result-content"><span className="result-mark">{state.phase === 'victory' ? '✦' : '×'}</span><p className="eyebrow">{state.phase === 'victory' ? '胜利' : '失败'}</p><h2>{state.outcome}</h2><p>{state.phase === 'victory' ? '四色区域已全部达标。' : '英雄生命归零。'}</p><div><button className="primary-btn" onClick={onRestart}>重新开始</button><button className="secondary-btn" onClick={onMap}>返回地图</button></div></div></div></div>}
  </section>
}
function Editor({ config, update, onBack, notice }: { config: GameConfig; update: (c: GameConfig, m?: string) => void; onBack: () => void; notice: (message: string) => void }) {
  const [tab, setTab] = useState<'cards' | 'monster' | 'hero' | 'rules'>('cards'); const [json, setJson] = useState(''); const [editingMonsterId, setEditingMonsterId] = useState(config.monsters[0]?.id ?? '')
  const monster = config.monsters.find(item => item.id === editingMonsterId) ?? config.monsters[0]
  const patchCard = (id: string, patch: Partial<CardDefinition>) => update({ ...config, cards: config.cards.map(c => c.id === id ? { ...c, ...patch } : c) })
  const cardNumericValue = (card: CardDefinition) => card.effect === 'block' ? card.amount : card.effect === 'draw' ? card.draw : card.effect === 'place' ? card.placement : card.attackDamage
  const updateCardNumeric = (card: CardDefinition, value: number) => patchCard(card.id, card.effect === 'block' ? { amount: value } : card.effect === 'draw' ? { draw: value } : card.effect === 'place' ? { placement: value } : { attackDamage: value })
  const addCard = () => { const id = `custom-${Date.now()}`; const newCard: CardDefinition = { id, name: '新卡牌', type: 'skill', cost: 1, colors: [], symbol: '✦', copies: 0, description: '新卡牌效果', effect: 'none', amount: 0, attackDamage: 0, draw: 0, placement: 0, nextColors: [], afterUse: 'discard' }; update({ ...config, cards: [...config.cards, newCard], hero: { ...config.hero, cards: { ...config.hero.cards, [id]: 0 } } }, '已新增卡牌。') }
  const duplicateCard = (source: CardDefinition) => { const id = `${source.id}-copy-${Date.now()}`; update({ ...config, cards: [...config.cards, { ...source, id, name: `${source.name} 副本` }], hero: { ...config.hero, cards: { ...config.hero.cards, [id]: 0 } } }, '已复制卡牌。') }
  const deleteCard = (id: string) => update({ ...config, cards: config.cards.filter(c => c.id !== id), hero: { ...config.hero, cards: Object.fromEntries(Object.entries(config.hero.cards).filter(([key]) => key !== id)) } }, '已删除卡牌档案。')
  const cardRows = config.cards.map(card => <div className="editor-card" key={card.id}><div className="editor-card-title"><span className={`mini-symbol ${card.colors[0] ? colorClass(card.colors[0]) : ''}`}>{card.symbol}</span><input value={card.name} onChange={e => patchCard(card.id, { name: e.target.value })} /><span className="id-tag">{card.id}</span><button className="icon-btn" onClick={() => duplicateCard(card)}>复制</button><button className="icon-btn danger" onClick={() => deleteCard(card.id)}>删除</button></div><div className="field-grid"><label>类型<select value={card.type} onChange={e => patchCard(card.id, { type: e.target.value as CardDefinition['type'] })}><option value="skill">技能</option><option value="location">地点</option></select></label><label>英文名<input value={card.nameEn ?? ""} onChange={e => patchCard(card.id, { nameEn: e.target.value.toUpperCase() })} /></label><label>费用<input type="number" value={card.cost} onChange={e => patchCard(card.id, { cost: +e.target.value })} /></label><label>数量<input type="number" min="0" value={config.hero.cards[card.id] ?? 0} onChange={e => update({ ...config, hero: { ...config.hero, cards: { ...config.hero.cards, [card.id]: +e.target.value } } })} /></label><label>符号<input value={card.symbol} onChange={e => patchCard(card.id, { symbol: e.target.value })} /></label><label>效果<select value={card.effect} onChange={e => patchCard(card.id, { effect: e.target.value as CardDefinition['effect'] })}><option value="none">无</option><option value="block">格挡</option><option value="draw">抽牌</option><option value="place">地点</option><option value="modifyNextLocationColors">强化下一地点</option></select></label><label>效果数值<input type="number" value={cardNumericValue(card)} onChange={e => updateCardNumeric(card, +e.target.value)} /></label><label>颜色<select multiple value={card.colors} onChange={e => patchCard(card.id, { colors: Array.from(e.currentTarget.selectedOptions).map(option => option.value as Color) })}>{COLORS.map(color => <option key={color} value={color}>{COLOR_META[color].label}</option>)}</select></label><label>使用后去向<select value={card.afterUse} onChange={e => patchCard(card.id, { afterUse: e.target.value as CardDefinition['afterUse'] })}><option value="discard">弃牌堆</option><option value="board">区域</option></select></label></div><textarea value={card.description} onChange={e => patchCard(card.id, { description: e.target.value })} /></div>)
  const patchMonster = (patch: Partial<MonsterDefinition>) => update({ ...config, monsters: config.monsters.map(item => item.id === monster.id ? { ...item, ...patch } : item) })
  const addMonster = () => { const id = `monster-${Date.now()}`; update({ ...config, monsters: [...config.monsters, { ...monster, id, name: '新怪物' }] }, '已新增怪物。'); setEditingMonsterId(id) }
  const duplicateMonster = () => { const id = `${monster.id}-copy-${Date.now()}`; update({ ...config, monsters: [...config.monsters, { ...monster, id, name: `${monster.name} 副本`, parts: monster.parts.map((part, index) => ({ ...part, id: `${id}-part-${index}` })), attacks: monster.attacks.map(attack => ({ ...attack, partId: monster.parts.findIndex(part => part.id === attack.partId) >= 0 ? `${id}-part-${monster.parts.findIndex(part => part.id === attack.partId)}` : attack.partId })) }] }, '已复制当前怪物。'); setEditingMonsterId(id) }
  const deleteMonster = () => { if (config.monsters.length <= 1) return update(config, '至少保留一个怪物。'); const next = config.monsters.filter(item => item.id !== monster.id); update({ ...config, monsters: next }, '已删除当前怪物。'); setEditingMonsterId(next[0].id) }
  const swapColors = <T extends { color: Color }>(items: T[], from: Color, to: Color) => items.map(item => item.color === from ? { ...item, color: to } : item.color === to ? { ...item, color: from } : item)
  const editRegion = (color: Color, requirement: number) => patchMonster({ regions: monster.regions.map(r => r.color === color ? { ...r, requirement } : r) }); const editRegionColor = (from: Color, to: Color) => patchMonster({ regions: swapColors(monster.regions, from, to) }); const editPart = (id: string, patch: Partial<MonsterDefinition['parts'][number]>) => { const nextId = patch.id ?? id; patchMonster({ parts: monster.parts.map(p => p.id === id ? { ...p, ...patch } : p), attacks: monster.attacks.map(a => a.partId === id ? { ...a, partId: nextId } : a) }) }; const deletePart = (id: string) => patchMonster({ parts: monster.parts.filter(p => p.id !== id), attacks: monster.attacks.filter(a => a.partId !== id) }); const addPart = () => { const id = `${monster.id}-part-${Date.now()}`; patchMonster({ parts: [...monster.parts, { id, name: '新部位', color: 'red', maxHp: 1 }] }) }; const editAttack = (index: number, patch: Partial<MonsterDefinition['attacks'][number]>) => patchMonster({ attacks: monster.attacks.map((a, i) => i === index ? { ...a, ...patch } : a) }); const addAttack = () => { const part = monster.parts[0]; if (part) patchMonster({ attacks: [...monster.attacks, { partId: part.id, color: part.color, damage: 1, turn: 1, enabled: true }] }) }; const deleteAttack = (index: number) => patchMonster({ attacks: monster.attacks.filter((_, i) => i !== index) })
  const importJson = () => { try { const next = validateConfig(JSON.parse(json)); update(next, '规则导入成功。'); setJson('') } catch (e) { update(config, `导入失败：${e instanceof Error ? e.message : 'JSON 格式错误。'}`) } }
  const exportJson = () => { navigator.clipboard?.writeText(JSON.stringify(config, null, 2)); setJson(JSON.stringify(config, null, 2)); update(config, '规则文本已生成并复制。') }
  const saveFile = async () => { try { const mode = await saveJsonFile('four-color-roguelike-config.json', config); notice(mode === 'file' ? '规则已保存为本地文件。' : '浏览器不支持直接写文件，配置已下载。') } catch (e) { if ((e as DOMException)?.name !== 'AbortError') notice(`保存失败：${e instanceof Error ? e.message : '无法写入文件。'}`) } }
  const importFile = async () => { try { const next = validateConfig(await openJsonFile()); update(next, '规则文件读取成功。'); setJson('') } catch (e) { if ((e as DOMException)?.name !== 'AbortError') notice(`读取失败：${e instanceof Error ? e.message : '配置文件无效。'}`) } }
  return <section className="editor-page page-pad"><div className="editor-heading"><div><p className="eyebrow">遗迹工坊 / 规则配置</p><h2>规则工坊</h2><p>调整后会自动保存；重新启程即可应用新规则。</p></div><button className="text-btn" onClick={onBack}>← 返回</button></div><div className="editor-layout"><aside className="editor-nav">{[['cards', '卡牌档案'], ['monster', '敌影档案'], ['hero', '英雄档案'], ['rules', '试炼规则']] .map(([key, label]) => <button key={key} className={tab === key ? 'editor-tab-active' : ''} onClick={() => setTab(key as typeof tab)}><span>{key === 'cards' ? '✦' : key === 'monster' ? '✣' : key === 'hero' ? '◈' : '⚙'}</span>{label}<b>→</b></button>)}<div className="editor-tools"><button onClick={saveFile}>保存规则文件</button><button onClick={importFile}>读取规则文件</button><button onClick={() => update(resetConfig(), '已恢复初始规则配置。')}>恢复初始规则</button><button onClick={exportJson}>导出规则</button><button onClick={importJson}>导入规则</button><textarea placeholder="粘贴规则文本后点击导入" value={json} onChange={e => setJson(e.target.value)} /></div></aside><div className="editor-content">{tab === 'cards' && <><div className="content-title"><div><h3>卡牌档案</h3><p>启程牌组共 {Object.values(config.hero.cards).reduce((a, b) => a + b, 0)} 张；技能卡不携带色域属性。</p></div><button className="secondary-btn" onClick={addCard}>＋ 添加卡牌</button></div>{cardRows}</>}{tab === 'monster' && <div className="config-section"><div className="config-title-row"><h3>敌影档案</h3><div><button className="icon-btn" onClick={addMonster}>新增</button><button className="icon-btn" onClick={duplicateMonster}>复制当前</button><button className="icon-btn danger" onClick={deleteMonster}>删除当前</button></div></div><label className="wide-label">当前编辑的敌影<select value={monster.id} onChange={e => setEditingMonsterId(e.target.value)}>{config.monsters.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label><label className="wide-label">名称<input value={monster.name} onChange={e => patchMonster({ name: e.target.value })} /></label><h4>四境封印要求</h4><div className="four-grid">{COLORS.map(color => <label key={color} className={colorClass(color)}>{COLOR_META[color].label}域<select value={color} onChange={e => editRegionColor(color, e.target.value as Color)}>{COLORS.map(option => <option key={option} value={option}>{COLOR_META[option].label}</option>)}</select><input type="number" min="0" value={monster.regions.find(r => r.color === color)!.requirement} onChange={e => editRegion(color, +e.target.value)} /></label>)}</div><div className="config-title-row"><h4>身体部位</h4><button className="icon-btn" onClick={addPart}>＋ 新增部位</button></div><div className="part-editor-list">{monster.parts.map(part => <div className="editor-part-row" key={part.id}><label>部位 id<input value={part.id} onChange={e => editPart(part.id, { id: e.target.value })} /></label><label>名称<input value={part.name} onChange={e => editPart(part.id, { name: e.target.value })} /></label><label>颜色<select value={part.color} onChange={e => editPart(part.id, { color: e.target.value as Color })}>{COLORS.map(option => <option key={option} value={option}>{COLOR_META[option].label}</option>)}</select></label><label>生命<input type="number" min="0" value={part.maxHp} onChange={e => editPart(part.id, { maxHp: +e.target.value })} /></label><button className="icon-btn danger" onClick={() => deletePart(part.id)}>删除</button></div>)}</div><div className="config-title-row"><h4>行动预告</h4><button className="icon-btn" onClick={addAttack} disabled={!monster.parts.length}>＋ 新增行动</button></div>{monster.attacks.map((attack, i) => <div className="attack-row" key={`${attack.partId}-${i}`}><label>攻击来源<select value={attack.partId} onChange={e => editAttack(i, { partId: e.target.value })}>{monster.parts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label><label className={colorClass(attack.color)}>攻击颜色<select value={attack.color} onChange={e => editAttack(i, { color: e.target.value as Color })}>{COLORS.map(option => <option key={option} value={option}>{COLOR_META[option].label}</option>)}</select></label><label>伤害<input type="number" value={attack.damage} onChange={e => editAttack(i, { damage: +e.target.value })} /></label><label>触发回合<input type="number" value={attack.turn} onChange={e => editAttack(i, { turn: +e.target.value })} /></label><label>启用<input type="checkbox" checked={attack.enabled} onChange={e => editAttack(i, { enabled: e.target.checked })} /></label><button className="icon-btn danger" onClick={() => deleteAttack(i)}>删除</button></div>)}<label className="wide-label">部位失效后的行动<select value={monster.deadPartBehavior} onChange={e => patchMonster({ deadPartBehavior: e.target.value as 'skip' | 'retarget' })}><option value="skip">跳过此次攻击</option><option value="retarget">改为其他目标（引擎预留）</option></select></label></div>}{tab === 'hero' && <div className="config-section"><h3>英雄档案</h3><div className="field-grid"><label>英雄名称<input value={config.hero.name} onChange={e => update({ ...config, hero: { ...config.hero, name: e.target.value } })} /></label><label>职业<input value={config.hero.className} onChange={e => update({ ...config, hero: { ...config.hero, className: e.target.value } })} /></label><label>代表颜色<select value={config.hero.color} onChange={e => update({ ...config, hero: { ...config.hero, color: e.target.value as Color } })}>{COLORS.map(color => <option key={color} value={color}>{COLOR_META[color].label}</option>)}</select></label><label>初始生命<input type="number" value={config.hero.maxHp} onChange={e => update({ ...config, hero: { ...config.hero, maxHp: +e.target.value } })} /></label></div><p className="editor-note">启程牌组数量在“卡牌档案”中调整，默认共 10 张。</p></div>}{tab === 'rules' && <div className="config-section"><h3>试炼规则</h3><div className="field-grid"><label>每回合费用<input type="number" value={config.rules.energyPerTurn} onChange={e => update({ ...config, rules: { ...config.rules, energyPerTurn: +e.target.value } })} /></label><label>每回合抽牌<input type="number" value={config.rules.cardsPerTurn} onChange={e => update({ ...config, rules: { ...config.rules, cardsPerTurn: +e.target.value } })} /></label><label>基础地点攻击<input type="number" value={config.rules.baseLocationDamage} onChange={e => update({ ...config, rules: { ...config.rules, baseLocationDamage: +e.target.value } })} /></label><label>格挡持续<select value={config.rules.blockDuration} onChange={e => update({ ...config, rules: { ...config.rules, blockDuration: e.target.value as 'turn' | 'round' } })}><option value="turn">敌方行动后清除</option><option value="round">跨回合保留</option></select></label></div><div className="rule-toggles"><label><input type="checkbox" checked={config.rules.immediateVictory} onChange={e => update({ ...config, rules: { ...config.rules, immediateVictory: e.target.checked } })} />最后一个区域达标时立即胜利</label><label><input type="checkbox" checked={config.rules.exhaustedAttackBehavior === 'skip'} onChange={e => { const behavior = e.target.checked ? 'skip' : 'retarget'; update({ ...config, rules: { ...config.rules, exhaustedAttackBehavior: behavior }, monsters: config.monsters.map(monster => ({ ...monster, deadPartBehavior: behavior })) }) }} />死亡攻击部位时跳过攻击</label></div><p className="editor-note">寻光卷轴与四相启示默认费用为 0；强化只作用于下一张实际使用的地点卡，且每次只能选择一个区域或部位。</p></div>}</div></div></section>
}
