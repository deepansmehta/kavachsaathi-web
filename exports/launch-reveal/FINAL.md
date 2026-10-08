# Launch Reveal — FINAL (locked)

**Status:** production final · do not tweak timings/visuals without owner sign-off

| | |
|---|---|
| Commit | `5840685` |
| Deploy | `6ac790d66d383f8762c77840` |
| Rollback | `6ac78fccee85dad2dae943ff` |
| Live | https://kavachsaathi.in |
| Owner replay | https://kavachsaathi.in/?replayLaunch=1 |

## Locked behaviour
- Auto playback, no Skip/Next/Replay
- Launch day only: **11 Oct 2026, 12:00–23:59 IST**, once per browser
- Never on `/card/*` and other protected routes
- Price scene = gold **KAVACH · JACKPOT** slot (no MRP / was / original)
- Spins: sharp digits, no blur overlay; ₹499 land + stamp
- Order → Firestore `orders`; **Go to Home** ends reveal + marks seen
- `?replayLaunch=1` owner-only before/after launch

## Screenshots
`01`–`07` (reference timing) · `live-01` / `live-05` / `live-07` · `reference.html`
