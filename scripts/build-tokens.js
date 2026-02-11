/**
 * Prepara los tokens: une todos los JSON, normaliza $value → value para Style Dictionary
 * y escribe build/tokens.resolved.json. Luego ejecuta Style Dictionary.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');

const SOURCE_FILES = [
  'tokens/core/spacing.json',
  'tokens/core/radius.json',
  'tokens/core/sizing.json',
  'tokens/core/elevation.json',
  'tokens/core/color.json',
  'tokens/core/font.json',
  'tokens/core/icons.json',
  'tokens/semantic/layout.json',
  'tokens/semantic/component.json',
  'tokens/semantic/typography.json',
  'tokens/themes/main.json',
];

function loadJSON(filePath) {
  const full = path.join(ROOT, filePath);
  if (!fs.existsSync(full)) {
    console.warn('Warning: token file not found, skipping:', filePath);
    return {};
  }
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source || {})) {
    if (key.startsWith('$')) continue;
    const s = source[key];
    if (s && typeof s === 'object' && s.$value === undefined && !Array.isArray(s)) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], s);
    } else {
      target[key] = s;
    }
  }
}

function normalizeToken(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.$value !== undefined) {
    const out = { value: node.$value };
    if (node.$type) out.type = node.$type;
    if (node.$description) out.comment = node.$description;
    return out;
  }
  const out = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    out[key] = normalizeToken(node[key]);
  }
  return out;
}

function main() {
  let merged = {};
  for (const file of SOURCE_FILES) {
    const data = loadJSON(file);
    deepMerge(merged, data);
  }
  const normalized = normalizeToken(merged);

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }
  const outPath = path.join(BUILD_DIR, 'tokens.resolved.json');
  fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2), 'utf8');
  console.log('Tokens normalizados escritos en:', outPath);

  require('./generate-platform-outputs.js');
}

main();
