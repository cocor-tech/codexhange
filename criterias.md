# CodeXhange — SEO Ranking Criteria Checklist

> 100 essential ranking criteria organized by category. Every piece of code written for CodeXhange must align with these guidelines.

---

## 🛠️ Category 1: Technical & Crawler SEO (The Foundation)

| # | Criterion | Implementation |
|---|-----------|---------------|
| 1 | **Proper Hreflang Tags** | Tag local subdirectories (e.g., `hreflang="en-ng"` for Nigeria) so Google serves the right version per country. |
| 2 | **Canonical Tags** | Every regional page points to itself as master copy to avoid duplicate content penalties. |
| 3 | **Valid XML Sitemap** | Auto-generate dynamic XML sitemap via Next.js that updates when new brand directories are created. |
| 4 | **Robots.txt Configuration** | Allow bots to crawl `/brand/` paths, block `/api/` and `/dashboard/`. |
| 5 | **Clean Semantic HTML** | Use `<main>`, `<section>`, `<article>`, `<h1>` — avoid generic `<div>` nesting. |
| 6 | **No Broken Links (404s)** | Custom 404 page that guides users back home. |
| 7 | **SSG/ISR Deployment** | Serve static HTML via Incremental Static Regeneration on Vercel. |
| 8 | **Valid Structured Data (Schema.js)** | Implement **Coupon Schema** + **Organization Schema** JSON-LD for rich snippets. |
| 9 | **URL Structure Cleanliness** | Short logical paths: `codexhange.com/ng/brand/nike` not query strings. |
| 10 | **Custom Breadcrumbs** | Breadcrumb navigation: *Home > Stores > Nike Coupons*. |
| 11 | **HTTPS Everywhere** | Full SSL via Cloudflare edge network. |
| 12 | **IPv6 Support** | Hosting accessible via IPv6. |

---

## ⚡ Category 2: Core Web Vitals & Performance (Speed)

| # | Criterion | Implementation |
|---|-----------|---------------|
| 13 | **Low LCP (< 2.5s)** | Main elements above the fold load fast. |
| 14 | **Excellent INP (< 200ms)** | "Copy Code" button responds instantly. |
| 15 | **Zero CLS** | No layout shift when elements load dynamically. |
| 16 | **Gzip/Brotli Compression** | Compress text assets via Cloudflare. |
| 17 | **Minified JS & CSS** | Next.js production build strips comments and whitespace. |
| 18 | **Next.js Image Optimization** | `<Image>` component for auto-resize, .webp format. |
| 19 | **Async/Deferred Scripts** | Cloudflare Turnstile loads async, doesn't block render. |
| 20 | **Low TTFB** | MongoDB indexes + Vercel Edge CDN caching. |

---

## 📝 Category 3: On-Page Optimization & Intent

| # | Criterion | Implementation |
|---|-----------|---------------|
| 21 | **Keyword-Targeted Title Tags** | `[Brand] Promo Codes & Discounts [Month] [Year]` |
| 22 | **Dynamic Year/Month Tokens** | Auto-update dates in titles and descriptions. |
| 23 | **Unique Meta Descriptions** | Under 160 chars, click-worthy summaries with code count. |
| 24 | **Single H1 Tag** | Exactly one `<h1>` per page with primary keyword. |
| 25 | **Logical Heading Hierarchy** | `<h2>` for sections, `<h3>` for code descriptions. |
| 26 | **Image Alt Text** | Descriptive alt text for brand logos. |
| 27 | **Keyword Density Balance** | Natural use of "coupon", "discount", "promo code", "deal", "save". |
| 28 | **Anchor Text Clarity** | "Reveal Nike Promo Code" not "Click Here". |
| 29 | **Internal Linking** | Link related brand categories. |
| 30 | **No Keyword Cannibalization** | One URL per brand keyword variant. |

---

## 💎 Category 4: Content Depth & E-E-A-T (Trust & Quality)

| # | Criterion | Implementation |
|---|-----------|---------------|
| 31 | **Explanatory Store Content** | 100-word guide below code list on how to apply codes. |
| 32 | **Clear Terms & Restrictions** | Show exclusions: "Valid on first orders only", "Min $50". |
| 33 | **Visible Expiration Dates** | Display when code expires or was last checked. |
| 34 | **Author/Community Profiles** | Public profile tier for contributors. |
| 35 | **About Us & Contact Pages** | Crawlable admin pages for legitimacy. |
| 36 | **Explicit Privacy Policy & ToS** | Linked in footer. |
| 37 | **Clear Monetization Disclosure** | Footer notice about affiliate commissions. |
| 38 | **"How to Use" FAQs** | Accordion FAQ with structured FAQ Schema. |
| 39 | **Fresh Content Frequency** | Track daily/weekly updates. |
| 40 | **Original Text Descriptions** | No copy-pasting from competitors. |

---

## 👥 Category 5: User Engagement & Behavior

| # | Criterion | Implementation |
|---|-----------|---------------|
| 41 | **Low Bounce Rate / High Dwell Time** | Clear, readable, engaging layout. |
| 42 | **High Direct Interaction Rate** | High click rates on "Copy Code" / "Reveal Deal". |
| 43 | **Clean Dustbin Ratio** | Low ratio of dead/downvoted codes prevents pogo-sticking. |
| 44 | **Explicit Success Ratings** | "89% Success Rate" from upvotes. |
| 45 | **Real-Time Comment Sections** | User feedback under codes. |
| 46 | **Social Sharing** | Clean share links for WhatsApp, X, Reddit. |
| 47 | **Clear Typography** | Legible font sizes, high-contrast colors. |
| 48 | **Intuitive Search Filters** | Filter global vs local, percentage off. |
| 49 | **No Intrusive Interstitials** | No fullscreen popups on landing. |
| 50 | **Prominent Brand Identity** | CodeXhange branding across all templates. |

---

## 📱 Category 6: Mobile Usability & Accessibility

| # | Criterion | Implementation |
|---|-----------|---------------|
| 51 | **Mobile-First Responsive Design** | Grids, buttons, text resize for smartphones. |
| 52 | **Touch Target Sizing** | Buttons large enough to tap easily. |
| 53 | **No Horizontal Scrolling** | Text wrap prevents overflow. |
| 54 | **Readable Mobile Font Scale** | Body text at least 16px on phones. |
| 55 | **Optimized SVGs** | Clean SVG logos or optimized WebP. |
| 56 | **WCAG Contrast Compliance** | Text passes accessibility checks. |
| 57 | **Screen Reader Compatibility** | ARIA attributes on dynamic elements. |
| 58 | **Fingerprint Layout Safety** | High-interaction elements in thumb zones. |
| 59 | **Minimal CSS Footprint** | Tightly bundled mobile styles. |
| 60 | **Input Optimization** | Correct mobile key types (numeric for filters). |

---

## 📊 Category 7: Off-Page Authority & Natural Backlinks

| # | Criterion | Implementation |
|---|-----------|---------------|
| 61 | **Organic Editorial Backlinks** | Earn links from bloggers/news outlets. |
| 62 | **Social Media Referral Traffic** | Visitors from Reddit, Facebook, TikTok. |
| 63 | **Brand Searches** | Users searching "codexhange nike codes". |
| 64 | **Diverse Link Anchor Text** | Natural mix of anchor text. |
| 65 | **High-Authority Domain Mentions** | Links from tech, e-commerce, finance sites. |
| 66 | **No Toxic Forum Spam** | Avoid cheap link services. |
| 67 | **Local Authority Signals** | Links from geographical extensions (.ng, .co.uk). |
| 68 | **Consistent Brand Citations** | "codexhange" spelled correctly everywhere. |
| 69 | **Resource Page Inclusions** | Listed in "how to save money" guides. |
| 70 | **Natural Link Growth Velocity** | Steady profile growth over time. |

---

## 🛡️ Category 8: Security, Anti-Spam & Data Integrity

| # | Criterion | Implementation |
|---|-----------|---------------|
| 71 | **Cloudflare Turnstile** | Bot detection on code submission. |
| 72 | **Nofollow on External Promos** | `rel="nofollow"` or `rel="sponsored"` on retail links. |
| 73 | **Hash Fingerprinting** | Prevent duplicate submissions. |
| 74 | **Profanity Filtering** | Block toxic text in comments/descriptions. |
| 75 | **MongoDB Sanitization** | Prevent script injection in submissions. |
| 76 | **Secure Cookie Config** | SameSite and Secure attributes on NextAuth cookies. |
| 77 | **Spam Submitter Auto-Banning** | Auto-strip posting privileges for repeated Dustbin triggers. |
| 78 | **Clean Redirect Scripts** | `/go?store=nike` instead of messy tracking strings. |
| 79 | **Regular DB Maintenance** | Purge stale/archived text from public indexes. |
| 80 | **Cloudflare WAF** | Block scraping attacks. |

---

## 🚀 Category 9: Strategic Monetization & Ad Placement

| # | Criterion | Implementation |
|---|-----------|---------------|
| 81 | **Balanced Ad-to-Content Ratio** | Ads secondary to functional codes. |
| 82 | **No Layout Shifts from Ads** | Fixed aspect-ratio containers for banners. |
| 83 | **Explicit Affiliate Disclosures** | Commission statements in header/footer. |
| 84 | **Clean Code Copy Interactions** | No pop-up ads to reveal a code. |
| 85 | **Affiliate Link Verification** | Regular audit of destination links. |
| 86 | **Non-Disruptive Mobile Banners** | No anchor ads blocking tap targets. |
| 87 | **Fast Ad Script Delivery** | Deferred loading for third-party monetization. |
| 88 | **User-Friendly Freemium** | Free search remains accessible to bots. |
| 89 | **Contextual Ad Relevance** | Ads correlate to shopping/tech/deals. |
| 90 | **Compliant Tracking** | Cookie consent banner. |

---

## 🎯 Category 10: Advanced Next.js & Modern Search Innovation

| # | Criterion | Implementation |
|---|-----------|---------------|
| 91 | **Dynamic Metadata API** | `generateMetadata` function renders OG attributes from MongoDB. |
| 92 | **Optimized Font Injections** | `next/font` hosts Poppins locally — no external render-blocking requests. |
| 93 | **SSR Fallback Profiles** | Graceful cached output to crawlers during DB lag. |
| 94 | **Sitemap Paging** | Paginate sitemaps under 50,000 URLs per file. |
| 95 | **Custom OG Image Generation** | Dynamic social sharing cards showing deal counts. |
| 96 | **Edge Middleware** | Geolocation checks at Vercel Edge for regional routing. |
| 97 | **Stale-While-Revalidate** | Serve static assets instantly, check updates in background. |
| 98 | **Structured List Schema** | Package code groups in schema arrays for SERP listings. |
| 99 | **Canonical Cross-Link Architecture** | Global and country folders declare cross-link metadata. |
| 100 | **Continuous Core Web Vitals Monitoring** | Track via Vercel Analytics / Google Search Console. |

---

> Every component, page, API route, and configuration file in this project must be audited against these 100 criteria before deployment.
