// Push App Store listing metadata and screenshots for a version.
//
//   APPLE_KEY_ID=... APPLE_ISSUER_ID=... APPLE_KEY_CONTENT=<base64 .p8> bun store/app-store.ts 3.0.1
//
// Creates (or reuses) the editable iOS version, writes store/metadata/<locale>.json
// and replaces screenshots with store/screenshots/{iphone,ipad}-<lang>/*.jpg.
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const BUNDLE_ID = 'ee.forgr.bewise'
const ROOT = new URL('.', import.meta.url).pathname
const version = process.argv[2]
if (!version)
  throw new Error('usage: bun store/app-store.ts <version>')

const { APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_KEY_CONTENT } = process.env
if (!APPLE_KEY_ID || !APPLE_ISSUER_ID || !APPLE_KEY_CONTENT)
  throw new Error('APPLE_KEY_ID, APPLE_ISSUER_ID and APPLE_KEY_CONTENT are required')

const pem = APPLE_KEY_CONTENT.includes('BEGIN') ? APPLE_KEY_CONTENT : Buffer.from(APPLE_KEY_CONTENT, 'base64').toString()
const key = createPrivateKey(pem)

function token() {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const data = `${b64({ alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' })}.${b64({ iss: APPLE_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`
  return `${data}.${sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

async function asc<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`${method} ${path} -> ${res.status} ${text}`)
  return (text ? JSON.parse(text) : null) as T
}

// Locale folder -> screenshot language folder.
const LOCALES: Record<string, string> = { 'en-GB': 'en', 'fr-FR': 'fr' }
const DISPLAY_TYPES: Record<string, string> = { iphone: 'APP_IPHONE_67', ipad: 'APP_IPAD_PRO_3GEN_129' }
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY']

const app = (await asc(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0]
console.log(`app ${app.id} ${app.attributes.name}`)

// 1. Version
const versions = (await asc(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data
let appVersion = versions.find((v: any) => v.attributes.versionString === version)
  ?? versions.find((v: any) => EDITABLE.includes(v.attributes.appStoreState))
if (!appVersion) {
  appVersion = (await asc('/v1/appStoreVersions', 'POST', {
    data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: version, releaseType: 'AFTER_APPROVAL' }, relationships: { app: { data: { type: 'apps', id: app.id } } } },
  })).data
}
else {
  await asc(`/v1/appStoreVersions/${appVersion.id}`, 'PATCH', { data: { type: 'appStoreVersions', id: appVersion.id, attributes: { versionString: version, releaseType: 'AFTER_APPROVAL' } } })
}
console.log(`version ${version} (${appVersion.id})`)

// 2. App info (name, subtitle, privacy URL) lives on the editable appInfo.
const appInfos = (await asc(`/v1/apps/${app.id}/appInfos`)).data
const appInfo = appInfos.find((i: any) => i.attributes.appStoreState !== 'READY_FOR_SALE') ?? appInfos[0]
const infoLocs = (await asc(`/v1/appInfos/${appInfo.id}/appInfoLocalizations`)).data

const versionLocs = (await asc(`/v1/appStoreVersions/${appVersion.id}/appStoreVersionLocalizations?limit=50`)).data

for (const [locale, lang] of Object.entries(LOCALES)) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'metadata', `${locale}.json`), 'utf8'))

  const info = infoLocs.find((l: any) => l.attributes.locale === locale)
  const infoAttrs = { name: meta.name, subtitle: meta.subtitle, privacyPolicyUrl: meta.privacyPolicyUrl }
  if (info)
    await asc(`/v1/appInfoLocalizations/${info.id}`, 'PATCH', { data: { type: 'appInfoLocalizations', id: info.id, attributes: infoAttrs } })
  else
    await asc('/v1/appInfoLocalizations', 'POST', { data: { type: 'appInfoLocalizations', attributes: { locale, ...infoAttrs }, relationships: { appInfo: { data: { type: 'appInfos', id: appInfo.id } } } } })

  const attrs = {
    description: meta.description,
    keywords: meta.keywords,
    promotionalText: meta.promotionalText,
    whatsNew: meta.whatsNew,
    supportUrl: meta.supportUrl,
    marketingUrl: meta.marketingUrl,
  }
  let loc = versionLocs.find((l: any) => l.attributes.locale === locale)
  if (loc) {
    await asc(`/v1/appStoreVersionLocalizations/${loc.id}`, 'PATCH', { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: attrs } })
  }
  else {
    loc = (await asc('/v1/appStoreVersionLocalizations', 'POST', { data: { type: 'appStoreVersionLocalizations', attributes: { locale, ...attrs }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: appVersion.id } } } } })).data
  }
  console.log(`${locale}: metadata updated`)

  // 3. Screenshots: drop every inherited set, upload ours.
  const sets = (await asc(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data
  for (const set of sets)
    await asc(`/v1/appScreenshotSets/${set.id}`, 'DELETE')

  for (const [device, displayType] of Object.entries(DISPLAY_TYPES)) {
    const dir = join(ROOT, 'screenshots', `${device}-${lang}`)
    const files = readdirSync(dir).filter(f => /\.(?:png|jpe?g)$/.test(f)).sort()
    const set = (await asc('/v1/appScreenshotSets', 'POST', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } },
    })).data
    for (const file of files) {
      const bytes = readFileSync(join(dir, file))
      const shot = (await asc('/v1/appScreenshots', 'POST', {
        data: { type: 'appScreenshots', attributes: { fileName: file, fileSize: bytes.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
      })).data
      for (const op of shot.attributes.uploadOperations) {
        const res = await fetch(op.url, {
          method: op.method,
          headers: Object.fromEntries(op.requestHeaders.map((h: any) => [h.name, h.value])),
          body: bytes.subarray(op.offset, op.offset + op.length),
        })
        if (!res.ok)
          throw new Error(`upload ${file}: ${res.status}`)
      }
      await asc(`/v1/appScreenshots/${shot.id}`, 'PATCH', {
        data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } },
      })
    }
    console.log(`${locale}: ${files.length} ${displayType} screenshots`)
  }
}
console.log('done')
