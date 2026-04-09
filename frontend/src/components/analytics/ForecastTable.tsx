import { addMonths, format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClienteAffidabilita } from "@/types";

interface ForecastItem {
  clienteId?: string;
  cliente: string;
  clienteCode?: string;
  months: number[];
  affidabilita: ClienteAffidabilita;
}

interface ForecastTableProps {
  data: ForecastItem[];
  totals: number[];
  costoMO: number;
  costoStruttura: number;
  loading?: boolean;
  onClienteClick?: (clienteId: string) => void;
  onAffidabilitaChange?: (clienteId: string, affidabilita: ClienteAffidabilita) => void;
  updatingClienteId?: string | null;
  baseDate?: Date;
}

const affidabilitaStyles: Record<ClienteAffidabilita, string> = {
  ALTA: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  MEDIA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  BASSA: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ForecastTable({
  data,
  totals,
  costoMO,
  costoStruttura,
  loading,
  onClienteClick,
  onAffidabilitaChange,
  updatingClienteId,
  baseDate,
}: ForecastTableProps) {
  const referenceDate = baseDate || new Date();
  const nextMonths = [
    addMonths(referenceDate, 1),
    addMonths(referenceDate, 2),
    addMonths(referenceDate, 3),
  ];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

  const marginePrevisto = totals.map((total) => {
    const totaleCosti = Math.abs(costoMO) + Math.abs(costoStruttura);
    if (total === 0) return 0;
    return ((total - totaleCosti) / total) * 100;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <h3 className="text-lg font-black tracking-tight text-foreground">Forecast 3 mesi</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
            Storico ultimi 3 mesi - solo RETAINER
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/40 bg-card/30 shadow-2xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="py-3 text-[10px] font-black uppercase tracking-widest">
                Cliente
              </TableHead>
              {nextMonths.map((month, index) => (
                <TableHead
                  key={index}
                  className="py-3 text-right text-[10px] font-black uppercase tracking-widest"
                >
                  {format(month, "MMM yyyy", { locale: it })}
                </TableHead>
              ))}
              <TableHead className="py-3 text-right text-[10px] font-black uppercase tracking-widest">
                Affidabilita
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nessun dato retainer trovato
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => {
                const isClickable = !!item.clienteId && !!onClienteClick;
                const isEditable = !!item.clienteId && !!onAffidabilitaChange;
                const isUpdating = updatingClienteId === item.clienteId;

                return (
                  <TableRow
                    key={item.clienteId || index}
                    className={`border-border/30 transition-colors ${
                      isClickable ? "cursor-pointer hover:bg-muted/20" : "hover:bg-muted/20"
                    }`}
                    onClick={isClickable ? () => onClienteClick?.(item.clienteId!) : undefined}
                  >
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span
                          className={`text-xs font-bold ${
                            isClickable ? "text-foreground hover:text-primary" : "text-foreground"
                          }`}
                        >
                          {item.cliente}
                        </span>
                        <span className="text-[9px] font-black uppercase opacity-50 text-muted-foreground">
                          {item.clienteCode}
                        </span>
                      </div>
                    </TableCell>

                    {item.months.map((value, monthIndex) => (
                      <TableCell key={monthIndex} className="py-3 text-right text-xs font-medium">
                        {formatCurrency(value)}
                      </TableCell>
                    ))}

                    <TableCell
                      className="py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isEditable ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center justify-end gap-2 rounded-xl border border-border/50 bg-card/40 px-3 py-1.5 transition-colors hover:bg-muted/30"
                            >
                              <Badge
                                variant="outline"
                                className={`${affidabilitaStyles[item.affidabilita]} min-w-[72px] justify-center rounded-xl border text-[9px] font-black uppercase tracking-widest`}
                              >
                                {item.affidabilita}
                              </Badge>
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="rounded-3xl border-border/50 bg-card/40 text-foreground shadow-2xl"
                          >
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              Affidabilita
                            </DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={item.affidabilita}
                              onValueChange={(value) =>
                                onAffidabilitaChange(
                                  item.clienteId!,
                                  value as ClienteAffidabilita
                                )
                              }
                            >
                              {(["ALTA", "MEDIA", "BASSA"] as ClienteAffidabilita[]).map((value) => (
                                <DropdownMenuRadioItem
                                  key={value}
                                  value={value}
                                  className="cursor-pointer text-xs font-bold uppercase tracking-widest focus:bg-muted"
                                >
                                  <span className={affidabilitaStyles[value].split(" ")[1]}>{value}</span>
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`${affidabilitaStyles[item.affidabilita]} rounded-xl border text-[9px] font-black uppercase tracking-widest`}
                        >
                          {item.affidabilita}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>

          <tfoot className="border-t border-border/60 bg-muted/10">
            <TableRow className="font-bold hover:bg-transparent">
              <TableCell className="py-4 text-xs uppercase tracking-tighter">
                Fatturabile totale
              </TableCell>
              {totals.map((total, index) => (
                <TableCell
                  key={index}
                  className="py-4 text-right text-xs font-black text-purple-400"
                >
                  {formatCurrency(total)}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
            <TableRow className="!border-t-0 text-muted-foreground hover:bg-transparent">
              <TableCell className="py-2 text-[10px] font-bold uppercase tracking-tight">
                Costo MO (media 3m)
              </TableCell>
              {totals.map((_, index) => (
                <TableCell key={index} className="py-2 text-right text-[10px] font-bold">
                  - {formatCurrency(costoMO)}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
            <TableRow className="!border-t-0 text-muted-foreground hover:bg-transparent">
              <TableCell className="py-2 text-[10px] font-bold uppercase tracking-tight">
                Costo struttura
              </TableCell>
              {totals.map((_, index) => (
                <TableCell key={index} className="py-2 text-right text-[10px] font-bold">
                  - {formatCurrency(costoStruttura)}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
            <TableRow className="!border-t border-border/20 hover:bg-transparent">
              <TableCell className="py-4 text-xs font-black uppercase text-red-500">
                Margine previsto
              </TableCell>
              {marginePrevisto.map((margin, index) => (
                <TableCell
                  key={index}
                  className={`py-4 text-right text-sm font-black ${
                    margin < 0 ? "text-red-500" : "text-green-500"
                  }`}
                >
                  {margin.toFixed(0)}%
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          </tfoot>
        </Table>
      </div>

      <div className="flex items-center gap-4 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${affidabilitaStyles.ALTA} rounded-xl border text-[9px] font-black uppercase tracking-widest`}
          >
            ALTA
          </Badge>
          <span>cliente molto stabile</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${affidabilitaStyles.MEDIA} rounded-xl border text-[9px] font-black uppercase tracking-widest`}
          >
            MEDIA
          </Badge>
          <span>andamento regolare</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${affidabilitaStyles.BASSA} rounded-xl border text-[9px] font-black uppercase tracking-widest`}
          >
            BASSA
          </Badge>
          <span>cliente da monitorare</span>
        </div>
        <div className="ml-auto italic">Clienti senza storico RETAINER non inclusi</div>
      </div>
    </div>
  );
}
