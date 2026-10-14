import type { Category } from './api'
import { ref, watch } from 'vue'
import { api } from './api'
import { BUNDLED_CATEGORIES } from './bundled'
import { state } from './state'
import { readJSON, writeJSON } from './storage'

const cached = (lang: string): Category[] => readJSON<Category[]>(`bewise.categories.${lang}`, [])

/** Never empty: the last list for this language, else the English themes shipped with the app. */
export const categories = ref<Category[]>(BUNDLED_CATEGORIES)
/** True while the list on screen is a fallback and the latest fetch failed. */
export const catalogStale = ref(false)

let generation = 0

export async function loadCategories() {
  const current = ++generation
  const lang = state.lang
  const saved = cached(lang)
  categories.value = saved.length ? saved : BUNDLED_CATEGORIES
  try {
    const fresh = await api.categories(lang)
    if (current !== generation)
      return
    categories.value = fresh
    catalogStale.value = false
    // Retired themes: move their readers to Inspiration.
    if (fresh.length && !fresh.some(c => c.id === state.category))
      state.category = 'inspire'
    writeJSON(`bewise.categories.${lang}`, fresh)
  }
  catch {
    if (current === generation)
      catalogStale.value = !saved.length
  }
}

export function categoryName(id: string): string {
  return categories.value.find(c => c.id === id)?.name ?? id
}

watch(() => state.lang, () => void loadCategories())
