"use client";

import type { WebsiteSourceType } from "@signage/types";
import { Globe, Info, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WebsiteEditorTab = "url" | "html" | "file";

type WebsiteEditorDialogProps = {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

export function WebsiteEditorDialog({ open, ownerId, onClose, onCreated }: WebsiteEditorDialogProps) {
  const titleId = useId();
  const [tab, setTab] = useState<WebsiteEditorTab>("url");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("url");
    setName("");
    setUrl("");
    setHtmlContent("");
    setUploadFile(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setUploadFile(file);
    if (!name.trim()) {
      const base = file.name.replace(/\.(html|htm)$/i, "");
      setName(base);
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/html": [".html", ".htm"] },
    multiple: false,
    disabled: saving,
  });

  async function saveWebsite() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required.");
      return;
    }

    setSaving(true);
    try {
      if (tab === "file") {
        if (!uploadFile) {
          toast.error("Choose an HTML file to upload.");
          return;
        }
        const formData = new FormData();
        formData.set("ownerId", ownerId);
        formData.set("name", trimmedName);
        formData.set("file", uploadFile);
        const response = await fetch("/api/websites/upload", { method: "POST", body: formData });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          toast.error(payload.error ?? "Upload failed.");
          return;
        }
      } else {
        const response = await fetch("/api/websites/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId,
            name: trimmedName,
            sourceType: tab as WebsiteSourceType,
            url: tab === "url" ? url : undefined,
            htmlContent: tab === "html" ? htmlContent : undefined,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          toast.error(payload.error ?? "Unable to save website.");
          return;
        }
      }

      toast.success(`${trimmedName} successfully created.`);
      onClose();
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save website.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const tabs: { id: WebsiteEditorTab; label: string }[] = [
    { id: "url", label: "Add Website URL" },
    { id: "html", label: "Paste HTML" },
    { id: "file", label: "Upload File" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" aria-hidden />
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Add website
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-border px-5">
          <div className="flex gap-6 overflow-x-auto">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "border-b-2 py-3 text-sm font-medium transition-colors",
                  tab === entry.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {tab === "url" ? (
            <>
              <p className="text-sm text-muted-foreground">Please enter the website address (URL)</p>
              <div className="space-y-2">
                <Label htmlFor="website-url">URL *</Label>
                <Input
                  id="website-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.example.com"
                />
                <p className="text-xs text-muted-foreground">e.g. https://www.google.com</p>
              </div>
            </>
          ) : null}

          {tab === "html" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Paste HTML code directly here. If you have a code snippet for an HTML5 widget, enter it here.
              </p>
              <div className="space-y-2">
                <Label htmlFor="website-html">Paste HTML code here *</Label>
                <textarea
                  id="website-html"
                  value={htmlContent}
                  onChange={(event) => setHtmlContent(event.target.value)}
                  rows={10}
                  className="min-h-[12rem] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
            </>
          ) : null}

          {tab === "file" ? (
            <div
              {...getRootProps()}
              className={cn(
                "flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors",
                isDragActive && "border-primary bg-primary/5",
              )}
            >
              <input {...getInputProps()} />
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Upload className="h-7 w-7 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">Drag and drop HTML file here</p>
              {uploadFile ? (
                <p className="mt-2 text-xs text-muted-foreground">{uploadFile.name}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">.html or .htm up to 5 MB</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="website-name">Name *</Label>
            <Input id="website-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          {tab === "url" ? (
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>A reliable internet connection is required to display online content</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <Button type="button" disabled={saving} onClick={() => void saveWebsite()}>
            {saving ? "Saving…" : tab === "file" ? "Upload" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
