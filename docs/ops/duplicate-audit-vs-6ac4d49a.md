# Duplicate-code audit vs deploy `6ac4d49a0c3f38c88730a4a2`

Compared uncommitted working tree Patient Ease modules to git `HEAD` (`aa5f8f4`, the codebase state that deploy `6ac4d49a` was built from).

## Re-implemented / renamed Patient Ease files (working tree vs HEAD)

| File | Verdict |
|------|---------|
| `src/lib/patientEase/coverage.ts` | Renamed rewrite (`parseCoverage`→`emptyCoverageSnapshot`/`validateCoverageSnapshot`, `roomTip`→`roomRentTip`). **Kept** — wired by `/api/coverage` + PDF. |
| `src/lib/patientEase/billLetter.ts` | Renamed rewrite (`billLetterEnglish`→`buildEnglishLetter`, `NOT_LEGAL_ADVICE`→`BILL_LETTER_DISCLAIMER`). **Kept** — wired by API + PDF. |
| `src/lib/patientEase/claimDeadline.ts` | Renamed rewrite (`claimCountdown`→`computeClaimCountdown`, etc.). **Kept** — wired by `/api/claim-deadline`. |
| `src/lib/patientEase/dischargeChecklist.ts` | Renamed rewrite (`progress`/`itemsForMode`→`checklistProgress` + `CASHLESS_ITEMS`). **Kept** — wired by API. |
| `src/lib/patientEase/attendantPass.ts` | Renamed rewrite (`createAttendantToken`→`createRawToken`/`createAttendantPass`). **Kept** — wired by API; `hashAttendantToken` alias retained. |
| `src/lib/patientEase/documentPack.ts` | Expanded sections + `allowed` rate-limit shape. **Kept** — wired by API + PDF. |
| `src/lib/patientEase/officialLinks.ts` | Additive (`E_RAKT_KOSH`, `JAN_AUSHADHI_INFO`). **Kept** — real enrichment, not a duplicate. |
| `src/lib/patientEase/pdfs/*.ts` | Updated to new helper names / `{bytes,headers}` returns. **Kept** — matches current libs. |
| `src/lib/patientEase/doctorSummary.ts` | **New** (not in HEAD). **Kept** — required by `/api/doctor-summary`. |
| `src/lib/patientEase/followUp.ts` | **New** (not in HEAD). **Kept** — required by `/api/follow-up` + Pack2 UI. Overlaps calendar helpers in `helpers.ts` but different types/consumers — not a pure duplicate. |

## Pure duplicates reverted

None. Reverting the renamed modules would break the already-updated Pack 2 API routes and UI that import the new names. No file was an unused copy of an identical module.

## Test fix

`scripts/test-patient-ease.ts` updated to call **current** export names and PDF shapes (no feature-behaviour changes).
