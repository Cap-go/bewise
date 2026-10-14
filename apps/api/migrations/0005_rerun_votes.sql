-- Hearts survive reruns.
-- 1. The legacy apps counted loves without always storing who gave them:
--    keep that anonymous part apart, so recounting the votes rows (on every
--    vote) no longer wipes it. From now on total_votes = legacy_votes + votes rows.
ALTER TABLE quotes ADD COLUMN legacy_votes INTEGER NOT NULL DEFAULT 0;
UPDATE quotes SET legacy_votes = max(0, total_votes - (SELECT count(*) FROM votes WHERE quote_id = quotes.id));

-- 2. A rerun starts with every heart its text received on earlier days
--    (src/schedule.ts does the same for new reruns).
INSERT OR IGNORE INTO votes (quote_id, user_id, created_at)
SELECT r.id, v.user_id, min(v.created_at) FROM quotes r
JOIN quotes o ON o.category_id = r.category_id AND o.lang = r.lang AND o.text = r.text AND o.date < r.date
JOIN votes v ON v.quote_id = o.id
WHERE r.source_date IS NOT NULL
GROUP BY r.id, v.user_id;

UPDATE quotes SET legacy_votes = max(legacy_votes, (
  SELECT coalesce(max(o.legacy_votes), 0) FROM quotes o
  WHERE o.category_id = quotes.category_id AND o.lang = quotes.lang AND o.text = quotes.text AND o.date < quotes.date
)) WHERE source_date IS NOT NULL;

UPDATE quotes SET total_votes = legacy_votes + (SELECT count(*) FROM votes WHERE quote_id = quotes.id);
