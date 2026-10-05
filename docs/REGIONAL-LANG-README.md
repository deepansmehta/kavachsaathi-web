# Regional Languages

KavachSaathi supports multilingual display for the emergency page and activation labels.

## Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Production-ready |
| `hi` | Hindi (हिंदी) | ✅ Production-ready |
| `pa` | Punjabi (ਪੰਜਾਬੀ) | ⚠️ Machine-drafted — needs native review |
| `bn` | Bengali (বাংলা) | ⚠️ Machine-drafted — needs native review |
| `gu` | Gujarati (ગુજરાતી) | ⚠️ Machine-drafted — needs native review |
| `mr` | Marathi (मराठी) | ⚠️ Machine-drafted — needs native review |
| `ta` | Tamil (தமிழ்) | ⚠️ Machine-drafted — needs native review |
| `te` | Telugu (తెలుగు) | ⚠️ Machine-drafted — needs native review |
| `kn` | Kannada (ಕನ್ನಡ) | ⚠️ Machine-drafted — needs native review |

## ⚠️ Important Notice for Non-EN/HI Languages

Translations for `pa`, `bn`, `gu`, `mr`, `ta`, `te`, `kn` were **machine-drafted** using AI translation and have **NOT been reviewed by native speakers**. They may contain:

- Grammatical errors
- Incorrect medical terminology
- Awkward phrasing

**Before enabling any language in production, it MUST be reviewed and approved by a fluent native speaker with medical vocabulary familiarity.**

## How to Enable

Set the `regionalLang` feature flag to `true` in Admin → Feature flags.

When enabled:
1. The language is auto-detected from the browser's `navigator.language`
2. A manual switcher appears on the emergency page
3. User's preference is saved in `localStorage` as `kavach_lang`

When disabled:
- Only English (and legacy Hindi) behavior is preserved
- No language switcher is shown

## Locale Files

Files are in `/locales/*.json`. Keys match the `DictKey` type in `src/lib/i18n-emergency.ts`.

## Adding a New Language

1. Create `/locales/<code>.json` with all keys from `en.json`
2. Add the language code to the `SUPPORTED_LANGS` array in the i18n module
3. Mark translations with `"_machineTranslated": true` until reviewed
4. Update this README

## User Data Is Never Translated

Patient names, medical conditions, medications, and all user-entered data are **never machine-translated**. Only UI labels and static strings are localized.

---
*Feature gated by `regionalLang` flag.*
