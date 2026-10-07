// Upload an AAB to the Google Play production track.
//
//   PLAY_CONFIG_JSON=<service account json or base64> bun store/play-release.ts app.aab 3.0.8
//
// BeWise's Play app requires changes to be sent for review from the Play
// Console, so the edit is committed with changesNotSentForReview=true.
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const PACKAGE = 'ee.forgr.bewise'
const ROOT = new URL('.', import.meta.url).pathname
const [aab, versionName] = process.argv.slice(2)
if (!aab || !versionName)
  throw new Error('usage: bun store/play-release.ts <app.aab> <versionName>')
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

async function call(url: string, method = 'GET', body?: unknown, contentType = 'application/json') {
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit,
  })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`${method} ${url} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const notes = [['en-US', 'en-GB'], ['fr-FR', 'fr-FR']].map(([language, file]) => ({
  language,
  text: JSON.parse(readFileSync(join(ROOT, 'metadata', `${file}.json`), 'utf8')).whatsNew.slice(0, 500),
}))

const edit = await call(`${API}/edits`, 'POST')
const bundle = await call(`${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, 'POST', readFileSync(aab), 'application/octet-stream')
console.log(`uploaded versionCode ${bundle.versionCode}`)
await call(`${API}/edits/${edit.id}/tracks/production`, 'PUT', {
  track: 'production',
  releases: [{ name: versionName, status: 'completed', versionCodes: [String(bundle.versionCode)], releaseNotes: notes }],
})
await call(`${API}/edits/${edit.id}:commit?changesNotSentForReview=true`, 'POST')
console.log(`production release ${versionName} ready: click "Send for review" in Play Console`)
