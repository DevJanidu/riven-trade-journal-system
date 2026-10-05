"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="focus-ring mt-1 flex h-11 w-full items-center justify-center rounded-[9px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70" disabled={pending}>{pending ? "Please wait…" : children}</button>;
}
