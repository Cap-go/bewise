// Push App Store listing metadata, screenshots and media for a version.
//
//   APPLE_KEY_ID=... APPLE_ISSUER_ID=... APPLE_KEY_CONTENT=<base64 .p8> bun store/app-store.ts 3.0.1
//
// Creates (or reuses) the editable iOS version, writes store/metadata/<locale>.json,
// replaces screenshots with store/screenshots/{iphone,ipad,duo-outer,duo-inner}-<lang>/*.jpg,
// the iPhone app preview with store/previews/iphone.mp4, and places the product
// page header and search results assets from store/creative/ (Asset Library).
// Renders come from store/promo (`bun run render`, `bun scripts/store-assets.ts`).
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

/** Send a file through the upload operations App Store Connect hands back. */
async function upload(ops: { url: string, method: string, offset: number, length: number, requestHeaders: { name: string, value: string }[] }[], bytes: Buffer, name: string) {
  for (const op of ops) {
    const res = await fetch(op.url, {
      method: op.method,
      headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])),
      body: bytes.subarray(op.offset, op.offset + op.length),
    })
    if (!res.ok)
      throw new Error(`upload ${name}: ${res.status}`)
  }
}

const md5 = (bytes: Buffer) => createHash('md5').update(bytes).digest('hex')

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
// Screenshot set -> folders (prefix of store/screenshots/<prefix>-<lang>).
// APP_IPHONE_DUO is not in Apple's OpenAPI yet but the API accepts it; one set
// holds both the outer (1398x2034) and inner (2007x2853) display screenshots.
const DISPLAY_TYPES: Record<string, string[]> = {
  APP_IPHONE_67: ['iphone'],
  APP_IPAD_PRO_3GEN_129: ['ipad'],
  APP_IPHONE_DUO: ['duo-outer', 'duo-inner'],
}
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

// Creative assets are uploaded once to the Asset Library, then placed on every localization.
let creative: Record<string, { kind: string, id: string }> | undefined

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

  for (const [displayType, folders] of Object.entries(DISPLAY_TYPES)) {
    const files = folders.flatMap((folder) => {
      const dir = join(ROOT, 'screenshots', `${folder}-${lang}`)
      return existsSync(dir) ? readdirSync(dir).filter(f => /\.(?:png|jpe?g)$/.test(f)).sort().map(f => join(dir, f)) : []
    })
    if (!files.length)
      continue
    const set = (await asc('/v1/appScreenshotSets', 'POST', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } },
    })).data
    for (const path of files) {
      const bytes = readFileSync(path)
      const fileName = path.split('/').slice(-2).join('-')
      const shot = (await asc('/v1/appScreenshots', 'POST', {
        data: { type: 'appScreenshots', attributes: { fileName, fileSize: bytes.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
      })).data
      await upload(shot.attributes.uploadOperations, bytes, fileName)
      await asc(`/v1/appScreenshots/${shot.id}`, 'PATCH', {
        data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5(bytes) } },
      })
    }
    console.log(`${locale}: ${files.length} ${displayType} screenshots`)
  }

  // 4. iPhone app preview (6.9" set, used for every iPhone size).
  const preview = join(ROOT, 'previews', 'iphone.mp4')
  if (existsSync(preview)) {
    for (const set of (await asc(`/v1/appStoreVersionLocalizations/${loc.id}/appPreviewSets?limit=50`)).data)
      await asc(`/v1/appPreviewSets/${set.id}`, 'DELETE')
    const set = (await asc('/v1/appPreviewSets', 'POST', {
      data: { type: 'appPreviewSets', attributes: { previewType: 'IPHONE_67' }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } },
    })).data
    const bytes = readFileSync(preview)
    const video = (await asc('/v1/appPreviews', 'POST', {
      data: { type: 'appPreviews', attributes: { fileName: 'bewise-iphone.mp4', fileSize: bytes.length, previewFrameTimeCode: '00:00:07:18', mimeType: 'video/mp4' }, relationships: { appPreviewSet: { data: { type: 'appPreviewSets', id: set.id } } } },
    })).data
    await upload(video.attributes.uploadOperations, bytes, 'preview')
    await asc(`/v1/appPreviews/${video.id}`, 'PATCH', { data: { type: 'appPreviews', id: video.id, attributes: { uploaded: true, sourceFileChecksum: md5(bytes) } } })
    console.log(`${locale}: app preview`)
  }

  // 5. Product page header and search results assets (Asset Library, iOS 27+).
  await placeCreative(loc.id, locale)
}

async function libraryAsset(file: string) {
  const bytes = readFileSync(join(ROOT, 'creative', file))
  const kind = file.endsWith('.mp4') ? 'appAssetLibraryVideos' : 'appAssetLibraryImages'
  const referenceName = `BeWise ${file}`
  // Reuse the copy uploaded by an earlier run instead of filling the library with duplicates.
  const existing = (await asc(`/v1/appAssetLibraries/${app.id}/${kind === 'appAssetLibraryVideos' ? 'videos' : 'images'}?limit=200`)).data
    .find((a: any) => a.attributes.referenceName === referenceName && !a.attributes.archived)
  if (existing)
    return { kind, id: existing.id as string }
  const asset = (await asc(`/v1/${kind}`, 'POST', {
    data: { type: kind, attributes: { category: 'CREATIVE_ASSETS', fileName: `bewise-${file}`, fileSize: bytes.length, referenceName }, relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: app.id } } } },
  })).data
  await upload(asset.attributes.uploadOperations, bytes, file)
  await asc(`/v1/${kind}/${asset.id}`, 'PATCH', { data: { type: kind, id: asset.id, attributes: { uploaded: true } } })
  return { kind, id: asset.id }
}

async function placeCreative(locId: string, locale: string) {
  if (!existsSync(join(ROOT, 'creative')))
    return
  creative ??= { header: await libraryAsset('header.mp4'), search: await libraryAsset('search.mp4') }
  for (const [name, placementType] of [['header', 'PRODUCT_PAGE_HEADER_ASSET'], ['search', 'APP_STORE_SEARCH_RESULTS_ASSET']] as const) {
    const asset = creative[name]
    const media = asset.kind === 'appAssetLibraryVideos' ? 'video' : 'image'
    try {
      await asc('/v1/appAssetLibraryPlacements', 'POST', {
        data: { type: 'appAssetLibraryPlacements', attributes: { placementType }, relationships: { [media]: { data: { type: asset.kind, id: asset.id } }, appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } },
      })
      console.log(`${locale}: ${placementType}`)
    }
    catch (error) {
      if (!/ 409 /.test(String(error)))
        throw error
      console.log(`${locale}: ${placementType} already placed`)
    }
  }
}
console.log('done')
