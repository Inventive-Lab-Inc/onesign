import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Asset library “+ Add” — muted at rest, theme green on hover/focus (see globals.css). */
export const mediaLibraryAddButtonClassName = "media-library-add-btn";
