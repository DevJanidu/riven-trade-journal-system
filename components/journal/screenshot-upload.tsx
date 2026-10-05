"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScreenshotUpload({ label, name, initialUrl }: { label: string; name: string; initialUrl?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [cleared, setCleared] = useState(false);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  function select(file?: File) {
    if (file && ["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setPreview(URL.createObjectURL(file));
      setCleared(false);
      if (inputRef.current && inputRef.current.files?.[0] !== file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        inputRef.current.files = transfer.files;
      }
    }
  }
  const imageUrl = initialUrl && (initialUrl.startsWith("trades/") || initialUrl.startsWith("users/")) ? `/api/uploads/${initialUrl}` : initialUrl;
  const display = cleared ? undefined : preview ?? imageUrl;
  return <div><p className="mb-2 text-sm font-medium text-secondary">{label}</p>
    <input ref={inputRef} name={name} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => select(event.target.files?.[0])} />
    <input type="hidden" name={`${name}Removed`} value={cleared ? "true" : "false"} />
    {display ? <div className="relative overflow-hidden border border-line bg-background"><Image src={display} alt={`${label} preview`} width={1200} height={675} unoptimized className="aspect-video w-full object-cover" /><button type="button" onClick={() => { setPreview(undefined); if (inputRef.current) inputRef.current.value = ""; setCleared(true); }} aria-label={`Remove ${label} image`} className="focus-ring absolute right-2 top-2 grid size-8 place-items-center rounded bg-black/70 text-white"><X size={16} /></button></div>
      : <button type="button" onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files[0]); }} className={cn("focus-ring flex aspect-video w-full flex-col items-center justify-center border border-dashed bg-background-secondary text-center transition-colors", dragging ? "border-accent bg-accent/5" : "border-line hover:border-line-strong")}><ImagePlus size={23} className="mb-3 text-muted" /><span className="text-sm font-medium text-secondary">Drop chart screenshot here</span><span className="mt-1 text-xs text-muted">or click to browse · PNG, JPG, WEBP (max 8 MB)</span></button>}
  </div>;
}
