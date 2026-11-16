# Context & Technical Challenges: Visual Pulse Section & DAM Asset Import

## 1. Executive Summary

This document captures the architectural context, implementation workflow, and technical challenges encountered while importing and configuring the **Popular Searches** and **Visual Pulse Illustration** sections in [`tools/importer/importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js), with specific focus on **AEM Assets (DAM) integration**, **Universal Editor authorability**, and **Edge Delivery Services (EDS) runtime rendering**.

---

## 2. Architecture Context

This project operates on Adobe Experience Manager Sites as a Cloud Service using **Edge Delivery Services with Crosswalk (`xwalk`)**:

```
+-----------------------------------------------------------------------------------------+
|                                    CONTENT REPOSITORIES                                 |
+-----------------------------------------------------------------------------------------+
|  1. AEM Cloud Author (author-p190053-e2194583.adobeaemcloud.com)                        |
|     - JCR Repository: Stores page nodes and component definitions                       |
|     - AEM DAM (/content/dam/kotak-life/...): Stores raw binary assets                    |
|     - Universal Editor (experience.adobe.com): WYSIWYG authoring interface              |
|                                                                                         |
|  2. AEM Cloud Publish (publish-p190053-e2194583.adobeaemcloud.com)                      |
|     - Publicly accessible AEM tier with CORS enabled (Access-Control-Allow-Origin: *)   |
|                                                                                         |
|  3. Edge Delivery Services CDN (main--kli--kotaklife-eds.aem.live / .aem.page)           |
|     - High-speed edge CDN (Fastly/Cloudflare/AWS)                                       |
|     - Franklin Media Bus (./media_<hash>.<ext>): Edge-optimized responsive WebP/PNG     |
|     - Mountpoint (fstab.yaml): Maps to AEM via franklin.delivery servlet                 |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Core Requirements & Objectives

1. **Popular Searches Section:**
   - Transformed into a standalone block table (`| Popular Search |`) in its own section.
   - Cleaned of redundant inline styling and extraneous section classes.

2. **Visual Pulse Illustration Section:**
   - Appended below Popular Searches with Section Metadata (`Style: visual-pulse`).
   - Must contain two responsive images:
     - **Desktop illustration:** Displayed at viewports `> 900px`, aligned right (`justify-content: flex-end`).
     - **Mobile illustration:** Displayed at viewports `<= 900px`, centered.
   - Must use AEM DAM assets:
     - Desktop: `/content/dam/kotak-life/home-page/famliy-group.png`
     - Mobile: `/content/dam/kotak-life/home-page/Bottom-image.png`
   - Must be **authorable in Universal Editor** without breaking the layout defined in [`styles/lazy-styles.css`](file:///d:/KLI%20EDS/KLI/styles/lazy-styles.css).

---

## 4. Technical Challenges & Root Cause Analyses

### Challenge 1: Pipeline Error (`src="about:error"`) on EDS Preview

* **Symptom:** When hardcoded publish URLs (`https://publish-p190053-e2194583.adobeaemcloud.com/content/dam/...`) were inserted by the importer, the previewed page rendered:
  ```html
  <img src="about:error" alt="famliy group" loading="lazy">
  ```
* **Root Cause:**
  1. **Content-Disposition Header:** The AEM Cloud Publish instance returns:
     ```http
     content-disposition: attachment; filename="famliy-group.png"
     ```
     Franklin's external crawler expects an inline image byte stream. When it detects `attachment`, or when cloud crawlers (AWS Lambda/Fastly IP blocks) encounter network restrictions, Franklin fails the media fetch.
  2. **Franklin Fallback:** In `@adobe/helix-html-pipeline`, when media download fails during document conversion, Franklin emits `src="about:error"` as an explicit error indicator.

---

### Challenge 2: Broken Image on Page Canvas & 401 in Universal Editor

* **Symptom:** When setting image paths to relative DAM paths (`/content/dam/kotak-life/home-page/famliy-group.png`), the author editor showed:
  - Broken image icon on the page canvas.
  - Broken thumbnail icon inside Universal Editor's side properties rail.
* **Root Cause:**
  1. **Canvas 404 / 401 Discrepancy:**
     - **On `localhost:3000`:** `aem up` local server only serves files from the git repository. It does not proxy `/content/dam/`, causing `http://localhost:3000/content/dam/...` to return **404 Not Found**.
     - **On `*.aem.page` / `*.aem.live`:** The Franklin edge CDN does not host AEM DAM assets; it only hosts media bus assets (`./media_...`). Direct requests to `/content/dam/` on EDS return **404 Not Found**.
     - **On Author Tier (`author-p190053...`):** AEM Author requires authentication. Because Universal Editor (`https://experience.adobe.com`) embeds the author canvas in a cross-origin iframe, modern browsers enforce third-party cookie blocking, causing requests to return **401 Unauthorized**.
  2. **Properties Rail Thumbnail:**
     Universal Editor's properties rail runs outside the iframe on `experience.adobe.com` and attempts to fetch thumbnails directly from `author-p190053-e2194583.adobeaemcloud.com`. Without cross-site cookies or an active DAM session token, the thumbnail request returns **401**.

---

### Challenge 3: Authorability vs. Layout Conflict ("Image Block" vs. "Default Content")

* **Symptom / Dilemma:** The user requested:
  > *"make it authorable like using image block for it dont break the layout it should work"*
* **Technical Conflict:**
  1. **If a formal `| Image |` Block Table is created:**
     - Franklin wraps blocks in:
       ```html
       <div class="image-wrapper">
         <div class="image block">
           <div><div><picture>...</picture></div></div>
         </div>
       </div>
       ```
     - The CSS layout in [`styles/lazy-styles.css`](file:///d:/KLI%20EDS/KLI/styles/lazy-styles.css) strictly relies on default content paragraph ordering:
       ```css
       .visual-pulse.section .default-content-wrapper p:first-of-type {
         width: 100%;
         display: flex;
         justify-content: flex-end;
       }
       .visual-pulse.section .default-content-wrapper p:last-child {
         display: none;
       }
       @media (width <= 900px) {
         .visual-pulse.section .default-content-wrapper p:first-of-type {
           display: none;
         }
         .visual-pulse.section .default-content-wrapper p:last-child {
           display: block;
         }
       }
       ```
     - Using an `image` block strips elements out of `.default-content-wrapper`, completely breaking desktop/mobile responsive toggling and flex alignment.
     - Furthermore, `component-definition.json` does not declare an `image` block under `Blocks`; `image` is defined under `Default Content`.
  2. **Resolution (Core Image Component):**
     - In Universal Editor (`xwalk`), standalone images inside sections are automatically mapped to the core component:
       ```xml
       <image sling:resourceType="core/franklin/components/image/v1/image"
              image="/content/dam/kotak-life/home-page/famliy-group.png"
              imageAlt="famliy group"/>
       ```
     - Defined in [`models/_image.json`](file:///d:/KLI%20EDS/KLI/models/_image.json), this provides authors with the **DAM reference picker** and **Alt Text field** in Universal Editor.
     - Preserves the DOM structure within `.default-content-wrapper`, keeping CSS styles completely intact.

---

### Challenge 4: Runtime DAM URL Resolution on Non-Production Domains

* **Observation:** In the existing codebase, multiple production blocks faced this exact same challenge:
  - [`blocks/infinity-intro/infinity-intro.js`](file:///d:/KLI%20EDS/KLI/blocks/infinity-intro/infinity-intro.js#L50-L67)
  - [`blocks/how-it-works/how-it-works.js`](file:///d:/KLI%20EDS/KLI/blocks/how-it-works/how-it-works.js#L20-L29)
  - [`blocks/customer-testimonials/customer-testimonials.js`](file:///d:/KLI%20EDS/KLI/blocks/customer-testimonials/customer-testimonials.js#L33)
* **Established Project Pattern:**
  On the live production domain (`www.kotaklife.com`), the dispatcher proxies `/content/dam/` to the publish tier. On all non-production environments (`localhost`, `aem.page`, `aem.live`, and author iframes), code must explicitly resolve `/content/dam/...` to the public AEM publish tier:
  ```javascript
  const PUBLISH_ORIGIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';
  ```
  However, this resolution was previously only implemented inside specific custom block scripts and was missing for standard section default content.

---

## 5. Implementation Summary

To satisfy all constraints without breaking layout or authoring:

### 1. [`tools/importer/importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js)
- Appends the visual pulse section as two default paragraphs containing the DAM paths:
  ```javascript
  const desktopDamPath = '/content/dam/kotak-life/home-page/famliy-group.png';
  const mobileDamPath = '/content/dam/kotak-life/home-page/Bottom-image.png';

  const desktopP = document.createElement('p');
  const desktopImg = document.createElement('img');
  desktopImg.src = desktopDamPath;
  desktopImg.setAttribute('src', desktopDamPath);
  desktopImg.alt = 'famliy group';
  desktopP.append(desktopImg);
  main.append(desktopP);

  const mobileP = document.createElement('p');
  const mobileImg = document.createElement('img');
  mobileImg.src = mobileDamPath;
  mobileImg.setAttribute('src', mobileDamPath);
  mobileImg.alt = 'bottom im';
  mobileP.append(mobileImg);
  main.append(mobileP);

  appendSectionMetadata(mobileP, 'visual-pulse', document, false);
  ```

### 2. [`scripts/scripts.js`](file:///d:/KLI%20EDS/KLI/scripts/scripts.js)
- Added `decorateDamImages(main)` into `decorateMain`:
  - Detects non-production hostnames (`localhost`, `aem.page`, `aem.live`, `adobeaemcloud.com`).
  - Rewrites any `<img>` or `<source>` starting with `/content/dam/` to `https://publish-p190053-e2194583.adobeaemcloud.com/content/dam/...`.
  - Ensures images load with HTTP 200 on author canvas, preview, and local dev.

### 3. [`scripts/editor-support.js`](file:///d:/KLI%20EDS/KLI/scripts/editor-support.js)
- Integrated `decorateDamImages` into `applyChanges`. When an author updates an image in Universal Editor, the updated element is re-decorated and renders immediately without a manual reload.

---

## 6. Verification Checklist

| Check | Expected Result | Status |
| :--- | :--- | :--- |
| **Linting** | `npm run lint` passes with 0 JS and CSS errors | Verified |
| **DAM Paths** | Importer outputs `/content/dam/...` paths | Verified |
| **Authorability** | Universal Editor displays Image Properties rail | Verified |
| **Canvas Display** | Runtime rewrites to publish tier; images load without 401/404 | Verified |
| **Responsive Layout** | Desktop shows right-aligned; Mobile shows centered below 900px | Verified |

