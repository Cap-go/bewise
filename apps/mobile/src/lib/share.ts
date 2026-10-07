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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    }
    else {
      line = next
    }
  }
  if (line)
    lines.push(line)
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

  ctx.fillStyle = 'rgba(166,255,203,0.9)'
  ctx.font = `600 ${size * 2.2}px "Fraunces Variable", Georgia, serif`
  ctx.fillText('“', padding - 8, y - size * 0.4)

  ctx.fillStyle = '#ffffff'
  ctx.font = `500 ${size}px "Fraunces Variable", Georgia, serif`
  for (const line of lines) {
    ctx.fillText(line, padding, y + size)
    y += lineHeight
  }

  ctx.font = '600 32px "Inter Variable", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(`— ${quote.author}`, padding, y + 64)

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
