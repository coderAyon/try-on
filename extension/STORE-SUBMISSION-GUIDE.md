# 🚀 Microsoft Edge & Google Chrome Store Publishing Guide

Your production release package is built and ready for submission:
📁 **File:** `extension-release.zip` (located in the root directory)

---

## 🔵 Method 1: Publish to Microsoft Edge Add-ons (Primary Target - Free)

Microsoft Edge Add-ons developer registration is **100% Free** (no registration fee required).

### Step 1: Open Microsoft Partner Center
1. Go to: [Microsoft Partner Center - Edge Extensions](https://partner.microsoft.com/dashboard/microsoftedge)
2. Sign in with any Microsoft account (Outlook / Hotmail / Office365).
3. Click **"Create new extension"**.

### Step 2: Upload the Release ZIP
1. Drag and drop the generated file:
   ```
   d:\STUDY\8th sem\project\sunglass_trial\extension-release.zip
   ```
2. Edge Partner Center will automatically validate `manifest.json`, icons, and scripts.

### Step 3: Fill in Store Listing Details
Copy and paste the exact text below:

- **Extension Name:**
  `Lumen Anywhere - Virtual Sunglasses Try-On`

- **Short Description (under 132 chars):**
  `Try on any sunglasses frame from Amazon, Ray-Ban, Prada, or any website in real-time 3D AR face tracking.`

- **Detailed Description:**
  ```markdown
  Lumen Anywhere brings virtual eyewear try-on to ANY website.

  Browse your favorite fashion and e-commerce stores (Amazon, Ray-Ban, Prada, Oakley, Gucci, Sunglass Hut, etc.), hover over any sunglasses image, and click "Try This Frame" to instantly see how they look on your face!

  ✨ KEY FEATURES:
  • Real-Time 3D AR Try-On: Uses client-side MediaPipe face tracking and Three.js WebGL rendering.
  • Realistic Depth Occlusion: Frame temples and arms realistically tuck behind your ears and head.
  • Automatic 3D Curved Fitting: Bends the 2D sunglasses frame into an authentic 3D face-wrap geometry with PBR optical glass reflections.
  • Right-Click Anywhere: Right-click any image on the web and select "Try on these sunglasses with Lumen AR".
  • Instant Image URL Try-On: Paste any sunglasses photo directly into the extension popup.

  🔒 PRIVACY FIRST:
  • All facial landmark tracking and camera processing happens 100% LOCALLY in your browser.
  • No camera video, face data, or personal information is ever recorded or uploaded to any server.
  ```

- **Category:** `Shopping` or `Lifestyle`
- **Visibility:** `Public`

### Step 4: Permission Justifications (Mandatory for Reviewers)
When Edge asks why each permission is needed, paste:

- **activeTab / tabs:**
  > "Used to open the virtual fitting room tab or bring an active try-on tab to focus when the user clicks 'Try This Frame'."

- **storage:**
  > "Used to store user preferences (preferred try-on mode, toggle state) and recently tried frames locally on the user's device."

- **contextMenus:**
  > "Allows users to right-click any sunglasses photo on any webpage and select 'Try on these sunglasses with Lumen AR'."

- **Host permissions (`<all_urls>`):**
  > "Required so the content script can scan product images across e-commerce shopping websites (such as Amazon, Ray-Ban, Prada, Zara, etc.) and display the non-intrusive floating 'Try This Frame' button on hover."

### Step 5: Privacy Policy
Edge requires a privacy policy statement:
> "Lumen Anywhere processes all camera streams and face landmarks strictly locally in the user's browser using client-side WebAssembly and Three.js WebGL. No video, images, or biometric face tracking data are ever transmitted, collected, or stored on any remote server."

### Step 6: Submit
Click **"Publish"**. Microsoft Edge typically reviews and approves extensions within **24 to 48 hours**.

---

## 🔴 Method 2: Publish to Google Chrome Web Store

1. Go to: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with your Google account (one-time $5 developer registration fee if first time).
3. Click **"New Item"** -> Upload `extension-release.zip`.
4. Paste the identical title, description, and permission justifications as above.
5. Click **"Submit for Review"**.
