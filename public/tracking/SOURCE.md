# Face tracking assets

- Face Landmarker float16 v1:
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- WASM runtime: @mediapipe/tasks-vision 0.10.32, copied from the installed package.
- Canonical face and its 898-triangle topology:
  https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj

Google / MediaPipe, Apache 2.0:
https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE

Downloaded 2026-10-03. face-triangles.json is the canonical OBJ's triangle
indices converted from one-based to zero-based vertex indexing.
All runtime assets are hosted locally; live tracking does not depend on a CDN.
