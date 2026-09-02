import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import { Download, RefreshCw, Rocket } from "lucide-react";

export type UpdateStage = "available" | "downloading" | "downloaded";

interface UpdateModalProps {
  stage: UpdateStage | null;
  version: string;
  progress: number;
  onStartDownload: () => void;
  onSnooze: () => void;
  onClose: () => void;
  onInstall: () => void;
}

export default function UpdateModal({
  stage,
  version,
  progress,
  onStartDownload,
  onSnooze,
  onClose,
  onInstall,
}: UpdateModalProps) {
  if (!stage) return null;

  return (
    <DialogPrimitive.Root
      open={!!stage}
      onOpenChange={(open) => {
        if (!open) {
          if (stage === "available") {
            onSnooze();
          } else {
            onClose();
          }
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[99999] -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[92vw] rounded-2xl border border-border bg-card p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
          onPointerDownOutside={(e) => {
            if (stage === "downloading" || stage === "downloaded") {
              e.preventDefault();
            } else {
              onSnooze();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (stage === "downloading") {
              onClose();
            } else if (stage === "available") {
              onSnooze();
            } else {
              onClose();
            }
          }}
        >
          {stage === "available" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Rocket className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                    Nova atualização disponível!
                  </DialogPrimitive.Title>
                  <p className="text-xs text-muted-foreground">Versão {version || "nova"} publicada</p>
                </div>
              </div>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mb-5">
                Uma nova versão do Bartz Analyzer está pronta para ser baixada. Recomendamos atualizar para receber as últimas correções e melhorias.
              </DialogPrimitive.Description>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onSnooze}>
                  Depois
                </Button>
                <Button onClick={onStartDownload} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar e instalar
                </Button>
              </div>
            </>
          )}

          {stage === "downloading" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 text-blue-400 animate-bounce" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                    Baixando atualização…
                  </DialogPrimitive.Title>
                  <p className="text-xs text-muted-foreground">Versão {version || "nova"}</p>
                </div>
              </div>
              <div className="mb-2 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <DialogPrimitive.Description className="text-xs text-muted-foreground mb-5">
                {progress}% — você pode continuar usando o programa durante o download.
              </DialogPrimitive.Description>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  Ocultar
                </Button>
              </div>
            </>
          )}

          {stage === "downloaded" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                    Atualização pronta!
                  </DialogPrimitive.Title>
                  <p className="text-xs text-muted-foreground">Versão {version || "nova"} baixada</p>
                </div>
              </div>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mb-5">
                Reinicie agora para aplicar a atualização, ou ela será instalada automaticamente quando o programa for fechado.
              </DialogPrimitive.Description>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Instalar ao fechar
                </Button>
                <Button onClick={onInstall} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Reiniciar e atualizar agora
                </Button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
