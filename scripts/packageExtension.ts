import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const extDir = path.resolve(rootDir, 'extension');
const distDir = path.resolve(extDir, 'dist');
const outputZipPath = path.resolve(rootDir, 'extension-release.zip');

function createPackage() {
  console.log('📦 Packaging Lumen Anywhere Browser Extension for Store Submission...');

  if (!fs.existsSync(distDir)) {
    throw new Error('extension/dist not found. Run npm run build:extension first.');
  }

  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const psCommand = `Compress-Archive -Path 'extension/manifest.json', 'extension/icons', 'extension/dist' -DestinationPath 'extension-release.zip' -Force`;
    execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: 'inherit' });
  } else {
    execSync(`cd extension && zip -r ../extension-release.zip manifest.json icons dist`, { stdio: 'inherit' });
  }

  const stats = fs.statSync(outputZipPath);
  const sizeKb = (stats.size / 1024).toFixed(1);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Extension Release Package Created Successfully!');
  console.log(`📁 ZIP Archive: ${outputZipPath}`);
  console.log(`📊 Total Size:  ${sizeKb} KB (${sizeMb} MB)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Ready to upload directly to:');
  console.log('1. Microsoft Edge Partner Center (https://partner.microsoft.com/dashboard/microsoftedge)');
  console.log('2. Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

createPackage();
