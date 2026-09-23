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
