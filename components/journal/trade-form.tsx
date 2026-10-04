"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/calendar-picker";
import { ThemedSelect } from "@/components/ui/themed-select";
import { ScreenshotUpload } from "./screenshot-upload";
import { directions, emotions, sessions, setups, type Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/trade";
import { calculatePlannedRR } from "@/lib/trading/calculations";
import { buildTradePatch } from "@/lib/trading/trade-patch";
import { Spinner } from "@/components/ui/spinner";
import type { DraftInput, TradeDraft } from "@/lib/validations/draft";

type Numbers = { entry: string; stopLoss: string; takeProfit: string; risk: string; profitLoss: string; profitBooked: string };
type SetupOption = { name: string; rules: string[]; avoidRules: string[] };

export function TradeForm({ initialTrade, initialDraft }: { initialTrade?: Trade; initialDraft?: TradeDraft }) {
  const draft = initialDraft?.data;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<"uploading" | "saving" | "saved" | "">("");
  const submitting = useRef(false);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [direction, setDirection] = useState<Trade["direction"]>(initialTrade?.direction ?? draft?.direction ?? "Long");
  const [setupOptions, setSetupOptions] = useState<SetupOption[]>([...setups].map(name => ({ name, rules: [], avoidRules: [] })));
  const [selectedSetup, setSelectedSetup] = useState(initialTrade?.setup ?? draft?.setup ?? setups[0]);
  const [checkedRules, setCheckedRules] = useState<string[]>(initialTrade?.setupChecklist ?? draft?.setupChecklist ?? []);
  useEffect(() => { fetch("/api/setup-types").then(response => response.json()).then(json => { if (json.success && json.data.length) { setSetupOptions(json.data); if (!initialTrade && !initialDraft) setSelectedSetup(json.data[0].name); } }).catch(() => undefined); }, [initialTrade, initialDraft]);
  const activeSetup = setupOptions.find(setup => setup.name === selectedSetup);
  const checklistPercent = activeSetup?.rules.length ? Math.round((checkedRules.filter(rule => activeSetup.rules.includes(rule)).length / activeSetup.rules.length) * 100) : 0;
  const strategyGrade: "A" | "A+" | undefined = checklistPercent > 90 ? "A+" : checklistPercent > 75 ? "A" : undefined;
  function changeSetup(value: string) { setSelectedSetup(value); setCheckedRules(initialTrade?.setup === value ? (initialTrade.setupChecklist ?? []) : draft?.setup === value ? draft.setupChecklist : []); }
  const [numbers, setNumbers] = useState<Numbers>({
    entry: initialTrade?.entry.toString() ?? draft?.entry ?? "",
    stopLoss: initialTrade?.stopLoss.toString() ?? draft?.stopLoss ?? "",
    takeProfit: initialTrade?.takeProfit.toString() ?? draft?.takeProfit ?? "",
    risk: initialTrade?.riskAmount.toString() ?? draft?.riskAmount ?? "25",
    profitLoss: initialTrade?.profitLoss.toString() ?? draft?.profitLoss ?? "",
    profitBooked: initialTrade?.profitBooked?.toString() ?? draft?.profitBooked ?? "0",
  });

  const plannedRR = useMemo(() => {
    const entry = Number(numbers.entry);
    const stop = Number(numbers.stopLoss);
    const target = Number(numbers.takeProfit);
    return entry && stop && target ? calculatePlannedRR(entry, stop, target, direction) : 0;
  }, [numbers, direction]);
  const actualR = Number(numbers.risk) > 0 && numbers.profitLoss !== "" ? Number(numbers.profitLoss) / Number(numbers.risk) : 0;
  const result = actualR > 0 ? "Win" : actualR < 0 ? "Loss" : "Break Even";
  const breakEvenAfterProfit = initialTrade?.breakEvenAfterProfit ?? draft?.breakEvenAfterProfit;

  function setNumber(key: keyof Numbers, value: string) {
    setNumbers(current => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "draft" ? "draft" : "complete";
    const startedAt = performance.now();
    submitting.current = true;
    setPending(true);
    setFormError("");
    setFormNotice("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const uploadedKeys: string[] = [];
    const uploadTimes: Record<string, number> = {};
    const cleanupUploads = () => Promise.all(uploadedKeys.map(key => fetch(`/api/uploads/${key}`, { method: "DELETE" }).catch(() => undefined)));
    if (intent === "complete" && !strategyGrade) { setFormError("Complete more than 75% of the setup rules to qualify for an A grade."); submitting.current = false; setPending(false); return; }
    if (intent === "complete" && value("psychologyReady") !== "Yes") { setFormError("Confirm that you are ready to lose the planned risk amount before taking this trade."); submitting.current = false; setPending(false); return; }
    const preparedAt = performance.now();
    const uploadImage = async (name: string, existing?: string): Promise<string | null | undefined> => {
      if (value(`${name}Removed`) === "true") return null;
      const file = form.get(name);
      if (!(file instanceof File) || file.size === 0) return existing;
      if (file.size > 8 * 1024 * 1024) throw new Error("Images must be 8 MB or smaller.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use a PNG, JPEG, or WebP image.");
      const data = new FormData();
      data.set("file", file);
      setProgress("uploading");
      const uploadStartedAt = performance.now();
      const response = await fetch("/api/uploads", { method: "POST", body: data });
      const json: ApiResponse<{ key: string }> = await response.json();
      uploadTimes[name] = Math.round(performance.now() - uploadStartedAt);
      if (!response.ok || !json.success) throw new Error(json.success ? "Unable to upload image" : json.error);
      uploadedKeys.push(json.data.key);
      return json.data.key;
    };
    let saved = false;
    try {
      const uploads = await Promise.allSettled([
        uploadImage("beforeScreenshot", initialTrade?.beforeScreenshot ?? draft?.beforeScreenshot ?? undefined),
        uploadImage("afterScreenshot", initialTrade?.afterScreenshot ?? draft?.afterScreenshot ?? undefined),
      ]);
      if (uploads[0].status === "rejected" || uploads[1].status === "rejected") {
        throw uploads.find(result => result.status === "rejected")?.reason ?? new Error("Unable to upload screenshot");
      }
      const uploadedAt = performance.now();
      setProgress("saving");
      const draftPayload: DraftInput = {
        date: value("date"), session: value("session") as DraftInput["session"], direction,
        entry: numbers.entry, stopLoss: numbers.stopLoss, takeProfit: numbers.takeProfit,
        riskAmount: numbers.risk, profitLoss: numbers.profitLoss, profitBooked: numbers.profitBooked,
        breakEvenAfterProfit: value("breakEvenAfterProfit") === "Yes", setup: selectedSetup,
        setupChecklist: checkedRules, setupAvoidChecklist: draft?.setupAvoidChecklist ?? [],
        psychologyReady: value("psychologyReady") === "Yes", psychologyAnswer: value("psychologyAnswer"),
        tradingViewUrl: value("tradingViewUrl"),
        beforeScreenshot: uploads[0].value ?? null, afterScreenshot: uploads[1].value ?? null,
        entryReason: value("entryReason"), wentWell: value("wentWell"), wentWrong: value("wentWrong"), improvement: value("improvement"),
        followedRules: value("followedRules") === "Yes", emotion: value("emotion") as DraftInput["emotion"],
      };
      if (intent === "draft") {
        const response = await fetch(initialDraft ? `/api/drafts/${initialDraft.id}` : "/api/drafts", {
          method: initialDraft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draftPayload),
        });
        const json: ApiResponse<TradeDraft> = await response.json();
        if (!response.ok || !json.success) {
          if (!json.success) { setFormError(json.error); setFieldErrors(json.fieldErrors ?? {}); }
          else setFormError("Unable to save draft");
          return;
        }
        saved = true;
        setProgress("saved");
        setFormNotice("Draft saved. Opening Trade Log...");
        router.push(`/trades?month=${json.data.date.slice(0, 7)}`);
        return;
      }
      const payload = {
        instrument: "XAUUSD", date: value("date"), session: value("session"), direction: value("direction"),
        entry: Number(numbers.entry), stopLoss: Number(numbers.stopLoss), takeProfit: Number(numbers.takeProfit),
        riskAmount: Number(numbers.risk), profitLoss: Number(numbers.profitLoss), profitBooked: Number(numbers.profitBooked), breakEvenAfterProfit: value("breakEvenAfterProfit") === "Yes", setup: selectedSetup,
        result: Number(numbers.profitLoss) === 0 ? (value("result") || "Break Even") : undefined,
        setupGrade: strategyGrade, setupChecklist: checkedRules, setupAvoidChecklist: initialTrade?.setupAvoidChecklist ?? draft?.setupAvoidChecklist ?? [],
        psychologyReady: value("psychologyReady") === "Yes", psychologyAnswer: value("psychologyAnswer"),
        tradingViewUrl: value("tradingViewUrl") || null,
        beforeScreenshot: uploads[0].value ?? null,
        afterScreenshot: uploads[1].value ?? null,
        entryReason: value("entryReason"), wentWell: value("wentWell"), wentWrong: value("wentWrong"), improvement: value("improvement"),
        followedRules: value("followedRules") === "Yes", emotion: value("emotion"),
      };
      const body = initialTrade ? buildTradePatch(initialTrade, payload) : payload;
      if (initialTrade && Object.keys(body).length === 0) {
        setFormNotice("No changes to save.");
        return;
      }
      const response = await fetch(initialTrade ? `/api/trades/${initialTrade.id}` : initialDraft ? `/api/drafts/${initialDraft.id}/complete` : "/api/trades", {
        method: initialTrade ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json: ApiResponse<Trade> = await response.json();
      const savedAt = performance.now();
      if (process.env.NODE_ENV === "development") {
        console.info(`[Trade Save Performance] prepare=${Math.round(preparedAt - startedAt)}ms imageProcessing=0ms beforeUpload=${uploadTimes.beforeScreenshot ?? 0}ms afterUpload=${uploadTimes.afterScreenshot ?? 0}ms uploadStage=${Math.round(uploadedAt - preparedAt)}ms API=${Math.round(savedAt - uploadedAt)}ms total=${Math.round(savedAt - startedAt)}ms requests=${uploadedKeys.length + 1}`);
      }
      if (!response.ok || !json.success) {
        if (!json.success) { setFormError(json.error); setFieldErrors(json.fieldErrors ?? {}); }
        else setFormError("Unable to save trade");
        return;
      }
      saved = true;
      setProgress("saved");
      setFormNotice("Saved. Opening trade...");
      router.push(`/trades/${json.data.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to connect. Check your connection and try again.");
    }
    finally {
      if (!saved) {
        await cleanupUploads();
        submitting.current = false;
        setPending(false);
        setProgress("");
      }
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    <FormSection title="Trade Details" description="The essential context for this Gold trade.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DatePicker name="date" label="Date" initialValue={initialTrade?.date ?? (draft?.date || initialDraft?.date || new Date().toISOString().slice(0, 10))} />
        <ThemedSelect name="session" label="Session" options={sessions} defaultValue={initialTrade?.session ?? draft?.session} />
        <Field label="Direction"><Segmented name="direction" options={directions} defaultValue={initialTrade?.direction ?? draft?.direction ?? "Long"} onChange={value => setDirection(value as Trade["direction"])} tone="direction" /></Field>
        <Field label="Risk Amount ($)"><input name="riskAmount" type="number" min="0" step="0.01" required value={numbers.risk} onChange={event => setNumber("risk", event.target.value)} className="form-input" placeholder="25.00" /></Field>
        <Field label="Entry"><input name="entry" inputMode="decimal" type="number" step="0.01" required value={numbers.entry} onChange={event => setNumber("entry", event.target.value)} className="form-input" placeholder="3942.50" /></Field>
        <Field label="Stop Loss"><input name="stopLoss" type="number" step="0.01" required value={numbers.stopLoss} onChange={event => setNumber("stopLoss", event.target.value)} className="form-input" placeholder="3937.20" /></Field>
        <Field label="Take Profit"><input name="takeProfit" type="number" step="0.01" required value={numbers.takeProfit} onChange={event => setNumber("takeProfit", event.target.value)} className="form-input" placeholder="3955.20" /></Field>
      </div>
    </FormSection>

    <FormSection title="Trade Result" description="R-multiples are calculated from your price levels, risk, and P/L.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Readout label="Planned R:R" value={plannedRR ? `1:${plannedRR.toFixed(2)}` : "\u2014"} />
        <Field label="Profit / Loss ($)"><input name="profitLoss" type="number" step="0.01" required value={numbers.profitLoss} onChange={event => setNumber("profitLoss", event.target.value)} className="form-input" placeholder="50.00" /></Field>
        <Field label="Profit booked before breakeven"><input name="profitBooked" type="number" min="0" step="0.01" value={numbers.profitBooked} onChange={event => setNumber("profitBooked", event.target.value)} className={cn("form-input", Number(numbers.profitBooked) > 0 && Number(numbers.profitLoss) === 0 && "border-accent/60 bg-accent/10 text-accent")} placeholder="0.00" />{Number(numbers.profitBooked) > 0 && Number(numbers.profitLoss) === 0 && <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-accent"><Check size={13} aria-hidden="true" />Profit protected: ${Number(numbers.profitBooked).toFixed(2)} booked</span>}</Field>
        <ThemedSelect name="breakEvenAfterProfit" label="Break even after profit booking?" options={["No", "Yes"]} defaultValue={breakEvenAfterProfit ? "Yes" : "No"} />
        <Readout label="Actual Result" value={`${actualR > 0 ? "+" : ""}${actualR.toFixed(2)}R`} tone={actualR > 0 ? "positive" : actualR < 0 ? "negative" : "default"} />
        {numbers.profitLoss !== "" && Number(numbers.profitLoss) === 0 ? <ThemedSelect name="result" label="Manual result for zero P/L" options={["Break Even"]} defaultValue={initialTrade?.result ?? "Break Even"} /> : <Readout label="Result" value={result === "Break Even" && breakEvenAfterProfit ? "Break Even \u00b7 Profit Booked" : result} tone={result === "Win" ? "positive" : result === "Loss" ? "negative" : "default"} />}
      </div>
    </FormSection>

    <FormSection title="Setup" description="Tag the playbook idea behind the trade.">
      <div className="grid gap-4 md:grid-cols-2">
        <ThemedSelect name="setup" label="Setup" options={setupOptions.map(setup => setup.name)} value={selectedSetup} onValueChange={changeSetup} tone="setup" />
        <Field label="TradingView Chart Link"><div className="relative"><input name="tradingViewUrl" type="url" defaultValue={initialTrade?.tradingViewUrl ?? draft?.tradingViewUrl} className="form-input pr-10" placeholder="https://www.tradingview.com/chart/..." /><ExternalLink size={15} className="pointer-events-none absolute right-3 top-3.5 text-muted" /></div></Field>
      </div>
    </FormSection>

    <FormSection title="Pre-trade checklist" description="Only take the trade when the setup is objectively ready." headerRight={<div className={cn("flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold", strategyGrade ? "border-accent/40 bg-accent/10 text-accent" : "border-[#263443] bg-[#0b1219] text-muted")}><span>{checklistPercent}% complete</span><span className="text-white/30">&middot;</span><span>{strategyGrade ?? "Not qualified"}</span></div>}>
      <div className="grid min-w-0 items-stretch gap-5 md:grid-cols-2"><Field label="Setup rules"><div className="flex h-full min-h-32 min-w-0 flex-col space-y-2 overflow-y-auto rounded-[9px] border border-[#263443] bg-[#0b1219] p-3">{activeSetup?.rules.length ? activeSetup.rules.map(rule => <label key={rule} className="flex min-w-0 items-start gap-2 text-sm text-[#cbd3d8]"><input type="checkbox" checked={checkedRules.includes(rule)} onChange={event => setCheckedRules(current => event.target.checked ? [...current, rule] : current.filter(item => item !== rule))} className="mt-0.5 shrink-0 accent-[#45c6bb]" /><span className="break-words">{rule}</span></label>) : <span className="text-xs text-muted">No rules added for this setup yet. Add them in Setup Types.</span>}</div></Field>
        <Field label="Do not take this trade if..."><div className="flex h-full min-h-32 min-w-0 flex-col space-y-2 overflow-y-auto rounded-[9px] border border-[#263443] bg-[#0b1219] p-3">{activeSetup?.avoidRules.length ? activeSetup.avoidRules.map(rule => <p key={rule} className="flex items-start gap-1.5 break-words text-sm text-loss"><AlertTriangle size={14} className="mt-0.5" aria-hidden="true" /><span>{rule}</span></p>) : <span className="text-xs text-muted">No avoid conditions added for this setup yet.</span>}</div></Field>
      </div>
    </FormSection>

    <FormSection title="Screenshots" description="Capture the plan before entry and the outcome after exit.">
      <div className="grid gap-5 lg:grid-cols-2"><ScreenshotUpload label="Before Trade" name="beforeScreenshot" initialUrl={initialTrade?.beforeScreenshot ?? draft?.beforeScreenshot ?? undefined} /><ScreenshotUpload label="After Trade" name="afterScreenshot" initialUrl={initialTrade?.afterScreenshot ?? draft?.afterScreenshot ?? undefined} /></div>
      <p className="mt-3 text-xs text-muted">PNG, JPEG, and WebP screenshots upload to private Neon Object Storage when you save the trade (maximum 8 MB each).</p>
    </FormSection>

    <FormSection title="Journal Notes" description="Write what matters while the decision is still fresh.">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextArea name="entryReason" label="Why did I enter this trade?" defaultValue={initialTrade?.entryReason ?? draft?.entryReason} />
        <TextArea name="wentWell" label="What went well?" defaultValue={initialTrade?.wentWell ?? draft?.wentWell} />
        <TextArea name="wentWrong" label="What went wrong?" defaultValue={initialTrade?.wentWrong ?? draft?.wentWrong} />
        <TextArea name="improvement" label="What could I improve?" defaultValue={initialTrade?.improvement ?? draft?.improvement} />
      </div>
    </FormSection>

    <FormSection title="Psychology" description="Keep this honest and simple.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Did I follow my trading rules?"><Segmented name="followedRules" options={["Yes", "No"]} defaultValue={(initialTrade?.followedRules ?? draft?.followedRules) === false ? "No" : "Yes"} /></Field>
        <ThemedSelect name="emotion" label="Emotion" options={emotions} defaultValue={initialTrade?.emotion ?? draft?.emotion} />
        <ThemedSelect name="psychologyReady" label={`Am I ready to lose $${Number(numbers.risk || 0).toFixed(2)}?`} options={["Yes", "No"]} defaultValue={(initialTrade?.psychologyReady ?? draft?.psychologyReady) ? "Yes" : "No"} />
        <TextArea name="psychologyAnswer" label="Why am I taking this trade, even if it loses?" defaultValue={initialTrade?.psychologyAnswer ?? draft?.psychologyAnswer} />
      </div>
    </FormSection>

    {formError && <div role="alert" className="rounded-[9px] border border-loss/40 bg-loss/5 px-4 py-3 text-sm text-loss"><p>{formError}</p>{Object.entries(fieldErrors).map(([field, errors]) => <p key={field} className="mt-1">{field}: {errors.join(", ")}</p>)}</div>}
    {formNotice && <div role="status" className="rounded-[9px] border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">{formNotice}</div>}
    <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
      <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      {!initialTrade && <Button type="submit" name="intent" value="draft" formNoValidate disabled={pending} variant="secondary" className="min-w-36"><Save size={16} />Save as Draft</Button>}
      <Button type="submit" name="intent" value="complete" disabled={pending} variant="primary" className="min-w-36">{progress === "saved" ? <Check size={16} /> : pending ? <Spinner label={progress === "uploading" ? "Uploading screenshot" : "Saving trade"} /> : <Save size={16} />}{progress === "saved" ? "Saved" : pending ? (progress === "uploading" ? "Uploading..." : "Saving...") : initialTrade ? "Update Trade" : "Complete Journal"}</Button>
    </div>
  </form>;
}

function FormSection({ title, description, headerRight, children }: { title: string; description: string; headerRight?: ReactNode; children: ReactNode }) {
  return <section className="rounded-[9px] border border-line bg-surface"><div className="flex items-start justify-between gap-4 rounded-t-[9px] border-b border-line px-5 py-4"><div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-muted">{description}</p></div>{headerRight}</div><div className="p-5">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex h-full min-h-0 flex-col"><span className="mb-2 block shrink-0 text-sm font-medium text-[#cbd3d8]">{label}</span>{children}</label>;
}

function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return <Field label={label}><textarea name={name} defaultValue={defaultValue} className="form-input" placeholder="Write a clear, honest note..." /></Field>;
}

function Readout({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  return <div><p className="mb-2 text-sm font-medium text-[#cbd3d8]">{label}</p><div className={cn("flex h-[42px] items-center rounded-[9px] border border-[#263443] bg-[#0b1219] px-[13px] text-sm font-medium tabular-nums", tone === "positive" && "text-profit", tone === "negative" && "text-loss", tone === "default" && "text-white")}>{value}</div></div>;
}

function Segmented({ name, options, defaultValue, onChange, tone = "default" }: { name: string; options: readonly string[]; defaultValue: string; onChange?: (value: string) => void; tone?: "default" | "direction" }) {
  return <div className="grid h-[42px] grid-cols-2 rounded-[9px] border border-[var(--field-border)] bg-[var(--field)] p-1">{options.map(option => <label key={option} className="relative cursor-pointer"><input className="peer sr-only" type="radio" name={name} value={option} defaultChecked={option === defaultValue} onChange={() => onChange?.(option)} /><span className={cn("flex h-full items-center justify-center rounded-md text-sm text-muted transition-colors peer-focus-visible:outline peer-focus-visible:outline-2",tone === "direction" ? option === "Long" ? "peer-checked:bg-profit/10 peer-checked:font-semibold peer-checked:text-profit peer-focus-visible:outline-profit" : "peer-checked:bg-loss/10 peer-checked:font-semibold peer-checked:text-loss peer-focus-visible:outline-loss" : "peer-checked:bg-accent/12 peer-checked:font-semibold peer-checked:text-accent peer-focus-visible:outline-accent")}>{option}</span></label>)}</div>;
}

