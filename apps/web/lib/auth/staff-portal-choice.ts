export const STAFF_PORTAL_CHOICE_KEY = "onesign-staff-portal-choice";

export type StaffPortalChoice = "admin" | "user";

export function getStaffPortalChoice(): StaffPortalChoice | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(STAFF_PORTAL_CHOICE_KEY);
  return value === "admin" || value === "user" ? value : null;
}

export function setStaffPortalChoice(choice: StaffPortalChoice): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STAFF_PORTAL_CHOICE_KEY, choice);
}

export function clearStaffPortalChoice(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STAFF_PORTAL_CHOICE_KEY);
}
