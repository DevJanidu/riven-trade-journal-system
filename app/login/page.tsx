import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) { const { reset } = await searchParams; return <AuthCard eyebrow="Welcome back" title="Sign in to your journal" description="Review your performance and continue building a disciplined trading process." footer={<>New to My Journal? <Link href="/register" className="font-medium text-accent hover:underline">Create an account</Link></>}>{reset === "success" && <p role="status" className="mb-4 rounded-lg border border-profit/30 bg-profit/10 px-3 py-2.5 text-sm text-profit">Password reset successfully. Sign in with your new password.</p>}<LoginForm/></AuthCard>; }
