// src/App.tsx
import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard";
import ConfigurationScreen from "./components/ConfigurationScreen";
import { Toaster, toast } from "sonner";
import { Button } from "./components/ui/button";
import { Download, RefreshCw, Rocket } from "lucide-react";

type UpdateStage = "available" | "downloading" | "downloaded";

export default function App() {
  const [screen, setScreen] = useState<'dash' | 'cfg'>('dash');

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
        // usuário clicou "Depois" há menos de 1 hora para esta mesma versão — não insistir ainda
        const s = snoozeRef.current;
        if (s && s.version === v && Date.now() - s.at < 60 * 60 * 1000) return;
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
        toast.error(`Erro na atualização: ${err}`);
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

  return (
    <>
      {screen === 'dash'
        ? <Dashboard onNavigateToConfig={() => setScreen('cfg')} />
        : <ConfigurationScreen onBack={() => setScreen('dash')} />}

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
