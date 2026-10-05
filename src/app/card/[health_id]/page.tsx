import { Metadata } from "next";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  cardIsActivated,
  cardIsBlocked,
  findCardByHealthId,
  loadEmergencyProfile,
} from "@/lib/cardsRepo";
import {
  isValidHealthId,
  normalizeHealthId,
  INVALID_CARD_MESSAGE,
} from "@/lib/healthId";
import { canActivateHealthId } from "@/lib/activationGate";
import { checkRateLimit } from "@/lib/rateLimit";
import { makeScanToken } from "@/lib/scanToken";
import { EmergencyLite } from "@/components/card/EmergencyLite";
import { loadFeatureFlags } from "@/lib/features/server";
import { featuresFromEnv } from "@/lib/features/flags";
import { ActivationSoon } from "@/components/card/ActivationSoon";
import { CardClient } from "./CardClient";

interface PageProps {
  params: { health_id: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
      if (!canActivateHealthId(healthId, card.isDemo === true)) {
        return <ActivationSoon healthId={healthId} />;
      }
      return <CardClient mode="unactivated" healthId={healthId} />;
    }

    const profile = await loadEmergencyProfile(db, card);
    if (!profile) {
      return (
        <CardClient
          mode="invalid"
          message="This card is activated but the profile could not be loaded."
        />
      );
    }
    profile.health_id = healthId;
    // Normal public scan view ALWAYS includes a short-lived photo URL when available
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
      /* photo optional if Storage briefly unavailable */
    }
    const scanToken = makeScanToken(healthId);
    const flags = await loadFeatureFlags().catch(() => featuresFromEnv());
    return (
      <EmergencyLite profile={profile} scanToken={scanToken} flags={flags} />
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
