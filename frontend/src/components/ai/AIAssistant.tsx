import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatPanel } from "./AIChatPanel";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[90]">
        <Button 
          onClick={() => setIsOpen(true)}
          className={`
            h-14 w-14 rounded-2xl bg-primary text-white shadow-[0_0_30px_hsl(var(--primary)/0.2)] 
            hover:scale-110 hover:shadow-[0_0_40px_hsl(var(--primary)/0.2)] active:scale-95 transition-all duration-500
            flex items-center justify-center group overflow-hidden
            ${isOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'}
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="h-7 w-7 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110" />
        </Button>
      </div>

      {/* Slide-in Chat Panel */}
      <AIChatPanel 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
