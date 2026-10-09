import type { CSSProperties, ReactNode } from 'react'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

const serif = loadFraunces('normal', { weights: ['600'], subsets: ['latin', 'latin-ext'] }).fontFamily
const sans = loadInter('normal', { weights: ['400', '500', '600'], subsets: ['latin', 'latin-ext'] }).fontFamily

// BeWise brand (apps/mobile/src/style.css)
const C = { ink: '#0b1016', ink2: '#121a23', ink3: '#1b2531', sky: '#00c0ff', aqua: '#00d9f2', mint: '#a6ffcb', rose: '#ff5f8f' }
const GRADIENT = `linear-gradient(90deg, ${C.sky}, ${C.mint})`

// A type alias (not an interface) so Remotion accepts it as Record<string, unknown> props.
export type PromoProps = { platform: 'appstore' | 'web' }

// Scene timing, in frames at 30 fps.
const S = {
  hook: [0, 75],
  today: [75, 165],
  langs: [165, 285],
  themes: [285, 375],
  nudge: [375, 465],
  widget: [465, 570],
  archive: [570, 660],
  end: [660, 765],
} as const
export const DURATION = S.end[1]
const FADE = 8

const LANGS = [
  ['life-ja', '日本語'],
  ['life-fr', 'Français'],
  ['life-hi', 'हिन्दी'],
  ['life-ko', '한국어'],
  ['life-es', 'Español'],
  ['life-zh-Hans', '中文'],
  ['life-de', 'Deutsch'],
  ['life-pt-BR', 'Português'],
] as const
const LANG_FRAMES = (S.langs[1] - S.langs[0]) / LANGS.length

const shot = (name: string) => staticFile(`shots/${name}.jpg`)
const ease = Easing.bezier(0.22, 1, 0.36, 1)

function useLayout() {
  const { width, height } = useVideoConfig()
  const portrait = height > width
  // Phone screen keeps the iPhone capture ratio (1320x2868).
  const screenH = portrait ? 1340 : 900
  const screenW = Math.round(screenH * 1320 / 2868)
  return { width, height, portrait, screenH, screenW }
}

/** Ink background with two slow teal glows, like the store screenshots. */
function Backdrop() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const drift = Math.sin(frame / 90) * 60
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: 'absolute', left: -width * 0.25 + drift, top: -height * 0.2, width: width * 1.1, height: width * 1.1, borderRadius: '50%', background: `radial-gradient(circle, ${C.aqua}2e 0%, transparent 62%)` }} />
      <div style={{ position: 'absolute', right: -width * 0.35 - drift, bottom: -height * 0.15, width: width, height: width, borderRadius: '50%', background: `radial-gradient(circle, ${C.mint}1c 0%, transparent 60%)` }} />
    </AbsoluteFill>
  )
}

/** Fade a whole scene in and out so scenes overlap softly. */
function SceneFade({ length, children, out = true }: { length: number, children: ReactNode, out?: boolean }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, FADE, length - FADE, length], [0, 1, 1, out ? 0 : 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

/** Two-line headline: white, then the brand gradient. Words rise in one by one. */
function Headline({ top, bottom, size, align = 'center', delay = 0 }: { top: string, bottom: string, size: number, align?: 'center' | 'left', delay?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  let i = 0
  const word = (w: string, style: CSSProperties) => {
    const p = spring({ frame: frame - delay - i++ * 3, fps, config: { damping: 200 }, durationInFrames: 18 })
    return (
      <span key={`${w}${i}`} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 0.45}em)`, marginRight: '0.24em', ...style }}>{w}</span>
    )
  }
  const gradient: CSSProperties = { backgroundImage: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingBottom: '0.08em' }
  return (
    <div style={{ fontFamily: serif, fontWeight: 600, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.01em', color: 'white', textAlign: align }}>
      <div>{top.split(' ').map(w => word(w, {}))}</div>
      <div>{bottom.split(' ').map(w => word(w, gradient))}</div>
    </div>
  )
}

function Phone({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  const { screenW, screenH } = useLayout()
  const bezel = Math.round(screenW * 0.035)
  const radius = screenW * 0.14
  return (
    <div style={{ position: 'absolute', width: screenW + bezel * 2, height: screenH + bezel * 2, borderRadius: radius + bezel, background: '#1d2530', padding: bezel, boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px #2c3644, 0 0 80px ${C.aqua}22`, ...style }}>
      <div style={{ position: 'relative', width: screenW, height: screenH, borderRadius: radius, overflow: 'hidden', background: C.ink }}>
        {children}
        <div style={{ position: 'absolute', top: screenH * 0.012, left: '50%', width: screenW * 0.3, height: screenH * 0.034, marginLeft: -screenW * 0.15, borderRadius: 999, background: 'black' }} />
      </div>
    </div>
  )
}

const Screen = ({ name, scale = 1 }: { name: string, scale?: number }) => (
  <Img src={shot(name)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `scale(${scale})` }} />
)

/** What the phone shows over the whole film, switching with each scene. */
function PhoneContent() {
  const frame = useCurrentFrame()
  const { screenW, screenH } = useLayout()
  const zoom = (start: number) => interpolate(frame, [start, start + 100], [1, 1.035], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Screens stack in time order: each one fades in over the previous (which
  // stays fully visible underneath), so the phone never dims between screens.
  const layers: { start: number, fade: number, node: ReactNode }[] = [
    { start: S.today[0], fade: 0, node: <Screen name="life-en" /> },
    ...LANGS.map(([name], i) => ({ start: S.langs[0] + i * LANG_FRAMES, fade: 5, node: <Screen name={name} /> })),
    { start: S.themes[0], fade: FADE, node: <Screen name="themes" scale={zoom(S.themes[0])} /> },
    { start: S.nudge[0], fade: FADE, node: <Screen name="onb2" /> },
    { start: S.widget[0], fade: FADE, node: <HomeScreen /> },
    { start: S.archive[0], fade: FADE, node: <Screen name="archive" scale={zoom(S.archive[0])} /> },
  ]

  // Love tap on today's quote: heart button sits at 13.5% / 85.9% of the capture.
  const tap = frame - (S.today[0] + 48)
  const heart = tap >= 0 ? spring({ frame: tap, fps: 30, config: { damping: 9, stiffness: 160 } }) : 0
  return (
    <>
      {layers.map((layer, i) => {
        const next = layers[i + 1]
        if (frame < layer.start || (next && frame >= next.start + next.fade))
          return null
        const opacity = layer.fade ? interpolate(frame, [layer.start, layer.start + layer.fade], [0, 1], { extrapolateRight: 'clamp' }) : 1
        return <AbsoluteFill key={i} style={{ opacity }}>{layer.node}</AbsoluteFill>
      })}
      {frame >= S.nudge[0] && frame < S.widget[0] && <Notification start={S.nudge[0] + 22} />}
      {heart > 0 && frame < S.langs[0] && (
        <div style={{ position: 'absolute', left: screenW * 0.135, top: screenH * 0.859, transform: `translate(-50%, -50%) scale(${0.6 + heart * 0.9})`, opacity: interpolate(tap, [0, 4, 30, 40], [0, 1, 1, 0], { extrapolateRight: 'clamp' }) }}>
          <svg width={screenW * 0.08} height={screenW * 0.08} viewBox="0 0 24 24"><path fill={C.rose} d="M12 21s-7.5-4.6-10-9.3C.4 8.5 2.3 4.5 6 4.5c2.2 0 3.6 1.2 4.4 2.4h3.2C14.4 5.7 15.8 4.5 18 4.5c3.7 0 5.6 4 4 7.2C19.5 16.4 12 21 12 21z" /></svg>
        </div>
      )}
    </>
  )
}

/** iOS-style banner for the daily reminder. */
function Notification({ start }: { start: number }) {
  const frame = useCurrentFrame()
  const { screenW } = useLayout()
  const p = spring({ frame: frame - start, fps: 30, config: { damping: 16, stiffness: 120 } })
  const u = screenW / 100
  return (
    <div style={{ position: 'absolute', left: u * 3.5, right: u * 3.5, top: u * 12, transform: `translateY(${(p - 1) * u * 40}px)`, opacity: p, borderRadius: u * 6, padding: `${u * 3.4}px ${u * 4}px`, background: 'rgba(40,48,60,0.82)', backdropFilter: 'blur(20px)', display: 'flex', gap: u * 3, alignItems: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
      <Img src={staticFile('icon.png')} style={{ width: u * 10, height: u * 10, borderRadius: u * 2.4 }} />
      <div style={{ flex: 1, fontFamily: sans, color: 'white', lineHeight: 1.25 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: u * 3.6, fontWeight: 600 }}>
          <span>Your daily wisdom is here</span>
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: u * 3.1 }}>now</span>
        </div>
        <div style={{ fontSize: u * 3.4, opacity: 0.85 }}>Take 10 seconds for today’s quote.</div>
      </div>
    </div>
  )
}

/** Home screen with the BeWise widget (recreated from the iOS widget design). */
function HomeScreen() {
  const frame = useCurrentFrame()
  const { screenW, screenH } = useLayout()
  const u = screenW / 100
  const pop = spring({ frame: frame - S.widget[0] - 8, fps: 30, config: { damping: 14, stiffness: 140 } })
  const app = (i: number, icon?: boolean) => (
    <div key={i} style={{ width: u * 15, height: u * 15, borderRadius: u * 3.6, overflow: 'hidden', background: icon ? 'transparent' : 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
      {icon && <Img src={staticFile('icon.png')} style={{ width: '100%', height: '100%' }} />}
    </div>
  )
  return (
    <AbsoluteFill>
      {/* Wallpaper in BeWise colors. */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 70% at 15% 10%, ${C.aqua}aa 0%, transparent 55%), radial-gradient(100% 60% at 90% 85%, ${C.mint}88 0%, transparent 60%), radial-gradient(80% 50% at 80% 30%, #3b5bdb66 0%, transparent 60%), ${C.ink2}` }} />
      <div style={{ position: 'absolute', top: u * 3.6, left: u * 10, fontFamily: sans, fontWeight: 600, fontSize: u * 4, color: 'white' }}>9:41</div>
      {/* Medium widget */}
      <div style={{ position: 'absolute', left: u * 6, right: u * 6, top: u * 20, height: u * 41, borderRadius: u * 6, overflow: 'hidden', transform: `scale(${0.85 + pop * 0.15})`, opacity: pop, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${shot('life-en')})`, backgroundSize: `${u * 100}px auto`, backgroundPosition: `0 ${-u * 32}px` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.65))' }} />
        <div style={{ position: 'absolute', inset: 0, padding: u * 4.6, display: 'flex', flexDirection: 'column', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: sans }}>
            <span style={{ fontSize: u * 2.6, fontWeight: 600, letterSpacing: '0.16em', opacity: 0.8 }}>QUOTE OF THE DAY</span>
            <span style={{ fontSize: u * 2.8, fontWeight: 600, padding: `${u * 0.9}px ${u * 2.4}px`, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }}>Life</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: u * 5.4, lineHeight: 1.18, textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>If I had to live my life again, I’d make the same mistakes, only sooner.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: u * 1.6, marginTop: u * 2.4, fontFamily: sans, fontSize: u * 3.1, opacity: 0.9 }}>
            <span style={{ width: u * 4, height: 1.5, background: C.mint }} />
            Tallulah Bankhead
          </div>
        </div>
      </div>
      {/* App grid + dock */}
      <div style={{ position: 'absolute', top: u * 68, left: u * 8, right: u * 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: u * 7, justifyItems: 'center' }}>
        {Array.from({ length: 12 }, (_, i) => app(i))}
      </div>
      <div style={{ position: 'absolute', bottom: u * 5, left: u * 4, right: u * 4, height: u * 23, borderRadius: u * 9, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(14px)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {[0, 1, 2].map(i => app(100 + i))}
        {app(200, true)}
      </div>
      <div style={{ position: 'absolute', top: screenH * 0.012 }} />
    </AbsoluteFill>
  )
}

/** Native language names flipping under the headline. */
function LanguageTicker({ size }: { size: number }) {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const i = Math.min(LANGS.length - 1, Math.floor(frame / LANG_FRAMES))
  const local = frame - i * LANG_FRAMES
  const p = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp', easing: ease })
  return (
    <div style={{ display: 'inline-flex', alignSelf: portrait ? 'center' : 'flex-start', alignItems: 'center', gap: size * 0.4, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, background: `${C.ink3}cc`, border: `1.5px solid ${C.aqua}55`, fontFamily: sans, fontWeight: 600, fontSize: size, color: 'white' }}>
      <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: 99, background: C.mint, boxShadow: `0 0 ${size}px ${C.mint}` }} />
      <span style={{ display: 'inline-block', minWidth: size * 4, opacity: p, transform: `translateY(${(1 - p) * size * 0.5}px)` }}>{LANGS[i][1]}</span>
    </div>
  )
}

const CAPTIONS: { scene: keyof typeof S, top: string, bottom: string }[] = [
  { scene: 'today', top: 'Wake up to', bottom: 'a wise quote.' },
  { scene: 'langs', top: 'In your language.', bottom: 'Any language.' },
  { scene: 'themes', top: 'Pick the voice', bottom: 'you need today.' },
  { scene: 'nudge', top: 'A gentle nudge,', bottom: 'at your time.' },
  { scene: 'widget', top: 'Right on your', bottom: 'home screen.' },
  { scene: 'archive', top: 'Every quote,', bottom: 'always with you.' },
]

function Hook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { portrait, width } = useLayout()
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 110 } })
  const size = portrait ? 86 : 120
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: size * 0.5, flexDirection: 'column' }}>
      <Img src={staticFile('icon.png')} style={{ width: width * (portrait ? 0.26 : 0.1), borderRadius: '23%', transform: `scale(${logo})`, boxShadow: `0 0 120px ${C.aqua}55` }} />
      <Headline top="One good thought," bottom="every morning." size={size} delay={10} />
    </AbsoluteFill>
  )
}

function EndCard({ platform }: PromoProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { portrait, width } = useLayout()
  const logo = spring({ frame: frame - 6, fps, config: { damping: 13, stiffness: 100 } })
  const line = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const name = portrait ? 120 : 132
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: name * 0.3 }}>
      <Img src={staticFile('icon.png')} style={{ width: width * (portrait ? 0.32 : 0.12), borderRadius: '23%', transform: `scale(${logo})`, boxShadow: `0 0 160px ${C.aqua}66` }} />
      <div style={{ fontFamily: serif, fontWeight: 600, fontSize: name, color: 'white', opacity: logo, letterSpacing: '-0.01em' }}>BeWise</div>
      <div style={{ fontFamily: sans, fontWeight: 500, fontSize: name * 0.3, color: 'white', opacity: line * 0.85, transform: `translateY(${(1 - line) * 20}px)`, textAlign: 'center', padding: '0 60px' }}>
        Daily wisdom, in your language.
      </div>
      {platform === 'web' && (
        <div style={{ marginTop: name * 0.25, fontFamily: sans, fontWeight: 600, fontSize: name * 0.24, opacity: line, display: 'flex', gap: 18, alignItems: 'center' }}>
          <span style={{ padding: '14px 30px', borderRadius: 999, background: 'white', color: C.ink }}>Free on iPhone & Android</span>
          <span style={{ backgroundImage: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>bewise.love</span>
        </div>
      )}
    </AbsoluteFill>
  )
}

export function Promo({ platform }: PromoProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { portrait, width, height, screenW, screenH } = useLayout()

  // The phone rises in after the hook, floats gently, and drops away for the end card.
  const enter = spring({ frame: frame - S.today[0], fps, config: { damping: 18, stiffness: 90 } })
  const leave = interpolate(frame, [S.end[0] - 4, S.end[0] + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const float = Math.sin(frame / 40) * 8
  const phoneW = screenW * 1.07
  const phoneLeft = portrait ? (width - phoneW) / 2 : width * 0.74 - phoneW / 2
  const phoneTop = portrait ? height - screenH * 1.07 - 40 : (height - screenH * 1.07) / 2
  const captionStyle: CSSProperties = portrait
    ? { position: 'absolute', top: 110, left: 40, right: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }
    : { position: 'absolute', left: 150, width: 860, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36 }

  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Backdrop />
      <Sequence from={S.hook[0]} durationInFrames={S.hook[1] - S.hook[0]}>
        <SceneFade length={S.hook[1] - S.hook[0]}><Hook /></SceneFade>
      </Sequence>

      {frame >= S.today[0] && frame < S.end[0] + 20 && (
        <Phone style={{ left: phoneLeft, top: phoneTop + (1 - enter) * 500 + leave * 700 + float, opacity: Math.min(enter, 1 - leave), transform: `rotate(${portrait ? 0 : -3 + Math.sin(frame / 60)}deg) scale(${1 - leave * 0.1})` }}>
          <PhoneContent />
        </Phone>
      )}

      {CAPTIONS.map(({ scene, top, bottom }) => {
        const [start, end] = S[scene]
        return (
          <Sequence key={scene} from={start} durationInFrames={end - start}>
            <SceneFade length={end - start}>
              <div style={captionStyle}>
                <Headline top={top} bottom={bottom} size={portrait ? 84 : 100} align={portrait ? 'center' : 'left'} />
                {scene === 'langs' && <LanguageTicker size={portrait ? 40 : 44} />}
              </div>
            </SceneFade>
          </Sequence>
        )
      })}

      <Sequence from={S.end[0]} durationInFrames={S.end[1] - S.end[0]}>
        <SceneFade length={S.end[1] - S.end[0]} out={false}><EndCard platform={platform} /></SceneFade>
      </Sequence>
    </AbsoluteFill>
  )
}
