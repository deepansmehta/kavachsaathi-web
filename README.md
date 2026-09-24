# KavachSaathi v2

India's first smart PVC health card — complete web app.  
**GDM Technoworld Pvt. Ltd.** · [kavachsaathi.in](https://kavachsaathi.in)

## Stack

Next.js 14 · Firebase Auth (Phone OTP) · Firestore · Tailwind · Framer Motion · next-pwa · Razorpay · react-hot-toast

## Quick start

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

## Deploy (Netlify + GoDaddy)

1. Push this repo to GitHub.
2. [Netlify](https://app.netlify.com) → Add new site → Import from Git → select this repo.
3. Build uses `netlify.toml` (`npm run build` + `@netlify/plugin-nextjs`).
4. Site settings → Environment variables — copy all keys from `.env.local.example` (production values).
   Set `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_URL` to `https://kavachsaathi.in`.
5. Domain management → Add `kavachsaathi.in` + `www`.
6. GoDaddy DNS → Netlify will show the exact records (usually Netlify DNS nameservers, or A/CNAME to Netlify).

## Demo mode (no Firebase)

| Action | How |
|--------|-----|
| Activate | Code `0042` / `DEMO` → OTP `123456` |
| Login | Any phone → OTP `123456` |
| Emergency | `/e/0042` |
| Doctor | Search `0042` |

## Pages

| Route | Notes |
|-------|--------|
| `/` | Landing (auto → `/dashboard` if logged in) |
| `/activate` | Code → Phone OTP → Health form + draft save |
| `/e/[code]` | **Pure SSR** emergency page, 72px blood group |
| `/login` | Phone OTP + 30s resend |
| `/dashboard` | Summary, scans, PWA banner |
| `/profile/edit` | Full medical editor |
| `/my-card` | PVC card + QR + share |
| `/scan-history` | Timeline |
| `/doctor` | Patient lookup + visit notes |
| `/order` | ₹199 / ₹299 + Razorpay |

## Critical rules baked in

- Never white bg (min `#111` / `#080808`)
- `initPersistentAuth()` + `kavach_session` cookie + middleware
- `/e/[code]` server-only; scan logged without blocking render
- Activation draft in `localStorage`
