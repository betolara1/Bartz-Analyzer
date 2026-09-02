import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard";
import ConfigurationScreen from "./components/ConfigurationScreen";
import LoginModal from "./components/LoginModal";
import UpdateModal, { UpdateStage } from "./components/UpdateModal";
import { Toaster, toast } from "sonner";
import { Loader2 } from "lucide-react";

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

      {/* Modal de atualização — renderizado via Radix Portal no body para sobrepor qualquer tela/modal com suporte total a cliques */}
      <UpdateModal
        stage={updateStage}
        version={updateVersion}
        progress={progress}
        onStartDownload={startDownload}
        onSnooze={snoozeUpdate}
        onClose={() => setUpdateStage(null)}
        onInstall={() => window.electron?.updater?.installUpdate()}
      />

      <Toaster position="bottom-left" richColors closeButton />
    </>
  );
}
