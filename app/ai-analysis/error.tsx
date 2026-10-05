"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="rounded-lg border border-line bg-surface p-6"><h1 className="text-lg font-semibold">Unable to load AI Analysis</h1><p className="mt-3 text-sm text-muted">Check the database connection and apply the AI Analysis migration, then try again.</p><Button className="mt-4" onClick={reset}>Retry</Button></section>; }
