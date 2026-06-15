import type { MediaGroupWithMembers } from "@/lib/console-sync";

export type MediaFolderEntry = {
  group: MediaGroupWithMembers;
  fileCount: number;
};

export function mediaFolderParentId(group: Pick<MediaGroupWithMembers, "parent_id">): string | null {
  return group.parent_id ?? null;
}

export function childMediaFolders(
  groups: MediaGroupWithMembers[],
  parentId: string | null,
): MediaGroupWithMembers[] {
  return groups.filter((group) => mediaFolderParentId(group) === parentId);
}

export function buildMediaFolderEntries(
  groups: MediaGroupWithMembers[],
  parentId: string | null,
  searchQuery = "",
): MediaFolderEntry[] {
  const query = searchQuery.trim().toLowerCase();
  let folders = childMediaFolders(groups, parentId);
  if (query) {
    folders = folders.filter((group) => group.name.toLowerCase().includes(query));
  }
  return folders.map((group) => ({
    group,
    fileCount: group.member_media_ids.length,
  }));
}

export function searchMediaFolderEntries(
  groups: MediaGroupWithMembers[],
  searchQuery: string,
): MediaFolderEntry[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [];
  return groups
    .filter((group) => group.name.toLowerCase().includes(query))
    .map((group) => ({
      group,
      fileCount: group.member_media_ids.length,
    }));
}

export function findMediaFolderContainingFile(
  groups: MediaGroupWithMembers[],
  mediaId: string,
): MediaGroupWithMembers | null {
  return groups.find((group) => group.member_media_ids.includes(mediaId)) ?? null;
}

export type MediaFolderTreeRow = {
  group: MediaGroupWithMembers;
  depth: number;
  pathNames: string[];
  pathLabel: string;
};

export function flattenMediaFolderTree(groups: MediaGroupWithMembers[]): MediaFolderTreeRow[] {
  const byParent = new Map<string | null, MediaGroupWithMembers[]>();

  for (const group of groups) {
    const parentId = mediaFolderParentId(group);
    const siblings = byParent.get(parentId) ?? [];
    siblings.push(group);
    byParent.set(parentId, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const rows: MediaFolderTreeRow[] = [];

  function walk(parentId: string | null, pathNames: string[]) {
    for (const group of byParent.get(parentId) ?? []) {
      const nextPath = [...pathNames, group.name];
      rows.push({
        group,
        depth: pathNames.length,
        pathNames: nextPath,
        pathLabel: nextPath.join(" / "),
      });
      walk(group.id, nextPath);
    }
  }

  walk(null, []);
  return rows;
}
