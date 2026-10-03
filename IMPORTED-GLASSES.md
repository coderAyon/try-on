# Imported eyewear library

18 user-supplied source files from src/types are available in the catalog as
24 selectable styles. The two model packs are separated into 2 and 6 pairs.
Source files remain in src/types. The Fano asset is served as fano.glb to avoid
hash characters being treated as URL fragments.

The library preserves source materials/textures. Legacy specular-glossiness
textures are adapted for the installed Three.js renderer. Model-specific
orientation and eye-plane origins are normalized before using the existing
landmark tracking rig. Frame width is normalized to 8.8 model units.

Each imported style has a pre-rendered PNG thumbnail, avoiding a separate
WebGL context and continuous model download for every catalog card.
The frontend merges local styles with API products so an older database does
not hide the imported models. Total displayed styles in the current API: 32.

Desktop camera width is capped at 768px, down from the surrounding 1024px
layout. Mobile keeps the available width. The original camera aspect ratios
and shared camera/landmark crop calculation are preserved.

Validation:
- npm run build
- node scripts/render-imported-catalog.cjs (24 model loads and thumbnails)
- node scripts/verify-camera.cjs --all-models (32 live model switches, 766px canvas)
- node scripts/verify-camera.cjs --model=imported-sunglass-2 (export transform correction)

Placement audit: node scripts/verify-all-placement.cjs renders all 32 displayed styles on two reference faces in six poses each. The Lis asset has an instance-only lens triangle repair; source files are unchanged.
