import Link from "next/link";
import Image from "next/image";
import wallpaper from "@/public/wallpaper.jpg";
import formLogo from "@/public/form-logo.png";

export function AuthCard({ eyebrow, title, description, children, footer, wide = false, loginBranding = false }: { eyebrow: string; title: string; description: string; children: React.ReactNode; footer: React.ReactNode; wide?: boolean; loginBranding?: boolean }) {
  return <div className="auth-page min-h-screen lg:flex">
    <aside className="auth-wallpaper relative hidden min-h-screen overflow-hidden lg:block lg:w-[58%]" aria-label="My Journal trading workspace">
      <Image src={wallpaper} alt="My Journal trading workspace" fill priority sizes="58vw" className="object-cover object-left" />
      {loginBranding && <>
        <div className="absolute inset-0 bg-[#061431]/60" aria-hidden="true" />
        <div className="relative z-10 flex min-h-screen flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center justify-between gap-4"><p className="text-sm font-semibold tracking-[.22em]">MY JOURNAL</p><span className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-medium tracking-wider text-white/80">XAUUSD / GOLD</span></div>
          <div className="my-16 max-w-lg">
            <h2 className="text-[38px] font-semibold leading-[1.15] tracking-tight xl:text-[46px]">Control your risk.<br />Build your discipline.</h2>
            <div className="mt-8 space-y-6">
              <div><h3 className="text-base font-semibold text-white">Keep losses manageable</h3><p className="mt-2 text-sm leading-6 text-white/80">Define your risk before every trade.</p></div>
              <div><h3 className="text-base font-semibold text-white">Manage the fear of losing</h3><p className="mt-2 text-sm leading-6 text-white/80">Follow your plan. Learn from each outcome.</p></div>
            </div>
          </div>
          <div className="max-w-lg">
            <blockquote className="border-l-2 border-cyan-200/70 pl-5 text-base leading-7 text-white/90">“Accept the risk. Respect your limits.”</blockquote>
            <p className="mt-8 border-t border-white/20 pt-5 text-sm leading-6 text-white/75">Developed by <a href="https://www.janidudev.com/" target="_blank" rel="noopener noreferrer" className="focus-ring rounded font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">Janidu Dhakshitha Yapa</a><span className="mx-2 text-white/40">·</span><a href="https://www.janidudev.com/" target="_blank" rel="noopener noreferrer" className="focus-ring rounded text-cyan-200 hover:underline">Portfolio ↗</a></p>
          </div>
        </div>
      </>}
    </aside>
    <main className="auth-panel flex min-h-screen flex-1 items-center justify-center overflow-y-auto px-5 py-10 sm:px-8 lg:px-12">
      <section className={`auth-content w-full ${wide ? "max-w-[440px]" : "max-w-[420px]"}`}>
        {!loginBranding && <Link href="/" aria-label="My Journal home" className="auth-mobile-brand focus-ring mb-10 flex w-fit items-center gap-3 rounded lg:hidden">
          <Image src="/logo.png" alt="" width={42} height={42} priority className="size-[42px] rounded-[10px] object-cover" />
          <span className="text-xs font-semibold tracking-[.18em] text-foreground">MY JOURNAL</span>
        </Link>}
        {loginBranding && <Link href="/" aria-label="My Journal home" className="focus-ring mx-auto mb-6 block w-fit rounded-2xl"><Image src={formLogo} alt="My Journal logo" width={112} height={112} priority sizes="112px" className="size-28 rounded-2xl object-contain" /></Link>}
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-accent">{eyebrow}</p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-.035em] text-foreground sm:text-[34px]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-secondary">{description}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 border-t border-line pt-5 text-center text-sm text-secondary">{footer}</div>
        {loginBranding && <p className="mt-6 text-center text-xs leading-6 text-muted lg:hidden">Developed by <a href="https://www.janidudev.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Janidu Dhakshitha Yapa</a></p>}
      </section>
    </main>
  </div>;
}
