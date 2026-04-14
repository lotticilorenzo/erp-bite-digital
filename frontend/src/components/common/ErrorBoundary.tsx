import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In produzione si invierebbe a Sentry/logging service — non console
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                Qualcosa è andato storto
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Si è verificato un errore imprevisto. Il team è stato notificato.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <pre className="mt-4 text-left text-xs bg-card border border-border rounded-lg p-4 overflow-auto max-h-40 text-red-400">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                className="bg-primary text-white font-black uppercase tracking-widest text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Riprova
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
                className="font-black uppercase tracking-widest text-xs"
              >
                <Home className="h-3.5 w-3.5 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Wrapper funzionale per ErrorBoundary su sezioni specifiche */
export function SectionErrorBoundary({ children, label = "sezione" }: { children: React.ReactNode; label?: string }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center p-12 text-center">
          <div className="space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive/60 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Impossibile caricare {label}. Aggiorna la pagina.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
