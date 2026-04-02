import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  Tag
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface MovimentiTableProps {
  data: any[];
  onRiconcilia?: (movimento: any) => void;
}

export function MovimentiTable({ data, onRiconcilia }: MovimentiTableProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#0f172a]/20 border border-dashed border-[#1e293b] rounded-3xl">
        <p className="text-[#475569] font-bold uppercase tracking-widest text-xs">Nessun movimento registrato</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[#1e293b]/50 bg-[#0f172a]/30 overflow-hidden backdrop-blur-sm">
      <Table>
        <TableHeader className="bg-[#0f172a]/50">
          <TableRow className="hover:bg-transparent border-[#1e293b]/50">
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-center">Data</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12">Descrizione</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12">Categoria</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-right">Importo</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-center">Stato</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const isEntry = Number(item.importo) > 0;
            return (
              <TableRow key={item.id} className="group border-[#1e293b]/30 hover:bg-white/5 transition-colors duration-300">
                <TableCell className="text-[10px] font-black text-white uppercase tabular-nums text-center">
                  {format(new Date(item.data_valuta), "dd MMM yyyy", { locale: it })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white truncate max-w-[300px]">
                      {item.descrizione || "Nessuna descrizione"}
                    </span>
                    {item.note && (
                      <span className="text-[9px] font-medium text-[#475569] italic truncate max-w-[300px]">
                        {item.note}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                   <Badge variant="outline" className="bg-[#1e293b]/30 border-[#1e293b] text-[#94a3b8] text-[9px] font-bold uppercase tracking-wider gap-1 px-2">
                     <Tag className="h-2.5 w-2.5" />
                     {item.categoria || "Altro"}
                   </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-mono text-xs font-black ${isEntry ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isEntry ? '+' : ''}{formatCurrency(item.importo)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {item.riconciliato ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold px-2 py-0.5 uppercase text-[9px] tracking-widest">
                       Riconciliato
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 font-bold px-2 py-0.5 uppercase text-[9px] tracking-widest">
                       In Attesa
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!item.riconciliato && (
                    <button 
                      onClick={() => onRiconcilia?.(item)}
                      className="h-8 w-8 rounded-lg bg-[#1e293b]/50 flex items-center justify-center text-[#475569] hover:text-white hover:bg-primary transition-all duration-300 shadow-lg"
                      title="Riconcilia con fattura"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
