"use client";

import type { Device, DeviceScreenOrientation } from "@signage/types";
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConsoleSync } from "@/components/console/console-sync-provider";
import { DeviceOrientationPicker } from "@/components/devices/device-orientation-picker";
import { DeviceSideDrawer } from "@/components/devices/device-side-drawer";
import { DeviceTagsEditor } from "@/components/devices/device-tags-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeDeviceScreenOrientation } from "@/lib/device-screen-orientation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleDataStore } from "@/stores/console-data-store";

export function DeviceSettingsDrawer({
  device,
  open,
  onClose,
  canEdit = true,
}: {
  device: Device;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const supabase = getSupabaseBrowserClient();
  const { syncNow } = useConsoleSync();
  const patchDevice = useConsoleDataStore((s) => s.patchDevice);

  const [name, setName] = useState(device.name);
  const [description, setDescription] = useState(device.description ?? "");
  const [orientation, setOrientation] = useState<DeviceScreenOrientation>(
    normalizeDeviceScreenOrientation(device.screen_orientation),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(device.name);
    setDescription(device.description ?? "");
    setOrientation(normalizeDeviceScreenOrientation(device.screen_orientation));
  }, [open, device]);

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Enter a screen name.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          name: trimmedName,
          description: description.trim() || null,
          screen_orientation: orientation,
        })
        .eq("id", device.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      patchDevice(device.id, {
        name: trimmedName,
        description: description.trim() || null,
        screen_orientation: orientation,
      });
      await syncNow();
      toast.success("Screen settings saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DeviceSideDrawer
      open={open}
      onClose={onClose}
      title="Screen settings"
      subtitle={canEdit ? "Name, description, orientation, and tags" : device.name}
      footer={
        canEdit ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="screen-settings-name">Name</Label>
          <Input
            id="screen-settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canEdit || saving}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screen-settings-description">Description</Label>
          <Input
            id="screen-settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={!canEdit || saving}
            placeholder="Optional subtitle for this screen"
          />
        </div>

        <div className="space-y-2">
          <Label>Screen orientation</Label>
          <DeviceOrientationPicker
            value={orientation}
            onChange={setOrientation}
            disabled={!canEdit || saving}
          />
        </div>

        <DeviceTagsEditor device={device} canEdit={canEdit} />
      </div>
    </DeviceSideDrawer>
  );
}

export function DeviceSettingsDrawerButton({
  device,
  canEdit = true,
}: {
  device: Device;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        Settings
      </Button>
      <DeviceSettingsDrawer device={device} open={open} onClose={() => setOpen(false)} canEdit={canEdit} />
    </>
  );
}
