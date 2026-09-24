import type {
  UserProfile,
  CardDoc,
  DoctorScan,
  BloodGroup,
  EmergencyContact,
} from "./types";
import { emptyContact } from "./types";

export function getDemoCard(code = "0042"): CardDoc {
  return {
    activation_code: code.length === 4 ? code : "0042",
    health_id: "KVS-2026-DEMO1",
    tier: "PRO",
    status: "active",
    activated: true,
    activated_at: new Date().toISOString(),
    user_uid: "demo-uid",
    name: "Rahul Sharma",
    address: "12 MG Road, Bengaluru, Karnataka",
    bloodGroup: "B+",
    medicalConditions: ["Asthma", "Type 2 Diabetes"],
    emergencyContact: { name: "Priya Sharma", phone: "9876543210" },
    familyDoctor: { name: "Dr. Ananya Mehta", phone: "9988776655" },
    hasInsurance: true,
  };
}

export function getDemoProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    uid: "demo-uid",
    full_name: "Rahul Sharma",
    dob: "1995-08-15",
    gender: "male",
    phone: "9876501234",
    address: "12 MG Road, Bengaluru, Karnataka",
    blood_group: "B+",
    height_cm: 175,
    weight_kg: 72,
    allergies: ["Penicillin", "Peanuts"],
    medical_conditions: ["Asthma", "Type 2 Diabetes"],
    medications: ["Metformin 500mg", "Inhaler - Salbutamol"],
    surgeries: ["Appendectomy 2018"],
    emergency_contact_1: {
      name: "Priya Sharma",
      phone: "9876543210",
      relation: "Spouse",
    },
    emergency_contact_2: {
      name: "Suresh Sharma",
      phone: "9123456780",
      relation: "Parent",
    },
    doctor_name: "Dr. Ananya Mehta",
    doctor_phone: "9988776655",
    doctor_clinic: "Apollo Clinic, Indiranagar",
    insurance_number: "HDFC-HEALTH-88442109",
    has_insurance: true,
    organ_donor: true,
    blood_donor: true,
    activation_code: "0042",
    health_id: "KVS-2026-DEMO1",
    tier: "PRO",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function getDemoScans(): DoctorScan[] {
  return [
    {
      id: "1",
      activation_code: "0042",
      user_uid: "demo-uid",
      scanned_by: "Dr. Mehta",
      hospital: "Apollo Hospital",
      location: "Bengaluru",
      notes: "Routine checkup",
      scanned_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "2",
      activation_code: "0042",
      user_uid: "demo-uid",
      scanned_by: "Paramedic Unit 4",
      hospital: "Emergency Response",
      location: "Highway NH48",
      scanned_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "3",
      activation_code: "0042",
      user_uid: "demo-uid",
      scanned_by: "Dr. Rao",
      hospital: "Fortis",
      scanned_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
  ];
}

export function isDemoCode(code: string): boolean {
  const t = code.trim().toUpperCase();
  return t === "DEMO" || t === "0000" || t === "0042";
}

export function mapEmergencyFromProfile(
  profile: UserProfile,
  card: CardDoc
): {
  profile: UserProfile;
  card: CardDoc;
  blood_group: BloodGroup;
  contacts: EmergencyContact[];
} {
  return {
    profile,
    card,
    blood_group: profile.blood_group,
    contacts: [
      profile.emergency_contact_1 || emptyContact(),
      profile.emergency_contact_2 || emptyContact(),
    ],
  };
}
