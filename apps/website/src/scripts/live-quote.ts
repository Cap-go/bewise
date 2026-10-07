import type { Quote } from '../data/site'
import { fallbackQuotes, showcaseCategories, site, sized } from '../data/site'

interface ApiQuote extends Quote {
  lang: string
  date: string
  votes: number
}

const labels: Record<string, string> = Object.fromEntries(showcaseCategories.map(c => [c.id, c.label]))
const cache = new Map<string, Promise<ApiQuote | null>>()
const state = { category: 'inspire', lang: 'en' }
let token = 0

function fetchQuote(category: string, lang: string): Promise<ApiQuote | null> {
  const key = `${category}:${lang}`
  let pending = cache.get(key)
  if (!pending) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    pending = fetch(`${site.api}/v1/quotes/today?category=${category}&lang=${lang}`, { signal: ctrl.signal })
      .then(res => (res.ok ? (res.json() as Promise<ApiQuote>) : null))
      .then(q => (q && q.text && q.author ? q : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer))
    cache.set(key, pending)
  }
  return pending
}

function setText(selector: string, value: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.textContent !== value)
      el.textContent = value
  })
}

function setImage(url: string) {
  document.querySelectorAll<HTMLImageElement>('[data-live-img]').forEach((img) => {
    const width = Number(img.dataset.liveImg) || 1200
    const next = sized(url, width)
    if (img.src === next)
      return
    const loader = new Image()
    loader.decoding = 'async'
    loader.onload = () => {
      img.style.opacity = '0'
      setTimeout(() => {
        img.src = next
        img.style.opacity = '1'
      }, 250)
    }
    loader.src = next
  })
}

function render(q: Quote & { votes?: number, date?: string }, lang: string) {
  setText('[data-live-text]', q.text)
  setText('[data-live-author]', q.author)
  setText('[data-live-category]', labels[q.category] ?? labels[state.category] ?? 'Inspiration')
  setText('[data-live-votes]', q.votes ? new Intl.NumberFormat(lang).format(q.votes) : 'Love')
  const length = q.text.length
  document.querySelectorAll<HTMLElement>('[data-live-text]').forEach((el) => {
    el.dataset.length = length > 220 ? 'xl' : length > 130 ? 'long' : length > 70 ? 'medium' : 'short'
  })
  const day = q.date ? new Date(`${q.date}T12:00:00`) : new Date()
  setText('[data-live-date]', new Intl.DateTimeFormat(lang, { weekday: 'long', month: 'long', day: 'numeric' }).format(day))
  document.querySelectorAll<HTMLElement>('[data-live-lang]').forEach(el => el.setAttribute('lang', lang))
  if (q.img)
    setImage(q.img)
}

async function update() {
  const current = ++token
  const { category, lang } = state
  document.documentElement.toggleAttribute('data-quote-loading', true)
  const live = await fetchQuote(category, lang)
  if (current !== token)
    return
  document.documentElement.toggleAttribute('data-quote-loading', false)
  const quote = live ?? fallbackQuotes[category] ?? fallbackQuotes.inspire!
  render(quote, live ? lang : 'en')
  document.querySelectorAll<HTMLElement>('[data-live-status]').forEach((el) => {
    el.textContent = live ? 'Live from api.bewise.love' : 'Offline preview'
    el.dataset.state = live ? 'live' : 'offline'
  })
}

function bindGroup(attr: 'category' | 'lang') {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-pick-${attr}]`)
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state[attr] = btn.dataset[attr === 'category' ? 'pickCategory' : 'pickLang']!
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)))
      void update()
    })
  })
}

bindGroup('category')
bindGroup('lang')

document.querySelectorAll<HTMLButtonElement>('[data-copy-quote]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = document.querySelector('[data-live-text]')?.textContent?.trim()
    const author = document.querySelector('[data-live-author]')?.textContent?.trim()
    const label = btn.querySelector('[data-copy-label]')
    try {
      await navigator.clipboard.writeText(`“${text}” — ${author}\n\nDaily wisdom with BeWise: ${site.url}`)
      if (label) {
        label.textContent = 'Copied'
        setTimeout(() => (label.textContent = 'Copy quote'), 1800)
      }
    }
    catch {}
  })
})

void update()
