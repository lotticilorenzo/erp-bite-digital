import React from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, Download, Edit2, 
  Trash2, ArrowRight, CheckCircle2, XCircle, Clock, Send
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import type { Preventivo, PreventivoStatus } from "@/types/preventivi";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PreventivoReportPDF } from "./PreventivoReportPDF";

interface Props {
  data: Preventivo[];
  onEdit: (p: Preventivo) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
  onStatusChange: (id: string, status: PreventivoStatus) => void;
}

const statusColors: Record<PreventivoStatus, string> = {
  BOZZA: "bg-muted/50 text-foreground border-border",
  INVIATO: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ACCETTATO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  RIFIUTATO: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  SCADUTO: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const statusIcons: Record<PreventivoStatus, React.ReactNode> = {
  BOZZA: <Clock className="w-3 h-3 mr-1" />,
  INVIATO: <ArrowRight className="w-3 h-3 mr-1" />,
  ACCETTATO: <CheckCircle2 className="w-3 h-3 mr-1" />,
  RIFIUTATO: <XCircle className="w-3 h-3 mr-1" />,
  SCADUTO: <Clock className="w-3 h-3 mr-1" />,
};

export const PreventiviTable: React.FC<Props> = ({ 
  data, onEdit, onDelete, onConvert, onStatusChange 
}) => {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/20">
          <TableRow>
            <TableHead className="w-[100px]">Codice</TableHead>
            <TableHead>Titolo / Oggetto</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Importo Lordo</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                Nessun preventivo trovato.
              </TableCell>
            </TableRow>
          ) : (
            data.map((p) => (
              <TableRow key={p.id} className="group hover:bg-muted/50 transition-colors">
                <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                  {p.numero}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground line-clamp-1">{p.titolo}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                      Creato il {format(parseISO(p.data_creazione), "dd/MM/yyyy")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-foreground truncate max-w-[150px] inline-block font-medium">
                    {p.cliente?.ragione_sociale || "N.D."}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Creazione: {format(parseISO(p.data_creazione), "dd/MM/yy")}</span>
                    {p.data_scadenza && (
                      <span className="text-[10px] text-rose-400 font-bold">Scadenza: {format(parseISO(p.data_scadenza), "dd/MM/yy")}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`${statusColors[p.stato]} font-bold text-[10px] py-0.5`}>
                    {statusIcons[p.stato]}
                    {p.stato}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-black text-foreground">
                  {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(p.importo_totale)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground">
                      <DropdownMenuLabel>Azioni Preventivo</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onEdit(p)} className="hover:bg-muted cursor-pointer">
                        <Edit2 className="w-4 h-4 mr-2" /> Modifica
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator className="bg-border" />
                      
                      <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Cambia Stato</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onStatusChange(p.id, 'INVIATO')} className="hover:bg-muted cursor-pointer">
                        <Send className="w-3 h-3 mr-2 text-blue-400" /> Segna come Inviato
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(p.id, 'ACCETTATO')} className="hover:bg-muted cursor-pointer">
                        <CheckCircle2 className="w-3 h-3 mr-2 text-emerald-400" /> Segna come Accettato
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(p.id, 'RIFIUTATO')} className="hover:bg-muted cursor-pointer">
                        <XCircle className="w-3 h-3 mr-2 text-rose-400" /> Segna come Rifiutato
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-border" />

                      {p.stato === 'ACCETTATO' && (
                        <DropdownMenuItem onClick={() => onConvert(p.id)} className="bg-primary/20 text-primary font-bold cursor-pointer">
                          <ArrowRight className="w-4 h-4 mr-2" /> Converti in Commessa
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem asChild className="hover:bg-muted cursor-pointer">
                        <PDFDownloadLink
                          document={<PreventivoReportPDF preventivo={p} />}
                          fileName={`Preventivo_${p.numero}_${p.cliente?.ragione_sociale.replace(/\s+/g, '_')}.pdf`}
                          className="w-full"
                        >
                          {({ loading }) => (
                            <div className="flex items-center text-foreground">
                              <Download className={`w-4 h-4 mr-2 ${loading ? 'animate-bounce' : ''}`} />
                              Scarica PDF
                            </div>
                          )}
                        </PDFDownloadLink>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-border" />

                      <DropdownMenuItem onClick={() => onDelete(p.id)} className="text-red-500 focus:text-red-400 hover:bg-red-500/10 cursor-pointer">
                        <Trash2 className="w-4 h-4 mr-2" /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
