export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "O+"
  | "O-"
  | "AB+"
  | "AB-";

export type CardTier = "STANDARD" | "PRO";
export type CardStatus = "available" | "unactivated" | "active";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface EmergencyContact {
  name: string;
  phone: string;
  relation?: string;
}

export interface SimpleContact {
  name: string;
  phone: string;
}

/** cards collection — doc ID = activation_code (0001–0100) */
export interface CardDoc {
  activation_code: string;
  health_id?: string;
  tier?: CardTier;
  status?: CardStatus;
  /** New schema flag */
  activated?: boolean;
  activated_at?: string | null;
  user_uid?: string;
  phone?: string;
  pinHash?: string;
  pin_hash?: string;

  // Emergency profile fields (on card doc)
  name?: string;
  address?: string;
  bloodGroup?: string;
  blood_group?: BloodGroup | string;
  medicalConditions?: string[];
  medical_conditions?: string[];
  emergencyContact?: SimpleContact;
  familyDoctor?: SimpleContact;
  hasInsurance?: boolean;
  has_insurance?: boolean;
}

/** Normalized public emergency view — safe to render */
export interface EmergencyPublicView {
  code: string;
  activated: boolean;
  name: string;
  address: string;
  bloodGroup: string;
  medicalConditions: string[];
  emergencyContact: SimpleContact | null;
  familyDoctor: SimpleContact | null;
  hasInsurance: boolean | null;
  userUid?: string;
}

/** users collection — doc ID = Firebase Auth UID */
export interface UserProfile {
  uid: string;
  full_name: string;
  dob: string;
  gender: Gender | "";
  phone: string;
  address: string;
  profile_photo?: string;
  blood_group: BloodGroup;
  height_cm?: number | null;
  weight_kg?: number | null;
  allergies: string[];
  medical_conditions: string[];
  medications: string[];
  surgeries: string[];
  emergency_contact_1: EmergencyContact;
  emergency_contact_2: EmergencyContact;
  emergency_contacts?: EmergencyContact[];
  doctor_name: string;
  doctor_phone: string;
  doctor_clinic: string;
  /** Prefer has_insurance for emergency — never show number publicly */
  insurance_number: string;
  has_insurance: boolean;
  organ_donor: boolean;
  blood_donor: boolean;
  activation_code: string;
  health_id: string;
  tier?: CardTier;
  created_at?: string | null;
  updated_at?: string | null;
  pin_hash?: string;
  reset_token?: string | null;
  reset_token_expires?: number | null;
}

export interface DoctorScan {
  id?: string;
  activation_code: string;
  user_uid: string;
  scanned_by?: string;
  hospital?: string;
  location?: string;
  notes?: string;
  scanned_at: string;
}

export interface ScanNotification {
  id: string;
  message: string;
  scanned_at: string;
  read: boolean;
}

export interface OrderDoc {
  order_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  pincode: string;
  blood_group: BloodGroup;
  tier: CardTier;
  amount: number;
  status: "pending" | "paid" | "shipped" | "delivered";
  razorpay_payment_id?: string;
  created_at: string;
}

export const BLOOD_GROUPS: BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
];

export const RELATIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Friend",
  "Guardian",
  "Other",
] as const;

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const emptyContact = (): EmergencyContact => ({
  name: "",
  phone: "",
  relation: "",
});

export const emptyProfile = (uid = ""): UserProfile => ({
  uid,
  full_name: "",
  dob: "",
  gender: "",
  phone: "",
  address: "",
  blood_group: "O+",
  height_cm: null,
  weight_kg: null,
  allergies: [],
  medical_conditions: [],
  medications: [],
  surgeries: [],
  emergency_contact_1: emptyContact(),
  emergency_contact_2: emptyContact(),
  doctor_name: "",
  doctor_phone: "",
  doctor_clinic: "",
  insurance_number: "",
  has_insurance: false,
  organ_donor: false,
  blood_donor: false,
  activation_code: "",
  health_id: "",
});
