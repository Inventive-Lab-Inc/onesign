import type { Website } from "@signage/types";
import { formatMediaAge } from "@/lib/media-display";
import { websitePreviewUrl } from "@/lib/website-playback";

export type WebsiteSort = "newest" | "oldest" | "name-asc" | "name-desc";

export function formatWebsiteMeta(website: Website): string {
  return `Website • ${formatMediaAge(website.created_at)}`;
}

export function sortWebsiteList(items: Website[], sort: WebsiteSort): Website[] {
  const copy = [...items];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "newest":
    default:
      return copy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
}

export function applyWebsiteSearchFilter(items: Website[], search: string): Website[] {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => {
    const haystack = [
      item.name,
      item.url ?? "",
      item.description ?? "",
      ...(item.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function websiteSourceLabel(sourceType: Website["source_type"]): string {
  if (sourceType === "html") return "Pasted HTML";
  if (sourceType === "file") return "Uploaded file";
  return "Website URL";
}

export function buildWebsiteInformationRows(website: Website): { label: string; value: string }[] {
  return [
    { label: "Created", value: formatMediaAge(website.created_at) },
    { label: "Type", value: websiteSourceLabel(website.source_type) },
    { label: "Preview URL", value: websitePreviewUrl(website) },
  ];
}
