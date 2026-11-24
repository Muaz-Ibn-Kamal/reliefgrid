export const ROLES = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_LABEL: Record<RoleName, string> = {
  SYSTEM_ADMIN: "System Admin",
  EMERGENCY_COORDINATOR: "Emergency Coordinator",
  RELIEF_ORGANIZATION: "Relief Organization",
  VOLUNTEER: "Volunteer",
  SHELTER_MANAGER: "Shelter Manager",
};

export const INCIDENT_CATEGORIES = ["FLOOD", "CYCLONE", "EARTHQUAKE", "FIRE", "LANDSLIDE", "INFRASTRUCTURE_FAILURE"] as const;
export const REQUEST_TYPES = ["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORT"] as const;
export const RESOURCE_CATEGORIES = ["FOOD", "WATER", "MEDICAL", "EMERGENCY_KIT", "BLANKET", "RESCUE_EQUIPMENT", "TRANSPORT"] as const;

/** Which resource categories can satisfy which request type (server-side allocation validation). */
export const REQUEST_RESOURCE_MAP: Record<(typeof REQUEST_TYPES)[number], readonly (typeof RESOURCE_CATEGORIES)[number][]> = {
  FOOD: ["FOOD", "EMERGENCY_KIT"],
  WATER: ["WATER"],
  MEDICAL: ["MEDICAL", "EMERGENCY_KIT"],
  SHELTER: ["BLANKET", "EMERGENCY_KIT"],
  RESCUE: ["RESCUE_EQUIPMENT", "TRANSPORT"],
  TRANSPORT: ["TRANSPORT"],
};

export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
