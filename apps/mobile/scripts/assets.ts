// Regenerate app icons and splash screens from assets/, then add the iOS 18+
// dark and tinted icon variants that @capacitor/assets does not produce.
//   bun scripts/assets.ts
import { copyFileSync, writeFileSync } from 'node:fs'
import { $ } from 'bun'

await $`bunx capacitor-assets generate --iconBackgroundColor '#0b1016' --iconBackgroundColorDark '#0b1016' --splashBackgroundColor '#0b1016' --splashBackgroundColorDark '#0b1016'`

const set = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
copyFileSync('assets/icon-ios-dark.png', `${set}/AppIcon-dark.png`)
copyFileSync('assets/icon-ios-tinted.png', `${set}/AppIcon-tinted.png`)
function image(filename: string, appearance?: string) {
  return {
    ...(appearance ? { appearances: [{ appearance: 'luminosity', value: appearance }] } : {}),
    filename,
    idiom: 'universal',
    platform: 'ios',
    size: '1024x1024',
  }
}
writeFileSync(`${set}/Contents.json`, `${JSON.stringify({
  images: [image('AppIcon-512@2x.png'), image('AppIcon-dark.png', 'dark'), image('AppIcon-tinted.png', 'tinted')],
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`)

// Android 12+ system splash icon: 288dp canvas masked to a 192dp circle. The launcher
// foreground is far too large and small for it, so the wide bw mark gets its own,
// shrunk to fit the circle (comes with @capacitor/assets).
const { default: sharp } = await import('sharp')
for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const canvas = Math.round(288 * scale)
  const mark = Math.round(canvas * 0.72)
  const offset = Math.round((canvas - mark) / 2)
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp('assets/icon-foreground.png').resize(mark, mark).toBuffer(), left: offset, top: offset }])
    .png()
    .toFile(`android/app/src/main/res/drawable-${density}/splash_icon.png`)
}
console.log('icons and splash generated')
