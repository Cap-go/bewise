-- BeWise now stores English only. bewise-translate serves every other
-- language on demand; the French, Spanish, German and Italian quotes and
-- theme names below were copied into its cache first (apps/translate/scripts/seed.ts).

-- 1. Keep the loves given in other languages on the English quote of the same day.
UPDATE quotes SET total_votes = total_votes + (
  SELECT coalesce(sum(t.total_votes), 0) FROM quotes t
  WHERE t.category_id = quotes.category_id AND t.date = quotes.date AND t.lang != 'en'
) WHERE lang = 'en';

INSERT OR IGNORE INTO votes (quote_id, user_id, created_at)
SELECT en.id, v.user_id, v.created_at FROM votes v
JOIN quotes t ON t.id = v.quote_id AND t.lang != 'en'
JOIN quotes en ON en.category_id = t.category_id AND en.date = t.date AND en.lang = 'en';

-- 2. Drop the translated copies.
DELETE FROM votes WHERE quote_id IN (SELECT id FROM quotes WHERE lang != 'en');
DELETE FROM quotes WHERE lang != 'en';
UPDATE categories SET name = json_object('en', json_extract(name, '$.en'));
