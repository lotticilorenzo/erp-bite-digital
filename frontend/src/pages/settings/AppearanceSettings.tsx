import { useTheme } from "@/context/ThemeContext";
import { 
  Moon, 
  Sun, 
  Palette, 
  Layers, 
  Type, 
  Check, 
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = [
  { id: "violet", color: "bg-[#8b5cf6]" },
  { id: "blue", color: "bg-[#3b82f6]" },
  { id: "green", color: "bg-[#22c55e]" },
  { id: "orange", color: "bg-[#f97316]" },
  { id: "pink", color: "bg-[#ec4899]" },
  { id: "slate", color: "bg-[#64748b]" },
] as const;

export default function AppearanceSettings() {
  const { 
    mode, setMode, 
    accent, setAccent, 
    density, setDensity, 
    fontSize, setFontSize 
  } = useTheme();

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Palette className="h-5 w-5 text-primary" />
          Personalizzazione Visiva
        </h2>
        <p className="mt-2 text-sm text-muted-strong">
          Scegli l'aspetto dell'interfaccia che meglio si adatta al tuo stile di lavoro.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tema Mode */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Moon className="h-4 w-4 text-primary" />
            Modalità Tema
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "light", icon: Sun, label: "Chiaro" },
              { id: "dark", icon: Moon, label: "Scuro" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setMode(t.id as any)}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300",
                  mode === t.id 
                    ? "bg-primary/12 border-primary/40 text-foreground shadow-lg shadow-primary/10" 
                    : "bg-muted/40 border-border/70 text-muted-strong hover:border-border hover:bg-accent/50"
                )}
              >
                <t.icon className={cn("h-6 w-6 mt-1", mode === t.id ? "text-primary" : "")} />
                <span className="text-xs font-bold uppercase tracking-widest">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Colore Accento */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Colore Accento
          </label>
          <div className="grid grid-cols-3 gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                className={cn(
                  "group relative h-12 rounded-xl transition-all duration-300 overflow-hidden border-2",
                  accent === a.id ? "border-foreground shadow-[0_0_0_1px_hsl(var(--foreground)/0.12)]" : "border-transparent hover:border-border"
                )}
              >
                <div className={cn("absolute inset-0 opacity-80 group-hover:opacity-100", a.color)} />
                {accent === a.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Densità Layout */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            Densità Interfaccia
          </label>
          <div className="space-y-2">
            {[
              { id: "compact", label: "Compatta", desc: "Massimizza i dati visibili" },
              { id: "normal", label: "Standard", desc: "Bilanciamento perfetto" },
              { id: "comfortable", label: "Rilassata", desc: "Spaziatura ampia e leggibile" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDensity(d.id as any)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left",
                  density === d.id 
                    ? "bg-primary/12 border-primary/40 text-foreground shadow-lg shadow-primary/10" 
                    : "bg-muted/40 border-border/70 text-muted-strong hover:border-border hover:bg-accent/50"
                )}
              >
                <div>
                  <p className="text-sm font-bold uppercase tracking-tight">{d.label}</p>
                  <p className="mt-0.5 text-[10px] text-faint">{d.desc}</p>
                </div>
                {density === d.id && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensione Font */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Type className="h-4 w-4 text-primary" />
            Dimensione Testo
          </label>
          <div className="flex rounded-2xl border border-border/70 bg-muted/40 p-1">
            {[
              { id: "sm", label: "Piccolo" },
              { id: "md", label: "Medio" },
              { id: "lg", label: "Grande" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFontSize(f.id as any)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all duration-300",
                  fontSize === f.id 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "text-muted-strong hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-center italic">
            <p className={cn(
              "text-muted-strong transition-all duration-300",
              fontSize === 'sm' ? "text-sm" : fontSize === 'md' ? "text-base" : "text-lg"
            )}>
              "Il design non è solo quello che sembra, ma come funziona."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
