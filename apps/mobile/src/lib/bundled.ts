import type { Category, Quote } from './api'

// Shipped with the app so a first launch without network still has themes
// to pick and a quote to read. English only: translations need the API.

const img = (id: string) => `https://images.unsplash.com/photo-${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=1600&q=80&w=900`

export const BUNDLED_CATEGORIES: Category[] = [
  { id: 'inspire', name: 'Inspiration', img: img('1541996206728-9e1c3466a148') },
  { id: 'management', name: 'Leadership', img: img('1526413425697-1d271fdbe7a9') },
  { id: 'sports', name: 'Sports', img: img('1576467544820-c20238183fa6') },
  { id: 'life', name: 'Life', img: img('1542549596-c5ea2b9f69fc') },
  { id: 'funny', name: 'Funny', img: img('1546052646-a88eafec0399') },
  { id: 'love', name: 'Love', img: img('1517856713891-215e57a13c0d') },
  { id: 'art', name: 'Art', img: img('1578926078640-668b1fb75403') },
  { id: 'students', name: 'Students', img: img('1560065710-bfe2ffbb06be') },
  { id: 'programming', name: 'Programming', img: img('1505238680356-667803448bb6') },
]

export function bundledQuote(category: string, date: string): Quote {
  return {
    id: '37712cb004cb3fe93c4a38564be0b3bb',
    category,
    lang: 'en',
    date,
    text: 'Our life is what our thoughts make it.',
    author: 'Marcus Aurelius',
    img: null,
    tags: [],
    votes: 0,
    voted: false,
  }
}
