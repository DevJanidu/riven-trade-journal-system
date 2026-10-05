import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
export const metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() { return <AuthCard eyebrow="Account recovery" title="Reset your password" description="Enter your account email and we’ll create a secure reset link that expires in one hour." footer={<Link href="/login" className="font-medium text-accent hover:underline">Back to sign in</Link>}><ForgotPasswordForm/></AuthCard>; }
