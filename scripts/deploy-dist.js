/**
 * Copia el contenido de dist/ a las rutas definidas en deploy-paths.json
 * o en variables de entorno DODADA_DEPLOY_*.
 *
 * Uso:
 *   node scripts/deploy-dist.js
 *   npm run deploy
 *
 * Configuración (deploy-paths.json en la raíz del repo):
 *   { "paths": { "ios": "/ruta/proyecto-ios/...", "android": "...", "web": "...", "css": "..." } }
 *
 * Variables de entorno (opcional, sobreescriben el JSON):
 *   DODADA_DEPLOY_IOS, DODADA_DEPLOY_ANDROID, DODADA_DEPLOY_WEB, DODADA_DEPLOY_CSS
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

const ENV_KEYS = {
  ios: 'DODADA_DEPLOY_IOS',
  android: 'DODADA_DEPLOY_ANDROID',
  web: 'DODADA_DEPLOY_WEB',
  css: 'DODADA_DEPLOY_CSS',
};

const DIST_SUBDIRS = ['ios', 'android', 'web', 'css'];

function loadDeployPaths() {
  let paths = {};
  const configPath = path.join(ROOT, 'deploy-paths.json');
  const examplePath = path.join(ROOT, 'deploy-paths.example.json');
  const toLoad = fs.existsSync(configPath) ? configPath : fs.existsSync(examplePath) ? examplePath : null;
  if (toLoad) {
    try {
      const raw = fs.readFileSync(toLoad, 'utf8');
      const config = JSON.parse(raw);
      if (config.paths && typeof config.paths === 'object') {
        paths = { ...config.paths };
      }
      if (toLoad === examplePath) {
        console.warn('Usando deploy-paths.example.json. Para rutas propias, copia a deploy-paths.json y edita.');
      }
    } catch (e) {
      console.warn('Warning: config deploy inválido o no legible:', e.message);
    }
  }
  for (const key of DIST_SUBDIRS) {
    const envVal = process.env[ENV_KEYS[key]];
    if (envVal !== undefined && envVal !== '') {
      paths[key] = envVal;
    }
  }
  return paths;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('No existe dist/. Ejecuta antes: npm run build');
    process.exit(1);
  }

  const paths = loadDeployPaths();
  const resolved = {};
  for (const key of DIST_SUBDIRS) {
    const value = paths[key];
    if (!value || typeof value !== 'string') continue;
    resolved[key] = path.isAbsolute(value) ? value : path.resolve(ROOT, value);
  }

  if (Object.keys(resolved).length === 0) {
    console.warn('No hay rutas de deploy configuradas.');
    console.warn('Copia deploy-paths.example.json a deploy-paths.json y define "paths" (ios, android, web, css).');
    console.warn('O usa DODADA_DEPLOY_IOS, DODADA_DEPLOY_ANDROID, etc.');
    process.exit(0);
  }

  for (const [platform, destDir] of Object.entries(resolved)) {
    const srcDir = path.join(DIST_DIR, platform);
    if (!fs.existsSync(srcDir)) continue;
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    for (const name of fs.readdirSync(srcDir)) {
      const src = path.join(srcDir, name);
      const dest = path.join(destDir, name);
      copyRecursive(src, dest);
      console.log(`Deploy ${platform}: ${path.relative(ROOT, dest)}`);
    }
  }
  console.log('Deploy completado.');
}

main();
