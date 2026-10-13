// Tiny App Store Connect API client for one-off store tasks.
//
//   bun store/asc.ts GET /v1/apps/1448918843
//   bun store/asc.ts PATCH /v1/reviewSubmissions/<id> '{"data":{...}}'
//
// Uses APPLE_KEY_ID / APPLE_ISSUER_ID / APPLE_KEY_CONTENT from the environment,
// or ~/.capgo-credentials/credentials.json (ee.forgr.bewise.ios) when unset.
import { createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

const file = `${process.env.HOME}/.capgo-credentials/credentials.json`
const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8'))['ee.forgr.bewise']?.ios ?? {} : {}
const keyId = process.env.APPLE_KEY_ID ?? saved.APPLE_KEY_ID
const issuer = process.env.APPLE_ISSUER_ID ?? saved.APPLE_ISSUER_ID
const raw: string = process.env.APPLE_KEY_CONTENT ?? saved.APPLE_KEY_CONTENT
if (!keyId || !issuer || !raw)
  throw new Error('APPLE_KEY_ID, APPLE_ISSUER_ID and APPLE_KEY_CONTENT are required')
const key = createPrivateKey(raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString())

function token() {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const data = `${b64({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${b64({ iss: issuer, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`
  return `${data}.${sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

export async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { ...init, headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json', ...init.headers } })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok)
    throw new Error(`${res.status} ${path}: ${JSON.stringify(json?.errors ?? json).slice(0, 800)}`)
  return json
}

if (import.meta.main) {
  const [method, path, body] = process.argv.slice(2)
  console.log(JSON.stringify(await api(path, { method, body }), null, 1))
}
