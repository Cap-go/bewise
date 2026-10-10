import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, C, Headline, sans, serif } from './Promo'

// App Store stills and creative assets, same look as the promo video.

/** Settled frame used for stills: every headline word has landed by then. */
export const STILL_FRAME = 60

function Device({ src, width, aspect, radius, style }: { src: string, width: number, aspect: number, radius: number, style?: CSSProperties }) {
  const bezel = Math.round(width * 0.028)
  return (
    <div style={{ position: 'absolute', width: width + bezel * 2, height: width / aspect + bezel * 2, borderRadius: radius + bezel, background: '#1d2530', padding: bezel, boxShadow: `0 60px 160px rgba(0,0,0,0.6), 0 0 0 3px #2c3644, 0 0 140px ${C.aqua}26`, ...style }}>
      <Img src={staticFile(src)} style={{ display: 'block', width, height: width / aspect, borderRadius: radius, objectFit: 'cover' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// iPhone Duo screenshots: outer display 1398x2034, inner display 2007x2853.

// A type alias (not an interface) so Remotion accepts it as Record<string, unknown> props.
export type DuoShotProps = {
  display: 'outer' | 'inner'
  shot: string
  top: string
  bottom: string
}

const DUO = {
  outer: { w: 1398, h: 2034 },
  inner: { w: 2007, h: 2853 },
}
export const DUO_SIZES = DUO

export function DuoShot({ display, shot, top, bottom }: DuoShotProps) {
  const { width, height } = useVideoConfig()
  const { w, h } = DUO[display]
  const aspect = w / h
  const screenH = height * 0.71
  const screenW = screenH * aspect
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Backdrop />
      <div style={{ position: 'absolute', top: height * 0.055, left: width * 0.05, right: width * 0.05 }}>
        <Headline top={top} bottom={bottom} size={width * 0.072} />
      </div>
      <Device src={`duo/${display}-${shot}.jpg`} width={screenW} aspect={aspect} radius={screenW * 0.085} style={{ left: (width - screenW) / 2 - screenW * 0.028, top: height * 0.255 }} />
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Product page header (21:9, 3840x1646) and search results asset (3:2).
// Videos loop: every motion completes a whole number of cycles in LOOP frames.

export const LOOP = 360
const LANG_SHOTS = ['life-en', 'life-ja', 'life-fr', 'life-hi', 'life-ko', 'life-es', 'life-de', 'life-pt-BR']
const PHONE_ASPECT = 1320 / 2868

function Phone({ children, width, style }: { children: ReactNode, width: number, style?: CSSProperties }) {
  const bezel = Math.round(width * 0.035)
  const radius = width * 0.14
  return (
    <div style={{ position: 'absolute', width: width + bezel * 2, height: width / PHONE_ASPECT + bezel * 2, borderRadius: radius + bezel, background: '#1d2530', padding: bezel, boxShadow: `0 60px 160px rgba(0,0,0,0.65), 0 0 0 3px #2c3644, 0 0 140px ${C.aqua}22`, ...style }}>
      <div style={{ position: 'relative', width, height: width / PHONE_ASPECT, borderRadius: radius, overflow: 'hidden', background: C.ink }}>
        {children}
        <div style={{ position: 'absolute', top: width * 0.026, left: '50%', width: width * 0.3, height: width * 0.074, marginLeft: -width * 0.15, borderRadius: 999, background: 'black' }} />
      </div>
    </div>
  )
}

const Shot = ({ name, opacity = 1 }: { name: string, opacity?: number }) => (
  <Img src={staticFile(`shots/${name}.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity }} />
)

/** Centre phone flips through languages; the frame loops back to English. */
function LanguageScreens() {
  const frame = useCurrentFrame() % LOOP
  const each = LOOP / LANG_SHOTS.length
  const i = Math.floor(frame / each)
  const next = (i + 1) % LANG_SHOTS.length
  const fade = interpolate(frame - i * each, [each - 8, each], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <>
      <Shot name={LANG_SHOTS[i]} />
      {fade > 0 && <Shot name={LANG_SHOTS[next]} opacity={fade} />}
    </>
  )
}

export function Creative({ layout }: { layout: 'header' | 'search' }) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = (frame % LOOP) / LOOP
  const wave = (phase: number) => Math.sin((t + phase) * Math.PI * 2)
  const header = layout === 'header'
  const phoneW = header ? height * 0.33 : width * 0.2
  const phonesTop = header ? height * 0.1 : height * 0.43
  const centerX = header ? width * 0.73 : width * 0.5
  const gap = phoneW * 1.1
  const phones = [
    { x: centerX - gap, y: phoneW * 0.22, rot: -7, node: <Shot name="themes" />, phase: 0.33 },
    { x: centerX + gap, y: phoneW * 0.22, rot: 7, node: <Shot name="archive" />, phase: 0.66 },
    { x: centerX, y: 0, rot: 0, node: <LanguageScreens />, phase: 0 },
  ]
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Backdrop />
      {phones.map((p, i) => (
        <Phone key={i} width={phoneW} style={{ left: p.x - phoneW / 2, top: phonesTop + p.y + wave(p.phase) * phoneW * 0.04, transform: `rotate(${p.rot}deg)` }}>
          {p.node}
        </Phone>
      ))}
      <div style={header
        ? { position: 'absolute', left: width * 0.07, top: 0, bottom: 0, width: width * 0.4, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: height * 0.04 }
        : { position: 'absolute', left: 0, right: 0, top: height * 0.05, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: height * 0.03 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.025 }}>
          <Img src={staticFile('icon.png')} style={{ width: height * (header ? 0.12 : 0.085), borderRadius: '23%', boxShadow: `0 0 80px ${C.aqua}55` }} />
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: height * (header ? 0.085 : 0.06), color: 'white' }}>BeWise</span>
        </div>
        <Headline top="One good thought," bottom="every morning." size={height * (header ? 0.088 : 0.07)} align={header ? 'left' : 'center'} delay={-60} />
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: height * (header ? 0.034 : 0.026), color: 'white', opacity: 0.75, display: 'flex', gap: '0.6em', alignItems: 'center' }}>
          <span style={{ width: '0.5em', height: '0.5em', borderRadius: 99, background: C.mint, boxShadow: `0 0 20px ${C.mint}` }} />
          <span>In your language. Any language.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 70%, ${C.ink}cc 100%)`, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
