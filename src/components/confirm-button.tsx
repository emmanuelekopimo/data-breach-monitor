"use client";

/** Submit button that asks for confirmation first. */
export function ConfirmButton({ message, children, className, label }: { message: string; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <button
      type="submit"
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
