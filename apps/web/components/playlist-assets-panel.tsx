"use client";

import type { Media, Website } from "@signage/types";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { FileImage, Globe, GripVertical, Images, Plus, Search, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { contentLibraryPath, useAdminClientRoutes } from "@/components/admin/admin-client-route-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { formatWebsiteMeta } from "@/lib/website-display";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { ItemActionMenu } from "@/components/console/item-action-menu";
import {
  formatMediaUploadLabel,
  MediaUploadProgressBar,
} from "@/components/media/media-upload-progress";
import { useMediaItemActions } from "@/hooks/use-media-item-actions";
import { cn, mediaLibraryAddButtonClassName } from "@/lib/utils";

type LibraryTab = "content" | "websites";

function LibraryThumb({ media }: { media: Media }) {
  const url = mediaPublicUrl(media.storage_path);
  return (
    <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {media.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="56px" />
      ) : media.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function WebsiteLibraryThumb({ website }: { website: Website }) {
  return (
    <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      <WebsitePreviewFrame website={website} className="pointer-events-none h-full w-full" />
      <span className="absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded bg-black/70 text-white">
        <Globe className="h-2.5 w-2.5" aria-hidden />
      </span>
    </div>
  );
}

interface PlaylistAssetsPanelProps {
  droppableId: string;
  libraryResetKey: number;
  librarySearch: string;
  onLibrarySearchChange: (value: string) => void;
  filteredLibrary: Media[];
  filteredWebsites: Website[];
  onAddMedia: (mediaId: string) => void;
  onAddWebsite: (websiteId: string) => void;
  ownerId?: string;
  workspaceId?: string | null;
  readOnly?: boolean;
  storageFull?: boolean;
  addDisabled?: boolean;
  addDisabledHint?: string;
}

export function PlaylistAssetsPanel({
  droppableId,
  libraryResetKey,
  librarySearch,
  onLibrarySearchChange,
  filteredLibrary,
  filteredWebsites,
  onAddMedia,
  onAddWebsite,
  ownerId,
  workspaceId,
  readOnly = false,
  storageFull = false,
  addDisabled = false,
  addDisabledHint,
}: PlaylistAssetsPanelProps) {
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("content");
  const adminRoutes = useAdminClientRoutes();
  const contentLibraryHref = contentLibraryPath(adminRoutes);
  const canUpload = Boolean(ownerId) && !readOnly && !storageFull && libraryTab === "content";
  const { uploading, uploadProgress, open, getInputProps } = useMediaUpload(ownerId ?? "", { workspaceId });
  const { buildActionItems, actionDialogs } = useMediaItemActions({
    userId: ownerId ?? "",
    readOnly,
    menuScope: "playlist-picker",
  });
  const activeDroppableId = libraryTab === "content" ? droppableId : `${droppableId}-websites`;
  const mediaName = (media: Media) => media.original_filename ?? media.storage_path;

  return (
    <aside className="w-full min-w-0 shrink-0 lg:w-full">
      <input {...getInputProps()} />
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Content library</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {libraryTab === "content"
                  ? "Drag onto the playlist, tap +, or upload."
                  : "Drag onto the playlist or tap + to add."}
              </p>
            </div>
            {canUpload ? (
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 gap-1.5 bg-brand px-2.5 text-brand-contrast shadow-sm hover:bg-brand-hover"
                disabled={uploading}
                title={uploadProgress ? formatMediaUploadLabel(uploadProgress) : "Upload files"}
                aria-label={uploadProgress ? formatMediaUploadLabel(uploadProgress) : "Upload files"}
                onClick={() => open()}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Upload
              </Button>
            ) : null}
          </div>

          <div className="mt-3 flex items-end gap-4 border-b border-border/80">
            <button
              type="button"
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium transition-colors",
                libraryTab === "content"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLibraryTab("content")}
            >
              <Images className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Content
            </button>
            <button
              type="button"
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium transition-colors",
                libraryTab === "websites"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLibraryTab("websites")}
            >
              <Globe className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Websites
            </button>
            <Link
              href={contentLibraryHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mb-1.5 ml-auto shrink-0",
              )}
            >
              Manage all content
            </Link>
          </div>

          {uploadProgress ? (
            <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <MediaUploadProgressBar progress={uploadProgress} compact />
            </div>
          ) : null}

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={librarySearch}
              onChange={(e) => onLibrarySearchChange(e.target.value)}
              placeholder={libraryTab === "content" ? "Search content…" : "Search websites…"}
              className="h-9 border-border bg-background pl-8 text-sm"
              aria-label={libraryTab === "content" ? "Search content library" : "Search websites"}
            />
          </div>
        </div>
        <div className="max-h-[min(520px,55vh)] overflow-y-auto p-3">
          {storageFull && !readOnly && libraryTab === "content" ? (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs leading-relaxed text-red-900 dark:text-red-100">
              Storage is full. Delete files from Content library or upgrade your plan.
            </p>
          ) : null}
          {libraryTab === "content" ? (
            <Droppable droppableId={activeDroppableId} key={`${libraryResetKey}-content`}>
              {(libProvided) => (
                <ul ref={libProvided.innerRef} {...libProvided.droppableProps} className="space-y-2">
                  {filteredLibrary.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                      {addDisabled && addDisabledHint ? (
                        addDisabledHint
                      ) : canUpload ? (
                        <>
                          No content yet.{" "}
                          <button
                            type="button"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                            onClick={() => open()}
                          >
                            Upload files
                          </button>
                        </>
                      ) : (
                        "No content in your library yet."
                      )}
                    </li>
                  ) : (
                    filteredLibrary.map((m, index) => (
                      <Draggable key={m.id} draggableId={`media-${m.id}`} index={index}>
                        {(dragProvided, snapshot) => (
                          <li
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 pr-2 shadow-sm",
                              snapshot.isDragging && "opacity-90 ring-2 ring-brand-faint30",
                            )}
                          >
                            <button
                              type="button"
                              className="flex shrink-0 cursor-grab touch-none items-center self-stretch px-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                              aria-label={`Drag ${m.original_filename ?? m.storage_path}`}
                              {...dragProvided.dragHandleProps}
                            >
                              <GripVertical className="h-4 w-4" aria-hidden />
                            </button>
                            <LibraryThumb media={m} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{mediaName(m)}</p>
                              <p className="text-[0.625rem] capitalize text-muted-foreground">{m.file_type}</p>
                            </div>
                            {ownerId ? (
                              <ItemActionMenu
                                ariaLabel={`Actions for ${mediaName(m)}`}
                                items={buildActionItems(m)}
                                className="shrink-0"
                              />
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className={cn(mediaLibraryAddButtonClassName, "h-8 w-8 p-0")}
                              disabled={addDisabled}
                              title={addDisabled ? addDisabledHint : "Add to playlist"}
                              aria-label={addDisabled ? addDisabledHint : "Add to playlist"}
                              onClick={() => onAddMedia(m.id)}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </li>
                        )}
                      </Draggable>
                    ))
                  )}
                  {libProvided.placeholder}
                </ul>
              )}
            </Droppable>
          ) : (
            <Droppable droppableId={activeDroppableId} key={`${libraryResetKey}-websites`}>
              {(libProvided) => (
                <ul ref={libProvided.innerRef} {...libProvided.droppableProps} className="space-y-2">
                  {filteredWebsites.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                      {addDisabled && addDisabledHint
                        ? addDisabledHint
                        : "No websites yet. Create one from the Websites page."}
                    </li>
                  ) : (
                    filteredWebsites.map((website, index) => (
                      <Draggable key={website.id} draggableId={`website-${website.id}`} index={index}>
                        {(dragProvided, snapshot) => (
                          <li
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 pr-2 shadow-sm",
                              snapshot.isDragging && "opacity-90 ring-2 ring-brand-faint30",
                            )}
                          >
                            <button
                              type="button"
                              className="flex shrink-0 cursor-grab touch-none items-center self-stretch px-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                              aria-label={`Drag ${website.name}`}
                              {...dragProvided.dragHandleProps}
                            >
                              <GripVertical className="h-4 w-4" aria-hidden />
                            </button>
                            <WebsiteLibraryThumb website={website} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{website.name}</p>
                              <p className="text-[0.625rem] text-muted-foreground">{formatWebsiteMeta(website)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className={cn(mediaLibraryAddButtonClassName, "h-8 w-8 p-0")}
                              disabled={addDisabled}
                              title={addDisabled ? addDisabledHint : "Add to playlist"}
                              aria-label={addDisabled ? addDisabledHint : "Add to playlist"}
                              onClick={() => onAddWebsite(website.id)}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </li>
                        )}
                      </Draggable>
                    ))
                  )}
                  {libProvided.placeholder}
                </ul>
              )}
            </Droppable>
          )}
        </div>
      </div>
      {ownerId ? actionDialogs : null}
    </aside>
  );
}
