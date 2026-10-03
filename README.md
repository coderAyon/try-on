# LUMEN VISION — Enterprise Virtual Try-On (VTO)
### Matching "Sunglass Hut" (FittingBox Technology) Fidelity | CSE Final Year Capstone Project

**LUMEN VISION** is an enterprise-grade Virtual Try-On web application engineered with **Three.js WebGL**, **MediaPipe FaceMesh (468 3D landmarks)**, and **React + TypeScript**. It delivers real-time physical optical fidelity, depth occlusion, and facial morphometrics matching the industry standard set by Sunglass Hut and FittingBox.

---

## 🏛️ Full-Stack System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SUNGLASS HUT VIRTUAL TRY-ON (VTO)                    │
│                 Full-Stack Enterprise Web Application                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│        FRONTEND (Client)         │        │         BACKEND (Server)         │
│    Vite + React 18 + Three.js    │        │       Node.js + Express REST     │
├──────────────────────────────────┤        ├──────────────────────────────────┤
│ • MediaPipe 478-pt FaceMesh      │        │ • /api/products (Catalog)        │
│ • Orthonormal Head Pose & IPD    │◄──API─►│ • /api/recommendations (AI Fit)  │
│ • WebGL PBR Physical Glass       │        │ • /api/cart (Shopping Bag & Tax) │
│ • 3D Head Occluder & Ear Clip    │        │ • /api/stores (Retail Locator)   │
│ • Interactive Before/After Split │        │ • /api/orders (Checkout Pipeline)│
│ • Real CAD glTF Model Pipeline   │        │ • /api/tryon (Telemetry/Looks)   │
└──────────────────────────────────┘        └─────────────────┬────────────────┘
                                                              │
                                            ┌─────────────────┴────────────────┐
                                            ▼                                  ▼
                                   ┌─────────────────┐        ┌────────────────┐
                                   │  Persistent DB  │        │ 3D CAD Storage │
                                   │   (JSON/SQLite) │        │ (public/models)│
                                   └─────────────────┘        └────────────────┘
```

---

## 📦 Tech Stack & Dependencies

- **Framework**: Vite + React 18 (TypeScript)
- **Computer Vision**: `@mediapipe/face_mesh`, `@mediapipe/camera_utils`
- **3D Graphics & Rendering**: `three`, `@types/three` (PBR `MeshPhysicalMaterial`, `MeshStandardMaterial`, ACESFilmic tone mapping)
- **Styling & Aesthetics**: Tailwind CSS, Google Fonts (`Inter`, `Cinzel`, `JetBrains Mono`)
- **Icons & Effects**: `lucide-react`, `canvas-confetti`, Web Audio API luxury sound synthesizer

---

## 🕶️ Implemented Sunglasses Catalog (Phase 1)

1. **Ray-Ban Aviator Classic** (`RB3025 001/58`)
   - Polished Arista Gold Plated Alloy, double bridge, silicone nose pads, G-15 optical green glass.
2. **Ray-Ban Original Wayfarer** (`RB2140 901`)
   - Hand-polished Italian acetate, metal hinge rivets, classic trapezoidal silhouette.
3. **Oakley Radar EV Path Prizm™** (`OO9208 46`)
   - High-performance sports wraparound single shield Plutonite® lens with aerodynamic brow vents.
4. **Ray-Ban Hexagonal Flat Lenses** (`RB3548N 001`)
   - 6-sided faceted coined metal rims with flat crystal lenses.
5. **Ray-Ban Round Metal Legend** (`RB3447 001`)
   - Retro coined gold circular rims with high arched nasal bridge.
6. **Cartier Première Luxury Cat-Eye** (`CT0271S`)
   - 24K gold flash finish, upswept high-fashion contours with burgundy optical tint.

---

## 🚀 Getting Started

### 1. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Build Production Bundle
```bash
npm run build
```

---

## 📡 Enterprise Backend REST API Specification

The Node.js + Express backend service runs on port `5000` (proxied transparently by Vite to `/api/*`):

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check, uptime, vision engine & rendering status |
| `/api/products` | `GET` | Filter products by `category`, `brand`, `faceShape`, `search` |
| `/api/products/:id` | `GET` | Get single product with full PBR and CAD asset paths |
| `/api/products/meta/categories` | `GET` | List available eyewear categories with item counts |
| `/api/products/meta/brands` | `GET` | List designer brands (Ray-Ban, Oakley, Prada, etc.) |
| `/api/recommendations/advisor` | `POST` | AI Fit Advisor: classifies face shape from landmarks & ranks frames |
| `/api/cart` | `GET` | Retrieve active shopping bag with subtotal, tax, & discounts |
| `/api/cart/add` | `POST` | Add product variant and size (`Standard 58mm` / `Large 62mm`) |
| `/api/cart/update` | `PUT` | Increment / decrement quantity or remove |
| `/api/cart/item/:id` | `DELETE` | Remove item from bag |
| `/api/cart/apply-coupon` | `POST` | Validate & apply promo codes (`SUN20`, `STUDENT15`, `VIPCLUB`) |
| `/api/stores` | `GET` | Retail store network (5th Ave NYC, Lincoln Rd Miami, Oxford St London) |
| `/api/stores/:id/stock/:productId` | `GET` | Real-time in-store stock check & 2-hour pickup availability |
| `/api/tryon/telemetry` | `POST` | Log 60 FPS CV telemetry (IPD, Yaw, Pitch, Roll, Confidence) |
| `/api/tryon/save-look` | `POST` | Save user snapshot look to persistent lookbook |
| `/api/tryon/looks` | `GET` | Retrieve saved snapshot gallery |
| `/api/reviews/:productId` | `GET` | Customer reviews with verified buyer & face shape tags |
| `/api/reviews` | `POST` | Submit customer review |
| `/api/orders/checkout` | `POST` | Enterprise order placement with invoice & tracking number |

---

## 🔬 Core Features Implemented in Phase 1

- **Luxury Minimalist Sunglass Hut Theme**: Slate-950, deep charcoal (`#0B0D11`), brushed champagne/gold accents (`#D4AF37`), frosted glassmorphic HUD.
- **Top Navigation Bar**: Brand logo, mode switcher (*Live Webcam*, *Studio Photo Upload*, *3D Studio Head*), luxury Web Audio sound toggle, and *AI Fit Advisor*.
- **16:9 HD WebGL Viewport**: Dynamic viewport with active product badge, face alignment guides, cyber corner brackets, and camera stream integration.
- **Minimalist Telemetry HUD**: Real-time status badge showing *Camera Active*, *Face Tracking: 60 FPS*, *Depth Occlusion: Active*, estimated *IPD in mm*, and *Head Pose Yaw/Pitch*.
- **Bottom Eyewear Carousel**: Horizontal sliding catalog drawer with category filters, color variant swatches, SVG previews, and instant try-on state.
- **Floating Controls**: Mirror mode horizontal flip, calibration drawer toggle, lighting environment presets (*Studio*, *Sunny Daylight*, *Golden Hour*, *Noir Runway*), and camera snapshot shutter.
- **Optical Calibration Drawer**: Real-time fine-tuning sliders for global frame scale, pupillary distance (IPD offset), bridge height, and temple depth.
- **FittingBox Depth Occluder**: Head occluder mesh with depth buffer masking (`colorWrite: false`), causing temple arms to disappear behind ears naturally.
- **AI Fit Advisor**: Facial morphometrics classifier analyzing facial geometry (Oval, Square, Round, Heart, Diamond) and matching flattering frame styles.
- **Editorial Snapshot Lookbook**: High-resolution composite capture with luxury editorial watermark and instant download capability.

---

## 📐 Phase 2: High-Precision Head Pose & Landmark Matrix Formulation

### 1. Key Face Mesh Topological Anchors
| Anatomical Landmark | MediaPipe Indices | Purpose in 3D Matrix Calculation |
| :--- | :--- | :--- |
| **Nasal Bridge** | `168` (Bridge), `6` (Glabella) | Face origin and vertical rest anchor for eyewear bridge |
| **Nose Tip Apex** | `4` | Vertical vector orientation ($\vec{v}_{up} = \vec{P}_{168} - \vec{P}_{4}$) |
| **Left Eye Contour** | `33` (Outer), `133` (Inner), `468` (Iris) | Eye center midpoint $\vec{P}_{leftEye}$ |
| **Right Eye Contour** | `362` (Inner), `263` (Outer), `473` (Iris) | Eye center midpoint $\vec{P}_{rightEye}$ |
| **Face Temples** | `127` (Left), `356` (Right) | Facial width & bi-temporal distance verification |

### 2. Orthonormal Coordinate Basis
To prevent gimbal lock and achieve singularity-free rotation:
1. **Lateral Axis ($\hat{X}$)**:
   $$\hat{X} = \frac{\vec{P}_{rightEye} - \vec{P}_{leftEye}}{\|\vec{P}_{rightEye} - \vec{P}_{leftEye}\|}$$
2. **Normal Axis ($\hat{Z}$)** (Pointing outward from face):
   $$\hat{Z} = \frac{\hat{X} \times (\vec{P}_{bridge} - \vec{P}_{noseTip})}{\|\hat{X} \times (\vec{P}_{bridge} - \vec{P}_{noseTip})\|}$$
3. **Orthogonal Vertical Axis ($\hat{Y}$)** (Strictly $90^\circ$ perpendicular):
   $$\hat{Y} = \frac{\hat{Z} \times \hat{X}}{\|\hat{Z} \times \hat{X}\|}$$
4. **Rotation Matrix & Quaternion**:
   $$R = \begin{bmatrix} \hat{X}_x & \hat{Y}_x & \hat{Z}_x \\ \hat{X}_y & \hat{Y}_y & \hat{Z}_y \\ \hat{X}_z & \hat{Y}_z & \hat{Z}_z \end{bmatrix} \implies q \in \mathbb{H}$$

### 3. Dynamic IPD (Interpupillary Distance) Scaling
Optical scale is continuously derived from the measured Euclidean distance between pupils:
$$s = \left(\frac{\|\vec{P}_{rightEye} - \vec{P}_{leftEye}\|}{w_{baseline}}\right) \cdot \text{scale}_{calibrated}$$
Ensures consistent millimeter-accurate frame sizing regardless of user distance from the camera.

### 4. Dual-Stage Adaptive Jitter Filter
- **Quaternion SLERP**: Constant angular velocity interpolation on rotations.
- **Velocity-Aware 1-Euro Translation Filter**: Dynamically transitions $\alpha$ between $0.18$ (when still) and $0.75$ (when moving), producing rock-solid stability without perceptual lag.

---

## 🎭 Phase 3: The Secret to Photorealism — Invisible 3D Head Occluder & Dynamic Temple Clipping

FittingBox and Sunglass Hut achieve convincing realism because sunglasses temples do not float in the air or pierce through cheeks when turning the head. Phase 3 implements this two-tier depth masking and hardware clipping architecture:

### 1. Dynamic Camera Stream Matching
- Dynamic aspect ratio $\text{Aspect} = \frac{W_v}{H_v}$ and focal length synchronization.
- Dynamically adapts vertical FOV ($44^\circ$ for $16:9$, $49.5^\circ$ for $4:3$) ensuring 1:1 metric correspondence between 2D webcam pixels and 3D WebGL space.

### 2. Anatomical 3D Head Occluder Mesh
- **Topology**: Conforms to standard human craniofacial anatomy (cranial dome, frontal zygomatic face surface, left/right ear blocks, and jawline).
- **GPU Depth Mask Settings**:
  ```typescript
  occluderMaterial.colorWrite = false; // 100% invisible to RGB camera
  occluderMaterial.depthWrite = true;  // Writes to GPU Z-buffer
  occluderMesh.renderOrder = 0;        // Renders first before sunglasses (renderOrder = 1)
  ```
- **Depth Occlusion Effect**: When the user rotates their head, the far temple arm recedes into the occluder geometry and is automatically masked by the GPU depth buffer.

### 3. Dynamic GPU Hardware Ear Clipping Plane
- Positioned dynamically at the coronal plane passing through temporal landmarks `127` and `356` (ear roots):
  $$\text{Plane}_{\text{ear}}: \hat{n}_{\text{world}} \cdot \vec{P} + d_{\text{world}} = 0$$
- Bound directly to `templeArmMaterial.clippingPlanes` with `renderer.localClippingEnabled = true`.
- Any geometry extending unrealistically past the ears is discarded in the GPU fragment shader stage.

### 4. Academic Demonstration / Proof Mode
- Click the **"3D"** button in the floating toolbar to toggle the invisible depth mask into a **cyan holographic wireframe**, visually demonstrating the occluder geometry and depth clipping mechanism in real time.

---

## ✨ Phase 4: Photorealistic PBR Materials, Glass Shader & Studio Lighting (FittingBox Standard)

Phase 4 elevates the visual fidelity from a geometric preview to an indistinguishable physical product showcase:

### 1. HDRI Studio Lighting & PMREM Generator ([`environmentGenerator.ts`](file:///d:/STUDY/8th%20sem/New%20project/src/utils/environmentGenerator.ts))
- **Pre-filtered Radiance Environment Maps (PMREM)**: Procedurally generates studio softbox lightboxes (key, fill, and overhead metallic glint strip) in real time without external network latency.
- **Color Grading & ACES Filmic Tone Mapping**:
  ```typescript
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.environment = envRenderTarget.texture;
  ```
- **Dynamic Lighting Presets**: Seamlessly shifts specular reflections between *Luxury Studio*, *Sunny Daylight*, *Golden Hour*, and *Noir Runway*.

### 2. Optical Crown Glass Shader (`MeshPhysicalMaterial`)
- **Index of Refraction ($IOR$)**: `1.52` (matching optical crown glass).
- **Physical Light Transmission**: `0.85 to 0.90` (semi-transparent polarized glass, allowing the user's eyes to show through naturally without opacity flattening).
- **Surface Roughness**: `0.05` (ultra-smooth optical polish).
- **Clearcoat & Roughness**: `clearcoat: 1.0`, `clearcoatRoughness: 0.05` (produces crisp outer glass glints and environment highlights).
- **Surface Reflectivity**: `0.90` (high-end polarized mirror reflectivity).
- **Iconic Tint Palette**:
  1. *Classic G-15 Green / Ray-Ban* (`#253d2c`)
  2. *Polarized Blue Mirror* (`#0284c7`)
  3. *Sunset Amber* (`#b45309`)
  4. *Polarized Jet Black* (`#111827`)

### 3. Frame Metallurgy & Polymers
- **Metal Frames (Gold, Arista, Titanium, Monel Alloy)**:
  `metalness: 0.95`, `roughness: 0.20`, `envMapIntensity: 2.4`.
- **Acetate / Plastic Frames (Italian Acetate, O Matter™ Polymer)**:
  `metalness: 0.00`, `roughness: 0.35`, `envMapIntensity: 1.1`.

### 4. Dynamic Nose Bridge Contact Drop-Shadow
- **Optical Grounding**: A procedural radial gradient shadow mesh is positioned beneath the nasal bridge (`0, -0.42, -0.32`), tilted along the dorsal slope of the nasal bone.
- Rigidly tracks head movements with `depthWrite: false` and `opacity: 0.45`, preventing the glasses from appearing as if they are floating disconnected from the face.



