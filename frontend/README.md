# Baari — frontend

Next.js 15 + Tailwind + shadcn + Motion. Currently only the **landing page**.
Signup, login, queue dashboard, etc. still live in the Python/HTMX app at the
project root and are linked to from the buttons here.

## Stack

- Next.js 15 (App Router) on React 19
- TypeScript
- Tailwind CSS 3.4 with shadcn-style semantic CSS variables
- shadcn `Button` (added directly under `components/ui/`)
- Motion (Framer Motion) for hero + scroll-reveal animations
- `next-themes` for the OS-aware light/dark toggle
- Lucide for icons
- Inter + Noto Sans Devanagari from `next/font/google`

## First run

```bash
cd frontend
cp .env.example .env.local
npm install         # or pnpm install / bun install
npm run dev         # http://localhost:3000
```

The signup / "Sign in" buttons point at `NEXT_PUBLIC_APP_URL`. While the Python
app is running locally on port 8000, set that env var to `http://localhost:8000`.
In production it's `https://baariprod.vercel.app` (or your custom domain).

## Build for production

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push to GitHub.
2. In Vercel, **Add New → Project** → import the same `Baari` repo.
3. Set **Root Directory** to `frontend`.
4. Framework preset: Next.js (auto-detected).
5. Add environment variable `NEXT_PUBLIC_APP_URL` = your Python backend URL.
6. Deploy.

You now have two Vercel projects pointing at the same repo:
- The original (Python serverless) → handles `/signup`, `/login`, `/queue`, etc.
- This one (Next.js) → handles the marketing landing.

Pushes that touch only `frontend/**` only rebuild this project. Pushes that
touch only `api/**` / `app/**` only rebuild the Python project. They're
independent.

## Directory layout

```
frontend/
├── app/
│   ├── layout.tsx              Root layout, fonts, theme provider
│   ├── page.tsx                The landing page (composes sections)
│   └── globals.css             Tailwind base + design tokens
├── components/
│   ├── ui/
│   │   └── button.tsx          shadcn Button (with a "glow" variant)
│   ├── sections/
│   │   ├── hero.tsx            Hero with gradient headline + orbs
│   │   ├── verticals.tsx       6-up business-type chips
│   │   ├── features.tsx        Feature grid with hover glow
│   │   └── cta-closing.tsx     Closing CTA card
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── theme-provider.tsx      next-themes wrapper
│   └── theme-toggle.tsx        Sun/moon icon button
├── lib/
│   └── utils.ts                The cn() helper
└── public/                     Static assets
```
