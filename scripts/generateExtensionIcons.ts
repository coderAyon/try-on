import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconDir = path.resolve('extension/icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

function getSvg(size: number) {
  const pad = size * 0.12;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#120e24" />
        <stop offset="100%" stop-color="#2d1b54" />
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#c084fc" />
        <stop offset="100%" stop-color="#7c3aed" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)" />
    <g transform="translate(${pad}, ${pad * 1.1}) scale(${(size - pad * 2) / 24})">
      <circle cx="6" cy="14" r="4.2" stroke="url(#glow)" stroke-width="2.2" fill="#7c3aed" fill-opacity="0.3" />
      <circle cx="18" cy="14" r="4.2" stroke="url(#glow)" stroke-width="2.2" fill="#7c3aed" fill-opacity="0.3" />
      <path d="M10.2 13h3.6" stroke="url(#glow)" stroke-width="2.2" stroke-linecap="round" />
      <path d="M1.8 13.5l3.2-6.5h14l3.2 6.5" stroke="url(#glow)" stroke-width="2" stroke-linecap="round" fill="none" />
      <circle cx="18" cy="6" r="1.5" fill="#38bdf8" />
    </g>
  </svg>
  `;
}

async function generate() {
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const svg = Buffer.from(getSvg(size));
    const outPath = path.join(iconDir, `icon${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`Generated icon${size}.png`);
  }

  // Generate 300x300 recommended store logo
  const logo300 = Buffer.from(getSvg(300));
  const storeAssetsDir = path.resolve('extension/store-assets');
  if (!fs.existsSync(storeAssetsDir)) fs.mkdirSync(storeAssetsDir, { recursive: true });
  await sharp(logo300).png().toFile(path.join(storeAssetsDir, 'logo-300x300.png'));
  console.log('Generated logo-300x300.png in extension/store-assets/');
}

generate().catch(console.error);
