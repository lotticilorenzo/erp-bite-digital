import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  user_nome?: string | null;
  tabella: string;
  record_id: string;
  azione: string;
  dati_prima?: Record<string, any>;
  dati_dopo?: Record<string, any>;
  created_at: string;
}

export interface AuditLogResponse {
  total: number;
  items: AuditLogEntry[];
}

export interface AuditLogParams {
  tabella?: string;
  record_id?: string;
  user_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export function useAuditLog(params?: AuditLogParams, enabled: boolean = true) {
  return useQuery<AuditLogResponse>({
    queryKey: ["audit-log", params],
    queryFn: async () => {
      const { data } = await api.get("/audit-log", { params });
      return data;
    },
    enabled,
    staleTime: 30000,
  });
}

export function useEntityAuditLog(
  tabella: string | undefined,
  recordId: string | undefined,
  params?: Omit<AuditLogParams, "tabella" | "record_id">,
  enabled: boolean = true,
) {
  return useQuery<AuditLogResponse>({
    queryKey: ["audit-log-entity", tabella, recordId, params],
    queryFn: async () => {
      const { data } = await api.get(`/audit-log/entity/${tabella}/${recordId}`, { params });
      return data;
    },
    enabled: enabled && !!tabella && !!recordId,
    staleTime: 30000,
  });
}
