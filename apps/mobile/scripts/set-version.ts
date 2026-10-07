// Stamp one version everywhere: package.json (Capgo bundle + updater builtin
// version), iOS MARKETING_VERSION / build number and Android versionName / versionCode.
//   bun scripts/set-version.ts 3.0.12
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const version = process.argv[2]
const match = version?.match(/^(\d+)\.(\d+)\.(\d+)$/)
if (!match)
  throw new Error('usage: bun scripts/set-version.ts <major.minor.patch>')
const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number]
const code = major * 1_000_000 + minor * 1_000 + patch

const edit = (path: string, fn: (s: string) => string) => writeFileSync(path, fn(readFileSync(path, 'utf8')))

edit('package.json', s => s.replace(/"version": "[^"]+"/, `"version": "${version}"`))
edit('ios/App/App.xcodeproj/project.pbxproj', s => s
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${code};`))
edit('android/app/build.gradle', s => s
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`))

console.log(`version ${version} (${code})`)
