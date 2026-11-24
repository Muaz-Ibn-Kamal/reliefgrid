import type { Role } from "@/generated/prisma/client";
export const ADMIN: Role = "SYSTEM_ADMIN";
export const COORD: Role = "EMERGENCY_COORDINATOR";
export const ORG: Role = "RELIEF_ORGANIZATION";
export const VOL: Role = "VOLUNTEER";
export const SHELTER: Role = "SHELTER_MANAGER";

export const OPS = [ADMIN, COORD] as const;           // coordinate emergency operations
export const ALL = [ADMIN, COORD, ORG, VOL, SHELTER] as const;
export const STAFF = [ADMIN, COORD, ORG, SHELTER] as const; // everyone except volunteers

/** Navigation visibility per role (UI only; every API route re-checks on the server). */
export const NAV: { href: string; label: string; icon: string; roles: readonly Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ALL },
  { href: "/incidents", label: "Incidents", icon: "Siren", roles: ALL },
  { href: "/requests", label: "Emergency Requests", icon: "LifeBuoy", roles: [ADMIN, COORD, ORG] },
  { href: "/resources", label: "Resources", icon: "Boxes", roles: [ADMIN, COORD, ORG] },
  { href: "/allocations", label: "Allocation", icon: "Truck", roles: [ADMIN, COORD, ORG] },
  { href: "/shelters", label: "Shelters", icon: "Home", roles: [ADMIN, COORD, ORG, SHELTER] },
  { href: "/tasks", label: "My Tasks", icon: "ClipboardCheck", roles: [VOL] },
  { href: "/volunteers", label: "Volunteers", icon: "Users", roles: [ADMIN, COORD] },
  { href: "/teams", label: "Teams", icon: "UsersRound", roles: [ADMIN, COORD, ORG, VOL] },
  { href: "/map", label: "Map View", icon: "Map", roles: ALL },
  { href: "/reports", label: "Reports & Analytics", icon: "BarChart3", roles: [ADMIN, COORD, ORG] },
  { href: "/users", label: "User Management", icon: "Shield", roles: [ADMIN] },
  { href: "/profile", label: "Profile", icon: "UserCog", roles: ALL },
];
