-- Optional short description shown under the screen name in the console.

alter table public.devices
  add column if not exists description text;

comment on column public.devices.description is
  'Optional subtitle for the screen (shown in the console and screen settings).';
