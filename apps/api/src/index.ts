import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import messages from '../../mobile/src/locales/en.json'
import { machineTranslated, normalizeLang } from '../../translate/src/lang'
import { addDays, countVotes, isoDate, scheduleCategoryDay, scheduleDay } from './schedule'

type Kind = 'quote' | 'category' | 'ui'

interface Env {
  DB: D1Database
  /** bewise-translate: English in, any language out, cached per string. */
  TRANSLATE: Fetcher & {
    translate: (texts: string[], lang: string, kind?: Kind, contexts?: string[]) => Promise<string[]>
    /** `translated[i]` is false when English came back because the model failed (retried later). */
    translateWithStatus: (texts: string[], lang: string, kind?: Kind, contexts?: string[]) => Promise<{ texts: string[], translated: boolean[] }>
  }
  /** Per client IP: endpoints that can call the model, and writes. */
  READ_LIMIT: RateLimit
  WRITE_LIMIT: RateLimit
}

interface App { Bindings: Env }

interface QuoteRow {
  id: string
  category_id: string
  lang: string
  date: string
  text: string
  author: string
  img: string | null
  tags: string
  total_votes: number
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[\w-]{8,64}$/
const CATEGORY_RE = /^[a-z_]{2,32}$/

interface Translated {
  texts: string[]
  /** False when some texts fell back to English after a failure: don't cache the response. */
  complete: boolean
}

/**
 * Only English is stored: translate on the way out, falling back to English.
 * Languages outside MACHINE_LANGS are served in English without asking the model.
 */
async function translate(env: Env, texts: string[], lang: string, kind: Kind, contexts: string[] = []): Promise<Translated> {
  if (!machineTranslated(lang) || texts.length === 0)
    return { texts, complete: true }
  try {
    const out: string[] = []
    let complete = true
    for (let i = 0; i < texts.length; i += 100) {
      const part = await env.TRANSLATE.translateWithStatus(texts.slice(i, i + 100), lang, kind, contexts.slice(i, i + 100))
      out.push(...part.texts)
      complete &&= part.translated.every(Boolean)
    }
    return { texts: out, complete }
  }
  catch (error) {
    console.error('translate failed', lang, kind, error)
    return { texts, complete: false }
  }
}

async function serializeQuotes(env: Env, rows: QuoteRow[], lang: string, voted = false) {
  const { texts, complete } = await translate(env, rows.map(r => r.text), lang, 'quote')
  return { quotes: rows.map((row, i) => serializeQuote(row, lang, texts[i], voted)), complete }
}

function serializeQuote(row: QuoteRow, lang: string, text: string, voted = false) {
  return {
    id: row.id,
    category: row.category_id,
    lang,
    date: row.date,
    text,
    author: row.author,
    img: row.img,
    tags: JSON.parse(row.tags || '[]') as string[],
    votes: row.total_votes,
    voted,
  }
}

/** Client sends its local day; accept only days around "now" so nobody reads the future archive. */
function resolveDay(day: string | undefined): string {
  const today = isoDate(new Date())
  if (!day)
    return today
  if (!DAY_RE.test(day) || day < addDays(today, -1) || day > addDays(today, 1))
    throw new HTTPException(400, { message: 'invalid date' })
  return day
}

function requireCategory(category: string | undefined): string {
  const value = category ?? 'inspire'
  if (!CATEGORY_RE.test(value))
    throw new HTTPException(400, { message: 'invalid category' })
  return value
}

function requireId(id: string | undefined, name: string): string {
  if (!id || !ID_RE.test(id))
    throw new HTTPException(400, { message: `invalid ${name}` })
  return id
}

function findQuote(db: D1Database, category: string, day: string) {
  return db.prepare('SELECT * FROM quotes WHERE category_id = ? AND lang = \'en\' AND date = ?').bind(category, day).first<QuoteRow>()
}

/** Retired themes (and unknown ids) fall back to Inspiration. */
async function activeCategory(db: D1Database, requested: string) {
  const active = await db.prepare('SELECT 1 FROM categories WHERE id = ? AND active = 1').bind(requested).first()
  return active ? requested : 'inspire'
}

async function todayQuote(db: D1Database, requested: string, day: string) {
  const category = await activeCategory(db, requested)
  let row = await findQuote(db, category, day)
  if (!row && await scheduleCategoryDay(db, category, day))
    row = await findQuote(db, category, day)
  return row
}

interface Messages { [key: string]: string | Messages }

/** Every string of the messages tree, with its key path ("tabs.archive"). */
function leaves(obj: Messages, prefix = '', out: [string, string][] = []): [string, string][] {
  for (const [key, value] of Object.entries(obj))
    typeof value === 'string' ? out.push([prefix + key, value]) : leaves(value, `${prefix}${key}.`, out)
  return out
}

function rebuild(obj: Messages, values: string[], at = { i: 0 }): Messages {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) =>
    [key, typeof value === 'string' ? values[at.i++] : rebuild(value, values, at)]))
}

/** Keep translated strings valid vue-i18n syntax: only `{name}` placeholders are special. */
function escapeMessage(text: string): string {
  return text.replace(/\{\w+\}|[{}@|]/g, m => m.length > 1 ? m : m === '{' || m === '}' ? '' : `{'${m}'}`)
}

async function hasVoted(db: D1Database, quoteId: string, userId: string | undefined) {
  if (!userId)
    return false
  return !!(await db.prepare('SELECT 1 FROM votes WHERE quote_id = ? AND user_id = ?').bind(quoteId, userId).first())
}

/**
 * Edge-cache successful GET responses for `maxAge` seconds, by full URL.
 * Handlers opt out with `Cache-Control: no-store` (see `complete`).
 */
function edgeCache(name: string, maxAge: number, skip?: (c: Context<App>) => boolean): MiddlewareHandler<App> {
  return async (c, next) => {
    if (skip?.(c))
      return next()
    const cache = await caches.open(name)
    const hit = await cache.match(c.req.url)
    if (hit)
      return new Response(hit.body, hit)
    await next()
    if (c.res.status !== 200 || c.res.headers.has('Cache-Control'))
      return
    c.header('Cache-Control', `public, max-age=${maxAge}`)
    c.executionCtx.waitUntil(cache.put(c.req.url, c.res.clone()))
  }
}

/** Keep English fallbacks of a failed translation out of every cache, so the next request retries. */
function complete(c: Context<App>, done: boolean) {
  if (!done)
    c.header('Cache-Control', 'no-store')
  return done
}

/** Rate limit by client IP (Workers rate limiting binding: per Cloudflare location, approximate). */
function rateLimit(binding: 'READ_LIMIT' | 'WRITE_LIMIT'): MiddlewareHandler<App> {
  return async (c, next) => {
    const { success } = await c.env[binding].limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })
    if (!success)
      return c.json({ error: 'too many requests' }, 429, { 'Retry-After': '60' })
    await next()
  }
}

const reads = rateLimit('READ_LIMIT')
const writes = rateLimit('WRITE_LIMIT')

/** `GET /v1/quotes?q=`: matches the author or the English text. */
function searchPattern(q: string | undefined): string | null {
  if (q === undefined)
    return null
  const value = q.trim()
  if (value.length < 2 || value.length > 64)
    throw new HTTPException(400, { message: 'invalid q' })
  return `%${value.replace(/[\\%_]/g, m => `\\${m}`)}%`
}

const app = new Hono<App>()

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))

app.onError((err, c) => {
  if (err instanceof HTTPException)
    return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'internal error' }, 500)
})

app.get('/', c => c.json({ name: 'bewise-api', ok: true }))

app.get('/v1/categories', edgeCache('bewise-categories', 3600), reads, async (c) => {
  const lang = normalizeLang(c.req.query('lang'))
  const { results } = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.sort,
      (SELECT img FROM quotes q WHERE q.category_id = c.id AND q.lang = 'en' AND q.img IS NOT NULL ORDER BY q.date DESC LIMIT 1) AS img
    FROM categories c WHERE c.active = 1 ORDER BY c.sort`).all<{ id: string, name: string, sort: number, img: string | null }>()
  const english = results.map(row => (JSON.parse(row.name || '{}') as Record<string, string>).en ?? row.id)
  const names = await translate(c.env, english, lang, 'category')
  complete(c, names.complete)
  return c.json(results.map((row, i) => ({ id: row.id, name: names.texts[i], img: row.img })))
})

// App strings for any language, translated from the English source of the app.
// `complete: false` means some strings are English fallbacks of a failed
// translation: the response is not cached anywhere, so asking again retries.
app.get('/v1/i18n/:lang', edgeCache('bewise-i18n', 86400), reads, async (c) => {
  const lang = normalizeLang(c.req.param('lang'))
  const source = messages as Messages
  const strings = leaves(source)
  const english = strings.map(([, text]) => text)
  const translated = await translate(c.env, english, lang, 'ui', strings.map(([key]) => key))
  const values = lang === 'en' ? english : translated.texts.map(escapeMessage)
  return c.json({ lang, messages: rebuild(source, values), complete: complete(c, translated.complete) })
})

app.get('/v1/quotes/today', reads, async (c) => {
  const category = requireCategory(c.req.query('category'))
  const lang = normalizeLang(c.req.query('lang'))
  const day = resolveDay(c.req.query('date'))
  const row = await todayQuote(c.env.DB, category, day)
  if (!row)
    throw new HTTPException(404, { message: 'no quote' })
  const { quotes: [quote] } = await serializeQuotes(c.env, [row], lang, await hasVoted(c.env.DB, row.id, c.req.query('user')))
  return c.json(quote)
})

// Archive, newest first, paginated with `before` (the date of the last quote
// received). Optional `q` searches the author and the English text.
app.get('/v1/quotes', edgeCache('bewise-archive', 600, c => c.req.query('user') !== undefined), reads, async (c) => {
  const category = await activeCategory(c.env.DB, requireCategory(c.req.query('category')))
  const lang = normalizeLang(c.req.query('lang'))
  const search = searchPattern(c.req.query('q'))
  const today = isoDate(new Date())
  const maxBefore = addDays(today, 1)
  const requested = c.req.query('before') ?? maxBefore
  if (!DAY_RE.test(requested))
    throw new HTTPException(400, { message: 'invalid before' })
  const before = requested > maxBefore ? maxBefore : requested
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 50)
  // The same text is shown on many days (legacy duplicates, daily reruns):
  // list it once, at its last day before today (UTC). That position doesn't
  // depend on `before`, so every page agrees: a text already listed at a later
  // day never comes back, and today's rerun doesn't hide its earlier days.
  const { results } = await c.env.DB
    .prepare(`
      SELECT * FROM (
        SELECT *, row_number() OVER (PARTITION BY text ORDER BY date DESC) AS rn
        FROM quotes WHERE category_id = ?1 AND lang = 'en' AND date < ?2
      ) WHERE rn = 1 AND date < ?3
        AND (?5 IS NULL OR text LIKE ?5 ESCAPE '\\' OR author LIKE ?5 ESCAPE '\\')
      ORDER BY date DESC LIMIT ?4`)
    .bind(category, today, before, limit, search)
    .all<QuoteRow>()
  const { quotes, complete: done } = await serializeQuotes(c.env, results, lang)
  complete(c, done)
  return c.json(quotes)
})

app.get('/v1/quotes/:id', reads, async (c) => {
  const id = requireId(c.req.param('id'), 'id')
  const row = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<QuoteRow>()
  if (!row)
    throw new HTTPException(404, { message: 'not found' })
  const { quotes: [quote] } = await serializeQuotes(c.env, [row], normalizeLang(c.req.query('lang')), await hasVoted(c.env.DB, row.id, c.req.query('user')))
  return c.json(quote)
})

async function voteRequest(c: Context<App>) {
  const id = requireId(c.req.param('id'), 'id')
  const body = await c.req.json<{ user?: string }>().catch(() => ({ user: undefined }))
  return { id, user: requireId(body.user, 'user') }
}

function totalVotes(result: D1Result): number {
  const votes = (result.results[0] as { total_votes: number } | undefined)?.total_votes
  if (votes === undefined)
    throw new HTTPException(404, { message: 'not found' })
  return votes
}

app.post('/v1/quotes/:id/vote', writes, async (c) => {
  const { id, user } = await voteRequest(c)
  const db = c.env.DB
  const [, , , row] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').bind(user),
    db.prepare('INSERT OR IGNORE INTO votes (quote_id, user_id) SELECT id, ? FROM quotes WHERE id = ?').bind(user, id),
    countVotes(db, id),
    db.prepare('SELECT total_votes FROM quotes WHERE id = ?').bind(id),
  ])
  return c.json({ votes: totalVotes(row), voted: true })
})

app.delete('/v1/quotes/:id/vote', writes, async (c) => {
  const { id, user } = await voteRequest(c)
  const db = c.env.DB
  const [, , row] = await db.batch([
    db.prepare('DELETE FROM votes WHERE quote_id = ? AND user_id = ?').bind(id, user),
    countVotes(db, id),
    db.prepare('SELECT total_votes FROM quotes WHERE id = ?').bind(id),
  ])
  return c.json({ votes: totalVotes(row), voted: false })
})

app.put('/v1/users/:id', writes, async (c) => {
  const id = requireId(c.req.param('id'), 'id')
  const body = await c.req.json<{ category?: string, lang?: string, platform?: string, appVersion?: string }>().catch(() => ({} as Record<string, string | undefined>))
  await c.env.DB.prepare(`
    INSERT INTO users (id, category_id, lang, platform, app_version) VALUES (?1, ?2, coalesce(?3, 'en'), ?4, ?5)
    ON CONFLICT (id) DO UPDATE SET
      category_id = coalesce(?2, category_id), lang = coalesce(?3, lang),
      platform = coalesce(?4, platform), app_version = coalesce(?5, app_version),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
    .bind(id, body.category?.slice(0, 32) ?? null, body.lang ? normalizeLang(body.lang) : null, body.platform?.slice(0, 16) ?? null, body.appVersion?.slice(0, 32) ?? null)
    .run()
  return c.json({ ok: true })
})

// Used by the BeWise iOS Shortcut / lock screen widget: the user id is the "API key".
app.get('/v1/users/:id/today', reads, async (c) => {
  const id = requireId(c.req.param('id'), 'id')
  const user = await c.env.DB.prepare('SELECT category_id, lang FROM users WHERE id = ?').bind(id).first<{ category_id: string | null, lang: string }>()
  if (!user)
    throw new HTTPException(404, { message: 'user not found' })
  const row = await todayQuote(c.env.DB, user.category_id ?? 'inspire', resolveDay(c.req.query('date')))
  if (!row)
    throw new HTTPException(404, { message: 'no quote' })
  const { quotes: [quote] } = await serializeQuotes(c.env, [row], normalizeLang(user.lang))
  return c.json(quote)
})

app.get('/v1/settings', edgeCache('bewise-settings', 3600), async (c) => {
  const row = await c.env.DB.prepare('SELECT value FROM settings WHERE key = \'global\'').first<{ value: string }>()
  return c.json(JSON.parse(row?.value ?? '{}'))
})

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const today = isoDate(new Date())
    // Cover users ahead of UTC (up to +14h) by preparing tomorrow too.
    // Sequential so both days never pick the same archived source.
    ctx.waitUntil((async () => {
      await scheduleDay(env.DB, today)
      await scheduleDay(env.DB, addDays(today, 1))
      await warmTranslations(env, addDays(today, 1))
    })())
  },
}

/** Translate tomorrow's quotes into our readers' languages ahead of time, so nobody waits on the model. */
async function warmTranslations(env: Env, day: string) {
  const [{ results: langs }, { results: rows }] = await env.DB.batch([
    env.DB.prepare('SELECT lang FROM users WHERE lang != \'en\' GROUP BY lang ORDER BY count(*) DESC LIMIT 30'),
    env.DB.prepare('SELECT text FROM quotes WHERE lang = \'en\' AND date = ?').bind(day),
  ]) as [D1Result<{ lang: string }>, D1Result<{ text: string }>]
  for (const lang of new Set(langs.map(l => normalizeLang(l.lang))))
    await translate(env, rows.map(r => r.text), lang, 'quote')
}

export { app }
