import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('extension/store-assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Generate 1280x800 Store Screenshot
async function generateScreenshot() {
  const width = 1280;
  const height = 800;

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0714" />
          <stop offset="50%" stop-color="#140e2b" />
          <stop offset="100%" stop-color="#07050d" />
        </linearGradient>
        <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#7c3aed" />
        </linearGradient>
        <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      
      <!-- Top Title Header -->
      <g transform="translate(60, 50)">
        <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#purpleGlow)" />
        <text x="55" y="28" font-family="Segoe UI, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">LUMEN ANYWHERE</text>
        <text x="290" y="28" font-family="Segoe UI, sans-serif" font-size="14" font-weight="600" fill="#c084fc">AR SUNGLASSES TRY-ON</text>
        <text x="55" y="52" font-family="Segoe UI, sans-serif" font-size="14" fill="#94a3b8">Try on any sunglasses from Amazon, Ray-Ban, Prada, or any website in real-time 3D AR</text>
      </g>

      <!-- Left Mockup: Shopping Website with Floating Button -->
      <g transform="translate(60, 140)">
        <rect width="540" height="600" rx="20" fill="#140f29" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1.5" />
        <!-- Browser Bar -->
        <rect width="540" height="42" rx="20" fill="#1e163b" />
        <circle cx="24" cy="21" r="5" fill="#f87171" />
        <circle cx="40" cy="21" r="5" fill="#fbbf24" />
        <circle cx="56" cy="21" r="5" fill="#34d399" />
        <rect x="80" y="10" width="380" height="22" rx="6" fill="#0e0a1f" />
        <text x="96" y="25" font-family="Segoe UI, sans-serif" font-size="11" fill="#a78bfa">🔒 https://www.ray-ban.com/sunglasses/aviator-classic</text>

        <!-- Product Image Area -->
        <rect x="30" y="65" width="480" height="320" rx="14" fill="#0c0919" stroke="rgba(255,255,255,0.06)" />
        
        <!-- Sunglass Vector Art -->
        <g transform="translate(140, 180) scale(1.6)">
          <ellipse cx="40" cy="40" rx="35" ry="28" fill="#152e20" stroke="#d4af37" stroke-width="4" />
          <ellipse cx="120" cy="40" rx="35" ry="28" fill="#152e20" stroke="#d4af37" stroke-width="4" />
          <path d="M75 35 Q80 30 85 35" fill="none" stroke="#d4af37" stroke-width="4" />
          <path d="M5 36 L-15 30" fill="none" stroke="#d4af37" stroke-width="3" />
          <path d="M155 36 L175 30" fill="none" stroke="#d4af37" stroke-width="3" />
        </g>
        
        <!-- Floating Try On Badge -->
        <g transform="translate(300, 310)">
          <rect width="180" height="46" rx="23" fill="#1b1236" stroke="#c084fc" stroke-width="1.5" filter="drop-shadow(0 4px 12px rgba(168,85,247,0.5))" />
          <text x="36" y="28" font-family="Segoe UI, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">Try This Frame ✦</text>
        </g>

        <!-- Product Details -->
        <text x="30" y="425" font-family="Segoe UI, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">Aviator Classic G-15</text>
        <text x="30" y="450" font-family="Segoe UI, sans-serif" font-size="14" fill="#a78bfa">Ray-Ban • Polished Gold Alloy</text>
        <text x="30" y="485" font-family="Segoe UI, sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">$228.00</text>
      </g>

      <!-- Right Mockup: 3D AR Face Mesh Try-On -->
      <g transform="translate(640, 140)">
        <rect width="580" height="600" rx="20" fill="#120e24" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1.5" />
        <!-- Browser Bar -->
        <rect width="580" height="42" rx="20" fill="#1b1633" />
        <text x="24" y="26" font-family="Segoe UI, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8">⚡ LUMEN REAL-TIME 3D AR STUDIO</text>
        <rect x="440" y="10" width="115" height="22" rx="11" fill="rgba(52, 211, 153, 0.2)" />
        <text x="455" y="25" font-family="Segoe UI, sans-serif" font-size="11" font-weight="bold" fill="#34d399">● FACE TRACKED</text>

        <!-- Live Camera Simulation Canvas -->
        <rect x="30" y="65" width="520" height="420" rx="16" fill="#080612" stroke="rgba(255,255,255,0.08)" />

        <!-- Face Tracking Landmarks Mesh Art -->
        <g transform="translate(170, 140)">
          <ellipse cx="120" cy="140" rx="90" ry="120" fill="none" stroke="rgba(168,85,247,0.25)" stroke-width="1.5" stroke-dasharray="4,4" />
          <!-- Eyes -->
          <circle cx="85" cy="115" r="4" fill="#38bdf8" />
          <circle cx="155" cy="115" r="4" fill="#38bdf8" />
          <circle cx="120" cy="125" r="3" fill="#a855f7" />
          <!-- 3D Sunglasses Rendered on Face -->
          <g transform="translate(25, 80) scale(1.1)">
            <ellipse cx="40" cy="38" rx="36" ry="29" fill="rgba(20,50,35,0.85)" stroke="#d4af37" stroke-width="4.5" />
            <ellipse cx="130" cy="38" rx="36" ry="29" fill="rgba(20,50,35,0.85)" stroke="#d4af37" stroke-width="4.5" />
            <path d="M76 33 Q85 27 94 33" fill="none" stroke="#d4af37" stroke-width="4.5" />
            <!-- Temple arm occluded behind ear -->
            <path d="M5 34 L-20 22" fill="none" stroke="#d4af37" stroke-width="3" stroke-dasharray="3,3" opacity="0.6" />
            <path d="M165 34 L190 22" fill="none" stroke="#d4af37" stroke-width="3" stroke-dasharray="3,3" opacity="0.6" />
          </g>
        </g>

        <!-- Tracking Telemetry Banner -->
        <rect x="30" y="505" width="520" height="65" rx="12" fill="#18132e" />
        <text x="50" y="530" font-family="Segoe UI, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">MediaPipe 468 Landmarks Active</text>
        <text x="50" y="550" font-family="Segoe UI, sans-serif" font-size="11" fill="#94a3b8">Yaw: 0°  •  Pitch: -2°  •  IPD: 63mm  •  Realistic Ear Occlusion Masking</text>
        <rect x="420" y="520" width="110" height="32" rx="8" fill="url(#purpleGlow)" />
        <text x="445" y="541" font-family="Segoe UI, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">Snapshot</text>
      </g>
    </svg>
  `);

  await sharp(svg).png().toFile(path.join(assetsDir, 'screenshot-1280x800.png'));
  console.log('✅ Generated store screenshot: extension/store-assets/screenshot-1280x800.png');
}

// 2. Generate 440x280 Promotional Small Tile
async function generatePromoTile() {
  const width = 440;
  const height = 280;

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#110d24" />
          <stop offset="100%" stop-color="#28164f" />
        </linearGradient>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      
      <g transform="translate(170, 75) scale(1.4)">
        <ellipse cx="25" cy="25" rx="22" ry="18" fill="#1b382b" stroke="url(#glow)" stroke-width="3" />
        <ellipse cx="75" cy="25" rx="22" ry="18" fill="#1b382b" stroke="url(#glow)" stroke-width="3" />
        <path d="M47 22 Q50 18 53 22" fill="none" stroke="url(#glow)" stroke-width="3" />
      </g>
      
      <text x="220" y="175" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">LUMEN ANYWHERE</text>
      <text x="220" y="202" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" font-weight="600" fill="#c084fc">Virtual Sunglasses Try-On</text>
      <text x="220" y="235" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" fill="#94a3b8">Real-time 3D AR on Amazon, Ray-Ban, Prada &amp; More</text>
    </svg>
  `);

  await sharp(svg).png().toFile(path.join(assetsDir, 'promo-tile-440x280.png'));
  console.log('✅ Generated store promotional tile: extension/store-assets/promo-tile-440x280.png');
}

// 3. Generate 1400x560 Large Promotional Tile
async function generatePromoLargeTile() {
  const width = 1400;
  const height = 560;

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgLarge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f0b21" />
          <stop offset="100%" stop-color="#26154b" />
        </linearGradient>
        <linearGradient id="glowLarge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bgLarge)" />
      
      <g transform="translate(580, 140) scale(2.5)">
        <ellipse cx="25" cy="25" rx="22" ry="18" fill="#1b382b" stroke="url(#glowLarge)" stroke-width="3" />
        <ellipse cx="75" cy="25" rx="22" ry="18" fill="#1b382b" stroke="url(#glowLarge)" stroke-width="3" />
        <path d="M47 22 Q50 18 53 22" fill="none" stroke="url(#glowLarge)" stroke-width="3" />
      </g>
      
      <text x="700" y="330" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="42" font-weight="bold" fill="#ffffff">LUMEN ANYWHERE</text>
      <text x="700" y="380" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="24" font-weight="600" fill="#c084fc">Virtual Sunglasses Try-On</text>
      <text x="700" y="430" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="18" fill="#94a3b8">Real-time 3D AR on Amazon, Ray-Ban, Prada &amp; More</text>
    </svg>
  `);

  await sharp(svg).png().toFile(path.join(assetsDir, 'promo-large-1400x560.png'));
  console.log('✅ Generated store large tile: extension/store-assets/promo-large-1400x560.png');
}

async function run() {
  await generateScreenshot();
  await generatePromoTile();
  await generatePromoLargeTile();
}

run().catch(console.error);
