# Current live eyewear fitting

Live AR now uses locally hosted Google MediaPipe Face Landmarker (478 points),
not the legacy Jeeliz bounding-box pose component. Camera frames and their
corresponding overlays are drawn together. Video cover/crop mapping is shared
by both layers; MediaPipe depth uses the same pixel scale as its x coordinate.

Frames are anchored to eye-corner midpoints and nasal-bridge depth. Rotation
comes from the eye line and forehead/chin axis. Frame scale comes from measured
3D eye separation and the imported model's lens-centre separation. Model-specific
fit offsets are no longer estimated from a face bounding box.

Each live AR instance owns its baked geometry. Its rear temple geometry is
compressed/spread to the measured temple-side landmarks (127/356), preserving
front-frame geometry. These are anatomical proxies near the ears, not detected
physical ear landmarks. They improve fit but do not certify exact ear contact.

An actual 898-triangle tracked face writes depth before the glasses, hiding the
far arm. A fitted skull volume fills the open back/forehead of the face surface.
The showroom keeps the original geometry; live fitting cannot mutate its cache.
The HUD reports tracking/FPS instead of claiming a 100% physical fitting lock.

Validation (2026-10-03):

- npm run build
- node scripts/verify-models.cjs
- node scripts/verify-camera.cjs (sample-photo webcam; 54-56 FPS on this host)
- node scripts/verify-landmark-angles.cjs

The angle check renders front, yaw +/-40 degrees, nod +/-30 degrees and roll
+25 degrees. It checks eye scale, combined rotation and temple depth, then runs
landmark inference on the rendered reference surface. Observed inferred angular
errors were 1.7-11.6 degrees. The screenshot is scratch/landmark-angle-check.png.
Synthetic surfaces do not reproduce real camera perspective, motion blur, hair,
all facial proportions or individual ear geometry. Physical webcam validation
remains necessary; no zero-drift or exact ear-contact claim is made.

Sources and licenses are in public/tracking/SOURCE.md,
public/models/aviator/SOURCE.md and public/models/jeeliz/SOURCE.md.
Aviator and Wayfarer use imported detailed demonstration assets; the remaining
styles use category-specific procedural geometry. They are representative assets,
not verified replicas of catalog brands.

## Face-width sizing and flat slider
Live fitting keeps a face-width minimum alongside the eye-spacing minimum. The dimensionless face/eye proportion is smoothed; the shared pose stabilizer described below controls rotation and distance noise.

Prada, Matsuda, Meta and Hexagonal now use explicit lens identities for both normalization and PBR assignment. Lens centering no longer falls back to the entire frame/arm bounding box for those sources. Lis's collapsed/extruded lens triangles outside the measured rim depth are removed from instance geometry. Original asset files remain intact.

The temple deformation starts behind the deepest lens surface, preserving every lens vertex. Each arm uses its measured source tip rather than an assumed +/-4.4 tip, preventing additional source hook offsets from moving the fitted endpoint.

The catalog uses a flat horizontal slider with 170 x 124 cards (160px wide on mobile). No perspective, rotation, lift or overlap is applied. It advances every 2.5 seconds, pauses on hover/focus or explicit pause, and respects hidden tabs and reduced motion. Manual touch scrolling and arrows are supported. Autoplay does not switch worn glasses.

Validation:
- npm run build
- node scripts/verify-all-placement.cjs: 32 frames x 2 reference faces x 6 synthetic poses = 384 renders; verifies lens anchors, facial width, orientation and unchanged lens geometry after temple fitting. Audit JSON and eight contact sheets are in scratch/placement-audit/.
- node scripts/verify-camera.cjs --all-models: 32 model switches using a sample-photo webcam; 766px desktop camera.
- node scripts/verify-landmark-angles.cjs: six pose inference, immediate distance response and sizing-noise checks.
- node scripts/verify-coverflow.cjs: flat cards, autoplay, unchanged selection, pause and desktop/mobile overflow.
- node scripts/render-imported-catalog.cjs: 24 normalized imports and tightly cropped PNG previews.

Physical webcam movement, motion blur and exact individual ear contact remain manual validation. The synthetic reference poses do not guarantee those conditions.

## Live selection and measured fit advisor
Selecting a catalog or advisor frame enters webcam mode. All catalog previews (including native finish variants) now use static PNGs rather than mounting new WebGL contexts. This prevents thumbnail renderer churn from exhausting contexts needed by live eyewear and MediaPipe. Model swaps clear stale model-load error overlays.

The Find my fit entry is in the hero beside the introductory copy. The advisor uses MediaPipe's learned landmark detector plus transparent, heuristic shape classification and styling rules. It measures forehead-to-chin height, cheek width, jaw width and forehead width in the head's local axes. At least eight near-frontal samples are smoothed before an estimate is displayed. No fixed biometric payload, random match percentages, claimed brand engine or uncalibrated millimetre measurements are shown.

Round / oval / square / soft flat and other silhouette previews accompany six diverse catalog suggestions. Suggestions are estimates rather than a calibrated optical-fitting assessment. Try on closes the dialog and selects the actual frame in the live view. No face returns a waiting state instead of an invented recommendation.

Validation: node scripts/verify-camera.cjs --all-models --fit-advisor checks every style's rendered overlay alpha pixels as well as loading, measured analysis, all preview images and recommended-frame selection.

## Shared pose stability (2026-10-04)

Every frame uses the same adaptive temporal filter for nasal bridge position, head-local bridge-to-frame offset, eye span and quaternion. Signed angular, translation and scale velocities suppress alternating detector noise instead of treating it as real motion. Low stationary cutoffs damp quiet poses; velocity and translation residual increase response during deliberate movement. Filter state survives frame selection and resets after face loss or a tracking gap. Small translation delay is intentional to suppress raw bridge noise.

Validation: npm run build; npx tsx scripts/verify-stability.ts; node scripts/verify-camera.cjs --all-models --fit-advisor. The temporal test injects bridge, rotation, scale and local-offset noise, checks combined yaw/pitch/roll motion, sudden position/distance changes at 20/30/60 FPS, reset and tracking-gap recovery. In that controlled sequence bridge and scale noise decreased about 70%, rotation noise about 58%; maximum angular lag was 1.13 degrees and translation lag 0.77 source pixels. Physical webcam performance depends on image quality and still requires movement validation.

## Camera distance response
The shared pose filter scales cheek width and eye span from the same filtered distance, preserving the actual facial proportion during approach/retreat. Scale residuals raise the filter response for distance changes while retaining a quiet cutoff for stationary noise. Temporal verification covers continuous approach/retreat at 20/30/60 FPS; the placement audit also verifies proportional sizing at 0.45, 0.7, 1, 1.4 and 1.8 times reference distance scale for every catalog model and both reference faces.
