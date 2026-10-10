// Stamps the iOS app version before a store build.
// MARKETING_VERSION = package.json version (also shown in Settings as __APP_VERSION__).
// CURRENT_PROJECT_VERSION = commit count on HEAD: grows with every commit, as App Store Connect requires.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const project = 'ios/App/App.xcodeproj/project.pbxproj'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const build = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()

const text = readFileSync(project, 'utf8')
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
writeFileSync(project, text)
console.log(`iOS sürümü ${version} (${build})`)
