import Link from "next/link";
import Image from "next/image";
import wallpaper from "@/public/wallpaper.jpg";

export function AuthCard({ eyebrow, title, description, children, footer, wide = false }: { eyebrow: string; title: string; description: string; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  return <div className="auth-page min-h-screen lg:flex">
    <aside className="auth-wallpaper relative hidden min-h-screen overflow-hidden lg:block lg:w-[58%]" aria-label="My Journal trading workspace">
      <Image src={wallpaper} alt="My Journal trading workspace" fill priority sizes="58vw" className="object-cover object-left" />
    </aside>
    <main className="auth-panel flex min-h-screen flex-1 items-center justify-center overflow-y-auto px-5 py-10 sm:px-8 lg:px-12">
      <section className={`auth-content w-full ${wide ? "max-w-[440px]" : "max-w-[420px]"}`}>
        <Link href="/" aria-label="My Journal home" className="auth-mobile-brand focus-ring mb-10 flex w-fit items-center gap-3 rounded lg:hidden">
          <Image src="/logo.png" alt="" width={42} height={42} priority className="size-[42px] rounded-[10px] object-cover" />
          <span className="text-xs font-semibold tracking-[.18em] text-foreground">MY JOURNAL</span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-accent">{eyebrow}</p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-.035em] text-foreground sm:text-[34px]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-secondary">{description}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 border-t border-line pt-5 text-center text-sm text-secondary">{footer}</div>
      </section>
    </main>
  </div>;
}
