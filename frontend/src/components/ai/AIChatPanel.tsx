import { useState, useEffect, useRef } from "react";
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  TrendingUp, 
  AlertCircle, 
  Users,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAI } from "@/hooks/useAI";
import type { ChatMessage } from "@/hooks/useAI";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  { label: "📊 Riepilogo mese", icon: BarChart3, query: "Genera un riepilogo dell'ultimo mese" },
  { label: "⚠️ Alert critici", icon: AlertCircle, query: "Quali sono gli alert critici o i clienti a rischio?" },
  { label: "💰 Top clienti", icon: Users, query: "Mostrami i top 5 clienti per fatturato" },
  { label: "📈 Trend fatturato", icon: TrendingUp, query: "Come sta andando il trend del fatturato?" },
];

export function AIChatPanel({ isOpen, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiMutation = useAI();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiMutation.isPending]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || aiMutation.isPending) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const response = await aiMutation.mutateAsync(text);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Scusa, ho riscontrato un errore nel connettermi al mio cervello AI. Riprova più tardi.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`
      fixed top-0 right-0 h-full w-[400px] bg-card border-l border-border 
      shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300
    `}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Bite AI Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted text-[#475569] hover:text-white">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6 pb-20">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-3xl bg-background border border-border flex items-center justify-center text-[#1e293b]">
                <Bot className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Ciao! Sono Bite AI</h4>
                <p className="text-xs text-muted-foreground max-w-[250px]"> Chiedimi pure riepiloghi, analisi sui dati dell'agenzia o alert critici.</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-lg
                ${m.role === 'user' 
                  ? 'bg-primary text-white font-medium rounded-tr-none' 
                  : 'bg-muted text-foreground border border-border/30 rounded-tl-none font-medium'
                }
              `}>
                {m.content}
                <div className={`mt-2 text-[8px] opacity-40 uppercase font-black tracking-widest ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {aiMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border/30 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 bg-primary/80 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Commands & Input */}
      <div className="p-4 border-t border-border bg-background/50 space-y-4">
        {/* Quick Commands */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {QUICK_COMMANDS.map((cmd) => (
            <Button 
              key={cmd.label}
              variant="outline"
              size="sm"
              onClick={() => handleSend(cmd.query)}
              className="h-8 shrink-0 rounded-lg border-border bg-card px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              <cmd.icon className="h-3 w-3 mr-2" />
              {cmd.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 relative">
          <Input 
            placeholder="Chiedi all'AI..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={aiMutation.isPending}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="h-12 bg-background border-border rounded-xl pr-12 focus-visible:ring-primary/40 text-sm font-medium"
          />
          <Button 
            size="icon" 
            onClick={() => handleSend()}
            disabled={!input.trim() || aiMutation.isPending}
            className={`
              absolute right-1 w-10 h-10 rounded-lg shadow-xl transition-all
              ${input.trim() ? "bg-primary text-white scale-100" : "bg-transparent text-[#1e293b] scale-90"}
            `}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
