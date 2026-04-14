import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Errore durante l'invio dell'email. Riprova più tardi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

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
          <CardTitle className="text-3xl font-bold tracking-tight">Recupero Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Inserisci la tua email per ricevere un link di reset.
          </CardDescription>
        </CardHeader>

        {!isSuccess ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center space-x-3 text-destructive animate-in slide-in-from-bottom-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email aziendale"
                    className="pl-10 bg-background/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full shadow-lg shadow-[0_0_20px_hsl(var(--primary)/0.2)]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  "Invia link di reset"
                )}
              </Button>
              <Link 
                to="/login" 
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Torna al login
              </Link>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-6 pb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-foreground">Email inviata!</p>
              <p className="text-sm text-muted-foreground">
                Se l'indirizzo <b>{email}</b> è nel nostro sistema, riceverai a breve un link per reimpostare la tua password.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link to="/login">Torna al login</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
