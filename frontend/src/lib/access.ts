const STUDIO_ONLY_ROLES = new Set(["COLLABORATORE", "DIPENDENTE", "FREELANCER", "PM"]);
// MANUTENTORE = super-admin (Fase M): superset di ADMIN, non deve perdere alcun accesso esistente.
const ERP_ACCESS_ROLES = new Set(["ADMIN", "DEVELOPER", "MANUTENTORE"]);
const FINANCE_ACCESS_ROLES = ERP_ACCESS_ROLES;
const MANUTENTORE_ROLES = new Set(["MANUTENTORE"]);

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

/** Vero solo per il super-admin (gestione utenti, impostazioni sistema). */
export function isManutentore(role?: string | null) {
  return MANUTENTORE_ROLES.has(normalizeRole(role));
}
