import { Metadata } from "next";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsActivated,
  cardIsBlocked,
  findCardByHealthId,
  loadEmergencyProfile,
} from "@/lib/cardsRepo";
import { isValidHealthId, normalizeHealthId, INVALID_CARD_MESSAGE } from "@/lib/healthId";
import { checkRateLimit } from "@/lib/rateLimit";
import { makeScanToken } from "@/lib/scanToken";
import { CardClient } from "./CardClient";

interface PageProps {
  params: { health_id: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "KavachSaathi Card",
    description: "Smart Health Card — Protect · Inform · Save",
    robots: { index: false, follow: false },
  };
}

/**
 * Single adaptive QR target:
 * https://kavachsaathi.in/card/{health_id}
 * — unactivated → activation form
 * — blocked → neutral blocked message (no medical data)
 * — activated → public emergency view
 */
export default async function CardPage({ params }: PageProps) {
  const healthId = normalizeHealthId(
    decodeURIComponent(params.health_id || "")
  );

  if (!isValidHealthId(healthId)) {
    return <CardClient mode="invalid" message={INVALID_CARD_MESSAGE} />;
  }

  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  try {
    const db = getAdminDb();
    const rl = await checkRateLimit({
      key: `card-page:${ip}`,
      limit: 50,
      windowMs: 60_000,
      captchaAfter: 20,
      db,
    });

    if (!rl.allowed) {
      return (
        <CardClient
          mode="rate"
          message="Too many requests from this network. Wait a minute and try again."
        />
      );
    }

    const card = await findCardByHealthId(db, healthId);
    if (!card) {
      return <CardClient mode="invalid" message={INVALID_CARD_MESSAGE} />;
    }

    if (cardIsBlocked(card)) {
      return <CardClient mode="blocked" />;
    }

    if (!cardIsActivated(card)) {
      return <CardClient mode="unactivated" healthId={healthId} />;
    }

    const profile = await loadEmergencyProfile(db, card);
    if (profile) {
      profile.health_id = healthId;
      try {
        const { isStorageConfigured, getSignedGetUrl } = await import(
          "@/lib/storage"
        );
        const path = profile.photo_url;
        if (
          isStorageConfigured() &&
          path &&
          !path.startsWith("http") &&
          path.includes("/")
        ) {
          profile.photoSignedUrl = await getSignedGetUrl({
            path,
            expiresMs: 5 * 60_000,
          });
        } else if (path?.startsWith("http")) {
          profile.photoSignedUrl = path;
        }
      } catch {
        /* storage optional until bucket exists */
      }
    }
    const scanToken = makeScanToken(healthId);
    return (
      <CardClient
        mode="activated"
        scanToken={scanToken}
        profile={profile}
        message={
          profile
            ? undefined
            : "This card is activated but the profile could not be loaded."
        }
      />
    );
  } catch (e) {
    console.error("card page", e);
    return (
      <CardClient
        mode="invalid"
        message="Service temporarily unavailable. Please try again."
      />
    );
  }
}
