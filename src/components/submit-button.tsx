"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "btn btn-primary", ...rest }: { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} {...rest}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
