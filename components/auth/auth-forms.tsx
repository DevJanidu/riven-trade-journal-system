"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AuthState } from "@/lib/auth/actions";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/lib/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthState = {};
function Field({ label, name, type = "text", autoComplete, minLength }: { label: string; name: string; type?: string; autoComplete?: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return <label className="block"><span className="mb-2 block text-xs font-medium text-foreground">{label}</span><span className="relative block"><input className="form-input" style={isPassword ? { paddingRight: 44 } : undefined} name={name} type={isPassword && visible ? "text" : type} autoComplete={autoComplete} minLength={minLength} required />{isPassword && <button type="button" onClick={() => setVisible(value => !value)} className="focus-ring absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[9px] text-muted transition hover:text-foreground" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button>}</span></label>;
}
function Message({ state }: { state: AuthState }) { return <>{state.error && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-sm text-loss">{state.error}</p>}{state.success && <p role="status" className="rounded-lg border border-profit/30 bg-profit/10 px-3 py-2.5 text-sm text-profit">{state.success}</p>}</>; }

export function LoginForm() { const [state, action] = useActionState(loginAction, initialState); return <form action={action} className="space-y-4"><Message state={state}/><Field label="Email address" name="email" type="email" autoComplete="email"/><div><Field label="Password" name="password" type="password" autoComplete="current-password"/><div className="mt-2 text-right"><Link className="text-xs text-accent hover:underline" href="/forgot-password">Forgot password?</Link></div></div><SubmitButton>Sign in</SubmitButton></form>; }
export function RegisterForm() { const [state, action] = useActionState(registerAction, initialState); return <form action={action} className="space-y-4"><Message state={state}/><Field label="Name" name="name" autoComplete="name"/><Field label="Email address" name="email" type="email" autoComplete="email"/><Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8}/><Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8}/><SubmitButton>Create account</SubmitButton></form>; }
export function ForgotPasswordForm() { const [state, action] = useActionState(forgotPasswordAction, initialState); return <form action={action} className="space-y-4"><Message state={state}/><Field label="Email address" name="email" type="email" autoComplete="email"/><SubmitButton>Send reset link</SubmitButton>{state.resetUrl && <p className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-xs leading-5 text-muted">Email delivery is not configured. Development reset link: <Link href={state.resetUrl} className="break-all text-gold hover:underline">Reset password</Link></p>}</form>; }
export function ResetPasswordForm({ token }: { token: string }) { const [state, action] = useActionState(resetPasswordAction, initialState); return <form action={action} className="space-y-4"><Message state={state}/><input type="hidden" name="token" value={token}/><Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8}/><Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8}/><SubmitButton>Reset password</SubmitButton></form>; }
