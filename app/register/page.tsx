import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";
export const metadata = { title: "Create account" };
export default function RegisterPage() { return <AuthCard eyebrow="Get started" title="Create your account" description="Keep your trades, reviews, and setup notes private in one focused workspace." footer={<>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}><RegisterForm/></AuthCard>; }
