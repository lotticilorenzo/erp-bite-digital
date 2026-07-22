import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

export type ScadenzaTipo = "attiva" | "passiva" | "fiscale" | "contributiva" | "finanziaria";
export type ScadenzaStato = "aperta" | "parziale" | "chiusa" | "scaduta";
export type ScadenzaControparte = "cliente" | "fornitore" | "erario" | "inps" | "banca" | "altro";
export type ScadenzaOrigine = "fic" | "manuale" | "ricorrenza" | "f24" | "progetto";
export type RicorrenzaPeriodicita = "settimanale" | "mensile" | "bimestrale" | "trimestrale" | "semestrale" | "annuale";

export interface Scadenza {
  id: string;
  tipo: ScadenzaTipo;
  data_attesa: string;
  importo: number;
  stato: ScadenzaStato;
  importo_incassato: number;
  importo_residuo: number;
  controparte_tipo: ScadenzaControparte | null;
  controparte_id: string | null;
  documento_rif: string | null;
  origine: ScadenzaOrigine;
  milestone: string | null;
  note: string | null;
}

export interface ScadenzaInput {
  tipo: ScadenzaTipo;
  data_attesa: string;
  importo: number;
  importo_incassato?: number;
  controparte_tipo?: ScadenzaControparte | null;
  documento_rif?: string | null;
  origine: ScadenzaOrigine;
  note?: string | null;
}

export interface Ricorrenza {
  id: string;
  descrizione: string;
  tipo_scadenza: ScadenzaTipo;
  importo: number;
  periodicita: RicorrenzaPeriodicita;
  giorno_riferimento: number | null;
  data_inizio: string;
  data_fine: string | null;
  prossima_data: string | null;
  controparte_tipo: ScadenzaControparte | null;
  attivo: boolean;
}

export interface RicorrenzaInput {
  descrizione: string;
  tipo_scadenza: ScadenzaTipo;
  importo: number;
  periodicita: RicorrenzaPeriodicita;
  giorno_riferimento?: number | null;
  data_inizio: string;
  data_fine?: string | null;
  controparte_tipo?: ScadenzaControparte | null;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["scadenze"], exact: false });
  qc.invalidateQueries({ queryKey: ["ricorrenze"], exact: false });
  qc.invalidateQueries({ queryKey: ["proiezione-cassa"], exact: false });
}

export function useScadenze(filtri: { tipo?: string; stato?: string } = {}) {
  return useQuery<Scadenza[]>({
    queryKey: ["scadenze", filtri],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filtri.tipo) params.tipo = filtri.tipo;
      if (filtri.stato) params.stato = filtri.stato;
      const { data } = await api.get<{ scadenze: Scadenza[] }>("/scadenze", { params });
      return data.scadenze;
    },
  });
}

export function useCreateScadenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScadenzaInput) => (await api.post("/scadenze", payload)).data,
    onSuccess: () => { invalidate(qc); toast.success("Scadenza creata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore creazione"),
  });
}

export function useUpdateScadenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScadenzaInput> }) => (await api.patch(`/scadenze/${id}`, data)).data,
    onSuccess: () => { invalidate(qc); toast.success("Scadenza aggiornata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore aggiornamento"),
  });
}

export function useDeleteScadenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/scadenze/${id}`); },
    onSuccess: () => { invalidate(qc); toast.success("Scadenza eliminata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore eliminazione"),
  });
}

/** "Segna pagata": porta l'incassato al pieno importo (chiude la scadenza). */
export function useSegnaPagataScadenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Scadenza) => (await api.patch(`/scadenze/${s.id}`, { importo_incassato: s.importo })).data,
    onSuccess: () => { invalidate(qc); toast.success("Scadenza segnata come pagata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore aggiornamento"),
  });
}

export function useRicorrenze(filtri: { attivo?: boolean } = {}) {
  return useQuery<Ricorrenza[]>({
    queryKey: ["ricorrenze", filtri],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filtri.attivo !== undefined) params.attivo = String(filtri.attivo);
      const { data } = await api.get<{ ricorrenze: Ricorrenza[] }>("/ricorrenze", { params });
      return data.ricorrenze;
    },
  });
}

export function useCreateRicorrenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RicorrenzaInput) => (await api.post("/ricorrenze", payload)).data,
    onSuccess: () => { invalidate(qc); toast.success("Ricorrenza creata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore creazione"),
  });
}

export function useUpdateRicorrenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RicorrenzaInput> & { attivo?: boolean } }) => (await api.patch(`/ricorrenze/${id}`, data)).data,
    onSuccess: () => { invalidate(qc); toast.success("Ricorrenza aggiornata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore aggiornamento"),
  });
}

export function useDeleteRicorrenza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/ricorrenze/${id}`); },
    onSuccess: () => { invalidate(qc); toast.success("Ricorrenza eliminata"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore eliminazione"),
  });
}

export function useGeneraRicorrenze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ricorrenza_id: string; fino_a: string }) => (await api.post("/ricorrenze/genera", payload)).data,
    onSuccess: (data: any) => { invalidate(qc); toast.success(`Generate ${data?.occorrenze_create ?? 0} occorrenze`); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore generazione"),
  });
}
