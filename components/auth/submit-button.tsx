"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="focus-ring mt-1 flex h-11 w-full items-center justify-center rounded-[9px] bg-accent px-4 text-sm font-semibold text-accent-contrast transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70" disabled={pending}>{pending ? "Please wait…" : children}</button>;
}
