import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      {/* Aurora Background Effect */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 100, 0],
          y: [0, 50, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none will-change-transform" 
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          x: [0, -100, 0],
          y: [0, -50, 0]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none will-change-transform" 
      />
      <motion.div 
        animate={{ 
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" 
      />

      <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-border/50 shadow-2xl relative animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mx-auto mb-6 relative group">
            <div className="absolute -inset-4 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition duration-1000" />
            <img 
              src="/logo_bite.jpg" 
              alt="Bite Digital" 
              className="relative max-w-[200px] h-auto mx-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-700" 
            />
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter uppercase italic text-white drop-shadow-sm">
            Bite ERP <span className="text-primary italic">v4</span>
          </CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Bentornato nell'hub operativo dello studio.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center space-x-3 text-destructive animate-in slide-in-from-bottom-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">
                  {error instanceof Error && error.message.includes("401") 
                    ? "Email o password non corretti." 
                    : "Errore di connessione al server. Verifica che il backend sia attivo."}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Email o Username"
                  className="pl-10 bg-background/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative group/input">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500 group-focus-within/input:text-primary transition-colors" />
                <Input
                  type="password"
                  placeholder="Password"
                  className="pl-10 bg-white/[0.03] border-white/10 rounded-xl focus:border-primary/40 focus:ring-primary/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4 flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-[11px] font-black uppercase italic tracking-[0.2em] text-primary-foreground shadow-[0_0_30px_rgba(124,58,237,0.3)] rounded-xl transition-all active:scale-[0.98]" 
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accesso in Corso...
                </>
              ) : (
                "Entra nel Sistema"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/forgot-password" title="Reimposta la tua password" id="login-forgot-password-link" className="text-primary hover:underline font-medium">
                Password dimenticata?
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
