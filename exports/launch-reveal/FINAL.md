# Launch Reveal — FINAL (complete spec)

**Status:** production final for 11 Oct 2026 launch day

## Behaviour
- Paths: `/` and `/coming-soon` only (never `/card/*`, `/e/*`, `/api/*`, …)
- Clock: **server** via `/api/time` + `/api/launch-reveal/status`
- Window: **11 Oct 2026, 12:00:00–23:59:59 IST**; from **12 Oct 00:00 IST** bundle never loads
- Once per browser (`kavach_launch_reveal_seen_v1`); no Skip/Next/Replay/dots
- `/coming-soon`: when server countdown hits zero → auto-play reveal → poll 2s × 60s → `/`
- Scenes: Reveal 6.5s → Brothers 10s → Leadership 7.5s → Slot 11.5s → Order (stays)
- Slot: ₹2999 → ₹1999 → ₹999 → ₹499 (teasers only — never MRP/was/original)
- Orders: `KS-ORD-*`, `addressEnc`, status `requested`, rate 5/h/IP, captcha after 3
- Admin: `/admin/orders` (+ CSV without address)
- Permanent `/order` + header/homepage **Order now**

## Owner rehearsal (phone)
1. Open preview: `https://kavachsaathi.in/?preview=<PRELAUNCH_PREVIEW_SECRET>`  
   (secret is in Netlify env — never paste it in chat)
2. Then open: `https://kavachsaathi.in/?replayLaunch=1`
3. Watch 30s countdown → full 5 scenes
4. On order form: submit shows **Demo — not saved** (no Firestore write)
5. Tap **Go to Home Page** to exit

Works **only before 11 Oct 12:00 IST** and **only with** the preview cookie.

## Rollback
Previous stable prod before this release — record at deploy time in the report.
