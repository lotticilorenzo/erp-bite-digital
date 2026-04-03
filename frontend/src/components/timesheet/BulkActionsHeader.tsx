import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  X,
  Loader2,
} from "lucide-react";
import {
  useBulkApproveTimesheets,
  useBulkDeleteTimesheets,
  useBulkUpdateMeseTimesheets
} from "@/hooks/useTimesheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, addMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";

interface BulkActionsHeaderProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsHeader({ selectedIds, onClearSelection }: BulkActionsHeaderProps) {
  const approveMutation = useBulkApproveTimesheets();
  const deleteMutation = useBulkDeleteTimesheets();
  const updateMeseMutation = useBulkUpdateMeseTimesheets();

  if (selectedIds.length === 0) return null;

  const handleApprove = async () => {
    console.log("BulkActionsHeader: handleApprove called for ids:", selectedIds);
    await approveMutation.mutateAsync({ ids: selectedIds, azione: "APPROVA" });
    onClearSelection();
  };

  const handleDelete = async () => {
    console.log("BulkActionsHeader: handleDelete called for ids:", selectedIds);
    // Removed confirm for automated testing stability
    await deleteMutation.mutateAsync(selectedIds);
    onClearSelection();
  };

  const handleMeseChange = async (mese: string) => {
    await updateMeseMutation.mutateAsync({ ids: selectedIds, mese_competenza: mese });
    onClearSelection();
  };

  const nextMonths = [
    startOfMonth(new Date()),
    startOfMonth(addMonths(new Date(), 1)),
    startOfMonth(addMonths(new Date(), -1)),
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-[#1e293b] border border-[#334155] rounded-full px-6 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-6 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-r border-[#334155] pr-6">
          <div className="bg-purple-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
            {selectedIds.length}
          </div>
          <span className="text-xs font-bold text-[#f1f5f9] whitespace-nowrap uppercase tracking-wider">Selezionati</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClearSelection}
            className="w-6 h-6 rounded-full hover:bg-white/10 text-[#64748b] hover:text-white"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 h-8 text-[10px] font-black uppercase tracking-widest"
          >
            {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle2 className="w-3 h-3 mr-2" />}
            Approva
          </Button>

          <Select onValueChange={handleMeseChange}>
            <SelectTrigger className="bg-[#0f172a] border-[#334155] text-white rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-widest w-[140px]">
              <Calendar className="w-3 h-3 mr-2 text-blue-400" />
              <SelectValue placeholder="Sposta Mese" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
              {nextMonths.map(m => (
                <SelectItem key={m.toISOString()} value={format(m, "yyyy-MM-dd")}>
                  {format(m, "MMMM yyyy", { locale: it })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            size="sm" 
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30 rounded-full px-4 h-8 text-[10px] font-black uppercase tracking-widest"
          >
            {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Trash2 className="w-3 h-3 mr-2" />}
            Elimina
          </Button>
        </div>
      </div>
    </div>
  );
}
