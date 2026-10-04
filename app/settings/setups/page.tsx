import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { SetupManager } from "@/components/setup-types/setup-manager";
export const metadata: Metadata = { title: "Setup Types" };
export default function SetupTypesPage() { return <><PageHeader eyebrow="Journal settings" title="Setup Types" description="Create and manage the setups used across your trade journal." /><SetupManager /></>; }
