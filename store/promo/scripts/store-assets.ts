// Render the iPhone Duo screenshots and the App Store creative assets.
//   bun scripts/store-assets.ts
// Writes store/screenshots/duo-{outer,inner}-{en,fr}/ and store/creative/.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const STORE = join(import.meta.dir, '../..')
const ENTRY = join(import.meta.dir, '../src/index.tsx')

const CAPTIONS: Record<string, [shot: string, top: string, bottom: string][]> = {
  en: [
    ['today-en', 'One wise quote,', 'every morning.'],
    ['today-ja', 'In your language.', 'Any language.'],
    ['themes-en', 'Pick the voice', 'you need today.'],
    ['widget-en', 'Right on your', 'home screen.'],
    ['archive-en', 'Every quote,', 'always with you.'],
  ],
  fr: [
    ['today-fr', 'Une pensée sage,', 'chaque matin.'],
    ['today-ja', 'Dans votre langue.', 'Toutes les langues.'],
    ['themes-fr', 'Choisissez la voix', 'qu’il vous faut.'],
    ['widget-fr', 'Sur votre', 'écran d’accueil.'],
    ['archive-fr', 'Chaque citation,', 'toujours avec vous.'],
  ],
}

function remotion(args: string[]) {
  const run = Bun.spawnSync(['bunx', 'remotion', ...args, '--log=error'], { cwd: join(import.meta.dir, '..'), stdout: 'inherit', stderr: 'inherit' })
  if (run.exitCode !== 0)
    throw new Error(`remotion ${args.join(' ')} failed`)
}

for (const [lang, shots] of Object.entries(CAPTIONS)) {
  for (const display of ['outer', 'inner'] as const) {
    const dir = join(STORE, 'screenshots', `duo-${display}-${lang}`)
    mkdirSync(dir, { recursive: true })
    shots.forEach(([shot, top, bottom], i) => {
      const id = display === 'outer' ? 'DuoOuter' : 'DuoInner'
      const out = join(dir, `${i + 1}-${shot.split('-')[0]}.jpg`)
      remotion(['still', ENTRY, id, out, '--frame=60', '--image-format=jpeg', '--jpeg-quality=92', `--props=${JSON.stringify({ display, shot, top, bottom })}`])
      console.log(out)
    })
  }
}

const creative = join(STORE, 'creative')
mkdirSync(creative, { recursive: true })
for (const id of ['Header', 'Search']) {
  const name = id.toLowerCase()
  remotion(['still', ENTRY, id, join(creative, `${name}.jpg`), '--frame=0', '--image-format=jpeg', '--jpeg-quality=92'])
  remotion(['render', ENTRY, id, join(creative, `${name}.mp4`), '--codec=h264', '--crf=18'])
}
