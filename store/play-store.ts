// Push Google Play listing text and graphics.
//
//   PLAY_CONFIG_JSON=<service account json or base64> bun store/play-store.ts
//
// Writes store/metadata/play/<locale>.json and replaces phone screenshots
// (store/screenshots/android-<lang>/*.jpg), feature graphic and icon.
import { createSign } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const PACKAGE = 'ee.forgr.bewise'
const ROOT = new URL('.', import.meta.url).pathname
const raw = process.env.PLAY_CONFIG_JSON
if (!raw)
  throw new Error('PLAY_CONFIG_JSON is required')
const sa = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString())

const now = Math.floor(Date.now() / 1000)
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')}`
const { access_token } = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
})).json() as { access_token: string }

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`
const auth = { Authorization: `Bearer ${access_token}` }

async function call(url: string, method = 'GET', body?: unknown, contentType = 'application/json') {
  const res = await fetch(url, {
    method,
    headers: { ...auth, 'Content-Type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit,
  })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`${method} ${url} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

// Some apps must send changes for review from the Play Console; others send
// them automatically. Try the automatic path, fall back to the manual one.
async function commit(editUrl: string): Promise<string> {
  try {
    await call(`${editUrl}:commit`, 'POST')
    return 'sent for review'
  }
  catch (error) {
    if (!String(error).includes('changesNotSentForReview'))
      throw error
    await call(`${editUrl}:commit?changesNotSentForReview=true`, 'POST')
    return 'saved; click "Send for review" in Play Console'
  }
}

const LOCALES: Record<string, string> = { 'en-US': 'en', 'fr-FR': 'fr' }
const edit = await call(`${API}/edits`, 'POST')
const e = `${API}/edits/${edit.id}`
const u = `${UPLOAD}/edits/${edit.id}`

for (const [locale, lang] of Object.entries(LOCALES)) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'metadata', 'play', `${locale}.json`), 'utf8'))
  await call(`${e}/listings/${locale}`, 'PUT', { language: locale, title: meta.title, shortDescription: meta.shortDescription, fullDescription: meta.fullDescription })

  const images: [string, string[]][] = [
    ['phoneScreenshots', readdirSync(join(ROOT, 'screenshots', `android-${lang}`)).filter(f => f.endsWith('.jpg')).sort().map(f => join(ROOT, 'screenshots', `android-${lang}`, f))],
    ['featureGraphic', [join(ROOT, 'play-feature-graphic.png')]],
    ['icon', [join(ROOT, 'play-icon-512.png')]],
  ]
  for (const [type, files] of images) {
    await call(`${e}/listings/${locale}/${type}`, 'DELETE')
    for (const file of files)
      await call(`${u}/listings/${locale}/${type}?uploadType=media`, 'POST', readFileSync(file), file.endsWith('.png') ? 'image/png' : 'image/jpeg')
  }
  console.log(`${locale}: listing and graphics updated`)
}

console.log(`listing ${await commit(e)}`)
