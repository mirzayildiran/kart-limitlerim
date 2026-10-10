// iPhone'da canlı test: Vite'ı yerel ağa açar, iOS uygulamasını bu sunucuya yönlendirir.
// Kullanım: npm run ios:dev            (sunucu + Xcode'da Run'a basılır)
//           npm run ios:dev -- --run   (sunucu + bağlı iPhone'a doğrudan kurar)
// Mac ve iPhone aynı Wi-Fi'da olmalı. Kaydettiğin her değişiklik telefonda anında yenilenir.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const port = 5173
const runOnDevice = process.argv.includes('--run')

function lanAddress() {
  const nets = networkInterfaces()
  // Wi-Fi genelde en0'dır; yoksa ilk yerel olmayan IPv4 adresi.
  const ordered = ['en0', ...Object.keys(nets).filter((name) => name !== 'en0')]
  for (const name of ordered) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const ip = lanAddress()
if (!ip) {
  console.error('Yerel ağ adresi bulunamadı. Mac Wi-Fi\'a bağlı mı?')
  process.exit(1)
}
const url = `http://${ip}:${port}`

run('node', ['scripts/copy-ocr-assets.mjs'])
// cap sync bir dist klasörü ister; canlı modda içeriği kullanılmaz.
if (!existsSync('dist/index.html')) run('npm', ['run', 'build'], { CAP_NATIVE: '1' })
run('npx', ['cap', 'sync', 'ios'], { CAP_SERVER_URL: url })

const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, CAP_NATIVE: '1' },
})

console.log(`\n  iPhone bu adresten yükleyecek: ${url}\n`)
if (runOnDevice) {
  spawn('npx', ['cap', 'run', 'ios'], { stdio: 'inherit' })
} else {
  console.log('  Xcode\'da üstten iPhone\'unu seç ve Run (⌘R) bas: npm run ios:open\n')
}

const stop = () => {
  vite.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
vite.on('exit', (code) => process.exit(code ?? 0))
