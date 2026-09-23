import { z } from "zod";

export const bloodGroupSchema = z.enum([
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
]);

export const phoneSchema = z
  .string()
  .min(10, "Enter a valid 10-digit phone number")
  .regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number");

export const emergencyContactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: phoneSchema,
  relation: z.string().min(1, "Relation is required"),
});

export const activationCodeSchema = z
  .string()
  .length(4, "Activation code must be 4 characters")
  .regex(/^[A-Z0-9]{4}$/i, "Invalid activation code format");

export const personalDetailsSchema = z.object({
  user_name: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  blood_group: bloodGroupSchema,
  phone: phoneSchema,
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72),
});

export const emergencyContactsSchema = z.object({
  emergency_contact_1: emergencyContactSchema,
  emergency_contact_2: emergencyContactSchema,
});

export const medicalInfoSchema = z.object({
  allergies: z.array(z.string()).default([]),
  medical_conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  doctor_name: z.string().optional(),
  doctor_phone: z.string().optional(),
  insurance_number: z.string().optional(),
  organ_donor: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const orderSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  blood_group: bloodGroupSchema,
  phone: phoneSchema,
  email: z.string().email("Enter a valid email"),
  address: z.string().min(10, "Enter your full address"),
  pincode: z
    .string()
    .length(6, "Pincode must be 6 digits")
    .regex(/^\d{6}$/, "Enter a valid pincode"),
  tier: z.enum(["STANDARD", "PRO"]),
});

export const passwordChangeSchema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
