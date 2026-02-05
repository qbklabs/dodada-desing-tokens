/**
 * Genera xcassets para iOS (Colores, Icons) y drawable XML para Android (iconos).
 * Requiere build/tokens.resolved.json y que generate-platform-outputs.js haya definido
 * getNodeAtPath, resolveRef. Se invoca desde generate-platform-outputs.js al final del build.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const ASSETS_ICONS = path.join(ROOT, 'assets', 'icons');

function hexToComponents(hex) {
  if (!hex || typeof hex !== 'string') return { r: '0', g: '0', b: '0', a: '1.000' };
  const normalized = hex.trim();
  if (normalized.startsWith('rgba')) {
    const m = normalized.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (m) {
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      return {
        r: (parseFloat(m[1]) / 255).toFixed(3),
        g: (parseFloat(m[2]) / 255).toFixed(3),
        b: (parseFloat(m[3]) / 255).toFixed(3),
        a: a.toFixed(3),
      };
    }
  }
  let hexClean = normalized.replace(/^#/, '');
  if (hexClean.length === 6) {
    const r = parseInt(hexClean.slice(0, 2), 16) / 255;
    const g = parseInt(hexClean.slice(2, 4), 16) / 255;
    const b = parseInt(hexClean.slice(4, 6), 16) / 255;
    return {
      r: r.toFixed(3),
      g: g.toFixed(3),
      b: b.toFixed(3),
      a: '1.000',
    };
  }
  if (hexClean.length === 8) {
    const r = parseInt(hexClean.slice(0, 2), 16) / 255;
    const g = parseInt(hexClean.slice(2, 4), 16) / 255;
    const b = parseInt(hexClean.slice(4, 6), 16) / 255;
    const a = parseInt(hexClean.slice(6, 8), 16) / 255;
    return {
      r: r.toFixed(3),
      g: g.toFixed(3),
      b: b.toFixed(3),
      a: a.toFixed(3),
    };
  }
  return { r: '0', g: '0', b: '0', a: '1.000' };
}

function writeColoresXcassets(colorTokens, json, getNodeAtPath, resolveRef) {
  const coloresDir = path.join(DIST_DIR, 'ios', 'Colores.xcassets');
  if (!fs.existsSync(coloresDir)) fs.mkdirSync(coloresDir, { recursive: true });

  const contentsJson = {
    info: { author: 'xcode', version: 1 },
  };
  fs.writeFileSync(path.join(coloresDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2), 'utf8');

  for (const t of colorTokens) {
    let hex = t.value;
    if (typeof hex === 'string' && hex.startsWith('{') && hex.endsWith('}')) {
      hex = resolveRef(json, hex);
    }
    if (typeof hex === 'string' && hex.startsWith('rgba')) {
      // keep as-is for components
    } else if (typeof hex !== 'string' || !hex.startsWith('#') && !hex.startsWith('rgba')) {
      hex = '#000000';
    }
    const comp = hexToComponents(hex);
    const colorsetName = t.caseName;
    const colorsetDir = path.join(coloresDir, `${colorsetName}.colorset`);
    if (!fs.existsSync(colorsetDir)) fs.mkdirSync(colorsetDir, { recursive: true });
    const colorContents = {
      colors: [
        {
          color: {
            'color-space': 'srgb',
            components: {
              alpha: comp.a,
              blue: comp.b,
              green: comp.g,
              red: comp.r,
            },
          },
          idiom: 'universal',
        },
      ],
      info: { author: 'xcode', version: 1 },
    };
    fs.writeFileSync(path.join(colorsetDir, 'Contents.json'), JSON.stringify(colorContents, null, 2), 'utf8');
  }
}

function findIconFile(filename) {
  if (!fs.existsSync(ASSETS_ICONS)) return null;
  const exact = path.join(ASSETS_ICONS, filename);
  if (fs.existsSync(exact)) return exact;
  const lower = path.join(ASSETS_ICONS, filename.toLowerCase());
  if (fs.existsSync(lower)) return lower;
  const list = fs.readdirSync(ASSETS_ICONS);
  const match = list.find((f) => f.toLowerCase() === filename.toLowerCase());
  if (match) return path.join(ASSETS_ICONS, match);
  return null;
}

function writeIconsXcassets(iconTokens) {
  const iconsDir = path.join(DIST_DIR, 'ios', 'Icons.xcassets');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const contentsJson = { info: { author: 'xcode', version: 1 } };
  fs.writeFileSync(path.join(iconsDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2), 'utf8');

  for (const t of iconTokens) {
    const filename = typeof t.value === 'string' ? t.value : '';
    const srcPath = findIconFile(filename);
    const imagesetName = t.caseName;
    const imagesetDir = path.join(iconsDir, `${imagesetName}.imageset`);
    if (!fs.existsSync(imagesetDir)) fs.mkdirSync(imagesetDir, { recursive: true });
    const destFilename = filename || 'placeholder.svg';
    const destPath = path.join(imagesetDir, destFilename);
    if (srcPath && fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
    const imageContents = {
      images: [{ filename: destFilename, idiom: 'universal' }],
      info: { author: 'xcode', version: 1 },
    };
    fs.writeFileSync(path.join(imagesetDir, 'Contents.json'), JSON.stringify(imageContents, null, 2), 'utf8');
  }
}

function caseNameToSnakeCase(name) {
  return name.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase();
}

async function writeAndroidDrawable(iconTokens) {
  let svg2vd;
  try {
    svg2vd = require('svg2vectordrawable');
  } catch (e) {
    console.warn('svg2vectordrawable no instalado. Ejecuta: npm install svg2vectordrawable --save-dev');
    console.warn('Iconos Android (drawable XML) no generados.');
    return;
  }
  const drawableDir = path.join(DIST_DIR, 'android', 'res', 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  const promises = [];
  for (const t of iconTokens) {
    const filename = typeof t.value === 'string' ? t.value : '';
    const srcPath = findIconFile(filename);
    const drawableName = 'ic_' + caseNameToSnakeCase(t.caseName);
    const outPath = path.join(drawableDir, `${drawableName}.xml`);
    if (!srcPath || !fs.existsSync(srcPath)) continue;
    const svgCode = fs.readFileSync(srcPath, 'utf8');
    promises.push(
      svg2vd(svgCode, { floatPrecision: 2 })
        .then((xml) => {
          if (xml) fs.writeFileSync(outPath, xml, 'utf8');
        })
        .catch((err) => {
          console.warn(`No se pudo convertir ${filename} a vector drawable:`, err.message);
        })
    );
  }
  await Promise.all(promises);
  if (promises.length > 0) console.log('Android drawable XML generados en dist/android/res/drawable/');
}

async function runAssetGeneration(json, categoriesMap, getNodeAtPath, resolveRef) {
  const colorTokens = (categoriesMap.get('color') || []).filter((t) => t.type === 'color');
  const iconTokens = (categoriesMap.get('icon') || []).filter((t) => t.type === 'asset' || t.type === 'string');

  if (colorTokens.length > 0) {
    writeColoresXcassets(colorTokens, json, getNodeAtPath, resolveRef);
    console.log('Colores.xcassets generado en dist/ios/Colores.xcassets');
  }
  if (iconTokens.length > 0) {
    writeIconsXcassets(iconTokens);
    console.log('Icons.xcassets generado en dist/ios/Icons.xcassets');
    await writeAndroidDrawable(iconTokens);
  }
}

module.exports = {
  runAssetGeneration,
  hexToComponents,
  writeColoresXcassets,
  writeIconsXcassets,
  writeAndroidDrawable,
};
