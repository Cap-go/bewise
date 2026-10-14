// Delete the cached translations of one English text, so the next request
// translates it again (after fixing a bad translation, or editing a quote).
//
//   bun scripts/purge.ts "<English text>" [--lang fr] [--kind quote|category|ui] [--local]
//
// The text must be the exact English source (quote text, theme name or app
// string). Without --lang, every language bewise-translate may have cached is
// purged; without --kind, all three kinds. Every revision up to the current
// one is purged, including the human seeds of revision 1. Keys are removed
// with `wrangler kv bulk delete` (missing keys are ignored); --local targets
// the `wrangler dev` store instead of production.
import type { Kind } from '../src/lang'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { cacheKey, MACHINE_LANGS, normalizeLang, REVISION } from '../src/lang'

const NAMESPACE = 'e29324c39e97481fbd0a8bab1d7753ac'
const KINDS: Kind[] = ['quote', 'category', 'ui']

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { lang: { type: 'string' }, kind: { type: 'string' }, local: { type: 'boolean' } },
})
const text = positionals[0]
if (!text || (values.kind && !KINDS.includes(values.kind as Kind)))
  throw new Error('usage: bun scripts/purge.ts "<English text>" [--lang fr] [--kind quote|category|ui] [--local]')

/** Every language normalizeLang can return: any two-letter code, plus the three-letter ones we translate. */
function allLangs(): string[] {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const codes = [...letters].flatMap(a => [...letters].map(b => a + b))
  return [...new Set([...codes, ...MACHINE_LANGS, 'zh-Hant', 'pt-PT'].map(normalizeLang))].filter(l => l !== 'en')
}

const langs = values.lang ? [normalizeLang(values.lang)] : allLangs()
const kinds = values.kind ? [values.kind as Kind] : KINDS
const keys: string[] = []
for (const kind of kinds) {
  for (const lang of langs) {
    for (let revision = 1; revision <= REVISION[kind]; revision++)
      keys.push(await cacheKey(kind, lang, text, revision))
  }
}

const file = '/tmp/bewise-translations-purge.json'
writeFileSync(file, JSON.stringify(keys))
console.log(`deleting ${keys.length} keys (${kinds.join(', ')} in ${langs.length} languages)`)
const run = Bun.spawnSync(['bunx', 'wrangler', 'kv', 'bulk', 'delete', file, '--namespace-id', NAMESPACE, '--force', values.local ? '--local' : '--remote'], { cwd: join(import.meta.dir, '..'), stdout: 'inherit', stderr: 'inherit' })
process.exit(run.exitCode ?? 1)
