# KavachSaathi — Production Go-Live Checklist

Firebase project: **kavachsaathi** · Site: **https://kavachsaathi.in**  
App path: `KAVACHSAATHI WEBSITE PORTAL/kavachsaathi`

Do **not** re-seed or overwrite the existing 100 production `cards` documents.

---

## A. Firebase Console — Auth providers

| Provider | Required? | Action |
|----------|-----------|--------|
| **Google** | **YES** | Enable — used by `/admin` (GDM team) |
| **Phone** | **NO** | Safe to **disable** — activation uses packaging `activation_code` + bcrypt PIN; `/my-profile` looks up phone as a **string field**, not Phone Auth OTP |
| Email/Password | No | Leave disabled unless you add it later |
| Anonymous | No | Leave disabled |

### Authorized domains (Authentication → Settings → Authorized domains)

Add / confirm:

1. `localhost` (local `npm run dev`)
2. `kavachsaathi.in`
3. `www.kavachsaathi.in` (if used)
4. Your Netlify site domain, e.g. `*.netlify.app` / the specific `something.netlify.app` hostname

---

## B. Firebase Console — Firestore

1. Confirm collections exist: `cards` (100 docs), and that `profiles` / `rate_limits` will be created by the app at runtime.
2. Deploy security rules from this repo:

```bash
cd "KAVACHSAATHI WEBSITE PORTAL/kavachsaathi"
firebase use kavachsaathi
firebase deploy --only firestore:rules
```

3. Rules deny all client access to `cards`, `profiles`, `rate_limits`. Access is Admin SDK only via Next.js API routes.

---

## C. Netlify environment variables

Copy from `.env.example`. **Required for production:**

### Firebase client
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `kavachsaathi`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### URLs
- `NEXT_PUBLIC_BASE_URL` = `https://kavachsaathi.in`
- `NEXT_PUBLIC_APP_URL` = `https://kavachsaathi.in`
- `NEXT_PUBLIC_SITE_URL` = `https://kavachsaathi.in`

### Firebase Admin (server) — one of:
- `FIREBASE_ADMIN_PROJECT_ID` + `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY`  
  **or**
- `FIREBASE_SERVICE_ACCOUNT_KEY` (full JSON string)

### Auth / sessions
- `ADMIN_EMAILS` — comma-separated GDM Google emails
- `NEXT_PUBLIC_ADMIN_EMAILS` — same list (client allowlist UI)
- `PROFILE_SESSION_SECRET` — long random string (HMAC for `/my-profile` cookies)

### Optional
- `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_LAUNCH_DATE`
- `GMAIL_APP_PASSWORD` (legacy forgot-PIN email flow)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`

---

## D. Deploy app

1. Push repo → Netlify build (`netlify.toml`).
2. Confirm custom domain `kavachsaathi.in` SSL is active.
3. Hit `https://kavachsaathi.in/card/KVS-2026-75QW6` (should show **activation** form while still unactivated — do not complete activation in prod smoke unless intentional).

---

## E. QR print sheet (real 100 cards)

```bash
npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/export-qr-urls.ts
```

Output: `qr-urls-100.csv` with  
`https://kavachsaathi.in/card/{health_id}` for each card.

Print / encode those URLs into the physical QR stickers.  
`activation_code` stays on packaging only — never next to the QR.

---

## F. Automated smoke test (safe — uses disposable test card)

With `npm run dev` running:

```bash
SMOKE_BASE_URL=http://localhost:3000 npx ts-node --skipProject \
  --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
  scripts/smoke-test.ts
```

Creates / tests / **deletes** `KVS-2099-SMK01` (`cards/9999`) only — does not touch `0001`–`0100`.

---

## G. Final manual verification

1. [ ] Google Auth works on `/admin` for an allowlisted email  
2. [ ] Phone Auth provider disabled (or confirmed unused)  
3. [ ] Firestore rules deployed  
4. [ ] Netlify env vars set  
5. [ ] Smoke test all green  
6. [ ] QR CSV exported for print vendor  
7. [ ] One real card scanned on phone → activation form loads  
8. [ ] After a **test** activation (or staging card), same QR shows emergency view  
9. [ ] `/my-profile` login with PIN works; wrong PIN locks after rapid failures  

---

## Phone Auth verdict

**Phone Auth can be fully disabled in Firebase Console.**

- Activation: packaging `activation_code` + bcrypt PIN (`/api/card/activate`) — no OTP.  
- `/my-profile`: phone is a stored profile field for lookup + PIN verify — not Firebase Phone Auth.  
- Legacy `/activate/[health_id]` OTP page now **redirects** to `/card/[health_id]`.  
- Deprecated `/api/activate-card` returns **410**.  
- Doctor portal `OTPInput` is only a **4-box UI** for typing activation codes — not Firebase Phone Auth.
