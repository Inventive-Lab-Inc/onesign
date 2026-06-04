"use client";

import type { Media } from "@signage/types";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MEDIA_UPLOAD_ACCEPT, uploadMediaFiles } from "@/lib/upload-media";

export function useMediaUpload(
  ownerId: string,
  options?: {
    onComplete?: (media: Media[]) => void | Promise<void>;
    /** When false, caller owns react-dropzone (e.g. full-page Media library). */
    withDropzone?: boolean;
  },
) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { syncNow } = useConsoleSync();
  const [uploading, setUploading] = useState(false);
  const onComplete = options?.onComplete;

  const uploadFiles = useCallback(
    async (files: File[]): Promise<Media[]> => {
      if (files.length === 0) return [];
      setUploading(true);
      try {
        const { uploaded, errors } = await uploadMediaFiles(supabase, ownerId, files);
        for (const message of errors) {
          toast.error(message);
        }
        for (const row of uploaded) {
          toast.success(`Uploaded ${row.original_filename ?? row.storage_path}`);
        }
        if (uploaded.length > 0) {
          await syncNow();
          await onComplete?.(uploaded);
        }
        return uploaded;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        toast.error(message);
        return [];
      } finally {
        setUploading(false);
      }
    },
    [onComplete, ownerId, supabase, syncNow],
  );

  const withDropzone = options?.withDropzone !== false;
  const dropzone = useDropzone({
    onDrop: (accepted) => {
      void uploadFiles(accepted);
    },
    accept: MEDIA_UPLOAD_ACCEPT,
    multiple: true,
    disabled: uploading || !withDropzone,
    noClick: true,
    noKeyboard: true,
  });

  return {
    uploading,
    uploadFiles,
    open: dropzone.open,
    getInputProps: dropzone.getInputProps,
    isDragActive: withDropzone ? dropzone.isDragActive : false,
  };
}
