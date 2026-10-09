export const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.bewise.love'

export interface Quote {
  id: string
  category: string
  lang: string
  date: string
  text: string
  author: string
  img: string | null
  tags: string[]
  votes: number
  voted: boolean
}

export interface Category {
  id: string
  name: string
  img: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok)
    throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined>) {
  return new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
}

export const api = {
  today: (category: string, lang: string, date: string, user: string) =>
    request<Quote>(`/v1/quotes/today?${qs({ category, lang, date, user })}`),
  archive: (category: string, lang: string, before: string, limit = 20) =>
    request<Quote[]>(`/v1/quotes?${qs({ category, lang, before, limit })}`),
  quote: (id: string, lang: string, user: string) => request<Quote>(`/v1/quotes/${id}?${qs({ lang, user })}`),
  vote: (id: string, user: string) =>
    request<{ votes: number, voted: boolean }>(`/v1/quotes/${id}/vote`, { method: 'POST', body: JSON.stringify({ user }) }),
  categories: (lang: string) => request<Category[]>(`/v1/categories?${qs({ lang, v: 3 })}`),
  saveUser: (id: string, body: { category?: string, lang?: string, platform?: string, appVersion?: string }) =>
    request<{ ok: boolean }>(`/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
}

/** Resize Unsplash photos for the device instead of downloading the 900x1600 originals. */
export function photo(url: string | null | undefined, width: number, height?: number): string | undefined {
  if (!url)
    return undefined
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('unsplash.com'))
      return url
    const dpr = Math.min(window.devicePixelRatio || 2, 3)
    u.searchParams.set('w', String(Math.round(width * dpr)))
    if (height)
      u.searchParams.set('h', String(Math.round(height * dpr)))
    else
      u.searchParams.delete('h')
    u.searchParams.set('fit', 'crop')
    u.searchParams.set('auto', 'format')
    u.searchParams.set('q', '70')
    u.searchParams.delete('fm')
    return u.toString()
  }
  catch {
    return url
  }
}

export function localDay(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
