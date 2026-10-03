# AR and VR upgrade — implementation and evaluation

This independent Lumen Vision capstone uses Sunglass Hut's public retail and virtual try-on flow as a reference. It does not use or claim access to Sunglass Hut's proprietary software, FittingBox SDK, commercial inventory, or production services.

## Implemented

- Live AR now loads the existing local glTF eyewear through the shared model manager. Previous requests to missing /models_cad/*.glb forced the cartoon-like procedural fallback.
- Jeeliz horizontal camera projection uses aspect * tan(verticalFov / 2). Model width stays constant in face coordinates; perspective handles distance rather than applying face-size scaling twice.
- Position and quaternion smoothing, live calibration refs, mirror control, and matching mirrored snapshots.
- More restrained physical materials and transparent tinted lenses. Alpha compositing is intentional: a separate WebGL canvas cannot physically refract the webcam image underneath it.
- The studio hides the synthetic head occluder and disables temple clipping so the complete product is visible. Studio mode no longer claims detected landmarks or tracking confidence.
- A separate WebXR VR showroom with a pedestal, environment lighting, desktop orbit/zoom, immersive headset entry, and controller ray selection. Hold a trigger while pointing at the frame to rotate it.
- Clean white retail surfaces with Lumen Vision branding.

## Run and demonstrate

Run `npm run dev` for client and API, then visit http://localhost:3000. `npm run dev:client` starts only the client. The landing experience is the 360-degree studio; camera access starts when Virtual Try-On is selected.

Select Explore VR showroom. Desktop orbit works without a headset. Immersive VR requires a compatible headset/browser and HTTPS (localhost is permitted). Opening a LAN HTTP address on a standalone headset does not meet secure-context requirements.

## Evaluation limits

Only three detailed local shapes currently exist: aviator, wayfarer, and hexagonal. The model manager maps other catalog categories to these existing shapes; those entries are approximate and need individual, correctly licensed, dimensionally accurate assets before claiming product-specific realism. The local models' source and redistribution licenses need to be recorded for an academic release.

Jeeliz reports a face pose and detection score, not 68 measured landmarks or calibrated physical IPD. IPD displayed in this implementation is a reference value with a manual offset, not an optical measurement. Occlusion is an approximate head proxy. Real camera registration and immersive controller behavior require hardware evaluation; a build alone cannot validate them.

For the final-year report, measure tracking jitter, alignment error at frontal and side poses, reacquisition time, actual FPS on named devices, and successful VR interaction on the target headset. Compare identical lighting, camera distance, and product geometry before and after. Do not describe the demo as matching Sunglass Hut's measured accuracy without conducting that comparison.

Public reference: https://www.sunglasshut.com/us/sunglasses/virtual-try-on
Three.js WebXR implementation: https://threejs.org/docs/#api/en/renderers/webxr/WebXRManager
