import { redirect } from "next/navigation";
export const metadata = { title: "Reset password" };
export default function ResetPasswordPage() { redirect("/forgot-password"); }
