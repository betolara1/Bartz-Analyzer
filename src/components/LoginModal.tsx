import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Lock, User, Eye, EyeOff, Loader2, LogIn, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface LoginModalProps {
  open: boolean;
  onLoginSuccess: (user: any) => void;
}

export default function LoginModal({ open, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("Por favor, preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await window.electron?.auth?.login(username.trim(), password);

      if (res?.ok && res.user) {
        toast.success(`Bem-vindo, ${res.user.txt_nome || res.user.txt_login}!`);
        onLoginSuccess(res.user);
      } else {
        const msg = res?.message || "Usuário ou senha incorretos.";
        setErrorMsg(msg);
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setErrorMsg("Erro de comunicação ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        aria-describedby="login-modal-description"
        className="bg-card border-border max-w-md w-[92vw] p-0 overflow-hidden shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg shadow-primary/20">
              B
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Bartz Analyzer
              </DialogTitle>
              <p id="login-modal-description" className="text-xs text-muted-foreground mt-0.5">
                Autenticação Pedidos Online — Digite suas credenciais para continuar
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-500 dark:text-red-400 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Usuário
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Ex: admin"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={loading}
                autoFocus
                className="bg-muted/50 border-border h-11 text-sm pl-3 pr-3 font-medium focus:bg-background transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Senha
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={loading}
                className="bg-muted/50 border-border h-11 text-sm pl-3 pr-10 font-medium focus:bg-background transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando credenciais...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Entrar no Analisador
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
