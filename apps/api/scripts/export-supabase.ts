// One-shot migration: read the legacy Supabase tables over PostgREST and write
// SQL files that `wrangler d1 execute --file` can import into D1.
//
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=<anon or service key> bun scripts/export-supabase.ts
//
// Use the service role key to include users (RLS hides them from the anon key).

import { mkdirSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_KEY
if (!url || !key)
  throw new Error('SUPABASE_URL and SUPABASE_KEY are required')

const OUT = new URL('../.migration/', import.meta.url).pathname
const PAGE = 1000
const ROWS_PER_INSERT = 50
const STATEMENTS_PER_FILE = 400

mkdirSync(OUT, { recursive: true })

async function fetchAll<T>(table: string, select: string, order: string): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&order=${order}&offset=${offset}&limit=${PAGE}`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}` },
    })
    if (!res.ok)
      throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const page = await res.json() as T[]
    rows.push(...page)
    if (page.length < PAGE)
      break
  }
  console.log(`${table}: ${rows.length}`)
  return rows
}

function sql(value: unknown): string {
  if (value === null || value === undefined)
    return 'NULL'
  if (typeof value === 'number')
    return String(value)
  if (typeof value === 'boolean')
    return value ? '1' : '0'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return `'${text.replaceAll('\'', '\'\'')}'`
}

const fileCounters: Record<string, number> = {}

function writeInserts(name: string, table: string, columns: string[], rows: unknown[][]) {
  const statements: string[] = []
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const values = rows.slice(i, i + ROWS_PER_INSERT).map(r => `(${r.map(sql).join(',')})`).join(',\n')
    statements.push(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES\n${values};`)
  }
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_FILE) {
    const n = (fileCounters[name] = (fileCounters[name] ?? 0) + 1)
    writeFileSync(`${OUT}${name}-${String(n).padStart(3, '0')}.sql`, `${statements.slice(i, i + STATEMENTS_PER_FILE).join('\n')}\n`)
  }
}

interface Category { id: string, active: boolean, order: number, name: Record<string, string> }
interface Quote { id: string, category_id: string, lang: string, date: string, text: string, author: string, img: string | null, tags: string[] | null, total_votes: number, created_at: string }
interface Vote { quote_id: string, user_id: string, created_at: string }
interface Setting { key: string, value: unknown }

const categories = await fetchAll<Category>('bewise_categories', 'id,active,order,name', 'id')
writeInserts('01-categories', 'categories', ['id', 'active', 'sort', 'name'], categories.map(c => [c.id, c.active, c.order, c.name]))

const settings = await fetchAll<Setting>('bewise_settings', 'key,value', 'key')
writeInserts('02-settings', 'settings', ['key', 'value'], settings.map(s => [s.key, s.value]))

const quotes = await fetchAll<Quote>('bewise_quotes', 'id,category_id,lang,date,text,author,img,tags,total_votes,created_at', 'id')
writeInserts('03-quotes', 'quotes', ['id', 'category_id', 'lang', 'date', 'text', 'author', 'img', 'tags', 'total_votes', 'created_at'], quotes.map(q => [q.id, q.category_id, q.lang, q.date, q.text, q.author, q.img, (q.tags ?? []).filter((t, i, all) => all.indexOf(t) === i), q.total_votes, q.created_at]))

interface User { id: string, category_id: string | null, lang: string | null, created_at: string, updated_at: string }
const users = await fetchAll<User>('bewise_users', 'id,category_id,lang,created_at,updated_at', 'id')
if (users.length) {
  writeInserts('04-users', 'users', ['id', 'category_id', 'lang', 'created_at', 'updated_at'], users.map(u => [u.id, u.category_id, u.lang ?? 'en', u.created_at, u.updated_at]))
}

const votes = await fetchAll<Vote>('bewise_votes', 'quote_id,user_id,created_at', 'created_at')
writeInserts('05-votes', 'votes', ['quote_id', 'user_id', 'created_at'], votes.map(v => [v.quote_id, v.user_id, v.created_at]))

console.log(`Wrote SQL to ${OUT}: ${categories.length} categories, ${quotes.length} quotes, ${users.length} users, ${votes.length} votes`)
