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

/** Mapa de segmentos a identificadores válidos (SwiftLint/ktlint). Evita _0 y snake_case. */
const SWIFT_SAFE_SEGMENT = {
  '0': 'zero',
  '2xs': 'twoXs',
  '2xl': 'twoXl',
  '3xl': 'threeXl',
  '4xl': 'fourXl',
  '5xl': 'fiveXl',
  level_0: 'levelZero',
  level_1: 'levelOne',
  level_2: 'levelTwo',
  level_3: 'levelThree',
  level_4: 'levelFour',
  blurNone: 'blurNone',
};

function swiftSafeSegment(segment) {
  if (SWIFT_SAFE_SEGMENT[segment] !== undefined) return SWIFT_SAFE_SEGMENT[segment];
  if (/^\d+$/.test(segment)) {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    return segment.length === 1 ? words[parseInt(segment, 10)] : 'value' + segment;
  }
  if (/^\d/.test(segment)) {
    const numWord = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' }[segment.charAt(0)];
    const rest = segment.slice(1).replace(/^([a-z])/, (_, c) => c.toUpperCase());
    return numWord ? numWord + rest : 'value' + segment.replace(/^(\d)/, '_$1');
  }
  return segment;
}

function pathToCaseName(pathSegments) {
  return pathSegments
    .map((seg, i) => {
      const safe = swiftSafeSegment(seg);
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

/** Emite protocolo *Tokens y un struct implementador para un enum de categoría (iOS). */
function emitSwiftProtocol(lines, enumName, tokens, flags) {
  const { hasDimensionOrNumber, colorTokens, fontFamilyTokens, fontWeightTokens, iconTokens } = flags;
  let valueType = null;
  let valueAccessor = null;
  let methodName = 'value';
  if (hasDimensionOrNumber) {
    valueType = 'CGFloat';
    valueAccessor = 'value';
  } else if (colorTokens.length > 0) {
    valueType = 'Color';
    valueAccessor = null;
    methodName = 'toColor';
  } else if (fontFamilyTokens.length > 0) {
    valueType = 'String';
    valueAccessor = 'value';
  } else if (fontWeightTokens.length > 0) {
    valueType = 'CGFloat';
    valueAccessor = 'value';
  } else if (iconTokens.length > 0) {
    valueType = 'String';
    valueAccessor = 'assetName';
    methodName = 'assetName';
  }
  if (valueType == null || tokens.length === 0) return;

  const themeTokenMap = {
    DodadaColorToken: ['DodadaTokenColorTokens', 'DodadaThemeColorTokensDefault'],
    DodadaIconToken: ['DodadaThemeIconTokens', 'DodadaThemeIconTokensDefault'],
    DodadaSizingToken: ['DodadaThemeSizingTokens', 'DodadaThemeSizingTokensDefault'],
    DodadaSpacingToken: ['DodadaThemeSpacingTokens', 'DodadaThemeSpacingTokensDefault'],
    DodadaRadiusToken: ['DodadaThemeRadiusTokens', 'DodadaThemeRadiusTokensDefault'],
    DodadaLayoutToken: ['DodadaThemeLayoutTokens', 'DodadaThemeLayoutTokensDefault'],
  };
  const pair = themeTokenMap[enumName];
  const baseName = enumName.startsWith('Dodada') ? enumName.slice(6).replace('Token', '') : enumName;
  const protocolName = pair ? pair[0] : `${enumName}Tokens`;
  const implName = pair ? pair[1] : `DodadaTheme${baseName}Tokens`;

  lines.push(`public protocol ${protocolName} {`);
  for (const t of tokens) {
    lines.push(`    static var ${t.caseName}: ${valueType} { get }`);
  }
  lines.push(`    func ${methodName}(for token: ${enumName}) -> ${valueType}`);
  lines.push('}');
  lines.push('');
  lines.push(`public struct ${implName}: ${protocolName} {`);
  if (colorTokens.length > 0) {
    for (const t of tokens) {
      lines.push(`    public static var ${t.caseName}: ${valueType} { ${enumName}.${t.caseName}.toColor() }`);
    }
    lines.push(`    public func ${methodName}(for token: ${enumName}) -> ${valueType} {`);
    lines.push('        token.toColor()');
    lines.push('    }');
    lines.push('}');
  } else {
    for (const t of tokens) {
      lines.push(`    public static var ${t.caseName}: ${valueType} { ${enumName}.${t.caseName}.${valueAccessor} }`);
    }
    lines.push(`    public func ${methodName}(for token: ${enumName}) -> ${valueType} {`);
    lines.push('        switch token {');
    for (const t of tokens) {
      lines.push(`        case .${t.caseName}: return Self.${t.caseName}`);
    }
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
  }
  lines.push('');
}

function kotlinEnumEntryName(caseName) {
  return caseName.charAt(0).toUpperCase() + caseName.slice(1);
}

/** Carpeta iOS por categoría (Color, Spacing, Assets, etc.). */
function getIosSubdir(category) {
  const map = {
    color: 'Color',
    spacing: 'Spacing',
    radius: 'Radius',
    layout: 'Layout',
    sizing: 'Sizing',
    icon: 'Icons',
    component: 'Component',
    elevation: 'Elevation',
    fontFamily: 'Typography',
    fontSize: 'Typography',
    fontWeight: 'Typography',
    lineHeight: 'LineHeight',
  };
  return map[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/** Enum name por categoría (Token suffix para color, icon, sizing, spacing, radius, layout). */
function getSwiftEnumName(category) {
  const tokenCategories = ['sizing', 'spacing', 'radius', 'layout'];
  const base = category.charAt(0).toUpperCase() + category.slice(1);
  if (category === 'color') return 'DodadaColorToken';
  if (category === 'icon') return 'DodadaIconToken';
  if (tokenCategories.includes(category)) return `Dodada${base}Token`;
  return `Dodada${base}`;
}

function emitSwift(categoriesMap, textStyles, iosDir) {
  for (const [category, tokens] of categoriesMap) {
    if (category === 'theme') continue;
    const isColor = category === 'color';
    const isIcon = category === 'icon';
    const enumName = getSwiftEnumName(category);
    const subdir = getIosSubdir(category);
    const outDir = path.join(iosDir, subdir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const lines = [
      '// Do not edit directly. Generated from design tokens.',
      '',
    ];
    if (isColor) {
      lines.push('import SwiftUI');
      lines.push('');
    } else {
      lines.push('import UIKit');
      lines.push('');
    }
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
      lines.push(`    /// Nombre del color en Colors.xcassets. Uso: Color(assetName)`);
      lines.push(`    public var assetName: String {`);
      lines.push(`        switch self {`);
      for (const t of colorTokens) {
        lines.push(`        case .${t.caseName}: return "${escapeSwiftString(t.caseName)}"`);
      }
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('}');
      lines.push('');
      lines.push(`public extension ${enumName} {`);
      lines.push(`    func toColor() -> Color {`);
      lines.push('        Color(assetName)');
      lines.push('    }');
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

    const cgFloatCategories = ['spacing', 'radius', 'sizing', 'layout'];
    if (hasDimensionOrNumber && cgFloatCategories.includes(category)) {
      const foundationProp = category === 'spacing' ? 'spacing' : category === 'radius' ? 'radius' : category === 'sizing' ? 'sizing' : 'layout';
      lines.push(`public extension ${enumName} {`);
      lines.push(`    func toCGFloat(using theme: DDDTheme = DDDThemeManager.shared.main) -> CGFloat {`);
      lines.push(`        theme.foundation.${foundationProp}.value(for: self)`);
      lines.push('    }');
      lines.push('}');
      lines.push('');
    }

    emitSwiftProtocol(lines, enumName, tokens, {
      hasDimensionOrNumber,
      colorTokens,
      fontFamilyTokens,
      fontWeightTokens,
      iconTokens,
    });

    const fileName = `${enumName}.swift`;
    fs.writeFileSync(path.join(outDir, fileName), lines.join('\n'), 'utf8');
    const legacyNames = { icon: 'DodadaIcon.swift', sizing: 'DodadaSizing.swift', spacing: 'DodadaSpacing.swift', radius: 'DodadaRadius.swift', layout: 'DodadaLayout.swift' };
    if (legacyNames[category]) {
      const legacyPath = path.join(iosDir, legacyNames[category]);
      if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
      const legacyInSubdir = path.join(outDir, legacyNames[category]);
      if (fs.existsSync(legacyInSubdir)) fs.unlinkSync(legacyInSubdir);
    }
    if (isColor) {
      const legacyPaths = ['DodadaColor.swift', 'DodadaTokenColor.swift'];
      for (const name of legacyPaths) {
        const p = path.join(iosDir, name);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        const p2 = path.join(outDir, name);
        if (fs.existsSync(p2)) fs.unlinkSync(p2);
      }
      const colorExtLines = [
        '// Do not edit directly. Generated from design tokens.',
        '',
        'import SwiftUI',
        '',
        'extension Color {',
      ];
      for (const t of tokens) {
        colorExtLines.push(`    public static var ${t.caseName}: Color { DodadaColorToken.${t.caseName}.toColor() }`);
        colorExtLines.push('');
        colorExtLines.push(`    public static func ${t.caseName}(using theme: DDDTheme = DDDThemeManager.shared.main) -> Color {`);
        colorExtLines.push(`        theme.colors.toColor(for: .${t.caseName})`);
        colorExtLines.push('    }');
      }
      colorExtLines.push('}');
      colorExtLines.push('');
      fs.writeFileSync(path.join(outDir, 'Dodada+Color.swift'), colorExtLines.join('\n'), 'utf8');
    }
  }
  const themePath = path.join(iosDir, 'DodadaThemeTokens.swift');
  if (fs.existsSync(themePath)) fs.unlinkSync(themePath);
  for (const sub of ['Color', 'Spacing', 'Radius', 'Layout', 'Sizing']) {
    const p = path.join(iosDir, sub, 'DodadaThemeTokens.swift');
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  emitSwiftCGFloatExtension(categoriesMap, iosDir);
  const legacyDDTheme = path.join(iosDir, 'Color', 'DDTheme.swift');
  if (fs.existsSync(legacyDDTheme)) fs.unlinkSync(legacyDDTheme);
  const legacyDDThemeRoot = path.join(iosDir, 'DDTheme.swift');
  if (fs.existsSync(legacyDDThemeRoot)) fs.unlinkSync(legacyDDThemeRoot);
  for (const [category, tokens] of categoriesMap) {
    if (category === 'theme') continue;
    const enumName = getSwiftEnumName(category);
    const legacyRoot = path.join(iosDir, `${enumName}.swift`);
    if (fs.existsSync(legacyRoot)) fs.unlinkSync(legacyRoot);
  }
  for (const name of ['DDTheme.swift', 'Dodada+Color.swift', 'DodadaTypography.swift']) {
    const p = path.join(iosDir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  for (const oldSub of ['FontFamily', 'FontSize', 'FontWeight']) {
    const oldDir = path.join(iosDir, oldSub);
    if (fs.existsSync(oldDir)) {
      try { fs.rmSync(oldDir, { recursive: true }); } catch (_) {}
    }
  }

  if (textStyles && textStyles.length > 0) {
    const lines = [
      '// Do not edit directly. Generated from design tokens.',
      'import UIKit',
      '',
    ];
    lines.push('public struct DodadaFont {');
    lines.push('    public let family: String');
    lines.push('    public let size: CGFloat');
    lines.push('    public let weight: CGFloat');
    lines.push('    public let lineHeight: CGFloat');
    lines.push('    public let letterSpacing: CGFloat?');
    lines.push('    public let underline: Bool');
    lines.push('}');
    lines.push('');
    lines.push('public enum DodadaTypographyToken: CaseIterable {');
    for (const s of textStyles) {
      lines.push(`    case ${s.caseName}`);
    }
    lines.push('}');
    lines.push('');
    lines.push('extension DodadaTypographyToken {');
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
    lines.push('public protocol DodadaThemeTypographyTokens {');
    for (const s of textStyles) {
      lines.push(`    static var ${s.caseName}: DodadaFont { get }`);
    }
    lines.push('    func font(for token: DodadaTypographyToken) -> DodadaFont');
    lines.push('}');
    lines.push('');
    lines.push('public struct DodadaThemeTypographyTokensDefault: DodadaThemeTypographyTokens {');
    for (const s of textStyles) {
      lines.push(`    public static var ${s.caseName}: DodadaFont { DodadaTypographyToken.${s.caseName}.font }`);
    }
    lines.push('    public func font(for token: DodadaTypographyToken) -> DodadaFont {');
    lines.push('        switch token {');
    for (const s of textStyles) {
      lines.push(`        case .${s.caseName}: return Self.${s.caseName}`);
    }
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    const typographyDir = path.join(iosDir, 'Typography');
    if (!fs.existsSync(typographyDir)) fs.mkdirSync(typographyDir, { recursive: true });
    fs.writeFileSync(path.join(typographyDir, 'DodadaTypography.swift'), lines.join('\n'), 'utf8');
  }
}

/** Genera un archivo *+CGFloat.swift por categoría (Spacing, Radius, Sizing, Layout, LineHeight) en su carpeta. Vars directas en extension CGFloat con prefijo. */
function emitSwiftCGFloatExtension(categoriesMap, iosDir) {
  const cgFloatCategories = ['spacing', 'radius', 'sizing', 'layout', 'lineHeight'];
  const legacyCGFloat = path.join(iosDir, 'Dodada+CGFloat.swift');
  if (fs.existsSync(legacyCGFloat)) fs.unlinkSync(legacyCGFloat);
  const prefixMap = { spacing: 'spacing', radius: 'radius', sizing: 'sizing', layout: 'layout', lineHeight: '' };
  for (const category of cgFloatCategories) {
    const tokens = categoriesMap.get(category);
    if (!tokens || tokens.length === 0) continue;
    const hasDimensionOrNumber = tokens.some((t) => t.type === 'dimension' || t.type === 'number');
    if (!hasDimensionOrNumber) continue;
    const enumName = getSwiftEnumName(category);
    const prefix = prefixMap[category] ?? category;
    const subdir = getIosSubdir(category);
    const outDir = path.join(iosDir, subdir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const fileLabelMap = { lineHeight: 'LineHeight' };
    const fileLabel = fileLabelMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    const lines = [
      '// Do not edit directly. Generated from design tokens.',
      '',
      'import CoreGraphics',
      '',
      'extension CGFloat {',
    ];
    for (const t of tokens) {
      const propName = prefix
        ? prefix + t.caseName.charAt(0).toUpperCase() + t.caseName.slice(1)
        : t.caseName.charAt(0).toLowerCase() + t.caseName.slice(1);
      lines.push(`    public static var ${propName}: CGFloat { ${enumName}.${t.caseName}.value }`);
    }
    lines.push('}');
    lines.push('');
    fs.writeFileSync(path.join(outDir, `${fileLabel}+CGFloat.swift`), lines.join('\n'), 'utf8');
  }
}

function escapeKotlinString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Recursively clones a token subtree resolving every .value that is a reference.
 * Returns a plain object: same structure with resolved values at leaves.
 */
function resolveThemeSubtree(json, node) {
  if (!node || typeof node !== 'object') return node;
  if (node.value !== undefined) {
    const v = node.value;
    const resolved =
      typeof v === 'string' && v.startsWith('{') && v.endsWith('}')
        ? resolveRef(json, v)
        : v;
    return { value: resolved, type: node.type, comment: node.comment };
  }
  const out = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    out[key] = resolveThemeSubtree(json, node[key]);
  }
  return out;
}

/** Genera theme-main.json y theme-main.ts con theme.main y todos sus componentes resueltos. */
function emitThemeMain(json, distDir) {
  const themeMain = getNodeAtPath(json, ['theme', 'main']);
  if (!themeMain) return;
  const resolved = resolveThemeSubtree(json, themeMain);
  const themeDir = path.join(distDir, 'theme');
  if (!fs.existsSync(themeDir)) fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(
    path.join(themeDir, 'theme-main.json'),
    JSON.stringify({ theme: { main: resolved } }, null, 2),
    'utf8'
  );
  const tsLines = [
    '/** Do not edit directly. Generated from design tokens. Tema main con componentes (valores resueltos). */',
    '',
    'export const themeMain = ',
    JSON.stringify(resolved, null, 2).replace(/^/gm, '  '),
    ' as const;',
    '',
    'export type ThemeMain = typeof themeMain;',
    '',
  ];
  fs.writeFileSync(path.join(themeDir, 'theme-main.ts'), tsLines.join('\n'), 'utf8');
}

/** pathSegments ["primary", "background", "default"] -> "primaryBackgroundDefault"; ["onlyIcon","filled",...] -> "onlyIconFilled..." */
function swiftButtonThemePropertyName(pathSegments) {
  const joined = pathSegments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return joined.charAt(0).toLowerCase() + joined.slice(1);
}

function collectButtonThemeLeaves(node, pathSegments, out) {
  if (!node || typeof node !== 'object') return;
  if (node.value !== undefined) {
    out.push({
      name: swiftButtonThemePropertyName(pathSegments),
      value: node.value,
      type: node.type || 'string',
    });
    return;
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    collectButtonThemeLeaves(node[key], [...pathSegments, key], out);
  }
}

/** Genera DDDButtonTheme.swift (protocolo + DDDButtonThemeDefault con propiedades de instancia) desde theme.main.button. */
function emitDDDButtonThemeSwift(json, iosDir) {
  const themeMain = getNodeAtPath(json, ['theme', 'main']);
  if (!themeMain) return;
  const resolved = resolveThemeSubtree(json, themeMain);
  const buttonNode = resolved && resolved.button;
  if (!buttonNode) return;
  const props = [];
  collectButtonThemeLeaves(buttonNode, [], props);
  if (props.length === 0) return;

  const componentDir = path.join(iosDir, 'Component');
  if (!fs.existsSync(componentDir)) fs.mkdirSync(componentDir, { recursive: true });

  const lines = [
    '// Do not edit directly. Generated from design tokens.',
    '',
    'import SwiftUI',
    '',
    'public protocol DDDButtonTheme {',
  ];
  for (const p of props) {
    const swiftType = p.type === 'color' ? 'Color' : 'CGFloat';
    lines.push(`    var ${p.name}: ${swiftType} { get }`);
  }
  lines.push('}');
  lines.push('');
  lines.push('// MARK: - Default implementation (tema main, valores resueltos)');
  lines.push('');
  lines.push('public struct DDDButtonThemeDefault: DDDButtonTheme {');
  for (const p of props) {
    let rhs;
    if (p.type === 'color') {
      const v = String(p.value);
      rhs =
        v.toLowerCase() === 'transparent'
          ? 'Color.clear'
          : `Color(hex: "${escapeSwiftString(v)}")`;
    } else if (p.type === 'dimension') {
      const n = parseDimensionPx(p.value);
      rhs = `CGFloat(${n})`;
    } else if (p.type === 'number') {
      rhs = `CGFloat(${Number(p.value)})`;
    } else {
      rhs = `CGFloat(${parseDimensionPx(p.value)})`;
    }
    const swiftType = p.type === 'color' ? 'Color' : 'CGFloat';
    lines.push(`    public var ${p.name}: ${swiftType} { ${rhs} }`);
  }
  lines.push('}');
  lines.push('');
  lines.push('// MARK: - Color hex helper (SwiftUI)');
  lines.push('');
  lines.push('extension Color {');
  lines.push('    /// Inicializa un Color desde hex (ej. "#ED2124" o "#ED2124FF"). "transparent" → clear.');
  lines.push('    public init(hex: String) {');
  lines.push('        if hex.lowercased() == "transparent" {');
  lines.push('            self = .clear');
  lines.push('            return');
  lines.push('        }');
  lines.push('        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)');
  lines.push('        var int: UInt64 = 0');
  lines.push('        Scanner(string: hex).scanHexInt64(&int)');
  lines.push('        let a, r, g, b: UInt64');
  lines.push('        switch hex.count {');
  lines.push('        case 3:');
  lines.push('            (r, g, b, a) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17, 255)');
  lines.push('        case 6:');
  lines.push('            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)');
  lines.push('        case 8:');
  lines.push('            (r, g, b, a) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)');
  lines.push('        default:');
  lines.push('            (r, g, b, a) = (0, 0, 0, 255)');
  lines.push('        }');
  lines.push('        self.init(');
  lines.push('            .sRGB,');
  lines.push('            red: Double(r) / 255,');
  lines.push('            green: Double(g) / 255,');
  lines.push('            blue: Double(b) / 255,');
  lines.push('            opacity: Double(a) / 255');
  lines.push('        )');
  lines.push('    }');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(path.join(componentDir, 'DDDButtonTheme.swift'), lines.join('\n'), 'utf8');
}

function emitKotlin(categoriesMap, textStyles, androidDir) {
  for (const [category, tokens] of categoriesMap) {
    const enumName = `Dodada${category.charAt(0).toUpperCase() + category.slice(1)}`;
    const lines = [
      '// Do not edit directly. Generated from design tokens.',
      'package com.dodada.tokens',
      '',
      'import androidx.compose.ui.unit.Dp',
      'import androidx.compose.ui.unit.dp',
      'import androidx.compose.ui.graphics.Color',
      '',
    ];
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

    const fileName = `${enumName}.kt`;
    require('fs').writeFileSync(require('path').join(androidDir, fileName), lines.join('\n'), 'utf8');
  }

  if (textStyles && textStyles.length > 0) {
    const lines = [
      '// Do not edit directly. Generated from design tokens.',
      'package com.dodada.tokens',
      '',
      'import androidx.compose.ui.graphics.Color',
      '',
    ];
    lines.push('data class DodadaFont(');
    lines.push('    val family: String,');
    lines.push('    val size: Float,');
    lines.push('    val weight: Float,');
    lines.push('    val lineHeight: Float,');
    lines.push('    val letterSpacing: Float?,');
    lines.push('    val underline: Boolean');
    lines.push(')');
    lines.push('');
    lines.push('enum class DodadaTypographyToken {');
    for (const s of textStyles) {
      lines.push(`    ${kotlinEnumEntryName(s.caseName)},`);
    }
    lines.push('}');
    lines.push('');
    lines.push('val DodadaTypographyToken.font: DodadaFont');
    lines.push('    get() = when (this) {');
    for (const s of textStyles) {
      const f = s.font;
      const name = kotlinEnumEntryName(s.caseName);
      const letterSpacing = f.letterSpacing != null ? `${f.letterSpacing}f` : 'null';
      lines.push(`        DodadaTypographyToken.${name} -> DodadaFont(`);
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
    require('fs').writeFileSync(require('path').join(androidDir, 'DodadaTypography.kt'), lines.join('\n'), 'utf8');
  }
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
  // Resolve all token values so outputs get final values (e.g. hex instead of {color.primary.500})
  for (const t of tokens) {
    if (typeof t.value === 'string' && t.value.startsWith('{') && t.value.endsWith('}')) {
      t.value = resolveRef(json, t.value);
    }
  }
  const categoriesMap = groupByCategory(tokens);
  const textStyles = collectTextStyles(json);

  const iosDir = path.join(DIST_DIR, 'ios');
  const androidDir = path.join(DIST_DIR, 'android');
  const webDir = path.join(DIST_DIR, 'web');
  const cssDir = path.join(DIST_DIR, 'css');
  [iosDir, androidDir, webDir, cssDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  emitSwift(categoriesMap, textStyles, iosDir);
  emitKotlin(categoriesMap, textStyles, androidDir);
  fs.writeFileSync(path.join(webDir, 'tokens.ts'), emitTypeScript(categoriesMap, textStyles), 'utf8');
  fs.writeFileSync(path.join(cssDir, 'variables.css'), emitCSS(categoriesMap), 'utf8');

  emitThemeMain(json, DIST_DIR);
  emitDDDButtonThemeSwift(json, path.join(DIST_DIR, 'ios'));

  // Eliminar archivos legacy monolíticos si aún existen
  const legacySwift = path.join(iosDir, 'DodadaTokens.swift');
  if (fs.existsSync(legacySwift)) fs.rmSync(legacySwift);
  const legacyKotlin = path.join(androidDir, 'DodadaTokens.kt');
  if (fs.existsSync(legacyKotlin)) fs.rmSync(legacyKotlin);

  const { runAssetGeneration } = require('./generate-assets.js');
  await runAssetGeneration(json, categoriesMap, getNodeAtPath, resolveRef);

  console.log('Platform outputs generated: dist/ios, dist/android, dist/web, dist/css, dist/theme');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
