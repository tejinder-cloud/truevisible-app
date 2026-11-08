"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, variant = "primary", name, value }: {
  children: React.ReactNode; pending: string; variant?: "primary" | "secondary"; name?: string; value?: string;
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className={`btn btn-${variant}`} type="submit" disabled={isPending} aria-disabled={isPending} name={name} value={value}>
      {isPending ? <><span className="spinner" aria-hidden="true" />{pending}</> : children}
    </button>
  );
}
