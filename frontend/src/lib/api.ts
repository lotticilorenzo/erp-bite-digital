import axios, { type AxiosError } from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
});

// ── REQUEST INTERCEPTOR: inietta JWT ──────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("BITE_ERP_TOKEN");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Previene redirect multipli su 401 simultanei ──────────
let _isRedirectingToLogin = false;

// ── RESPONSE INTERCEPTOR: gestione errori centralizzata ───
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    const status = error.response?.status;

    if (status === 401 && !window.location.pathname.startsWith("/login")) {
      if (!_isRedirectingToLogin) {
        _isRedirectingToLogin = true;
        localStorage.removeItem("BITE_ERP_TOKEN");
        // Reset flag after navigation so future logins work
        setTimeout(() => { _isRedirectingToLogin = false; }, 3000);
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      toast.error("Non autorizzato a eseguire questa operazione");
    } else if (status === 404) {
      // 404 non mostra toast automatico — gestito dal componente
    } else if (status === 409) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Conflitto: record già esistente";
      toast.error(msg);
    } else if (status === 422) {
      // Validation error — estrai messaggio utile
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msgs = detail.map((d) => d.msg).join(", ");
        toast.error(`Dati non validi: ${msgs}`);
      } else if (typeof detail === "string") {
        toast.error(`Dati non validi: ${detail}`);
      } else {
        toast.error("Dati non validi — verifica i campi inseriti");
      }
    } else if (status === 429) {
      toast.error("Troppe richieste — riprova tra qualche secondo");
    } else if (status && status >= 500) {
      toast.error("Errore del server — riprova più tardi");
    }

    return Promise.reject(error);
  }
);

/** Estrae il messaggio di errore dall'eccezione Axios in modo leggibile */
export function getErrorMessage(error: unknown, fallback = "Operazione fallita"): string {
  if (!error) return fallback;
  const axiosErr = error as AxiosError<{ detail?: string | { msg: string }[] }>;
  const detail = axiosErr.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  return axiosErr.message || fallback;
}

export { api };
export default api;
