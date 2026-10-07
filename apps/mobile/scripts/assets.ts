// Regenerate app icons and splash screens from assets/, then add the iOS 18+
// dark and tinted icon variants that @capacitor/assets does not produce.
//   bun scripts/assets.ts
import { copyFileSync, writeFileSync } from 'node:fs'
import { $ } from 'bun'

await $`bunx capacitor-assets generate --iconBackgroundColor '#0b1016' --iconBackgroundColorDark '#0b1016' --splashBackgroundColor '#0b1016' --splashBackgroundColorDark '#0b1016'`

const set = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
copyFileSync('assets/icon-ios-dark.png', `${set}/AppIcon-dark.png`)
copyFileSync('assets/icon-ios-tinted.png', `${set}/AppIcon-tinted.png`)
const image = (filename: string, appearance?: string) => ({
  ...(appearance ? { appearances: [{ appearance: 'luminosity', value: appearance }] } : {}),
  filename,
  idiom: 'universal',
  platform: 'ios',
  size: '1024x1024',
})
writeFileSync(`${set}/Contents.json`, `${JSON.stringify({
  images: [image('AppIcon-512@2x.png'), image('AppIcon-dark.png', 'dark'), image('AppIcon-tinted.png', 'tinted')],
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`)
console.log('icons and splash generated')
