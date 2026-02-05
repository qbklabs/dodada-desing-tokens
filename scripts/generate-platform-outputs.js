/**
 * Reads build/tokens.resolved.json and generates iOS (Swift), Android (Kotlin), and Web (TypeScript + CSS).
 * JSON structure and token names are preserved; only platform-safe naming (e.g. Swift numeric prefix) is applied.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const DIST_DIR = path.join(ROOT, 'dist');
const RESOLVED_PATH = path.join(BUILD_DIR, 'tokens.resolved.json');

function loadResolved() {
  const raw = fs.readFileSync(RESOLVED_PATH, 'utf8');
  return JSON.parse(raw);
}

function getNodeAtPath(json, pathArr) {
  let cur = json;
  for (const k of pathArr) {
    cur = cur && cur[k];
  }
  return cur;
}

function resolveRef(json, refStr) {
  if (typeof refStr !== 'string' || !refStr.startsWith('{') || !refStr.endsWith('}')) return refStr;
  const pathArr = refStr.slice(1, -1).trim().split('.');
  const node = getNodeAtPath(json, pathArr);
  if (!node || node.value === undefined) return refStr;
  const v = node.value;
  if (typeof v === 'string' && v.startsWith('{') && v.endsWith('}')) return resolveRef(json, v);
  return v;
}

function parseLetterSpacingEm(str) {
  if (str == null) return undefined;
  const m = String(str).match(/^([-\d.]+)em$/);
  return m ? parseFloat(m[1]) : undefined;
}

function swiftCaseName(segment) {
  if (/^\d/.test(segment)) return `_${segment}`;
  return segment;
}

function pathToCaseName(pathSegments) {
  return pathSegments
    .map((seg, i) => {
      const safe = swiftCaseName(seg);
      return i === 0 ? safe : safe.charAt(0).toUpperCase() + safe.slice(1);
    })
    .join('');
}

function collectTokens(node, category, pathSegments, out) {
  if (!node || typeof node !== 'object') return;
  if (node.value !== undefined) {
    out.push({
      category,
      path: pathSegments.join('.'),
      pathSegments,
      caseName: pathToCaseName(pathSegments),
      value: node.value,
      type: node.type || 'string',
    });
    return;
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    collectTokens(node[key], category, [...pathSegments, key], out);
  }
}

function collectAllTokens(json) {
  const out = [];
  for (const category of Object.keys(json)) {
    if (category === 'font') {
      if (json.font.family) collectTokens(json.font.family, 'fontFamily', ['family'], out);
      if (json.font.weight) collectTokens(json.font.weight, 'fontWeight', ['weight'], out);
      continue;
    }
    if (category === 'typography') {
      if (json.typography.size) collectTokens(json.typography.size, 'fontSize', ['size'], out);
      if (json.typography.lineHeight) collectTokens(json.typography.lineHeight, 'lineHeight', ['lineHeight'], out);
      continue;
    }
    collectTokens(json[category], category, [], out);
  }
  return out;
}

function groupByCategory(tokens) {
  const map = new Map();
  for (const t of tokens) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category).push(t);
  }
  return map;
}

function collectTextStyles(json) {
  const textNode = json.typography && json.typography.text;
  if (!textNode) return [];
  const out = [];
  for (const [styleName, variants] of Object.entries(textNode)) {
    if (!variants || typeof variants !== 'object') continue;
    for (const [variantName, spec] of Object.entries(variants)) {
      if (!spec || typeof spec !== 'object' || spec.value !== undefined) continue;
      const caseName = styleName + variantName.charAt(0).toUpperCase() + variantName.slice(1);
      const familyNode = spec.fontFamily;
      const sizeNode = spec.fontSize;
      const weightNode = spec.fontWeight;
      const lineHeightNode = spec.lineHeight;
      const letterSpacingNode = spec.letterSpacing;
      const decorationNode = spec.textDecoration;
      const family = familyNode && familyNode.value != null ? resolveRef(json, familyNode.value) : '';
      const sizeStr = sizeNode && sizeNode.value != null ? resolveRef(json, sizeNode.value) : '0px';
      const weightVal = weightNode && weightNode.value != null ? resolveRef(json, weightNode.value) : 400;
      const lineHeightVal = lineHeightNode && lineHeightNode.value != null ? resolveRef(json, lineHeightNode.value) : 1.5;
      const letterSpacingStr = letterSpacingNode && letterSpacingNode.value != null ? resolveRef(json, letterSpacingNode.value) : null;
      const underline = decorationNode && decorationNode.value === 'underline';
      out.push({
        caseName,
        font: {
          family: String(family),
          size: parseDimensionPx(sizeStr),
          weight: Number(weightVal),
          lineHeight: Number(lineHeightVal),
          letterSpacing: parseLetterSpacingEm(letterSpacingStr),
          underline,
        },
      });
    }
  }
  return out;
}

function parseDimensionPx(value) {
  if (typeof value === 'number') return value;
  const m = String(value).match(/^([-\d.]+)px$/);
  return m ? parseFloat(m[1]) : 0;
}

function escapeSwiftString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Emite un literal CGFloat válido en Swift; si el valor es NaN usa CGFloat.nan. */
function swiftCGFloatLiteral(n) {
  if (typeof n === 'number' && Number.isNaN(n)) return 'CGFloat.nan';
  return `CGFloat(${n})`;
}

function kotlinEnumEntryName(caseName) {
  return caseName.charAt(0).toUpperCase() + caseName.slice(1);
}

function emitSwift(categoriesMap, textStyles) {
  const lines = [
    '// Do not edit directly. Generated from design tokens.',
    'import UIKit',
    '',
  ];
  for (const [category, tokens] of categoriesMap) {
    const enumName = `Dodada${category.charAt(0).toUpperCase() + category.slice(1)}`;
    lines.push(`public enum ${enumName}: CaseIterable {`);
    for (const t of tokens) {
      lines.push(`    case ${t.caseName}`);
    }
    lines.push('}');
    lines.push('');

    const hasDimensionOrNumber = tokens.some((t) => t.type === 'dimension' || t.type === 'number');
    if (hasDimensionOrNumber) {
      lines.push(`extension ${enumName} {`);
      lines.push(`    public var value: CGFloat {`);
      lines.push(`        switch self {`);
      for (const t of tokens) {
        const n =
          t.type === 'dimension'
            ? parseDimensionPx(t.value)
            : t.type === 'number'
              ? Number(t.value)
              : 0;
        lines.push(`        case .${t.caseName}: return ${swiftCGFloatLiteral(n)}`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
    }

    const colorTokens = tokens.filter((t) => t.type === 'color');
    if (colorTokens.length > 0 && !hasDimensionOrNumber) {
      lines.push(`extension ${enumName} {`);
      lines.push(`    /// Nombre del color en Colores.xcassets. Uso: Color(assetName) o UIColor(named: assetName)`);
      lines.push(`    public var assetName: String {`);
      lines.push(`        switch self {`);
      for (const t of colorTokens) {
        lines.push(`        case .${t.caseName}: return "${escapeSwiftString(t.caseName)}"`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
    }

    const fontFamilyTokens = tokens.filter((t) => t.type === 'fontFamily');
    if (fontFamilyTokens.length > 0 && !hasDimensionOrNumber && colorTokens.length === 0) {
      lines.push(`extension ${enumName} {`);
      lines.push(`    public var value: String {`);
      lines.push(`        switch self {`);
      for (const t of fontFamilyTokens) {
        const s = typeof t.value === 'string' ? t.value : String(t.value);
        lines.push(`        case .${t.caseName}: return "${escapeSwiftString(s)}"`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
    }

    const fontWeightTokens = tokens.filter((t) => t.type === 'fontWeight');
    if (fontWeightTokens.length > 0 && !hasDimensionOrNumber && colorTokens.length === 0 && fontFamilyTokens.length === 0) {
      lines.push(`extension ${enumName} {`);
      lines.push(`    public var value: CGFloat {`);
      lines.push(`        switch self {`);
      for (const t of fontWeightTokens) {
        const n = Number(t.value);
        lines.push(`        case .${t.caseName}: return ${swiftCGFloatLiteral(n)}`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
    }

    const iconTokens = tokens.filter((t) => t.type === 'asset');
    if (iconTokens.length > 0) {
      lines.push(`extension ${enumName} {`);
      lines.push(`    /// Nombre de la imagen en Icons.xcassets. Uso: Image(assetName) o UIImage(named: assetName)`);
      lines.push(`    public var assetName: String {`);
      lines.push(`        switch self {`);
      for (const t of iconTokens) {
        lines.push(`        case .${t.caseName}: return "${escapeSwiftString(t.caseName)}"`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
    }
  }

  if (textStyles && textStyles.length > 0) {
    lines.push('public struct DodadaFont {');
    lines.push('    public let family: String');
    lines.push('    public let size: CGFloat');
    lines.push('    public let weight: CGFloat');
    lines.push('    public let lineHeight: CGFloat');
    lines.push('    public let letterSpacing: CGFloat?');
    lines.push('    public let underline: Bool');
    lines.push('}');
    lines.push('');
    lines.push('public enum DodadaTokenText: CaseIterable {');
    for (const s of textStyles) {
      lines.push(`    case ${s.caseName}`);
    }
    lines.push('}');
    lines.push('');
    lines.push('extension DodadaTokenText {');
    lines.push('    public var font: DodadaFont {');
    lines.push('        switch self {');
    for (const s of textStyles) {
      const f = s.font;
      const letterSpacing = f.letterSpacing != null ? swiftCGFloatLiteral(f.letterSpacing) : 'nil';
      lines.push(`        case .${s.caseName}: return DodadaFont(`);
      lines.push(`            family: "${escapeSwiftString(f.family)}",`);
      lines.push(`            size: ${swiftCGFloatLiteral(f.size)},`);
      lines.push(`            weight: ${swiftCGFloatLiteral(f.weight)},`);
      lines.push(`            lineHeight: ${swiftCGFloatLiteral(f.lineHeight)},`);
      lines.push(`            letterSpacing: ${letterSpacing},`);
      lines.push(`            underline: ${f.underline ? 'true' : 'false'}`);
      lines.push('        )');
    }
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
    lines.push('');
  }
  return lines.join('\n');
}

function escapeKotlinString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function emitKotlin(categoriesMap, textStyles) {
  const lines = [
    '// Do not edit directly. Generated from design tokens.',
    'package com.dodada.tokens',
    '',
    'import androidx.compose.ui.unit.Dp',
    'import androidx.compose.ui.unit.dp',
    'import androidx.compose.ui.graphics.Color',
    '',
  ];
  for (const [category, tokens] of categoriesMap) {
    const enumName = `Dodada${category.charAt(0).toUpperCase() + category.slice(1)}`;
    lines.push(`enum class ${enumName} {`);
    for (const t of tokens) {
      lines.push(`    ${kotlinEnumEntryName(t.caseName)},`);
    }
    lines.push('}');
    lines.push('');

    const dimensionOrNumber = tokens.filter((t) => t.type === 'dimension' || t.type === 'number');
    if (dimensionOrNumber.length > 0) {
      lines.push(`val ${enumName}.value: Dp`);
      lines.push(`    get() = when (this) {`);
      for (const t of dimensionOrNumber) {
        const name = kotlinEnumEntryName(t.caseName);
        const n = t.type === 'dimension' ? parseDimensionPx(t.value) : Number(t.value);
        lines.push(`        ${enumName}.${name} -> ${n}.dp`);
      }
      lines.push(`        else -> 0.dp`);
      lines.push(`    }`);
      lines.push('');
    }
    const colorTokens = tokens.filter((t) => t.type === 'color');
    if (colorTokens.length > 0) {
      lines.push(`val ${enumName}.colorValue: Color`);
      lines.push(`    get() = when (this) {`);
      for (const t of colorTokens) {
        const name = kotlinEnumEntryName(t.caseName);
        const hex = typeof t.value === 'string' ? t.value : String(t.value);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1.0;
        lines.push(`        ${enumName}.${name} -> Color(red = ${r}/255f, green = ${g}/255f, blue = ${b}/255f${a !== 1 ? `, alpha = ${a}f` : ''})`);
      }
      lines.push(`        else -> Color.Unspecified`);
      lines.push(`    }`);
      lines.push('');
    }
    const fontFamilyTokens = tokens.filter((t) => t.type === 'fontFamily');
    if (fontFamilyTokens.length > 0) {
      lines.push(`val ${enumName}.fontFamilyValue: String`);
      lines.push(`    get() = when (this) {`);
      for (const t of fontFamilyTokens) {
        const name = kotlinEnumEntryName(t.caseName);
        const s = typeof t.value === 'string' ? t.value : String(t.value);
        lines.push(`        ${enumName}.${name} -> "${escapeKotlinString(s)}"`);
      }
      lines.push(`        else -> ""`);
      lines.push(`    }`);
      lines.push('');
    }
    const fontWeightTokens = tokens.filter((t) => t.type === 'fontWeight');
    if (fontWeightTokens.length > 0) {
      lines.push(`val ${enumName}.fontWeightValue: Float`);
      lines.push(`    get() = when (this) {`);
      for (const t of fontWeightTokens) {
        const name = kotlinEnumEntryName(t.caseName);
        const n = Number(t.value);
        lines.push(`        ${enumName}.${name} -> ${n}f`);
      }
      lines.push(`        else -> 400f`);
      lines.push(`    }`);
      lines.push('');
    }
  }

  if (textStyles && textStyles.length > 0) {
    lines.push('data class DodadaFont(');
    lines.push('    val family: String,');
    lines.push('    val size: Float,');
    lines.push('    val weight: Float,');
    lines.push('    val lineHeight: Float,');
    lines.push('    val letterSpacing: Float?,');
    lines.push('    val underline: Boolean');
    lines.push(')');
    lines.push('');
    lines.push('enum class DodadaTokenText {');
    for (const s of textStyles) {
      lines.push(`    ${kotlinEnumEntryName(s.caseName)},`);
    }
    lines.push('}');
    lines.push('');
    lines.push('val DodadaTokenText.font: DodadaFont');
    lines.push('    get() = when (this) {');
    for (const s of textStyles) {
      const f = s.font;
      const name = kotlinEnumEntryName(s.caseName);
      const letterSpacing = f.letterSpacing != null ? `${f.letterSpacing}f` : 'null';
      lines.push(`        DodadaTokenText.${name} -> DodadaFont(`);
      lines.push(`            family = "${escapeKotlinString(f.family)}",`);
      lines.push(`            size = ${f.size}f,`);
      lines.push(`            weight = ${f.weight}f,`);
      lines.push(`            lineHeight = ${f.lineHeight}f,`);
      lines.push(`            letterSpacing = ${letterSpacing},`);
      lines.push(`            underline = ${f.underline ? 'true' : 'false'}`);
      lines.push('        )');
    }
    lines.push('    }');
    lines.push('');
  }
  return lines.join('\n');
}

function emitTypeScript(categoriesMap, textStyles) {
  const lines = [
    '/** Do not edit directly. Generated from design tokens. */',
    '',
  ];
  for (const [category, tokens] of categoriesMap) {
    const objName = category;
    lines.push(`export const ${objName} = {`);
    for (const t of tokens) {
      let val;
      if (t.type === 'color' || t.type === 'fontFamily' || t.type === 'string') {
        val = JSON.stringify(t.value);
      } else if (t.type === 'dimension') {
        val = JSON.stringify(t.value);
      } else if (t.type === 'number') {
        val = Number(t.value);
      } else if (t.type === 'fontWeight') {
        val = Number(t.value);
      } else {
        val = JSON.stringify(t.value);
      }
      lines.push(`  ${t.caseName}: ${val},`);
    }
    lines.push('} as const;');
    lines.push('');
    lines.push(`export type ${category.charAt(0).toUpperCase() + category.slice(1)}Token = keyof typeof ${objName};`);
    lines.push('');
  }
  if (textStyles && textStyles.length > 0) {
    lines.push('export interface DodadaFont {');
    lines.push('  family: string;');
    lines.push('  size: number;');
    lines.push('  weight: number;');
    lines.push('  lineHeight: number;');
    lines.push('  letterSpacing: number | null;');
    lines.push('  underline: boolean;');
    lines.push('}');
    lines.push('');
    lines.push('export const tokenText = {');
    for (const s of textStyles) {
      const f = s.font;
      const letterSpacing = f.letterSpacing != null ? f.letterSpacing : 'null';
      lines.push(`  ${s.caseName}: {`);
      lines.push(`    family: "${String(f.family).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",`);
      lines.push(`    size: ${f.size},`);
      lines.push(`    weight: ${f.weight},`);
      lines.push(`    lineHeight: ${f.lineHeight},`);
      lines.push(`    letterSpacing: ${letterSpacing},`);
      lines.push(`    underline: ${f.underline},`);
      lines.push('  } as DodadaFont,');
    }
    lines.push('} as const;');
    lines.push('');
    lines.push('export type TokenTextKey = keyof typeof tokenText;');
    lines.push('');
  }
  return lines.join('\n');
}

function emitCSS(categoriesMap) {
  const lines = ['/* Do not edit directly. Generated from design tokens. */', '', ':root {'];
  for (const [, tokens] of categoriesMap) {
    for (const t of tokens) {
      const varName = `--${t.category}-${t.path.replace(/\./g, '-')}`;
      const val =
        t.type === 'dimension' || t.type === 'number'
          ? t.type === 'dimension'
            ? t.value
            : String(t.value)
          : String(t.value);
      lines.push(`  ${varName}: ${val};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

async function main() {
  if (!fs.existsSync(RESOLVED_PATH)) {
    console.error('Run the main build first to generate build/tokens.resolved.json');
    process.exit(1);
  }
  const json = loadResolved();
  const tokens = collectAllTokens(json);
  const categoriesMap = groupByCategory(tokens);
  const textStyles = collectTextStyles(json);

  const iosDir = path.join(DIST_DIR, 'ios');
  const androidDir = path.join(DIST_DIR, 'android');
  const webDir = path.join(DIST_DIR, 'web');
  const cssDir = path.join(DIST_DIR, 'css');
  [iosDir, androidDir, webDir, cssDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  fs.writeFileSync(path.join(iosDir, 'DodadaTokens.swift'), emitSwift(categoriesMap, textStyles), 'utf8');
  fs.writeFileSync(path.join(androidDir, 'DodadaTokens.kt'), emitKotlin(categoriesMap, textStyles), 'utf8');
  fs.writeFileSync(path.join(webDir, 'tokens.ts'), emitTypeScript(categoriesMap, textStyles), 'utf8');
  fs.writeFileSync(path.join(cssDir, 'variables.css'), emitCSS(categoriesMap), 'utf8');

  const { runAssetGeneration } = require('./generate-assets.js');
  await runAssetGeneration(json, categoriesMap, getNodeAtPath, resolveRef);

  console.log('Platform outputs generated: dist/ios, dist/android, dist/web, dist/css');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
