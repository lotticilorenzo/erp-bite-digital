import { Fragment, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditLog, useEntityAuditLog, type AuditLogEntry } from "@/hooks/useAuditLog";
import { useUsers } from "@/hooks/useUsers";

const TABLE_OPTIONS = [
  "commesse",
  "clienti",
  "progetti",
  "timesheet",
  "users",
  "preventivi",
  "fatture_attive",
  "fatture_passive",
  "movimenti_cassa",
  "regole_riconciliazione",
];

type AuditLogTableProps = {
  tabella?: string;
  recordId?: string;
  hideFilters?: boolean;
  defaultLimit?: number;
  title?: string;
  compact?: boolean;
};

type DiffRow = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm", { locale: it });
  } catch {
    return value;
  }
}

function actionBadgeClass(action: string) {
  const normalized = action.toUpperCase();
  if (normalized.includes("DELETE") || normalized.includes("ELIM")) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }
  if (normalized.includes("CREATE") || normalized.includes("CREA")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (normalized.includes("APPROV")) {
    return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  }
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toDiffRows(entry: AuditLogEntry): DiffRow[] {
  const before = entry.dati_prima ?? {};
  const after = entry.dati_dopo ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  if (!keys.length) {
    return [
      {
        field: "payload",
        before: valueToString(entry.dati_prima),
        after: valueToString(entry.dati_dopo),
        changed: true,
      },
    ];
  }

  return keys.map((field) => {
    const beforeValue = valueToString(before[field]);
    const afterValue = valueToString(after[field]);
    return {
      field,
      before: beforeValue,
      after: afterValue,
      changed: beforeValue !== afterValue,
    };
  });
}

function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.split(" ").filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "??";
}

function entityLabel(entry: AuditLogEntry) {
  return `${entry.tabella} · ${entry.record_id.slice(0, 8)}`;
}

function detailLabel(entry: AuditLogEntry) {
  const diffs = toDiffRows(entry).filter((row) => row.changed);
  if (!diffs.length) return "Nessun delta strutturato disponibile";
  return diffs
    .slice(0, 2)
    .map((row) => `${row.field}: ${row.after !== "-" ? row.after : row.before}`)
    .join(" · ");
}

export function AuditLogTable({
  tabella,
  recordId,
  hideFilters = false,
  defaultLimit = 50,
  title,
  compact = false,
}: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedTable, setSelectedTable] = useState(tabella ?? "all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const isEntityView = !!tabella && !!recordId;

  const filters = useMemo(
    () => ({
      tabella: !hideFilters && selectedTable !== "all" ? selectedTable : undefined,
      user_id: !hideFilters && selectedUserId !== "all" ? selectedUserId : undefined,
      from_date: !hideFilters && fromDate ? fromDate : undefined,
      to_date: !hideFilters && toDate ? toDate : undefined,
      limit: defaultLimit,
      offset: 0,
    }),
    [defaultLimit, fromDate, hideFilters, selectedTable, selectedUserId, toDate],
  );

  const entityFilters = useMemo(
    () => ({
      from_date: !hideFilters && fromDate ? fromDate : undefined,
      to_date: !hideFilters && toDate ? toDate : undefined,
      limit: defaultLimit,
      offset: 0,
    }),
    [defaultLimit, fromDate, hideFilters, toDate],
  );

  const globalAudit = useAuditLog(filters, !isEntityView);
  const entityAudit = useEntityAuditLog(tabella, recordId, entityFilters, isEntityView);
  const { data: users = [] } = useUsers(true, !hideFilters);

  const response = isEntityView ? entityAudit.data : globalAudit.data;
  const isLoading = isEntityView ? entityAudit.isLoading : globalAudit.isLoading;
  const items = response?.items ?? [];

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h3>
        </div>
      )}

      {!hideFilters && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Utente</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome} {user.cognome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isEntityView && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Tabella</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {TABLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Dal</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Al</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Quando</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Chi</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Azione</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Entità</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Dettaglio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento audit trail...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nessuna voce audit trovata con i filtri correnti.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((entry) => {
                const diffRows = toDiffRows(entry).filter((row) => row.changed);
                const isExpanded = expandedId === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-[10px] font-black text-primary">
                            {initials(entry.user_nome)}
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            {entry.user_nome ?? "Sistema"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-black uppercase ${actionBadgeClass(entry.azione)}`}>
                          {entry.azione}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {entityLabel(entry)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-3">
                          <span className="line-clamp-2 text-xs text-muted-foreground">{detailLabel(entry)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={5} className={compact ? "p-4" : "p-5"}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Prima</p>
                              <div className="mt-3 space-y-2">
                                {diffRows.length === 0 && (
                                  <p className="text-xs text-muted-foreground">Nessun valore precedente disponibile.</p>
                                )}
                                {diffRows.map((row) => (
                                  <div key={`before-${entry.id}-${row.field}`} className="rounded-xl border border-red-500/10 bg-background/50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.field}</p>
                                    <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-red-300">{row.before}</pre>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Dopo</p>
                              <div className="mt-3 space-y-2">
                                {diffRows.length === 0 && (
                                  <p className="text-xs text-muted-foreground">Nessun valore aggiornato disponibile.</p>
                                )}
                                {diffRows.map((row) => (
                                  <div key={`after-${entry.id}-${row.field}`} className="rounded-xl border border-emerald-500/10 bg-background/50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.field}</p>
                                    <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-emerald-300">{row.after}</pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {response?.total ?? 0} modifiche trovate
      </div>
    </div>
  );
}
