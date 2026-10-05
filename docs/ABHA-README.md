# ABHA (Ayushman Bharat Health Account) Integration

## Current Status

KavachSaathi stores an optional ABHA number in the user profile. When the `abhaLink` feature flag is **ON**, the Full Details modal (PIN scope only) displays:

- The ABHA number (shown in `XX-XXXX-XXXX-XXXX` formatted form)
- A QR code encoding the ABHA number for quick scanning
- A copy button

## What ABHA Is

ABHA (Ayushman Bharat Health Account) is a 14-digit unique health ID issued by the National Health Authority (NHA) of India. It forms the backbone of the Ayushman Bharat Digital Mission (ABDM).

- **Official site**: https://abdm.gov.in
- **Create ABHA**: https://healthid.ndhm.gov.in

## For Full ABDM Integration

Full integration with ABDM's FHIR-based health records requires:

1. **NHA Registration** as a Health Repository Provider (HRP) or Health Locker.
2. Obtaining API credentials from NHA.
3. Implementing ABDM Gateway APIs for PHR linking, consent management, and health record exchange.
4. Undergoing NHA security audit and go-live approval.

This is a substantial backend integration and **is NOT implemented in this MVP**. The current implementation stores the ABHA number provided by the user, encrypts it at rest (AES-256-GCM), and displays it in the PIN-gated Full Details view only.

## Data Model

The ABHA ID is stored as `abhaIdEnc` (AES-256-GCM encrypted) in the profile document. The legacy field `abhaId` (plain text) is migrated on first profile save.

## Privacy Note

ABHA numbers are considered sensitive PII and are:
- **Never** shown on the public emergency page
- **Only** shown in Full Details with valid PIN
- **Encrypted at rest** in Firestore
- **Never** transmitted to third parties

---
*This README is for internal reference. Feature gated by `abhaLink` flag.*
