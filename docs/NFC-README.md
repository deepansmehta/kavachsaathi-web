# NFC (Near Field Communication) Integration

KavachSaathi supports optional NFC tags embedded in or attached to physical cards. When an NFC-enabled phone taps the card, it opens the emergency page directly — no QR scan needed.

## How It Works

1. Each card has a URL: `https://kavachsaathi.in/card/<HEALTH_ID>`
2. This URL is written as an **NDEF URI record** to the NFC chip.
3. When tapped, Android/iOS launches a browser automatically.

## Admin Setup

1. Go to **Admin → NFC** (`/admin/nfc`) — requires `nfcInfo` feature flag ON.
2. Find the card by serial number.
3. Click **Copy URL** to copy the exact URL for that card.
4. Enable NFC for the card (optional toggle for tracking).

## Writing NFC Tags

### Required hardware
- NFC-capable phone (most Android phones; iPhones ≥ XS)
- Blank NFC tag (NTAG213 recommended — 144 bytes, ≈ 137 bytes for data — enough for a URL ≤ 120 chars)

### Android (NFC Tools / NFC TagWriter)

1. Install **NFC Tools** (by wakdev) — free on Play Store.
2. Open app → **Write** → **Add a record** → **URL / URI**.
3. Paste the card URL (e.g. `https://kavachsaathi.in/card/KVS-2026-12345`).
4. Tap **Write** and touch the NFC tag.

### iOS (NFC Tools)

1. Install **NFC Tools** (same app, App Store).
2. Same steps as Android above.

### Alternative: TagWriter by NXP

1. Install **TagWriter by NXP** from Play Store.
2. **Write tags** → **New dataset** → **URI / URL** → paste URL.
3. Tap **Save and Write** → tap tag.

## URL Format

```
https://kavachsaathi.in/card/<HEALTH_ID>
```

Example: `https://kavachsaathi.in/card/KVS-2026-12345`

The URL length is ≈ 50–55 characters, well within NTAG213 capacity.

## Security

- NFC contains **only the public URL** — the same URL printed as QR code.
- No health data, PIN, or encryption key is stored on the NFC chip.
- Accessing health data still requires PIN or hospital emergency attestation.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Phone doesn't read tag | Enable NFC in phone Settings → Connected devices |
| iOS doesn't open URL | iPhone XS+ required; use NFC Tools app to write and test |
| URL doesn't fit | Use short serial: `KVS-2026-XXXXX` = 31 chars + domain ≈ 55 total — fits fine |
| Tag writes but URL wrong | Re-write using NFC Tools; use Copy button in Admin → NFC for exact URL |

---
*Feature gated by `nfcInfo` flag. See `/admin/nfc` for card-specific NFC URLs.*
