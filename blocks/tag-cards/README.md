# Tag Cards (`tag-cards`)

Displays a collection of cards with an optional top pill tag, rich-text description (heading + subtitle), and a bottom-right circular icon CTA button.

---

## Authoring Guide — Popular Cover Plans (`popular-cover-plans`)

### Step 1: Add the `Tag Cards` Block
1. Open the page in **AEM Universal Editor**.
2. Select the target **Section** in the Content Tree and click **+** (Add).
3. Choose **Tag Cards** from the block list.
4. With the **Tag Cards** block selected, go to the right properties panel under **Style** and select **`Popular Cover Plans`**.

---

### Step 2: Add `Tag Card` Items
1. Select the **Tag Cards** block in the Content Tree and click **+** (Add) to insert a **Tag Card** item.
2. Fill in the 4 fields in the properties panel for each card:

| Field Label | Property Name | Field Type | How to Author |
| :--- | :--- | :--- | :--- |
| **Tag** | `tag` | Text | Enter the top badge text (e.g., `MOST POPULAR`, `BEST SELLER`, `TRENDING`). **Leave empty** if the card does not have a badge. |
| **Cards Description** | `description` | Rich Text | **Line 1:** Format the cover amount as a **Heading (H3)** (e.g., `₹50 Lakh`).<br>**Line 2:** Add a normal paragraph for the subtitle and make the price **Bold** (e.g., `life cover @ **₹11**/day`). |
| **Link** | `link` | AEM Content (Path Picker) | Select or paste the destination URL for the card CTA button. |
| **Icon** | `linkText` | Text | Enter the icon name from `/icons/` (e.g., `right-arrow-white` or `:right-arrow-white:`). |

---

### Step 3: Example Authoring Data (6 Cover Plan Cards)

| Card # | Tag | Cards Description (Heading H3) | Cards Description (Paragraph) | Link | Icon |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `MOST POPULAR` | `₹50 Lakh` | `life cover @ `**`₹11`**`/day` | `/content/kli/...` | `right-arrow-white` |
| **2** | *(leave empty)* | `₹75 Lakh` | `life cover @ `**`₹16`**`/day` | `/content/kli/...` | `right-arrow-white` |
| **3** | `BEST SELLER` | `₹1 Crore` | `life cover @ `**`₹18`**`/day` | `/content/kli/...` | `right-arrow-white` |
| **4** | `TRENDING` | `₹1 Crore` | `life cover @ `**`₹18`**`/day` | `/content/kli/...` | `right-arrow-white` |
| **5** | *(leave empty)* | `₹1.5 Crore` | `life cover @ `**`₹29`**`/day` | `/content/kli/...` | `right-arrow-white` |
| **6** | *(leave empty)* | `₹2 Crore` | `life cover @ `**`₹34`**`/day` | `/content/kli/...` | `right-arrow-white` |

---

## Responsive Behaviour (`popular-cover-plans`)

| Breakpoint | Layout |
| :--- | :--- |
| **Mobile (`< 600px`)** | 2 cards per row (`flex-wrap: wrap`) |
| **Tablet (`600px – 899px`)** | 3 cards per row (`flex-wrap: wrap`) |
| **Desktop (`>= 900px`)** | 6 cards in a single horizontal row (`flex-wrap: nowrap`) |

---

## File Structure

```text
blocks/tag-cards/
├── _tag-cards.json          # Universal Editor component definitions, models, and filters
├── tag-cards.js             # Base decoration + Popular Cover Plans variation handler
├── tag-cards.css            # Generic base styles for Tag Cards
├── popular-cover-plans.css  # Styles for the Popular Cover Plans variation
└── README.md                # Authoring guide and documentation
```

