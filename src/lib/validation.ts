import { z } from "zod";
import { normalizeDomain, normalizeEmail } from "./identity";

const DOMAIN_RE = /^(?=.{3,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
});

export const assetSchema = z
  .object({
    kind: z.enum(["email", "domain"], { error: "Choose email or domain" }),
    value: z.string().trim().min(1, "Enter a value to monitor").max(254, "Value is too long"),
    label: z.string().trim().max(40, "Label must be 40 characters or fewer").optional().default(""),
  })
  .transform((v) => ({ ...v, value: v.kind === "email" ? normalizeEmail(v.value) : normalizeDomain(v.value) }))
  .superRefine((v, ctx) => {
    if (v.kind === "email" && !z.email().safeParse(v.value).success) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a valid email address" });
    }
    if (v.kind === "domain" && !DOMAIN_RE.test(v.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a domain like example.com" });
    }
  });

export const passwordCheckSchema = z.object({
  password: z.string().min(1, "Enter a password to check").max(256, "Password is too long"),
});

export const noteSchema = z.object({
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer"),
});

export type FieldErrors = Record<string, string[] | undefined>;

/** Turns a Zod error into { field: [messages] } for inline form errors. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
