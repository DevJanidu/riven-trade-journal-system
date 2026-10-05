import Link from "next/link";
import type { ButtonHTMLAttributes,ReactNode } from "react";
import { cn } from "@/lib/utils";
const styles={primary:"border-primary bg-primary text-primary-foreground hover:bg-primary-hover",secondary:"secondary-action border-line bg-surface-raised text-foreground hover:border-accent/30 hover:bg-foreground/[.04]",danger:"border-loss/30 bg-loss/10 text-loss hover:bg-loss/15",ghost:"border-transparent text-muted hover:bg-foreground/[.04] hover:text-foreground"};
type Variant=keyof typeof styles; const base="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export function Button({className,variant="secondary",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant}){return <button className={cn(base,styles[variant],className)} {...props}/>}
export function ButtonLink({href,children,className,variant="secondary"}:{href:string;children:ReactNode;className?:string;variant?:Variant}){return <Link href={href} className={cn(base,styles[variant],className)}>{children}</Link>}
