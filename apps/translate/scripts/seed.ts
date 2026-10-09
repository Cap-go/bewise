// One-off: copy the translations BeWise already had (quotes and theme names in
// D1, app strings from the old locale files) into the translation cache, so
// they keep being served instead of being machine-translated again.
//
//   bun scripts/seed.ts [path/to/old/locales]
import type { Kind } from '../src/lang'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { cacheKey } from '../src/lang'

const LANGS = ['fr', 'es', 'de', 'it']
const API_DIR = join(import.meta.dir, '../../api')
const NAMESPACE = 'e29324c39e97481fbd0a8bab1d7753ac'

function d1<T>(sql: string): T[] {
  const run = Bun.spawnSync(['bunx', 'wrangler', 'd1', 'execute', 'bewise', '--remote', '--json', '--command', sql], { cwd: API_DIR })
  if (run.exitCode !== 0)
    throw new Error(run.stderr.toString())
  return JSON.parse(run.stdout.toString())[0].results as T[]
}

const entries = new Map<string, string>()
async function add(kind: Kind, lang: string, source: string, value: string) {
  if (source.trim() && value.trim())
    entries.set(await cacheKey(kind, lang, source), value.trim())
}

const quotes = d1<{ src: string, lang: string, dst: string }>(`
  SELECT src, lang, dst FROM (
    SELECT en.text AS src, t.lang AS lang, t.text AS dst,
      row_number() OVER (PARTITION BY en.text, t.lang ORDER BY t.date DESC) AS rn
    FROM quotes en
    JOIN quotes t ON t.category_id = en.category_id AND t.date = en.date AND t.lang IN ('fr', 'es', 'de', 'it')
    WHERE en.lang = 'en'
  ) WHERE rn = 1`)
for (const q of quotes)
  await add('quote', q.lang, q.src, q.dst)
console.log(`quotes: ${quotes.length}`)

for (const { name } of d1<{ name: string }>('SELECT name FROM categories')) {
  const names = JSON.parse(name) as Record<string, string>
  for (const lang of LANGS) {
    if (names.en && names[lang])
      await add('category', lang, names.en, names[lang])
  }
}

function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string')
      out[prefix + k] = v
    else if (v && typeof v === 'object')
      flatten(v as Record<string, unknown>, `${prefix}${k}.`, out)
  }
  return out
}

const localesDir = process.argv[2]
if (localesDir) {
  const en = flatten(JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8')))
  for (const file of readdirSync(localesDir).filter(f => LANGS.includes(f.replace('.json', '')))) {
    const lang = file.replace('.json', '')
    const messages = flatten(JSON.parse(readFileSync(join(localesDir, file), 'utf8')))
    for (const [key, source] of Object.entries(en)) {
      if (messages[key])
        await add('ui', lang, source, messages[key])
    }
  }
}

const file = '/tmp/bewise-translations-seed.json'
writeFileSync(file, JSON.stringify([...entries].map(([key, value]) => ({ key, value }))))
console.log(`writing ${entries.size} translations`)
const put = Bun.spawnSync(['bunx', 'wrangler', 'kv', 'bulk', 'put', file, '--namespace-id', NAMESPACE, '--remote'], { cwd: join(import.meta.dir, '..'), stdout: 'inherit', stderr: 'inherit' })
process.exit(put.exitCode ?? 1)
