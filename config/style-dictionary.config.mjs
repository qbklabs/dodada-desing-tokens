/**
 * Style Dictionary - Dodada Design Tokens
 * Se usa con el JSON ya resuelto (build/tokens.resolved.json) generado por scripts/build-tokens.js
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export default {
  source: [path.join(ROOT, 'build/tokens.resolved.json')],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: path.join(ROOT, 'dist/css/'),
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    scss: {
      transformGroup: 'scss',
      buildPath: path.join(ROOT, 'dist/scss/'),
      files: [
        {
          destination: '_variables.scss',
          format: 'scss/variables',
          options: { outputReferences: true },
        },
      ],
    },
    js: {
      transformGroup: 'js',
      buildPath: path.join(ROOT, 'dist/js/'),
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
          options: { outputReferences: true },
        },
      ],
    },
    ios: {
      transformGroup: 'ios-swift',
      buildPath: path.join(ROOT, 'dist/ios/'),
      files: [
        {
          destination: 'DodadaTokens.swift',
          format: 'ios-swift/class.swift',
          options: { outputReferences: true, className: 'DodadaTokens' },
        },
      ],
    },
    android: {
      transformGroup: 'compose',
      buildPath: path.join(ROOT, 'dist/android/'),
      files: [
        {
          destination: 'DodadaTokens.kt',
          format: 'compose/object',
          className: 'DodadaTokens',
          packageName: 'com.dodada.tokens',
          options: { outputReferences: true },
        },
      ],
    },
  },
};
