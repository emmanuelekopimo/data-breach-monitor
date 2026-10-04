import { CircleAlert } from "lucide-react";

/** Label, control and inline Zod errors for one form field. */
export function Field({ name, label, errors, children, className = "" }: { name: string; label: string; errors?: string[]; children: React.ReactNode; className?: string }) {
  const invalid = Boolean(errors?.length);
  return (
    <div className={`field ${className}`} data-invalid={invalid}>
      <label htmlFor={name}>{label}</label>
      {children}
      {invalid ? (
        <span className="field-error" id={`${name}-error`} role="alert">
          <CircleAlert size={13} aria-hidden />
          {errors![0]}
        </span>
      ) : null}
    </div>
  );
}
