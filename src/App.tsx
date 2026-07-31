import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard";
import ConfigurationScreen from "./components/ConfigurationScreen";
import LoginModal from "./components/LoginModal";
import { Toaster, toast } from "sonner";
import { Button } from "./components/ui/button";
import { Download, RefreshCw, Rocket, Loader2 } from "lucide-react";

type UpdateStage = "available" | "downloading" | "downloaded";

export default function App() {
  const [screen, setScreen] = useState<'dash' | 'cfg'>('dash');

  // Controle de autenticação
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Verificar cache de sessão ao abrir o programa
  useEffect(() => {
    (async () => {
      try {
        const res = await window.electron?.auth?.getSession();
        if (res?.ok && res.user) {
          setCurrentUser(res.user);
          setIsLoginOpen(false);
        } else {
          setIsLoginOpen(true);
        }
      } catch (e) {
        console.error("Erro ao verificar sessão do usuário:", e);
        setIsLoginOpen(true);
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await window.electron?.auth?.logout();
      setCurrentUser(null);
      setIsLoginOpen(true);
      toast.info("Você deslogou da sua conta.");
    } catch (e) {
      console.error("Erro ao deslogar:", e);
    }
  };

  // popup de atualização
  const [updateStage, setUpdateStage] = useState<UpdateStage | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const stageRef = useRef<UpdateStage | null>(null);
  const snoozeRef = useRef<{ version: string; at: number } | null>(null);
  stageRef.current = updateStage;

  useEffect(() => {
    if (window.electron?.updater) {
      window.electron.updater.onUpdateAvailable((info) => {
        const v = info?.version || "";
        // já baixando ou pronta para instalar — não voltar para a fase inicial
        if (stageRef.current === "downloading" || stageRef.current === "downloaded") return;
        // se for verificação manual, ignora o snooze (botão "Depois")
        const isManual = !!info?.isManual;
        if (!isManual) {
          // usuário clicou "Depois" há menos de 1 hora para esta mesma versão — não insistir ainda
          const s = snoozeRef.current;
          if (s && s.version === v && Date.now() - s.at < 60 * 60 * 1000) return;
        }
        setUpdateVersion(v);
        setProgress(0);
        setUpdateStage("available");
      });

      window.electron.updater.onUpdateProgress((progressObj) => {
        setProgress(Math.round(progressObj?.percent || 0));
        // só transita de "available" para "downloading"; se o usuário ocultou (null), não reabrir
        setUpdateStage((prev) => (prev === "available" ? "downloading" : prev));
      });

      window.electron.updater.onUpdateDownloaded((info) => {
        if (info?.version) setUpdateVersion(info.version);
        setProgress(100);
        setUpdateStage("downloaded"); // reabre o popup mesmo se estava oculto
      });

      window.electron.updater.onUpdateNotAvailable((info) => {
        toast.info("Você já possui a versão mais recente.", {
          description: `Versão atual: ${info?.version || ''}`
        });
      });

      window.electron.updater.onUpdateError((err) => {
        setUpdateStage(null);
        toast.error("Erro na atualização.", { description: String(err) });
      });
    }
  }, []);

  function startDownload() {
    setUpdateStage("downloading");
    setProgress(0);
    window.electron?.updater?.startDownload();
  }

  function snoozeUpdate() {
    snoozeRef.current = { version: updateVersion, at: Date.now() };
    setUpdateStage(null);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Carregando sessão do usuário...</p>
      </div>
    );
  }

  return (
    <>
      {screen === 'dash'
        ? <Dashboard onNavigateToConfig={() => setScreen('cfg')} currentUser={currentUser} onLogout={handleLogout} />
        : <ConfigurationScreen onBack={() => setScreen('dash')} currentUser={currentUser} onLogout={handleLogout} />}

      {/* Modal de Login (solicita quando deslogado ou primeira abertura) */}
      <LoginModal
        open={isLoginOpen}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginOpen(false);
        }}
      />

      {/* Popup de atualização — aparece por cima de tudo, mesmo com o programa em uso */}
      {updateStage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[440px] max-w-[92vw] rounded-2xl border border-border bg-card p-6 shadow-2xl">
            {updateStage === "available" && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Nova atualização disponível!</h2>
                    <p className="text-xs text-muted-foreground">Versão {updateVersion || "nova"} publicada</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Uma nova versão do Bartz Analyzer está pronta para ser baixada. Recomendamos atualizar para receber as últimas correções e melhorias.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={snoozeUpdate}>Depois</Button>
                  <Button onClick={startDownload} className="gap-2">
                    <Download className="h-4 w-4" /> Baixar e instalar
                  </Button>
                </div>
              </>
            )}

            {updateStage === "downloading" && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                    <Download className="h-5 w-5 text-blue-400 animate-bounce" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Baixando atualização…</h2>
                    <p className="text-xs text-muted-foreground">Versão {updateVersion || "nova"}</p>
                  </div>
                </div>
                <div className="mb-2 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-5">{progress}% — você pode continuar usando o programa durante o download.</p>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setUpdateStage(null)}>Ocultar</Button>
                </div>
              </>
            )}

            {updateStage === "downloaded" && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Atualização pronta!</h2>
                    <p className="text-xs text-muted-foreground">Versão {updateVersion || "nova"} baixada</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Reinicie agora para aplicar a atualização, ou ela será instalada automaticamente quando o programa for fechado.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setUpdateStage(null)}>Instalar ao fechar</Button>
                  <Button onClick={() => window.electron?.updater?.installUpdate()} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Reiniciar e atualizar agora
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toaster position="bottom-left" richColors closeButton />
    </>
  );
}
