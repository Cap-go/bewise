// Daily quote scheduling.
// BeWise has ~1,100 unique hand-picked quotes (2019-2025), stored in English
// (bewise-translate serves every other language). Instead of depending on
// third-party quote APIs (which broke the old backend), each day re-features an
// archived quote for every active theme. The least recently shown quote goes
// first, so a theme cycles through its whole pool before repeating; loved
// quotes break ties.

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

  // Candidates: original (non-rerun) days with a photo and an author.
  // Rank their text by when it was last shown in this theme.
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
      ORDER BY s.last_shown ASC, s.votes DESC, random()
      LIMIT 1`)
    .bind(categoryId, day)
    .first<{ date: string }>()
  if (!source)
    return false

  // The rerun keeps the hearts its text already received.
  const id = crypto.randomUUID().replaceAll('-', '')
  await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO quotes (id, category_id, lang, date, text, author, img, tags, total_votes, legacy_votes, source_date)
      SELECT ?4, category_id, lang, ?3, text, author, img, tags, 0, 0, date
      FROM quotes WHERE category_id = ?1 AND lang = 'en' AND date = ?2`)
      .bind(categoryId, source.date, day, id),
    ...inheritVotes(db, id),
  ])
  return true
}

/**
 * Give a rerun the hearts of every earlier day of its text: the users who
 * loved it (so they see it loved) and the anonymous legacy count.
 * Same rules as migrations/0005_rerun_votes.sql.
 */
export function inheritVotes(db: D1Database, id: string): D1PreparedStatement[] {
  return [
    db.prepare(`
      INSERT OR IGNORE INTO votes (quote_id, user_id, created_at)
      SELECT r.id, v.user_id, min(v.created_at) FROM quotes r
      JOIN quotes o ON o.category_id = r.category_id AND o.lang = r.lang AND o.text = r.text AND o.date < r.date
      JOIN votes v ON v.quote_id = o.id
      WHERE r.id = ?1
      GROUP BY v.user_id`).bind(id),
    db.prepare(`
      UPDATE quotes SET legacy_votes = max(legacy_votes, (
        SELECT coalesce(max(o.legacy_votes), 0) FROM quotes o
        WHERE o.category_id = quotes.category_id AND o.lang = quotes.lang AND o.text = quotes.text AND o.date < quotes.date
      )) WHERE id = ?1`).bind(id),
    countVotes(db, id),
  ]
}

/** Recount a quote's hearts after its votes changed. */
export function countVotes(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare('UPDATE quotes SET total_votes = legacy_votes + (SELECT count(*) FROM votes WHERE quote_id = ?1) WHERE id = ?1').bind(id)
}
