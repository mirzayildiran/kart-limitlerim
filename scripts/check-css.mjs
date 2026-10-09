// Fails on raw colour literals outside src/ui/tokens.css.
// Scans src/**/*.css and src/**/*.tsx. A line containing `/* allow-color */` is exempt.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const tokensFile = join(root, 'src', 'ui', 'tokens.css');
const ALLOW = '/* allow-color */';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/;
const FUNC = /\b(?:rgba?|hsla?)\(/i;
const COLOR = new RegExp(`${HEX.source}|${FUNC.source}`, 'i');

// String literal contents in a TSX line: '...', "...", `...`
const STRING = /(['"`])((?:\\.|(?!\1).)*)\1/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(srcDir).filter((f) => {
  if (f === tokensFile) return false;
  return f.endsWith('.css') || f.endsWith('.tsx');
});

const violations = [];

for (const file of files) {
  const isCss = file.endsWith('.css');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ALLOW)) return;
    let hit = false;
    if (isCss) {
      hit = COLOR.test(line);
    } else {
      for (const m of line.matchAll(STRING)) {
        if (COLOR.test(m[2])) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      const rel = relative(root, file).split(sep).join('/');
      violations.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Ham renk değeri bulundu. Yalnızca tokens.css değişkenlerini kullan (var(--…)).');
  console.error('Bilerek istisna gerekiyorsa satıra /* allow-color */ ekle.\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${violations.length} ihlal.`);
  process.exit(1);
}

console.log(`check-css: ${files.length} dosya tarandı, ham renk yok.`);
