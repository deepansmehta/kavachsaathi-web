# KavachSaathi Web — Smart Health Card

Single adaptive QR · Next.js 14 · Firebase Admin SDK APIs · Netlify  
**GDM Technoworld** · [kavachsaathi.in](https://kavachsaathi.in)

> Full production checklist: see **[GOLIVE.md](./GOLIVE.md)**

## Product rule

One unchanging QR per card:

```
https://kavachsaathi.in/card/{health_id}
```

| Status | `/card/[health_id]` |
|--------|---------------------|
| `unactivated` | Activation form (`activation_code` + health fields + 4–6 digit PIN) |
| `activated` | Public emergency profile |

Do **not** re-seed the existing 100 `cards` documents.

## Quick start

```bash
cp .env.example .env.local
# fill values (or add service-account.json for Admin SDK)
npm install
npm run dev
```

## Auth providers (Firebase Console)

| Provider | Needed? |
|----------|---------|
| **Google** | Yes — `/admin` |
| **Phone** | **No** — safe to disable (no OTP; phone is a plain profile field) |

Authorized domains: `localhost`, `kavachsaathi.in`, `www.kavachsaathi.in`, Netlify host.

## Deploy

### 1. Firestore rules

```bash
firebase use kavachsaathi
firebase deploy --only firestore:rules
```

`cards`, `profiles`, and `rate_limits` are **deny-all** for clients. Access is Admin SDK only via API routes (`/api/card/activate`, `/api/cards`, `/api/emergency`, `/api/admin`, `/api/profile/*`).

### 2. Netlify

1. Import Git repo (build via `netlify.toml`).
2. Set every variable from `.env.example` (production URLs → `https://kavachsaathi.in`).
3. Required secrets: Firebase Admin credentials, `ADMIN_EMAILS`, `PROFILE_SESSION_SECRET`.
4. Attach domain `kavachsaathi.in`.

### 3. Smoke test (disposable card only)

```bash
# terminal 1
npm run dev

# terminal 2
SMOKE_BASE_URL=http://localhost:3000 npx ts-node --skipProject \
  --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
  scripts/smoke-test.ts
```

Uses `KVS-2099-SMK01` / `cards/9999` then deletes it — never touches `0001`–`0100`.

### 4. QR CSV for print

```bash
npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/export-qr-urls.ts
```

## Key routes

| Route | Purpose |
|--------|---------|
| `/card/[health_id]` | Adaptive QR target |
| `/my-profile` | PIN login · edit · forgot PIN |
| `/admin` | Inventory · deactivate · reset PIN · CSV |
| `/api/card/activate` | Atomic activation (bcrypt PIN) |

## Security

- No Firebase Phone Auth / OTP in the live QR flow
- PIN stored as bcrypt `pin_hash`
- Activation uses Firestore `runTransaction`
- Rate limits + CAPTCHA on card activate & profile login
