export function getAdminPageTitle(pathname: string): string {
  if (pathname === "/admin") return "Clients";
  if (pathname === "/admin/audit") return "Audit log";
  if (pathname === "/admin/admins") return "Admins";
  if (pathname === "/admin/staff") return "Admins";
  if (pathname.startsWith("/admin/clients/") && pathname.includes("/groups/")) return "Group";
  if (pathname.startsWith("/admin/clients/") && pathname.includes("/devices/")) return "Screen";
  if (pathname.startsWith("/admin/clients/") && pathname.includes("/content/")) return "Content";
  if (pathname.startsWith("/admin/clients/") && pathname.includes("/websites/")) return "Website";
  if (pathname.startsWith("/admin/clients/") && pathname.includes("/playlists/")) return "Playlist";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/devices")) return "Screens";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/groups")) return "Groups";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/content")) return "Content";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/websites")) return "Websites";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/playlists")) return "Content";
  if (pathname.startsWith("/admin/clients/") && pathname.endsWith("/audit")) return "Audit log";
  if (pathname.startsWith("/admin/clients/")) return "Client";
  return "Admin";
}
