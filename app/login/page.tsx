import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
export const metadata = { title: "Sign in" };
export default function LoginPage() { return <AuthCard eyebrow="Welcome back" title="Sign in to your journal" description="Review your performance and continue building a disciplined trading process." footer={<>New to My Journal? <Link href="/register" className="font-medium text-accent hover:underline">Create an account</Link></>}><LoginForm/></AuthCard>; }
