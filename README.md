# CodeXhange — The Gamified Promo & Discount Code Library

CodeXhange is a community-driven, self-cleaning search engine and library for active promo codes and discount codes. Unlike traditional coupon sites littered with expired codes, CodeXhange uses a **"Fuel Economy"** to incentivize users to curate, verify, and share working discounts.

---

## The Core Problem

1. **Demand vs. Supply** — Why share a public promo code if you get no reward when someone else uses it?
2. **The Dustbin Effect** — Promo codes expire fast. Traditional sites keep dead codes active, frustrating users and ruining SEO.
3. **Traffic Monopolies** — On forums, the first poster dominates traffic. No room for new contributors.

---

## The Solution: Fuel Economy

A gamified token called **Fuel** powers the entire platform.

### Earning Fuel

| Action | Fuel | Why |
|--------|------|-----|
| Refer a friend | 100 | Drives the ecosystem |
| Vote on a code | 10 | Keeps the database clean |
| Submit a code | 5 | Adds fresh supply (kept low to prevent spam) |

### Burning Fuel (Boosts)

Merchants and affiliates burn Fuel to pin promo codes to the top of brand pages.

| Boost Type | Cost | Duration |
|------------|------|----------|
| Micro-Cap | 50 Fuel | 15 clicks then auto-ends |
| Mega-Cap | 500 Fuel | 7 days pinned |

---

## SEO Strategy — Subdirectory Architecture

Single domain (`codexhange.com`) consolidates all Domain Authority:

- **Global:** `/brand/[brand-name]` (e.g., `/brand/nordvpn`)
- **Localized:** `/[country-code]/brand/[brand-name]` (e.g., `/ng/brand/uber`)

### SEO Features

- **ISR (Incremental Static Regeneration):** Brand pages are static HTML served instantly. Revalidated every 10 minutes (`revalidate: 600`).
- **Dynamic Meta Tags:** Server-generated titles (`"Active Uber Codes in Nigeria (July 2026)"`) and OpenGraph tags.
- **Hreflang Tags:** Auto-injected for regional pages.
- **Cloudflare Cache:** Static pages, images, and scripts served from Cloudflare's edge — zero serverless cost for 95% of traffic.

---

## Security & Anti-Abuse

### Two-Tier Approach

1. **Cloudflare Turnstile (Network Level):** Silent bot detection on sign-up and code submission.
2. **Hash Fingerprinting (Application Level):** Unique browser/device hash stored per user — prevents multi-account farming behind VPNs even when Turnstile passes.

### The Dustbin (Auto-Quality Control)

Every code has a "Did this work? Yes/No" prompt.
- If a code gets **5+ negative votes** AND a **<30% success rate**, it's automatically archived.
- Search engines only index active, accurate pages.

---

## Auth Strategy — No Login Wall for Shoppers

Two distinct audience groups:

1. **Shoppers (No Auth Required):** Browse pages, copy codes freely. Googlebot crawls without blockage. SEO first.
2. **Contributors (Auth Required):** Must sign in to submit codes, vote, or boost. Uses **NextAuth.js** with Google OAuth + email magic links.

### Why NextAuth.js?
- Built for Next.js with pre-built MongoDB adapter.
- Auto-creates Users, Accounts, Sessions collections.
- Secure session tokens for API routes.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **Database** | MongoDB (Mongoose ODM) |
| **Auth** | NextAuth.js v4 (Google + Email providers, DB sessions) |
| **Styling** | Tailwind CSS 3.4 (glassmorphism design system) |
| **Font** | Poppins (Google Fonts, self-hosted via next/font) |
| **Deployment** | Vercel (recommended) or Heroku |
| **CDN/Cache** | Cloudflare (DNS, Turnstile, caching) |

---

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Design system (glass, btn, input, auth-card components)
│   ├── layout.tsx           # Root layout — Poppins, SessionProvider, Navbar
│   ├── page.tsx             # Landing page — hero, how it works, popular brands
│   ├── auth/
│   │   ├── layout.tsx       # AuthLayout wrapper (glass auth card)
│   │   ├── login/page.tsx   # Google OAuth + magic link sign in
│   │   └── register/page.tsx# Google OAuth sign up
│   ├── brand/
│   │   └── [slug]/page.tsx  # ISR brand page — dynamic OG/meta, hreflang-ready
│   ├── dashboard/page.tsx   # Fuel balance, transaction history
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── codes/route.ts           # GET (public, filterable) + POST (auth, +5 Fuel)
│       ├── codes/[id]/vote/route.ts # Up/down vote + Dustbin auto-archive
│       ├── fuel/route.ts            # Balance + transaction history
│       └── fuel/boost/route.ts      # Micro (50 Fuel/15 clicks) / Mega (500 Fuel/7 days)
├── components/
│   ├── Logo.tsx
│   ├── Navbar.tsx
│   ├── auth/AuthLayout.tsx
│   └── ui/ (Button, Input, Card, Modal, Toast, ThemeToggle)
└── lib/
    ├── SessionProvider.tsx
    ├── mongodb.ts            # Native MongoDB client (for NextAuth adapter)
    ├── mongoose.ts           # Mongoose connection (cached singleton)
    ├── auth.ts               # NextAuth config
    └── models/ (User.ts, Code.ts, FuelLedger.ts)
```

---

## MongoDB Schemas

### User
```
{ name, email, emailVerified, image, fuelBalance, fingerprintHash }
```

### Code
```
{ code, brand, brandSlug, description, discount, link, scope (global|local),
  country, submittedBy, upvotes, downvotes, clicks,
  boosted, boostedUntil, boostClicksUsed, boostClicksLimit,
  archived, archivedAt }
```
Indexes: `{brandSlug, scope, country}`, `{brandSlug, archived, boosted}`

### FuelLedger
```
{ userId, amount, type (earned|spent), reason (referral|vote|submission|boost|bonus), reference }
```
Index: `{userId, createdAt}`

---

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import repo into Vercel
3. Set env vars: `MONGODB_URI`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
4. Deploy — ISR works natively

### Heroku
```
web: npm start
```
- Requires `next.config.js` with `output: 'standalone'` (already configured)
- Set same env vars + `NEXTAUTH_URL`

### Cloudflare
- Put Cloudflare in front of Vercel/Heroku
- Cache static pages at the edge
- Use Turnstile for bot protection

---

## Design System

- **Colors:** Amber/orange brand palette (`brand-500: #f59e0b`)
- **Dark/Light:** CSS custom properties with `.light` class toggle
- **Components:** `.glass`, `.glass-card`, `.btn-primary`, `.btn-glass`, `.input-glass`, `.auth-card`
- **Border Style:** Asymmetric — `border-top-left-radius` + `border-bottom-right-radius` only
- **Performance:** Zero JS animation overhead. All transitions via CSS. No Framer Motion, no Lenis.

---

## Development

```bash
npm install          # Install dependencies
cp .env.example .env # Fill in your env vars
npm run dev          # Start dev server (localhost:3000)
npx tsc --noEmit     # Type check only
npm run build        # Production build
npm start            # Start production server
```

---

## Roadmap

| Phase | Timeline | Features |
|-------|----------|----------|
| **1** | Weeks 1-4 | Next.js scaffold, MongoDB schemas, ISR brand pages, code submission API, GitHub/Heroku pipeline |
| **2** | Weeks 5-8 | Voting mechanism, Dustbin auto-archive, Fuel dashboard, Boost interface |
| **3** | Weeks 9-11 | Cloudflare Turnstile, browser fingerprinting, rate limiting |
| **4** | Weeks 12+ | Dynamic sitemaps, hreflang automation, affiliate link monetization |

---

## License

MIT
