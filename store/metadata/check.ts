// Validate store listings against App Store / Google Play limits.
//   bun store/metadata/check.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const dir = import.meta.dir
const len = (s: string) => [...s].length
const errors: string[] = []
const check = (file: string, field: string, value: unknown, max: number, min = 1) => {
  if (typeof value !== 'string' || len(value) < min)
    errors.push(`${file}: ${field} missing`)
  else if (len(value) > max)
    errors.push(`${file}: ${field} ${len(value)}/${max}`)
}

for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  check(f, 'name', m.name, 30)
  check(f, 'subtitle', m.subtitle, 30)
  check(f, 'keywords', m.keywords, 100)
  check(f, 'promotionalText', m.promotionalText, 170)
  check(f, 'description', m.description, 4000, 200)
  check(f, 'whatsNew', m.whatsNew, 4000)
  if (/,\s/.test(m.keywords ?? ''))
    errors.push(`${f}: keywords have a space after a comma`)
  const titleWords = `${m.name} ${m.subtitle}`.toLowerCase().split(/[\s:,&-]+/).filter(w => w.length > 3)
  const repeated = (m.keywords ?? '').toLowerCase().split(',').filter((k: string) => titleWords.includes(k.trim()))
  if (repeated.length)
    errors.push(`${f}: keywords repeat title/subtitle words: ${repeated.join(', ')}`)
}
for (const f of readdirSync(join(dir, 'play')).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(join(dir, 'play', f), 'utf8'))
  check(`play/${f}`, 'title', m.title, 30)
  check(`play/${f}`, 'shortDescription', m.shortDescription, 80)
  check(`play/${f}`, 'fullDescription', m.fullDescription, 4000, 200)
}
console.log(errors.length ? errors.join('\n') : 'all listings within limits')
process.exit(errors.length ? 1 : 0)
