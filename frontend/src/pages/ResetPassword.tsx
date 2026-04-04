import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forza password semplice: min 8 caratteri
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    let s = 0;
    if (password.length >= 8) s += 25;
    if (/[A-Z]/.test(password)) s += 25;
    if (/[0-9]/.test(password)) s += 25;
    if (/[^A-Za-z0-9]/.test(password)) s += 25;
    setStrength(s);
  }, [password]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-border/50 text-center p-8">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Token Mancante</h2>
          <p className="text-sm text-muted-foreground mb-6">Il link di reset non è valido o è incompleto.</p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Richiedi un nuovo link</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post("/api/v1/auth/reset-password", { token, new_password: password });
      setIsSuccess(true);
      toast.success("Password reimpostata con successo!");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Token scaduto o non valido. Riprova il recupero.");
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
          <CardTitle className="text-3xl font-bold tracking-tight">Nuova Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Imposta una password sicura per il tuo account.
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
              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nuova password"
                    className="pl-10 pr-10 bg-background/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Conferma password"
                    className="pl-10 bg-background/50"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Password strength bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <span>Sicurezza password</span>
                    <span>{strength}%</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        strength < 50 ? "bg-destructive" : strength < 100 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full shadow-lg shadow-[0_0_20px_hsl(var(--primary)/0.2)]" 
                disabled={isLoading || password.length < 8}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reimpostazione in corso...
                  </>
                ) : (
                  "Salva nuova password"
                )}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-6 pb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-foreground">Password Aggiornata!</p>
              <p className="text-sm text-muted-foreground">
                La tua password è stata reimpostata correttamente. Verrai reindirizzato al login tra pochi secondi.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link to="/login">Vai al login ora</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
