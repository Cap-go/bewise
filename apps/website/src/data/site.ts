export const site = {
  name: 'BeWise',
  url: 'https://bewise.love',
  tagline: 'One beautiful quote, every day.',
  description: 'BeWise brings you one beautiful quote every morning on a full-bleed photo. 9 themes, 1,100+ quotes, in your language. Free, no account, no ads.',
  appStoreId: '1448918843',
  appStore: 'https://apps.apple.com/app/id1448918843',
  googlePlay: 'https://play.google.com/store/apps/details?id=ee.forgr.bewise',
  github: 'https://github.com/Cap-go/bewise',
  capgo: 'https://capgo.app',
  email: 'hello@capgo.app',
  company: 'Digital Shift OÜ',
  api: 'https://api.bewise.love',
} as const

export const nav = [
  { href: '/#features', label: 'Features' },
  { href: '/#open-source', label: 'Open source' },
  { href: '/shortcut', label: 'Shortcut' },
  { href: '/support', label: 'Support' },
] as const

export interface Quote {
  category: string
  text: string
  author: string
  img: string
}

const photo = (id: string) => `https://images.unsplash.com/photo-${id}`

/** Shown instantly and whenever the live API can't be reached. */
export const fallbackQuotes: Record<string, Quote> = {
  inspire: { category: 'inspire', text: 'Act as if what you do makes a difference. It does.', author: 'William James', img: photo('1470071459604-3b5ec3a7fe05') },
  love: { category: 'love', text: 'Where there is love there is life.', author: 'Mahatma Gandhi', img: photo('1490750967868-88aa4486c946') },
  management: { category: 'management', text: 'A leader is one who knows the way, goes the way, and shows the way.', author: 'John C. Maxwell', img: photo('1519681393784-d120267933ba') },
  programming: { category: 'programming', text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra', img: photo('1518837695005-2083093ee35b') },
  funny: { category: 'funny', text: 'I am so clever that sometimes I don’t understand a single word of what I am saying.', author: 'Oscar Wilde', img: photo('1507525428034-b723cf961d3e') },
}

export const showcaseCategories = [
  { id: 'inspire', label: 'Inspiration' },
  { id: 'love', label: 'Love' },
  { id: 'management', label: 'Leadership' },
  { id: 'programming', label: 'Programming' },
  { id: 'funny', label: 'Humour' },
] as const

export const languages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
  { id: 'de', label: 'Deutsch' },
  { id: 'it', label: 'Italiano' },
  { id: 'ja', label: '日本語' },
  { id: 'hi', label: 'हिन्दी' },
] as const

export const themes = [
  'Inspiration',
  'Leadership',
  'Sports',
  'Life',
  'Humour',
  'Love',
  'Art',
  'Students',
  'Programming',
] as const

export function sized(url: string, width: number, quality = 70): string {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('unsplash.com')) {
      u.searchParams.set('w', String(width))
      u.searchParams.set('q', String(quality))
      u.searchParams.set('auto', 'format')
      u.searchParams.set('fit', 'crop')
    }
    return u.toString()
  }
  catch {
    return url
  }
}
