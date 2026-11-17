# Insurance Guide: Design vs. Imported Page Discrepancy & Challenge Analysis

## Overview

This document provides a comprehensive analysis of the discrepancies between the **Figma Insurance Guide Design** ([Figma Node 5679-12800](https://www.figma.com/design/eQkxe1Fztgy4MfkZrFL0Ds/Kotak-Website-Dev-Design-File---V1?node-id=5679-12800)) and the content imported from the live Kotak Life website via [`tools/importer/importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js).

It details the structural, functional, and content gaps encountered when migrating live articles into Adobe Experience Manager Edge Delivery Services (AEM EDS), along with technical recommendations to resolve them.

---

## 1. Executive Summary

| Dimension | Live Site / Imported Output (`importv3.js`) | Target Figma Design (`5679-12800`) |
| :--- | :--- | :--- |
| **Page Layout** | Monolithic page with CSS float hacks (`65%` left, `35%` right) across two disconnected EDS sections. | Modern responsive 2-column layout (Main article content + sticky right-rail sidebar) on a CSS Grid. |
| **Hero Section** | Centered text banner with a complex multi-link dropdown (`.drpwn-wrapper`). Missing category pills and read time. | Left-aligned modern hero with category tag pill, read time, trust badge, and direct primary CTA. |
| **Article Navigation** | None. Plain linear document flow. | Sticky **Table of Contents (TOC)** with scroll-spy tracking H2/H3 headings. |
| **Social Engagement** | Stripped out during import (`.blog-social-meida` removed). | Social sharing bar (LinkedIn, X, WhatsApp, Facebook, Copy link) + "Was this helpful?" feedback widget. |
| **Product Cross-Sell** | 3 promo cards dumped at the very bottom of the page (`.saving-token`). | Contextual inline mid-article CTA banners + sticky sidebar product calculator/quote card. |
| **Media & Assets** | Broken DAM links (`/content/dam/...`) ingested as plain text anchors. | Responsive optimized images (`<picture>`), reviewer avatar, and SVG iconography. |

---

## 2. Discrepancy Breakdown by Component

### A. Breadcrumbs & Top Navigation
* **Figma Design:** Shows standard hierarchical breadcrumb navigation (e.g., `Home > Insurance Guide > Savings & Tax > Article Title`) directly above the hero banner.
* **Imported Page:** No breadcrumbs appear.
* **Root Cause in Importer:** [`importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js#L16) explicitly deletes `.blog-bradcrumb` in `removeGlobalNoise()` and does not set `Breadcrumb: true` in the Franklin `Metadata` table.
* **Impact:** EDS's auto-blocking in [`scripts/scripts.js`](file:///d:/KLI%20EDS/KLI/scripts/scripts.js#L70-L82) only activates breadcrumbs if `metadata.breadcrumb === 'true'`.

---

### B. Hero Banner Area
* **Figma Design:**
  1. **Category Tag Pill:** Topic label (e.g., *Savings & Tax*) placed above the H1.
  2. **Article Heading (H1) & Subheading:** Clean typography with ample line-height.
  3. **Metadata Row:** Author/Reviewer byline, Published/Updated date, estimated reading time (e.g., `5 min read`), and view count.
  4. **Trust Badge:** "Human expertise, no AI" pill badge.
  5. **Featured Visual:** Decorative illustration or graphic supporting the topic.
* **Imported Page:**
  1. Category pill is missing.
  2. Reading time is missing (only view count and date exist in the source HTML).
  3. No featured graphic or hero illustration is captured.
  4. Houses a legacy select dropdown ("Get Lumpsum Return", "Get Regular income", etc.) built by `decorateHeroBanner()`, which looks clunky and misaligned with the new UI.

---

### C. Article Body (Left Column)
* **Figma Design:**
  1. **Step-by-Step Sections:** Steps (such as *Steps for Existing Taxpayers* or *Steps for New Taxpayers*) are rendered inside distinct visual stepper cards with step numbers (`1`, `2`, `3`) and clear card borders.
  2. **Eligibility & Exception Lists:** Rendered inside bordered callout boxes with icon bullets.
  3. **Mid-Article CTA Banners:** Contextual product prompt (e.g. *Calculate Your Tax Savings*) inserted between article sections.
  4. **Suggested Readings:** Displayed as featured reading cards with thumbnail previews.
  5. **Interactive Rating / Feedback:** "Was this article helpful? [Yes] [No]" component placed at the end of the article text.
* **Imported Page:**
  1. Stepper sections are flattened into generic `<h2>` and `<h3>` tags with standard `<p>` elements.
  2. Eligibility lists are deeply nested `<ul>` tags that risk formatting collapse in Word/docx markdown conversion.
  3. No mid-article CTAs exist; all promotional tokens are displaced to the very end of the page.
  4. Suggested readings are rendered as a plain numbered list (`<ol>`).
  5. Feedback/rating widget is completely absent.

---

### D. Sidebar & Right-Rail
* **Figma Design:**
  1. **Sticky Table of Contents (TOC):** "In this article" / "Table of Contents" list linking to every H2 section. Sticks on screen while scrolling down the long article.
  2. **Sticky Quote / Lead Generation Card:** A high-contrast card prompting the user to calculate premium or request a call back with a primary action button.
  3. **Trending / Related Guides:** Top 3 related guides with thumbnails and read times.
* **Imported Page:**
  1. **No Table of Contents exists.**
  2. The sidebar contains 6 heavy SEO link blocks (`.check-calculators` converted to `rte-v2 bookmarks-links`), containing dozen of text links with a "SHOW MORE +" button. This clutters the sidebar and does not match the clean Figma layout.

---

### E. Author / Reviewer Bio Card (`profile-cards`)
* **Figma Design:**
  - Modern reviewer badge: circular avatar photo, reviewer name, role/designation, short bio, LinkedIn button, and a "Verified by Kotak Life" trust marker.
* **Imported Page:**
  - The photo is rendered as a raw text URL (`<a href="/content/dam/...prasad.png">...</a>`) because the DAM asset path was not transformed into a reachable image URL.
  - The author title, name, bio, and LinkedIn icon are concatenated with raw `<br>` tags into a single text block, losing layout fidelity.

---

### F. Product Cards (`financial-cards`) & Bookmarks
* **Figma Design:**
  - Highlighted plan cards with product tags ("Guaranteed Returns"), bulleted benefits, and distinct dual action buttons ("Check Returns", "Invest Now").
* **Imported Page:**
  - Images point to relative DAM paths (`/content/dam/assets-kotak/assets/images/homepagev2/...svg`) and render as raw text links.
  - Placed at the bottom under `.popular-search` section rather than structured as a clean product carousel or grid.

---

## 3. Technical & Architectural Challenges

### Challenge 1: The Two-Column CSS Float Hack
In [`styles/lazy-styles.css`](file:///d:/KLI%20EDS/KLI/styles/lazy-styles.css#L42-L55):
```css
@media (width >= 900px) {
  .column-left-section.section {
    width: 65%;
    float: left;
    padding-right: 40px;
  }
  .bookmark-section.section {
    width: 35%;
    float: right;
  }
}
```
* **Why this breaks:**
  - An element with `position: sticky` (like the Table of Contents or Sidebar CTA) **cannot stick** inside a floating parent container when sibling sections are floated.
  - Floats prevent equal-height column synchronization and complicate responsive breakpoints.
* **Required Fix:**
  Transition to a unified layout section or block container that uses CSS Grid:
  ```css
  .guide-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }
  @media (width >= 900px) {
    .guide-layout {
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 48px;
    }
  }
  ```

---

### Challenge 2: Relative DAM Image URLs Broken During Ingestion
In [`tools/importer/importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js):
* `buildProfileCards` and `appendKotakPromos` clone `<img>` elements whose `src` contains `/content/dam/...` or `/assets/...`.
* When the Franklin importer generates the Word document, the ingestion worker attempts to resolve relative URLs against `localhost` or fails to fetch them without credentials.
* **Result:** The docx pipeline drops the image binary and falls back to rendering the URL string as a hyperlink.
* **Required Fix:** Force absolute URL resolution pointing to the production live domain (`https://www.kotaklife.com`) during the DOM transformation:
  ```javascript
  const makeAbsoluteImageUrl = (img) => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('/content/dam/') || src.startsWith('/assets/')) {
      img.src = `https://www.kotaklife.com${src}`;
    }
  };
  ```

---

### Challenge 3: Dynamic Table of Contents (TOC) Creation
* AEM EDS content authors write pure markdown or Word documents. Manually creating and updating anchor links for 10+ H2 headings across dozens of guides is impractical and error-prone.
* **Required Architectural Solution:**
  Create a lightweight **TOC Auto-Block** or client-side decorator:
  1. Query all `h2` headings inside the article body.
  2. Assign kebab-case IDs if missing (`heading.id = heading.textContent...`).
  3. Dynamically populate the sidebar TOC list.
  4. Attach an `IntersectionObserver` to highlight the active section as the user scrolls.

---

### Challenge 4: Missing Metadata Fields in Page Frontmatter
* EDS relies heavily on the `Metadata` table at the bottom of the Word document (`appendMetadataBlockAtBottom`) to control page behavior.
* Currently, `importv3.js` only sets:
  - `Title`
  - `Description`
  - `Image`
* It misses critical flags needed to match the Figma design:
  - `Breadcrumb: true` (required to trigger `buildBreadcrumbBlock`)
  - `Category: Savings & Tax` (required for article categorization and filtering)
  - `Read-Time: 5 min` (or dynamically computed)
  - `Template: insurance-guide` (to apply scoped page template styles)

---

## 4. Content Gap Matrix

| Feature / Element | In Figma Design? | In Live Source HTML? | In Imported DOM? | Action Required |
| :--- | :---: | :---: | :---: | :--- |
| **Breadcrumbs** | Yes | Yes (`.blog-bradcrumb`) | No (Removed) | Set `metadata.Breadcrumb = 'true'` in importer. |
| **Category Tag Pill** | Yes | Yes (in breadcrumb/URL) | No (Removed) | Extract category text and inject as `<p class="category-tag">` in Hero. |
| **Reading Time** | Yes | No | No | Compute dynamically via script or word count in importer. |
| **Social Share Toolbar** | Yes | Yes (`.blog-social-meida`) | No (Removed) | Convert `.blog-social-meida` into an icon list block or EDS sharing component. |
| **Sticky Table of Contents** | Yes | No | No | Implement dynamic client-side TOC auto-block. |
| **Sticky Sidebar CTA / Form** | Yes | No | No | Author a reusable `form` or `profile-cta` block in the sidebar rail. |
| **Process Stepper Cards** | Yes | Yes (as raw H2/H3/P) | Flattened HTML | Wrap step sections into a styled stepper or `RTE V2 (stepper)` block. |
| **Mid-Article CTA Banner** | Yes | No (at footer only) | Displaced | Place promo cards after the 2nd or 3rd H2 section rather than at bottom. |
| **Feedback Widget (Yes/No)** | Yes | No | No | Add reusable client-side feedback component before reviewer card. |
| **Reviewer Avatar & Bio** | Yes | Yes (`.authorBox`) | Broken Images | Fix absolute image resolution and clean up reviewer card styling. |
| **Disclaimer Accordion** | Yes | Yes (`.terms`) | Yes | Styling refinement to match Figma accordion tokens. |
| **Popular Searches** | Yes | Yes (`.popular_list`) | Yes | Functional; requires styling refinement to match pill tags. |

---

## 5. Implementation Roadmap

### Step 1: Importer Updates ([`tools/importer/importv3.js`](file:///d:/KLI%20EDS/KLI/tools/importer/importv3.js))
1. **Preserve Metadata Flags:**
   - In `appendMetadataBlockAtBottom()`, add `metadata.Breadcrumb = 'true'` and `metadata.Template = 'insurance-guide'`.
2. **Category Extraction:**
   - Before stripping `.blog-bradcrumb`, extract the parent topic (e.g. *Savings & Tax*) and insert it into `heroContainer` above the `h1`.
3. **Absolute Image Path Resolution:**
   - Run `resolveAbsoluteAssetUrls(main)` across all author avatars, promo cards, and inline article images to ensure no `/content/dam/` relative paths survive into the output table.
4. **Social Share Capture:**
   - Re-route `.blog-social-meida` into a dedicated social sharing block instead of treating it as global noise.

### Step 2: Styling & Block Upgrades
1. **Replace Float Layout with CSS Grid:**
   - Deprecate `.column-left-section` and `.bookmark-section` float rules in [`styles/lazy-styles.css`](file:///d:/KLI%20EDS/KLI/styles/lazy-styles.css).
   - Implement a responsive CSS Grid container for the guide layout.
2. **Build the Table of Contents (TOC) Component:**
   - Create a lightweight TOC block in `blocks/toc/` or an auto-block decorator in `scripts.js` that inspects document headings and generates anchor links with scroll tracking.
3. **Profile Card Enhancements:**
   - Refactor `cards.css` / `profile-cards` to render author image, title, name, bio, and LinkedIn icon with verified badge hierarchy.
4. **Step Cards & Callouts:**
   - Create an RTE V2 variant (`rte-v2.stepper` or `card-border-red`) for multi-step instructions and eligibility criteria.

