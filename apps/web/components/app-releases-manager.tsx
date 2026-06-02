"use client";

import type { AppRelease } from "@signage/types";
import { CheckCircle2, Download, FileUp, History, Package, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function releaseApkPublicUrl(publicBaseUrl: string, storagePath: string): string {
  const base = publicBaseUrl.replace(/\/$/, "");
  const path = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/releases/${path}`;
}

function releaseApkDownloadName(release: AppRelease): string {
  const safeVersion = release.version_name.replace(/[^\w.-]+/g, "-");
  return `onesign-tv-v${safeVersion}.apk`;
}

function ReleaseRow({
  release,
  publicBaseUrl,
  onActivate,
  onDelete,
  showDownload,
}: {
  release: AppRelease;
  publicBaseUrl: string;
  onActivate: (id: string) => void;
  onDelete: (release: AppRelease) => void;
  showDownload?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">
            v{release.version_name}
            <span className="ml-1.5 font-normal text-muted-foreground">({release.version_code})</span>
          </span>
          {release.is_active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-brand-badge dark:text-brand-onDark">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Active
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{formatReleaseDate(release.created_at)}</p>
        {release.release_notes ? (
          <p className="text-sm text-muted-foreground">{release.release_notes}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showDownload && release.is_active && publicBaseUrl ? (
          <a
            href={releaseApkPublicUrl(publicBaseUrl, release.storage_path)}
            download={releaseApkDownloadName(release)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download APK
          </a>
        ) : null}
        {!release.is_active ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => onActivate(release.id)}>
              Activate
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDelete(release)}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AppReleasesManager({ userId }: { userId: string }) {
  const publicBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [versionCode, setVersionCode] = useState("");
  const [versionName, setVersionName] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [apkFile, setApkFile] = useState<File | null>(null);

  const activeRelease = useMemo(() => releases.find((r) => r.is_active) ?? null, [releases]);
  const previousReleases = useMemo(() => releases.filter((r) => !r.is_active), [releases]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("version_code", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setReleases((data ?? []) as AppRelease[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPublish = useCallback(async () => {
    if (!apkFile) {
      toast.error("Choose an APK file first.");
      return;
    }
    const parsedCode = Number.parseInt(versionCode, 10);
    if (!Number.isFinite(parsedCode) || parsedCode <= 0) {
      toast.error("Version code must be a positive integer (must increase every release).");
      return;
    }
    if (!versionName.trim()) {
      toast.error("Version name is required (for example 0.2.0).");
      return;
    }

    setUploading(true);
    try {
      const digest = await sha256Hex(apkFile);
      const objectPath = `android/${parsedCode}-${crypto.randomUUID()}.apk`;
      const { error: uploadError } = await supabase.storage.from("releases").upload(objectPath, apkFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/vnd.android.package-archive",
      });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("app_releases")
        .insert({
          version_code: parsedCode,
          version_name: versionName.trim(),
          storage_path: objectPath,
          sha256: digest,
          release_notes: releaseNotes.trim() || null,
          package_name: "dev.signage.tv",
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        toast.error(insertError?.message ?? "Could not save release metadata.");
        return;
      }

      const { error: activateError } = await supabase.rpc("activate_app_release", {
        p_release_id: inserted.id,
      });
      if (activateError) {
        toast.error(activateError.message);
        return;
      }

      toast.success(`Published v${versionName.trim()} — TVs will pick this up on their next update check.`);
      setVersionCode("");
      setVersionName("");
      setReleaseNotes("");
      setApkFile(null);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [apkFile, refresh, releaseNotes, supabase, userId, versionCode, versionName]);

  const onActivate = useCallback(
    async (releaseId: string) => {
      const { error } = await supabase.rpc("activate_app_release", { p_release_id: releaseId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Release activated.");
      await refresh();
    },
    [refresh, supabase],
  );

  const onDelete = useCallback(
    async (release: AppRelease) => {
      if (release.is_active) {
        toast.error("Activate a different release before deleting the active one.");
        return;
      }
      const { error: storageError } = await supabase.storage.from("releases").remove([release.storage_path]);
      if (storageError) {
        toast.error(storageError.message);
        return;
      }
      const { error } = await supabase.from("app_releases").delete().eq("id", release.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Release deleted.");
      await refresh();
    },
    [refresh, supabase],
  );

  return (
    <section className="mb-7 space-y-6 border-b border-border pb-7">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Package className="h-[1.125rem] w-[1.125rem] text-brand" strokeWidth={2} aria-hidden />
          <h2 className="text-base font-semibold text-foreground">TV app updates (OTA)</h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Paired TVs check for updates on startup and every few hours. They download the{" "}
          <span className="font-medium text-foreground">active</span> build and prompt to install when a newer{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">versionCode</code> is available.
        </p>
      </div>

      {/* Active release */}
      <div className="rounded-xl border border-border bg-muted/30">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Active release</h3>
          <p className="text-xs text-muted-foreground">What TVs and new installs receive today.</p>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
        ) : activeRelease ? (
          <ReleaseRow
            release={activeRelease}
            publicBaseUrl={publicBaseUrl}
            onActivate={(id) => void onActivate(id)}
            onDelete={(r) => void onDelete(r)}
            showDownload
          />
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">No active release yet. Publish one below.</div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Publish form */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Publish new release</h3>
            <p className="text-xs text-muted-foreground">Upload a signed APK and make it the active rollout.</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="release-version-code">Version code</Label>
                <Input
                  id="release-version-code"
                  type="number"
                  min={1}
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  placeholder="5"
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">Integer — must increase every release.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="release-version-name">Version name</Label>
                <Input
                  id="release-version-name"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="0.5.0"
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">Display label, e.g. 0.5.0</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-notes">Release notes</Label>
              <Input
                id="release-notes"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Bug fixes and performance improvements"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-apk">Release APK</Label>
              <label
                htmlFor="release-apk"
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors",
                  uploading ? "pointer-events-none opacity-60" : "hover:border-brand/40 hover:bg-muted/40",
                )}
              >
                <FileUp className="h-8 w-8 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium text-foreground">
                  {apkFile ? apkFile.name : "Choose APK file"}
                </span>
                <span className="text-xs text-muted-foreground">Signed Android package (.apk)</span>
                <input
                  id="release-apk"
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  disabled={uploading}
                  className="sr-only"
                  onChange={(e) => setApkFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button type="button" className="w-full gap-2" disabled={uploading} onClick={() => void onPublish()}>
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? "Publishing…" : "Publish and activate"}
            </Button>
          </div>
        </div>

        {/* Previous releases */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold text-foreground">Previous releases</h3>
            </div>
            <p className="text-xs text-muted-foreground">Reactivate or remove older builds.</p>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
          ) : previousReleases.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No previous releases.</div>
          ) : (
            <ul className="divide-y divide-border">
              {previousReleases.map((release) => (
                <li key={release.id}>
                  <ReleaseRow
                    release={release}
                    publicBaseUrl={publicBaseUrl}
                    onActivate={(id) => void onActivate(id)}
                    onDelete={(r) => void onDelete(r)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
