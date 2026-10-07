-- Content cleanup after the Supabase/Firebase import.
-- 1. The broken 2025 Supabase cron stored one untranslated, imageless quote
--    in every theme. Drop those rows.
DELETE FROM quotes WHERE date IN ('2025-11-25', '2025-11-30') AND (img IS NULL OR img = '');

-- 2. The legacy fetcher saved the same quote day after day: Emotions and
--    Justice only hold one usable quote each. Retire them; the app moves their
--    users to Inspiration.
UPDATE categories SET active = 0 WHERE id IN ('emotions', 'justice');

-- 3. Lookups by text for de-duplicated archives and rotation.
CREATE INDEX IF NOT EXISTS idx_quotes_text ON quotes (category_id, lang, text);
