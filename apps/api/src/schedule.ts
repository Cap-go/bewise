// Daily quote scheduling.
// BeWise has ~1,100 unique hand-picked quotes (2019-2025) translated in five
// languages. Instead of depending on third-party quote APIs (which broke the
// old backend), each day re-features an archived quote for every active theme,
// with all its translations. The least recently shown quote goes first, so a
// theme cycles through its whole pool before repeating; loved quotes break ties.

export const QUOTE_LANGS = ['en', 'fr', 'es', 'de', 'it'] as const

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

/**
 * Make sure every active category has a quote for `day`.
 * Returns the number of categories that got a new quote.
 */
export async function scheduleDay(db: D1Database, day: string): Promise<number> {
  const { results: categories } = await db
    .prepare('SELECT id FROM categories WHERE active = 1')
    .all<{ id: string }>()

  let scheduled = 0
  for (const { id } of categories)
    scheduled += (await scheduleCategoryDay(db, id, day)) ? 1 : 0
  return scheduled
}

export async function scheduleCategoryDay(db: D1Database, categoryId: string, day: string): Promise<boolean> {
  const existing = await db
    .prepare('SELECT 1 FROM quotes WHERE category_id = ? AND lang = \'en\' AND date = ?')
    .bind(categoryId, day)
    .first()
  if (existing)
    return false

  // Candidates: original (non-rerun) English days with a photo and every
  // translation. Rank their text by when it was last shown in this theme.
  const source = await db
    .prepare(`
      WITH shown AS (
        SELECT text, max(date) AS last_shown, max(total_votes) AS votes
        FROM quotes WHERE category_id = ?1 AND lang = 'en' AND date < ?2
        GROUP BY text
      )
      SELECT q.date FROM shown s
      JOIN quotes q ON q.category_id = ?1 AND q.lang = 'en' AND q.text = s.text
      WHERE q.source_date IS NULL AND q.img IS NOT NULL AND q.img != '' AND trim(q.author) != ''
        AND (SELECT count(*) FROM quotes t WHERE t.category_id = ?1 AND t.date = q.date) >= ?3
      ORDER BY s.last_shown ASC, s.votes DESC, random()
      LIMIT 1`)
    .bind(categoryId, day, QUOTE_LANGS.length)
    .first<{ date: string }>()
  if (!source)
    return false

  await db
    .prepare(`
      INSERT OR IGNORE INTO quotes (id, category_id, lang, date, text, author, img, tags, total_votes, source_date)
      SELECT lower(hex(randomblob(16))), category_id, lang, ?3, text, author, img, tags, 0, date
      FROM quotes WHERE category_id = ?1 AND date = ?2`)
    .bind(categoryId, source.date, day)
    .run()
  return true
}
