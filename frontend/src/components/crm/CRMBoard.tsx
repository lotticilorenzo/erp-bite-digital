import { useState } from "react";
import { 
  Plus, 
} from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import type { CRMLead, CRMStage } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// ScrollArea import removed
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { CRMLeadCard } from "./CRMLeadCard";

interface CRMBoardProps {
  onSelectLead: (lead: CRMLead) => void;
}

export function CRMBoard({ onSelectLead }: CRMBoardProps) {
  const { stages, leads, updateLeadStage, createLead } = useCRM();
  const [activeLead, setActiveLead] = useState<CRMLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (over && active.id !== over.id) {
      const leadId = active.id as string;
      const newStageId = over.id as string;
      
      try {
        await updateLeadStage.mutateAsync({ id: leadId, stadio_id: newStageId });
      } catch (err) {
        toast.error("Errore durante lo spostamento");
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 w-full bg-background/20 rounded-3xl overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        <div className="flex gap-6 p-6 h-[calc(100vh-280px)] min-w-max">
          {stages.map((stage) => (
            <DroppableColumn 
              key={stage.id} 
              stage={stage} 
              leads={leads.filter(l => l.stadio_id === stage.id)}
              onSelectLead={onSelectLead}
              onNewLead={() => createLead.mutate({ nome_azienda: "Nuovo Lead", stadio_id: stage.id })}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeLead ? (
          <div className="w-80 opacity-90">
            <CRMLeadCard lead={activeLead} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({ 
  stage, 
  leads, 
  onSelectLead,
  onNewLead
}: { 
  stage: CRMStage; 
  leads: CRMLead[];
  onSelectLead: (lead: CRMLead) => void;
  onNewLead: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = leads.reduce((acc, l) => acc + Number(l.valore_stimato), 0);

  return (
    <div 
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] shrink-0 flex flex-col gap-4 rounded-3xl transition-colors ${
        isOver ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset shadow-inner' : 'bg-transparent'
      }`}
    >
      {/* Column Header */}
      <div className="flex flex-col gap-2 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.3)]" style={{ backgroundColor: stage.colore }} />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#475569]">{stage.nome}</h3>
            <Badge variant="outline" className="text-[9px] font-bold bg-white/5 border-white/5 text-[#64748b] h-4.5 px-1.5 flex items-center justify-center">
              {leads.length}
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onNewLead}
            className="h-7 w-7 text-[#1e293b] hover:text-primary hover:bg-primary/5 rounded-full"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#94a3b8] tabular-nums bg-white/5 w-fit px-2 py-0.5 rounded-full border border-white/5">
          €{totalValue.toLocaleString()}
        </div>
      </div>

      {/* Column Content */}
      <div className="flex-1 space-y-4 p-1 overflow-y-auto custom-scrollbar">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} onClick={() => onSelectLead(lead)} />
        ))}
        <Button 
          variant="ghost" 
          className="w-full justify-start h-12 px-4 text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-primary hover:bg-white/5 group border border-dashed border-white/5 rounded-2xl"
          onClick={onNewLead}
        >
          <Plus className="h-4 w-4 mr-3 group-hover:scale-125 transition-transform" />
          Aggiungi Lead
        </Button>
      </div>
    </div>
  );
}

function DraggableCard({ lead, onClick }: { lead: CRMLead; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={() => {
      // Prevent click while dragging
      if (transform) return;
      onClick();
    }}>
      <CRMLeadCard lead={lead} />
    </div>
  );
}
