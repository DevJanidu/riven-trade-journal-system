"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AuthState } from "@/lib/auth/actions";
import { forgotPasswordAction, loginAction, registerAction, requestRegistrationAction, resetPasswordAction, verifyResetCodeAction } from "@/lib/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthState = {};
function Field({ label, name, type = "text", autoComplete, minLength }: { label: string; name: string; type?: string; autoComplete?: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return <label className="block"><span className="mb-2 block text-xs font-medium text-foreground">{label}</span><span className="relative block"><input className="form-input" style={isPassword ? { paddingRight: 44 } : undefined} name={name} type={isPassword && visible ? "text" : type} autoComplete={autoComplete} minLength={minLength} required />{isPassword && <button type="button" onClick={() => setVisible(value => !value)} className="focus-ring absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[9px] text-muted transition hover:text-foreground" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button>}</span></label>;
}
function Message({ state }: { state: AuthState }) { return <>{state.error && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-sm text-loss">{state.error}</p>}{state.success && <p role="status" className="rounded-lg border border-profit/30 bg-profit/10 px-3 py-2.5 text-sm text-profit">{state.success}</p>}</>; }

export function LoginForm() { const [state, action] = useActionState(loginAction, initialState); return <form action={action} className="space-y-4"><Message state={state}/><Field label="Email address" name="email" type="email" autoComplete="email"/><div><Field label="Password" name="password" type="password" autoComplete="current-password"/><div className="mt-2 text-right"><Link className="text-xs text-accent hover:underline" href="/forgot-password">Forgot password?</Link></div></div><SubmitButton>Sign in</SubmitButton></form>; }
function OtpCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return <p className="text-xs text-muted">{remaining === null ? "Code expires in five minutes." : remaining === 0 ? "Code expired. Request a new code." : `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}.`}</p>;
}
function OtpCodeInput() {
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");
  const setDigit = (index: number, value: string) => {
    const entered = value.replace(/\D/g, "").slice(0, 6 - index);
    if (!entered) {
      setDigits(current => current.map((digit, position) => position === index ? "" : digit));
      return;
    }
    setDigits(current => current.map((digit, position) => entered[position - index] ?? digit));
    inputs.current[Math.min(index + entered.length, 5)]?.focus();
  };
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, "");
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };
  return <>
    <input type="hidden" name="code" value={code}/>
    <div className="flex gap-2" role="group" aria-label="Six-digit verification code">
      {digits.map((digit, index) => <input
        key={index}
        ref={input => { inputs.current[index] = input; }}
        className="form-input h-12 w-full min-w-0 p-0 text-center text-lg font-semibold tracking-wide"
        value={digit}
        onChange={event => setDigit(index, event.target.value)}
        onKeyDown={event => handleKeyDown(event, index)}
        onPaste={handlePaste}
        onFocus={event => event.currentTarget.select()}
        type="text"
        inputMode="numeric"
        autoComplete={index === 0 ? "one-time-code" : "off"}
        pattern="[0-9]"
        maxLength={6}
        aria-label={`Verification code digit ${index + 1}`}
        required
      />)}
    </div>
  </>;
}
function PasswordChangeModal({ challenge }: { challenge: AuthState }) {
  const [state, action] = useActionState(resetPasswordAction, challenge);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="password-modal-title"><section className="w-full max-w-[540px] rounded-xl border border-line bg-surface p-6 shadow-2xl shadow-black/10 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.16em] text-accent">Code verified</p><h2 id="password-modal-title" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h2><p className="mt-2 text-sm leading-6 text-muted">Your verification code is accepted. Set your new password below.</p><div className="mt-7"><form action={action} className="space-y-4"><Message state={state}/><input type="hidden" name="challengeId" value={challenge.challengeId}/><Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8}/><Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8}/><SubmitButton>Save new password</SubmitButton></form></div></section></div>;
}
function VerifyOtpForm({ challenge, resetPassword, onRestart }: { challenge: AuthState; resetPassword?: boolean; onRestart: () => void }) {
  const [state, action] = useActionState(resetPassword ? verifyResetCodeAction : registerAction, challenge);
  if (resetPassword && state.verified) return <PasswordChangeModal challenge={state}/>;
  return <form action={action} className="space-y-4">
    <Message state={state}/>
    <p className="text-sm text-muted">{resetPassword ? "Enter the code sent to your account email." : "Enter the approval code provided by the app owner."} {challenge.email && <span className="break-all">Account: {challenge.email}</span>}</p>
    <input type="hidden" name="challengeId" value={challenge.challengeId}/>
    <div><span className="mb-2 block text-xs font-medium text-foreground">Six-digit code</span><OtpCodeInput/><p className="mt-2 text-xs text-muted">Paste the full code or enter one digit in each box.</p></div>
    {challenge.expiresAt && <OtpCountdown expiresAt={challenge.expiresAt}/>}
    <SubmitButton>{resetPassword ? "Verify code" : "Verify code and create account"}</SubmitButton>
    <button type="button" onClick={onRestart} className="focus-ring w-full rounded-lg p-2 text-sm text-accent hover:underline">Request a new code / change details</button>
    <p className="text-xs text-muted">Allow 60 seconds between code requests. A new code replaces the previous code.</p>
  </form>;
}
function RegistrationRequest({ onRestart }: { onRestart: () => void }) {
  const [state, action] = useActionState(requestRegistrationAction, initialState);
  if (state.challengeId) return <VerifyOtpForm challenge={state} onRestart={onRestart}/>;
  return <form action={action} className="space-y-4"><Message state={state}/><p className="text-sm text-muted">New accounts require approval from the app owner. An approval code will be emailed to the owner and expires after five minutes.</p><Field label="Name" name="name" autoComplete="name"/><Field label="Email address" name="email" type="email" autoComplete="email"/><Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8}/><Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8}/><SubmitButton>Send approval code to owner</SubmitButton></form>;
}
export function RegisterForm() {
  const [version, setVersion] = useState(0);
  return <RegistrationRequest key={version} onRestart={() => setVersion(value => value + 1)}/>;
}
function PasswordResetRequest({ onRestart }: { onRestart: () => void }) {
  const [state, action] = useActionState(forgotPasswordAction, initialState);
  if (state.challengeId) return <VerifyOtpForm challenge={state} resetPassword onRestart={onRestart}/>;
  return <form action={action} className="space-y-4"><Message state={state}/><Field label="Email address" name="email" type="email" autoComplete="email"/><SubmitButton>Send reset code</SubmitButton></form>;
}
export function ForgotPasswordForm() {
  const [version, setVersion] = useState(0);
  return <PasswordResetRequest key={version} onRestart={() => setVersion(value => value + 1)}/>;
}
