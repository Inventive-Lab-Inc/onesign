"use client";

import type { Media } from "@signage/types";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ArrowUpRight, FileImage, Plus, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { cn, mediaLibraryAddButtonClassName } from "@/lib/utils";

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

interface PlaylistAssetsPanelProps {
  droppableId: string;
  libraryResetKey: number;
  librarySearch: string;
  libraryHref: string;
  onLibrarySearchChange: (value: string) => void;
  filteredLibrary: Media[];
  onAddMedia: (mediaId: string) => void;
  addDisabled?: boolean;
  addDisabledHint?: string;
}

export function PlaylistAssetsPanel({
  droppableId,
  libraryResetKey,
  librarySearch,
  libraryHref,
  onLibrarySearchChange,
  filteredLibrary,
  onAddMedia,
  addDisabled = false,
  addDisabledHint,
}: PlaylistAssetsPanelProps) {
  return (
    <aside className="w-full shrink-0 lg:w-[300px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">From library</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Search, drag, or tap Add. Upload new files in Library.</p>
            </div>
            <Link
              href={libraryHref}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              Library
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={librarySearch}
              onChange={(e) => onLibrarySearchChange(e.target.value)}
              placeholder="Search library…"
              className="h-9 border-border bg-background pl-8 text-sm"
              aria-label="Search library"
            />
          </div>
        </div>
        <div className="max-h-[min(520px,55vh)] overflow-y-auto p-3">
          <Droppable droppableId={droppableId} key={libraryResetKey}>
            {(libProvided) => (
              <ul ref={libProvided.innerRef} {...libProvided.droppableProps} className="space-y-2">
                {filteredLibrary.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    {addDisabled && addDisabledHint ? (
                      addDisabledHint
                    ) : (
                      <>
                        No files in your library yet.{" "}
                        <Link href={libraryHref} className="font-medium text-brand-strong underline-offset-4 hover:underline">
                          Upload in Library
                        </Link>
                      </>
                    )}
                  </li>
                ) : (
                  filteredLibrary.map((m, index) => (
                    <Draggable key={m.id} draggableId={`media-${m.id}`} index={index}>
                      {(dragProvided, snapshot) => (
                        <li
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 pr-2 shadow-sm",
                            snapshot.isDragging && "opacity-90 ring-2 ring-brand-faint30",
                          )}
                        >
                          <LibraryThumb media={m} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{m.original_filename ?? m.storage_path}</p>
                            <p className="text-[0.625rem] capitalize text-muted-foreground">{m.file_type}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className={mediaLibraryAddButtonClassName}
                            disabled={addDisabled}
                            title={addDisabled ? addDisabledHint : "Add to playlist"}
                            onClick={() => onAddMedia(m.id)}
                          >
                            <Plus className="h-3 w-3" />
                            Add
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
        </div>
      </div>
    </aside>
  );
}
