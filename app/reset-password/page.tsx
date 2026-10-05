import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
export const metadata = { title: "Reset password" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <AuthCard eyebrow="Account recovery" title="Choose a new password" description="Use at least eight characters and choose something you don’t use elsewhere." footer={<Link href="/login" className="font-medium text-accent hover:underline">Back to sign in</Link>}>{token ? <ResetPasswordForm token={token}/> : <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-sm text-loss">This reset link is incomplete. Request a new one from the forgot-password page.</p>}</AuthCard>; }
