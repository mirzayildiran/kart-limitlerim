import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

/**
 * Adds a Content-Security-Policy <meta> to the built index.html (web and iOS app). Build only:
 * the dev server injects <style> tags at run time, which a strict policy would block.
 * Inline <script> and <style> blocks in index.html (theme and boot screen) are allowed by their
 * SHA-256 hash, computed here so editing them never breaks the policy.
 */
export function csp(options: { connect: (string | undefined)[] }): Plugin {
  const hash = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`
  const inline = (html: string, tag: 'script' | 'style') =>
    [...html.matchAll(new RegExp(`<${tag}(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => hash(m[1]))
  const origins = options.connect.flatMap((url) => {
    try {
      return url ? [new URL(url).origin] : []
    } catch {
      return []
    }
  })

  return {
    name: 'kl-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const policy = [
          "default-src 'self'",
          // OCR runs Tesseract's WebAssembly in a worker.
          `script-src 'self' 'wasm-unsafe-eval' ${inline(html, 'script').join(' ')}`.trim(),
          `style-src 'self' ${inline(html, 'style').join(' ')}`.trim(),
          // blob: is the picked screenshot shown during import; data: covers small inlined assets.
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          `connect-src 'self' ${origins.join(' ')}`.trim(),
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; ')
        return html.replace(/<meta charset="UTF-8" \/>/i, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      },
    },
  }
}
