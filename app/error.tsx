"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="grid min-h-72 place-items-center border border-line bg-surface p-8 text-center"><div><h2 className="text-lg font-semibold text-foreground">Unable to load journal data</h2><p className="mt-2 max-w-md text-sm text-muted">Check that the database is configured and available, then try again.</p><Button className="mt-5" onClick={reset}>Try again</Button></div></div>;
}
