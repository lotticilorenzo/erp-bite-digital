import { 
  Moon, 
  Sun, 
  Check, 
  Layout, 
  Type, 
  Palette
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import type { ThemeAccent, ThemeDensity, ThemeFontSize } from "@/context/ThemeContext";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ACCENTS: { id: ThemeAccent; label: string; color: string }[] = [
  { id: "violet", label: "Viola", color: "bg-primary" },
  { id: "blue", label: "Blu", color: "bg-[#3b82f6]" },
  { id: "green", label: "Verde", color: "bg-[#10b981]" },
  { id: "orange", label: "Arancione", color: "bg-[#f59e0b]" },
  { id: "pink", label: "Rosa", color: "bg-[#ec4899]" },
  { id: "slate", label: "Slate", color: "bg-[#64748b]" },
];

export function ThemeSettingsContent() {
  const { 
    mode, setMode, 
    accent, setAccent, 
    density, setDensity, 
    fontSize, setFontSize 
  } = useTheme();

  return (
    <div className="space-y-6">
      {/* SEZIONE 1 - TEMA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <span className="text-xs font-bold text-foreground uppercase tracking-tight">
            {mode === "dark" ? "Tema Scuro" : "Tema Chiaro"}
          </span>
        </div>
        <button 
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${mode === 'dark' ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ${mode === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <DropdownMenuSeparator className="bg-border opacity-50" />

      {/* SEZIONE 2 - COLORE ACCENT */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
          <Palette className="h-3 w-3" />
          Colore Accent
        </div>
        <div className="grid grid-cols-6 gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              className={`h-7 w-7 rounded-full ${a.color} flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${accent === a.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
              title={a.label}
            >
              {accent === a.id && <Check className="h-3 w-3 text-white stroke-[4]" />}
            </button>
          ))}
        </div>
      </div>

      <DropdownMenuSeparator className="bg-border opacity-50" />

      {/* SEZIONE 3 - DENSITÀ LAYOUT */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
          <Layout className="h-3 w-3" />
          Densità Layout
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          {(["compact", "normal", "comfortable"] as ThemeDensity[]).map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-black uppercase transition-all ${density === d ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {d === 'compact' ? 'Comp' : d === 'normal' ? 'Norm' : 'Comod'}
            </button>
          ))}
        </div>
      </div>

      <DropdownMenuSeparator className="bg-border opacity-50" />

      {/* SEZIONE 4 - DIMENSIONE TESTO */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
          <Type className="h-3 w-3" />
          Dimensione Testo
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          {(["sm", "md", "lg"] as ThemeFontSize[]).map((s) => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              className={`flex-1 py-1.5 px-2 rounded-md font-black transition-all ${fontSize === s ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
              style={{ fontSize: s === 'sm' ? '10px' : s === 'md' ? '12px' : '14px' }}
            >
              {s === 'sm' ? 'A' : s === 'md' ? 'A' : 'A'}
              <span className="ml-1 text-[8px] opacity-70">
                {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemePanel() {
  const { isThemePanelOpen, setIsThemePanelOpen } = useTheme();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg active:scale-95 transition-all"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[300px] p-6 bg-card border-border shadow-2xl rounded-xl animate-in slide-in-from-top-2 duration-300">
          <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground mb-4">
            Personalizzazione Visiva
          </DropdownMenuLabel>
          <ThemeSettingsContent />
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isThemePanelOpen} onOpenChange={setIsThemePanelOpen}>
        <DialogContent className="sm:max-w-[400px] p-8 bg-card border-border rounded-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
              Personalizzazione Progetto
            </DialogTitle>
          </DialogHeader>
          <ThemeSettingsContent />
        </DialogContent>
      </Dialog>
    </>
  );
}
