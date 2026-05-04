import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  User,
  Briefcase,
  Users,
  LayoutDashboard,
  Timer,
  CheckSquare,
  Calendar,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useStudio } from "@/hooks/useStudio";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { allProgetti, allClienti } = useStudio();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digita un comando o cerca..." />
      <CommandList className="max-h-[350px] overflow-y-auto">
        <CommandEmpty>Nessun risultato trovato.</CommandEmpty>
        <CommandGroup heading="Navigazione Rapida">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/studio-os/list"))}>
            <CheckSquare className="mr-2 h-4 w-4" />
            <span>Studio OS - Task</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/planning"))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Execution Hub</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/progetti"))}>
            <Briefcase className="mr-2 h-4 w-4" />
            <span>Progetti</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/clienti"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Clienti</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/commesse"))}>
            <Briefcase className="mr-2 h-4 w-4" />
            <span>Commesse</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/timesheet"))}>
            <Timer className="mr-2 h-4 w-4" />
            <span>Timesheet</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Progetti Recenti">
          {allProgetti.slice(0, 10).map((p) => (
            <CommandItem
              key={p.id}
              onSelect={() => runCommand(() => navigate(`/progetti/${p.id}`))}
            >
              <Briefcase className="mr-2 h-4 w-4 text-primary" />
              <span>{p.nome}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Clienti">
          {allClienti.slice(0, 10).map((c) => (
            <CommandItem
              key={c.id}
              onSelect={() => runCommand(() => navigate(`/clienti/${c.id}`))}
            >
              <User className="mr-2 h-4 w-4 text-emerald-500" />
              <span>{c.ragione_sociale}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Impostazioni">
          <CommandItem onSelect={() => runCommand(() => navigate("/settings/profile"))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profilo</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings/appearance"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Aspetto</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
