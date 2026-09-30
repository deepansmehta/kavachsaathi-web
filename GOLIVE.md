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
- `PROFILE_SESSION_SECRET` — long random string (HMAC for `/my-profile` cookies) — **do not rotate casually** (logs everyone out)
- `PROFILE_ENC_KEY` — 32-byte key as base64 (`openssl rand -base64 32`) for AES-256-GCM PII at rest — **back up offline**

### Firebase Storage (same project)
- `FIREBASE_STORAGE_BUCKET` = `kavachsaathi.firebasestorage.app`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = `kavachsaathi.firebasestorage.app`

### Optional
- `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_LAUNCH_DATE`
- `GMAIL_APP_PASSWORD` (legacy forgot-PIN email flow)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`

---

## C2. Storage + rules

Bucket: `gs://kavachsaathi.firebasestorage.app` (asia-south1), public access prevention ON, uniform ACL ON, CORS for kavachsaathi.in + localhost.

```bash
firebase deploy --only firestore:rules,storage --project kavachsaathi
```

- `storage.rules`: deny all client read/write (Admin SDK + signed URLs only)
- `firestore.rules`: deny client access to `cards`, `profiles`, `accessLogs`, `rate_limits`, and default catch-all

---

## D. Deploy app

1. Push repo → Netlify build (`netlify.toml`).
2. Confirm custom domain `kavachsaathi.in` SSL is active.
3. Hit `https://kavachsaathi.in/card/KVS-2026-75QW6` (should show **activation wizard step 1** while still unactivated — do not complete activation in prod smoke unless intentional).

### Rollback (Full Details release)

- Previous production deploy ID: `6abd05dd030f756edf0595c2` (`pre-full-details` tag → commit on `main` before this release)
- Current production deploy ID (Full Details): `6abd39800461b9ad320559b4`
- Git tag: `pre-full-details`

```bash
# Netlify UI: Deploys → publish previous deploy, OR:
netlify api restoreSiteDeploy --data '{"site_id":"ace40397-cda8-481a-8e87-f748c4413a18","deploy_id":"6abd05dd030f756edf0595c2"}'
```

Firestore/storage rules can stay (stricter). Env vars stay.

---

## D2. Activation flow (7 steps)

On `/card/{health_id}` when unactivated:

1. Activation code → 15-min activation session cookie  
2. Medical / emergency contacts  
3. Photo (required, camera capture)  
4. Exactly 2 different ID proofs (Aadhaar = last 4 only)  
5. Address + address proof  
6. Insurance (private / government / both)  
7. Consents (EN+HI) + PIN → activate  

Uploads use V4 signed PUT URLs; files land in `pending/` then move to `profiles/{health_id}/`.

---

## D3. Open Full Details (hospital admission)

Public emergency view shows photo + insurer/scheme names only.  
**Open Full Details** modal:

- **PIN path**: full IDs, address, insurance docs (5-min signed GET URLs), 10-min session  
- **Emergency hospital path**: limited insurance/admission data only; logged to `accessLogs`  
- Document previews watermarked; Cache-Control: no-store  

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
