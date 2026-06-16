import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceGroupWithMembers, DeviceWithAssignments } from "@/lib/console-sync";
import { assignPlaylistToDevice, ensureActivePlaylistForDevice } from "@/lib/screen-playlist";
import { useConsoleDataStore } from "@/stores/console-data-store";

export function findGroupContainingDevice(
  deviceGroups: DeviceGroupWithMembers[],
  deviceId: string,
  exceptGroupId?: string | null,
): DeviceGroupWithMembers | null {
  return (
    deviceGroups.find(
      (entry) =>
        entry.member_device_ids.includes(deviceId) &&
        (exceptGroupId == null || entry.id !== exceptGroupId),
    ) ?? null
  );
}

/** Remove screens from every group except the target (one group per screen). */
export async function removeDeviceFromOtherGroups(
  supabase: SupabaseClient,
  deviceIds: string[],
  targetGroupId: string,
): Promise<{ error: string | null }> {
  if (deviceIds.length === 0) return { error: null };

  const { error } = await supabase
    .from("device_group_members")
    .delete()
    .in("device_id", deviceIds)
    .neq("group_id", targetGroupId);

  return { error: error?.message ?? null };
}

export function patchStoreAfterDevicesMovedToGroup(
  targetGroupId: string,
  movedDeviceIds: string[],
  playlistId?: string | null,
): void {
  if (movedDeviceIds.length === 0) return;

  useConsoleDataStore.setState((state) => ({
    deviceGroups: state.deviceGroups.map((entry) => {
      if (entry.id === targetGroupId) {
        return {
          ...entry,
          playlist_id: playlistId ?? entry.playlist_id,
          member_device_ids: [...new Set([...entry.member_device_ids, ...movedDeviceIds])],
        };
      }
      return {
        ...entry,
        member_device_ids: entry.member_device_ids.filter((id) => !movedDeviceIds.includes(id)),
      };
    }),
  }));
}

/** Assign screens to a group, evicting them from any other group first. */
export async function moveDevicesIntoGroup(
  supabase: SupabaseClient,
  ownerId: string,
  group: DeviceGroupWithMembers,
  deviceIds: string[],
): Promise<{ playlistId: string | null; error: string | null }> {
  if (deviceIds.length === 0) {
    return { playlistId: group.playlist_id, error: null };
  }

  const { error: evictError } = await removeDeviceFromOtherGroups(supabase, deviceIds, group.id);
  if (evictError) {
    return { playlistId: null, error: evictError };
  }

  const toInsert = deviceIds.filter((id) => !group.member_device_ids.includes(id));
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("device_group_members").insert(
      toInsert.map((deviceId) => ({ group_id: group.id, device_id: deviceId })),
    );
    if (insertError) {
      return { playlistId: null, error: insertError.message };
    }
  }

  const groupWithMembers: DeviceGroupWithMembers = {
    ...group,
    member_device_ids: [...new Set([...group.member_device_ids, ...deviceIds])],
  };

  const { playlistId, error: ensureError } = await ensurePlaylistForGroup(supabase, ownerId, groupWithMembers);
  if (ensureError || !playlistId) {
    return { playlistId: null, error: ensureError ?? "Unable to prepare group playlist" };
  }

  const { error: assignError } = await assignGroupPlaylistToDevices(supabase, playlistId, deviceIds);
  if (assignError) {
    return { playlistId, error: assignError };
  }

  return { playlistId, error: null };
}

export async function ensurePlaylistForGroup(
  supabase: SupabaseClient,
  ownerId: string,
  group: Pick<DeviceGroupWithMembers, "id" | "name" | "playlist_id">,
): Promise<{ playlistId: string | null; error: string | null }> {
  if (group.playlist_id) {
    return { playlistId: group.playlist_id, error: null };
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert({ owner_id: ownerId, name: `${group.name} — group` })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { playlistId: null, error: error?.message ?? "Unable to create group playlist" };
  }

  const { error: linkError } = await supabase
    .from("device_groups")
    .update({ playlist_id: data.id })
    .eq("id", group.id);

  if (linkError) {
    return { playlistId: null, error: linkError.message };
  }

  return { playlistId: data.id, error: null };
}

export async function assignGroupPlaylistToDevices(
  supabase: SupabaseClient,
  playlistId: string,
  deviceIds: string[],
): Promise<{ error: string | null }> {
  for (const deviceId of deviceIds) {
    const assignError = await assignPlaylistToDevice(supabase, deviceId, playlistId);
    if (assignError) {
      return { error: assignError };
    }
  }
  return { error: null };
}

export async function syncGroupPlaylistToMembers(
  supabase: SupabaseClient,
  ownerId: string,
  group: DeviceGroupWithMembers,
): Promise<{ playlistId: string | null; error: string | null }> {
  const { playlistId, error: ensureError } = await ensurePlaylistForGroup(supabase, ownerId, group);
  if (ensureError || !playlistId) {
    return { playlistId: null, error: ensureError ?? "Unable to prepare group playlist" };
  }

  if (group.member_device_ids.length === 0) {
    return { playlistId, error: null };
  }

  const { error } = await assignGroupPlaylistToDevices(supabase, playlistId, group.member_device_ids);
  return { playlistId, error };
}

export async function restoreIndividualPlaylistForDevice(
  supabase: SupabaseClient,
  ownerId: string,
  device: DeviceWithAssignments,
  groupPlaylistId?: string | null,
): Promise<{ playlistId: string | null; error: string | null }> {
  if (groupPlaylistId) {
    const previousScreenPlaylist = (device.device_playlists ?? [])
      .filter((row) => row.playlist_id !== groupPlaylistId)
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
      )[0];

    if (previousScreenPlaylist) {
      const assignError = await assignPlaylistToDevice(supabase, device.id, previousScreenPlaylist.playlist_id);
      if (assignError) {
        return { playlistId: null, error: assignError };
      }
      return { playlistId: previousScreenPlaylist.playlist_id, error: null };
    }

    const { data, error } = await supabase
      .from("playlists")
      .insert({ owner_id: ownerId, name: `${device.name} — screen` })
      .select("id")
      .single();

    if (error || !data?.id) {
      return { playlistId: null, error: error?.message ?? "Unable to create playlist" };
    }

    const assignError = await assignPlaylistToDevice(supabase, device.id, data.id);
    if (assignError) {
      return { playlistId: null, error: assignError };
    }
    return { playlistId: data.id, error: null };
  }

  const { playlistId, error } = await ensureActivePlaylistForDevice(supabase, ownerId, device);
  return { playlistId, error };
}

export async function restoreIndividualPlaylistsForDevices(
  supabase: SupabaseClient,
  ownerId: string,
  devices: DeviceWithAssignments[],
  groupPlaylistId?: string | null,
): Promise<{ error: string | null }> {
  for (const device of devices) {
    const { error } = await restoreIndividualPlaylistForDevice(supabase, ownerId, device, groupPlaylistId);
    if (error) {
      return { error };
    }
  }
  return { error: null };
}

export async function removeDeviceFromGroup(
  supabase: SupabaseClient,
  ownerId: string,
  group: Pick<DeviceGroupWithMembers, "id" | "name" | "playlist_id">,
  device: DeviceWithAssignments,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("device_group_members")
    .delete()
    .eq("group_id", group.id)
    .eq("device_id", device.id);
  if (error) {
    return { error: error.message };
  }

  const { error: restoreError } = await restoreIndividualPlaylistForDevice(
    supabase,
    ownerId,
    device,
    group.playlist_id,
  );
  if (restoreError) {
    return { error: restoreError };
  }

  useConsoleDataStore.setState((state) => ({
    deviceGroups: state.deviceGroups.map((entry) =>
      entry.id === group.id
        ? {
            ...entry,
            member_device_ids: entry.member_device_ids.filter((id) => id !== device.id),
          }
        : entry,
    ),
  }));

  return { error: null };
}
