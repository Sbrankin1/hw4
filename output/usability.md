# Usability Improvements: Campus Customs

Two front-end improvements came from the Apple Store and NEXT reference images. Two back-end improvements came from cleaning up the product data so the shop and the chatbot could both use it. Each section says what we added and why it helps the business.

---

## Front end

### 1. A header that is always a search box and a category menu (from NEXT)
**What we added**
- A three-tier sticky header: a Yale-blue strip on top, then search on the left, the Campus Customs crest in the center and Log In / Create Account on the right, then an uppercase link row.
- The link row goes beyond the five required pages. It adds shortcuts to **Hoodies, Sweatshirts, Tees, Outerwear** and a gold **Family Gifts** link, and highlights the section you're in.
- The header stays at the top while you scroll. On phones it collapses into a menu button.

**Why it helps the business**
- A shopper who already knows what they want ("navy hoodie", "Saybrook") can search from any page in one step, instead of landing on the home page and hunting.
- One click on "Hoodies" goes straight to a filtered grid of 27 items, so there are fewer clicks between arriving and seeing products.
- The gold **Family Gifts** link puts parents and grandparents, a big group of buyers for college merch, one click from the right products.

### 2. Browse by picture, not just by list (from Apple)
**What we added**
- An Apple-style **icon row** under the big "Shop." heading: one product photo per sub-type (Crewnecks, Quarter-Zips, Pullover Hoodies, Fleece Jackets…), each linking to that filtered grid.
- **"The latest."** scrolling cards and a NEXT-style **"Find Your Yale"** theme carousel.
- **Image tile grids** for every Residential College and every sport.
- **Category boxes** on the products page: Category, Type and Theme filter chips, each showing how many items it holds.

**Why it helps the business**
- Shoppers recognize a hoodie or a quarter-zip faster from a photo than from a word, so they reach a relevant grid sooner and are less likely to bounce.
- College and sport tiles speak to *identity* ("I'm in Saybrook", "my kid rows crew"), which is why people buy college gear. These pages had no entry point before.
- Item counts on the chips ("Hoodies 27", "Family 14") show the range up front and stop dead-end clicks into empty filters.

### Supporting additions: keep shoppers moving once they've found something
- **Category buttons on every product page.** Each item shows clickable buttons for its category, sub-type and theme (e.g. *Hoodies · Pullover Hoodies · Sports*). One click opens everything similar.
- **"More like this."** Every product page ends with four related items (same sub-type first) and a "See all…" link.
- **Business value:** a shopper who lands on a sold-out or not-quite-right item has a next step instead of leaving. This is the in-store equivalent of "if you like this, try these", and it raises the number of products each visitor sees.

---

## Back end

### 3. Clean categories and sub-categories the agent can search by
**What we added**
- The database's `garment_type` had **22 overlapping labels** ("t-shirt", "short-sleeve T-shirt", "short-sleeve t-shirt"…). We mapped them, at read time and without changing the database, into **4 categories and 9 sub-categories** (e.g. Sweatshirts → Crewnecks / Mocknecks / Quarter-Zips). All 102 products fit exactly one.
- Every API product carries `category` and `subcategory`, and the agent's `search_products` tool takes **`category` and `subcategory` filters**, listed with their exact allowed values in the tool's description.

**Why it helps the business**
- Plain keyword search is unreliable on this catalogue. Measured on the real data:

  | Shopper asks for… | Keyword search | Category filter |
  |---|---|---|
  | "tees" | `"tee"` finds **6** of 27 tops | `category="T-Shirts & Tops"` → **27** |
  | "sweatshirts" | `"sweatshirt"` returns **59**, including 20 hoodies and tees | `category="Sweatshirts"` → **40**, all correct |
  | "a 1/4 zip" | `"1/4 zip"` finds **5** of 11 | `subcategory="Quarter-Zips"` → **11** |

  The filters let the agent turn "what tees do you have?" into one exact call that returns every tee and nothing else.
- The chatbot's answers line up with the website's own filters and nav links, so "Hoodies" means the same 27 items everywhere. Shoppers trust a store that's consistent.
- Fewer missed matches means fewer "sorry, we don't have that" replies for items the shop actually stocks, which means fewer lost sales.

### 4. Themes: shopping by *who it's for*, which the agent understands
**What we added**
- A second, independent label on every product, worked out from its id: **Sports, Residential Colleges, Graduate & Professional Schools, Family, Classic Yale / Spirit**. We tested it on all 102 products, and every product gets exactly one theme.
- The agent's `search_products` tool takes a **`theme` filter**, and the prompt maps everyday requests to it ("something for my dad" → Family).

**Why it helps the business**
- People shop college merch by **relationship and identity**, not by garment, and those words aren't in the product text. Measured on the real data: a keyword search for `"family"` finds **0** products, and `"mom"` finds **2**. `theme="Family"` returns all **14** Mom/Dad/Grandpa/Aunt… items. Likewise `"college"` matches **96** of 102 products (almost every item is tagged "college apparel"), while `theme="Residential Colleges"` returns exactly the **19** college-crest items.
- Themes combine with categories ("a Family **hoodie**"), so the agent can narrow fast instead of dumping the whole catalogue.
- The same themes power the "Find Your Yale" carousel and the theme chips. One back-end decision improved the chat, the home page and the products page together.

### Why these two back-end decisions mattered for the agent
The agent can only be as good as the filters it's given. Clean categories and themes turned vague shopper language into **exact, structured tool calls**, and the results then appear on the page as product cards (Problem 7). The result is a chatbot that finds the right items quickly, never invents products, and shows the same results a shopper would get by clicking through the site.
