import { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  Phone,
  Heart,
  AlertTriangle,
  Pill,
  Stethoscope,
  Shield,
  Droplets,
  FileText,
} from "lucide-react";
import {
  getEmergencyData,
  logScanBackground,
} from "@/lib/firebase-server";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyContactCard } from "@/components/ui/EmergencyContactCard";
import { Badge } from "@/components/ui/Badge";
import { telHref, formatPhone } from "@/lib/utils";
import type { EmergencyContact } from "@/lib/types";

interface PageProps {
  params: { code: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const data = await getEmergencyData(params.code);
  if (!data) return { title: "Card Not Found — KavachSaathi" };
  return {
    title: `${data.profile.full_name} — Emergency Health Info`,
    description: `Blood group ${data.profile.blood_group}. Emergency medical profile via KavachSaathi.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveContacts(profile: {
  emergency_contacts?: EmergencyContact[];
  emergency_contact_1?: EmergencyContact;
  emergency_contact_2?: EmergencyContact;
}): EmergencyContact[] {
  if (Array.isArray(profile.emergency_contacts) && profile.emergency_contacts.length) {
    return profile.emergency_contacts.filter((c) => c?.name && c?.phone);
  }
  return [profile.emergency_contact_1, profile.emergency_contact_2].filter(
    (c): c is EmergencyContact => Boolean(c?.name && c?.phone)
  );
}

/** PURE SERVER COMPONENT — no 'use client', no hooks, SSR only */
export default async function EmergencyPage({ params }: PageProps) {
  const data = await getEmergencyData(params.code);

  if (!data) {
    notFound();
  }

  const { card, profile } = data;
  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  // Fire-and-forget — do NOT await
  logScanBackground(card.activation_code, profile.uid, ip);

  const contacts = resolveContacts(profile);

  return (
    <div className="min-h-screen bg-kavach-black text-cream">
      <div className="border-b border-danger/40 bg-danger/15 px-4 py-3 text-center">
        <p className="font-rajdhani text-sm font-bold uppercase tracking-[0.15em] text-danger">
          Emergency Medical Profile
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 pb-16">
        <div className="mb-6 flex flex-col items-center">
          <BloodGroupBadge bloodGroup={profile.blood_group} size="emergency" />
          <p className="mt-3 font-rajdhani text-xs font-semibold uppercase tracking-[0.2em] text-cream-soft">
            Blood Group
          </p>
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-rajdhani text-3xl font-bold text-cream sm:text-4xl">
            {profile.full_name}
          </h1>
          <p className="mt-1 font-mono text-sm text-gold">{profile.health_id}</p>
          {profile.dob && (
            <p className="mt-1 font-body text-sm text-cream-soft">
              DOB: {profile.dob}
            </p>
          )}
        </div>

        {profile.insurance_number && (
          <section className="mb-6">
            <div className="rounded-card border border-gold/40 bg-gold-faint px-4 py-4 text-center">
              <p className="flex items-center justify-center gap-2 font-rajdhani text-xs font-bold uppercase tracking-[0.2em] text-gold">
                <FileText className="h-3.5 w-3.5" />
                Insurance Number
              </p>
              <p className="mt-2 break-all font-mono text-xl font-bold tracking-wide text-cream sm:text-2xl">
                {profile.insurance_number}
              </p>
            </div>
          </section>
        )}

        {(profile.organ_donor || profile.blood_donor) && (
          <div className="mb-6 space-y-2">
            {profile.organ_donor && (
              <div className="flex items-center gap-3 rounded-card border border-success/40 bg-success/15 px-4 py-3">
                <Heart className="h-6 w-6 shrink-0 fill-success text-success" />
                <p className="font-rajdhani text-base font-bold uppercase tracking-wide text-success">
                  Registered Organ Donor
                </p>
              </div>
            )}
            {profile.blood_donor && (
              <div className="flex items-center gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3">
                <Droplets className="h-6 w-6 shrink-0 text-danger" />
                <p className="font-rajdhani text-base font-bold uppercase tracking-wide text-danger">
                  Blood Donor
                </p>
              </div>
            )}
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
            <Phone className="h-4 w-4" />
            Emergency Contacts — Tap to Call
          </h2>
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <p className="rounded-card border border-kavach-border bg-kavach-s1 p-4 font-body text-sm text-cream-soft">
                No emergency contacts listed
              </p>
            ) : (
              contacts.map((c, i) => (
                <EmergencyContactCard key={`${c.phone}-${i}`} contact={c} index={i + 1} />
              ))
            )}
          </div>
        </section>

        {profile.allergies?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 font-rajdhani text-sm font-bold uppercase tracking-widest text-danger">
              <AlertTriangle className="h-4 w-4" />
              Allergies
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.allergies.map((a) => (
                <div
                  key={a}
                  className="rounded-badge border border-red-500/40 bg-red-500/15 px-4 py-2 font-rajdhani text-base font-semibold text-red-300"
                >
                  {a}
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.medical_conditions?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 font-rajdhani text-sm font-bold uppercase tracking-widest text-orange-400">
              <Stethoscope className="h-4 w-4" />
              Medical Conditions
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.medical_conditions.map((c) => (
                <div
                  key={c}
                  className="rounded-card border border-orange-500/40 bg-orange-500/15 px-4 py-2.5 font-rajdhani text-base font-semibold text-orange-300"
                >
                  {c}
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.medications?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 font-rajdhani text-sm font-bold uppercase tracking-widest text-blue-400">
              <Pill className="h-4 w-4" />
              Medications
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.medications.map((m) => (
                <div
                  key={m}
                  className="rounded-card border border-blue-500/40 bg-blue-500/15 px-4 py-2.5 font-rajdhani text-base font-semibold text-blue-300"
                >
                  {m}
                </div>
              ))}
            </div>
          </section>
        )}

        {(profile.doctor_name || profile.doctor_phone) && (
          <section className="mb-8">
            <h2 className="mb-3 font-rajdhani text-sm font-bold uppercase tracking-widest text-gold">
              Primary Doctor
            </h2>
            <div className="rounded-card border border-kavach-border bg-kavach-s1 p-4">
              {profile.doctor_name && (
                <p className="font-rajdhani text-lg font-semibold text-cream">
                  {profile.doctor_name}
                </p>
              )}
              {profile.doctor_clinic && (
                <p className="font-body text-sm text-cream-soft">
                  {profile.doctor_clinic}
                </p>
              )}
              {profile.doctor_phone && (
                <a
                  href={telHref(profile.doctor_phone)}
                  className="mt-2 inline-flex items-center gap-2 font-mono text-gold hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {formatPhone(profile.doctor_phone)}
                </a>
              )}
            </div>
          </section>
        )}

        {!profile.allergies?.length &&
          !profile.medical_conditions?.length &&
          !profile.medications?.length && (
            <div className="mb-6 rounded-card border border-kavach-border bg-kavach-s1 p-4 text-center">
              <Badge variant="outline">
                No known allergies or conditions listed
              </Badge>
            </div>
          )}

        <div className="mt-10 border-t border-kavach-border pt-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <Shield className="h-4 w-4 text-gold" />
            <p className="font-rajdhani text-sm font-semibold text-gold">
              Powered by KavachSaathi
            </p>
          </div>
          <p className="font-body text-xs text-cream-soft">
            GDM Technoworld Pvt. Ltd. · kavachsaathi.in
          </p>
        </div>
      </div>
    </div>
  );
}
