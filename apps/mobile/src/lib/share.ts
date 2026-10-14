import type { Quote } from './api'
import { Clipboard } from '@capacitor/clipboard'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { i18n } from '~/i18n'
import { photo } from './api'

const W = 1080
const H = 1350

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Words (or, for Chinese, Japanese, Thai..., word-like runs) with their trailing spaces. */
function segments(text: string, granularity: 'word' | 'grapheme'): string[] {
  if (typeof Intl.Segmenter === 'function')
    return Array.from(new Intl.Segmenter(undefined, { granularity }).segment(text), s => s.segment)
  return granularity === 'word' ? text.split(/(?<=\s)/) : Array.from(text)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const fits = (s: string) => ctx.measureText(s.trim()).width <= maxWidth
  let line = ''
  for (const piece of segments(text, 'word')) {
    if (fits(line + piece)) {
      line += piece
      continue
    }
    if (line.trim())
      lines.push(line.trim())
    line = piece.trimStart()
    // A single run wider than the card (long word, unsegmented script): break between characters.
    while (!fits(line)) {
      let head = ''
      for (const g of segments(line, 'grapheme')) {
        if (!fits(head + g) && head)
          break
        head += g
      }
      lines.push(head.trim())
      line = line.slice(head.length).trimStart()
    }
  }
  if (line.trim())
    lines.push(line.trim())
  return lines
}

/** Render an Instagram-ready 4:5 card of the quote. */
export async function renderQuoteCard(quote: Quote): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, H, W, 0)
  bg.addColorStop(0, '#1fa2ff')
  bg.addColorStop(0.55, '#00d9f2')
  bg.addColorStop(1, '#a6ffcb')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const src = photo(quote.img, W / 2, H / 2)
  if (src) {
    try {
      const img = await loadImage(src)
      const scale = Math.max(W / img.width, H / img.height)
      ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale)
    }
    catch {}
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(8,12,18,0.35)')
  shade.addColorStop(0.45, 'rgba(8,12,18,0.55)')
  shade.addColorStop(1, 'rgba(8,12,18,0.88)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)

  await Promise.all([
    document.fonts.load('500 60px "Fraunces Variable"'),
    document.fonts.load('600 30px "Inter Variable"'),
  ]).catch(() => {})

  const padding = 96
  let size = quote.text.length > 220 ? 46 : quote.text.length > 120 ? 56 : 68
  ctx.font = `500 ${size}px "Fraunces Variable", Georgia, serif`
  let lines = wrap(ctx, quote.text, W - padding * 2)
  while (lines.length * size * 1.3 > H * 0.55 && size > 32) {
    size -= 4
    ctx.font = `500 ${size}px "Fraunces Variable", Georgia, serif`
    lines = wrap(ctx, quote.text, W - padding * 2)
  }

  const lineHeight = size * 1.3
  const blockHeight = lines.length * lineHeight
  let y = (H - blockHeight) / 2 + size * 0.2

  // Arabic, Hebrew...: the canvas is not in the page, so set the direction from the quote's script.
  const rtl = /^\P{L}*[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/u.test(quote.text)
  const start = rtl ? W - padding : padding
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'start'

  ctx.fillStyle = 'rgba(166,255,203,0.9)'
  ctx.font = `600 ${size * 2.2}px "Fraunces Variable", Georgia, serif`
  ctx.fillText('“', start + (rtl ? 8 : -8), y - size * 0.4)

  ctx.fillStyle = '#ffffff'
  ctx.font = `500 ${size}px "Fraunces Variable", Georgia, serif`
  for (const line of lines) {
    ctx.fillText(line, start, y + size)
    y += lineHeight
  }

  ctx.font = '600 32px "Inter Variable", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  if (quote.author.trim())
    ctx.fillText(`— ${quote.author.trim()}`, start, y + 64)

  // The BeWise footer stays left to right.
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.font = '700 30px "Inter Variable", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('BeWise', padding, H - 80)
  ctx.font = '500 26px "Inter Variable", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.textAlign = 'right'
  ctx.fillText('bewise.love', W - padding, H - 80)

  return canvas.toDataURL('image/png')
}

export function shareText(quote: Quote): string {
  return i18n.global.t('quote.shareText', { text: quote.text, author: quote.author })
}

export async function shareQuote(quote: Quote) {
  const text = shareText(quote)
  if (!Capacitor.isNativePlatform()) {
    if (navigator.share)
      await navigator.share({ text }).catch(() => {})
    else
      await copyQuote(quote)
    return
  }
  try {
    const dataUrl = await renderQuoteCard(quote)
    const file = await Filesystem.writeFile({
      path: `bewise-${quote.date}.png`,
      data: dataUrl.split(',')[1]!,
      directory: Directory.Cache,
    })
    await Share.share({ text, files: [file.uri], dialogTitle: 'BeWise' })
  }
  catch (error) {
    if (String(error).includes('cancel'))
      return
    await Share.share({ text, dialogTitle: 'BeWise' }).catch(() => {})
  }
}

export async function copyQuote(quote: Quote) {
  await Clipboard.write({ string: shareText(quote) })
}
