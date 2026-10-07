-- Clean, hand-written category names for the five supported languages.
UPDATE categories SET name='{"en": "Inspiration", "fr": "Inspiration", "es": "Inspiración", "de": "Inspiration", "it": "Ispirazione"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='inspire';
UPDATE categories SET name='{"en": "Leadership", "fr": "Leadership", "es": "Liderazgo", "de": "Führung", "it": "Leadership"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='management';
UPDATE categories SET name='{"en": "Sports", "fr": "Sport", "es": "Deporte", "de": "Sport", "it": "Sport"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='sports';
UPDATE categories SET name='{"en": "Emotions", "fr": "Émotions", "es": "Emociones", "de": "Gefühle", "it": "Emozioni"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='emotions';
UPDATE categories SET name='{"en": "Life", "fr": "Vie", "es": "Vida", "de": "Leben", "it": "Vita"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='life';
UPDATE categories SET name='{"en": "Funny", "fr": "Humour", "es": "Humor", "de": "Humor", "it": "Umorismo"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='funny';
UPDATE categories SET name='{"en": "Love", "fr": "Amour", "es": "Amor", "de": "Liebe", "it": "Amore"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='love';
UPDATE categories SET name='{"en": "Art", "fr": "Art", "es": "Arte", "de": "Kunst", "it": "Arte"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='art';
UPDATE categories SET name='{"en": "Students", "fr": "Études", "es": "Estudiantes", "de": "Studium", "it": "Studenti"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='students';
UPDATE categories SET name='{"en": "Programming", "fr": "Programmation", "es": "Programación", "de": "Programmieren", "it": "Programmazione"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='programming';
UPDATE categories SET name='{"en": "Justice", "fr": "Justice", "es": "Justicia", "de": "Gerechtigkeit", "it": "Giustizia"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='justice';
UPDATE categories SET name='{"en": "Design", "fr": "Design", "es": "Diseño", "de": "Design", "it": "Design"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='design';
UPDATE categories SET name='{"en": "Greatness", "fr": "Grandeur", "es": "Grandeza", "de": "Größe", "it": "Grandezza"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='greatness';
UPDATE categories SET name='{"en": "Random", "fr": "Au hasard", "es": "Aleatorio", "de": "Zufall", "it": "Casuale"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='random';
UPDATE categories SET name='{"en": "Startups", "fr": "Startups", "es": "Startups", "de": "Startups", "it": "Startup"}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='startup';
