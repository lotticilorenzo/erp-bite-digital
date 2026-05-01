const STUDIO_ONLY_ROLES = new Set(["COLLABORATORE", "DIPENDENTE", "FREELANCER", "PM"]);
const ERP_ACCESS_ROLES = new Set(["ADMIN", "DEVELOPER"]);
const FINANCE_ACCESS_ROLES = ERP_ACCESS_ROLES;

export function normalizeRole(role?: string | null) {
  return role?.toUpperCase() ?? "";
}

export function isStudioOnlyRole(role?: string | null) {
  return STUDIO_ONLY_ROLES.has(normalizeRole(role));
}

export function hasErpAccess(role?: string | null) {
  return ERP_ACCESS_ROLES.has(normalizeRole(role));
}

export function hasFinanceAccess(role?: string | null) {
  return FINANCE_ACCESS_ROLES.has(normalizeRole(role));
}
