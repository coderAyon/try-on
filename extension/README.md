# Lumen Anywhere - Browser Extension (Manifest V3)

Virtual sunglasses try-on browser extension for **Microsoft Edge** and **Google Chrome**.

After rebuilding with `npm run build:extension`, reload the extension on
`edge://extensions` or `chrome://extensions`, then refresh the shopping tab.
The in-page mirror uses bundled MediaPipe iris landmarks and keeps camera frames
inside the browser. Use a front-facing product photo: angled product shots cannot
be fully corrected by a 2D overlay. Size, Nose, and drag controls allow fine tuning.
Run `node scripts/verify-extension-mirror.cjs` to check the unpacked extension,
local WASM loading, eye fitting, face loss, and reflection cleanup in Chrome.

Browse any e-commerce or fashion website (Amazon, Ray-Ban, Prada, Oakley, etc.), hover over any sunglasses image, click **"Try This Frame"**, and instantly try it on your face using real-time 3D AR face tracking with realistic depth occlusion!

---

## 📁 Architecture Overview

```
/extension
├── manifest.json             # Manifest V3 configuration (Edge & Chrome)
├── icons/                    # 16px, 32px, 48px, 128px extension icons
├── dist/                     # Compiled production bundles
│   ├── background/
│   │   └── service-worker.js # Event-driven MV3 service worker
│   ├── content/
│   │   ├── content-script.js # E-commerce image scanner & detection
│   │   └── overlay.css       # Glassmorphism floating badge styling
│   └── popup/
│       ├── index.html        # Premium AI SaaS popup interface
│       └── assets/           # React + Tailwind bundled assets
└── src/
    ├── background/
    │   └── service-worker.ts # Tab orchestrator & context menu handler
    ├── content/
    │   ├── content-script.ts # MutationObserver & hover overlay
    │   └── overlay.css       # Floating badge CSS
    ├── popup/
    │   ├── Popup.tsx         # Modern glassmorphism React popup
    │   ├── main.tsx
    │   ├── index.html
    │   └── popup.css
    ├── utils/
    │   ├── domScanner.ts
    │   ├── imageExtractor.ts # Max-res srcset, lazy-load & metadata parser
    │   ├── sunglassesDetector.ts # Multi-stage heuristic & semantic classifier
    │   └── storage.ts        # chrome.storage.local persistence
    └── types/
        └── index.ts          # Extension TypeScript contracts
```

---

## 🚀 How to Install & Test in Microsoft Edge (Primary Target)

1. Open **Microsoft Edge**.
2. Navigate to: `edge://extensions/`
3. Toggle on **Developer mode** in the left sidebar.
4. Click **"Load unpacked"**.
5. Select this directory:
   ```
   d:\STUDY\8th sem\project\sunglass_trial\extension
   ```
6. The **Lumen Anywhere - Virtual Sunglasses Try-On** extension is now installed and active!

---

## 🌐 How to Install & Test in Google Chrome

1. Open **Google Chrome**.
2. Navigate to: `chrome://extensions/`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **"Load unpacked"**.
5. Select the `extension` folder.

---

## 🛠️ How to Rebuild After Edits

To regenerate icons and compile all TypeScript bundles:

```bash
npm run build:extension
```

To run the main web app dev server alongside the extension:

```bash
npm run dev
```

---

## ✨ Key Features

1. **Intelligent Image Extraction**:
   - Resolves `srcset`, `data-src`, `data-zoom-image`, and Amazon dynamic JSON `data-a-dynamic-image`.
   - Traverses DOM to extract brand names, product titles, and prices.
2. **Lightweight Sunglasses Detection**:
   - Aspect ratio and dimension filters.
   - Rejects banners, logos, icons, avatars, and unrelated elements.
   - Semantic signals: matches keywords (`sunglasses`, `shades`, `polarized`, `aviator`, `wayfarer`, etc.).
3. **Floating "Try This Frame" Badge**:
   - Glassmorphic design with subtle purple glow and micro-animations.
   - Non-intrusive hover trigger.
4. **Context Menu Integration**:
   - Right-click any image on the web -> *"Try on these sunglasses with Lumen AR"*.
5. **AR Try-On Engine Bridge**:
   - Connects to your live 3D try-on engine (`http://localhost:3000/#try-on?frame=...`).
   - Removes image background and builds an authentic curved 3D eyewear mesh with optical pupil alignment.
   - Real-time MediaPipe face landmarks, head rotation (yaw/pitch/roll), and depth occlusion behind ears and face!
