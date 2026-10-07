import type { Category } from './api'
import { ref, watch } from 'vue'
import { api } from './api'
import { state } from './state'

const cached = (lang: string): Category[] => JSON.parse(localStorage.getItem(`bewise.categories.${lang}`) ?? '[]')

export const categories = ref<Category[]>([])

export async function loadCategories() {
  categories.value = cached(state.lang)
  try {
    const fresh = await api.categories(state.lang)
    categories.value = fresh
    // Retired themes: move their readers to Inspiration.
    if (fresh.length && !fresh.some(c => c.id === state.category))
      state.category = 'inspire'
    localStorage.setItem(`bewise.categories.${state.lang}`, JSON.stringify(fresh))
  }
  catch {}
}

export function categoryName(id: string): string {
  return categories.value.find(c => c.id === id)?.name ?? id
}

watch(() => state.lang, () => void loadCategories())
