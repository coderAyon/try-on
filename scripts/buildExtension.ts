import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const extDir = path.resolve(rootDir, 'extension');
const outDir = path.resolve(extDir, 'dist');

async function buildAll() {
  console.log('🚀 Building Lumen Anywhere Extension (Manifest V3)...');

  // Ensure clean dist directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Build Popup (React App)
  console.log('📦 Building Popup UI...');
  await build({
    root: path.resolve(extDir, 'src/popup'),
    plugins: [react()],
    base: './',
    build: {
      outDir: path.resolve(outDir, 'popup'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(extDir, 'src/popup/index.html'),
      },
    },
  });

  // 2. Build Content Script (Standalone JS bundle)
  console.log('📦 Building Content Script...');
  await build({
    root: extDir,
    build: {
      outDir: path.resolve(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(extDir, 'src/content/content-script.ts'),
        name: 'LumenContentScript',
        formats: ['iife'],
        fileName: () => 'content-script.js',
      },
    },
  });

  // Copy Content Script CSS
  const contentCssSrc = path.resolve(extDir, 'src/content/overlay.css');
  const contentCssDest = path.resolve(outDir, 'content/overlay.css');
  fs.copyFileSync(contentCssSrc, contentCssDest);

  // 3. Build Background Service Worker (ES Module for MV3)
  console.log('📦 Building Background Service Worker...');
  await build({
    root: extDir,
    build: {
      outDir: path.resolve(outDir, 'background'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(extDir, 'src/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js',
      },
    },
  });

  console.log('✨ Lumen Anywhere Extension built successfully in extension/dist!');
}

buildAll().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
