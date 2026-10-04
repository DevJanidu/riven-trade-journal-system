import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return <LoaderCircle aria-label={label} role="status" className={cn("animate-spin", className)} size={16} />;
}
