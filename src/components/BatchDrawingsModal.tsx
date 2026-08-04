import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { toast } from "sonner";
import {
  Files,
  FolderOpen,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  FolderPlus,
} from "lucide-react";

interface BatchDrawingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMirrorPath?: string;
}

export const BatchDrawingsModal: React.FC<BatchDrawingsModalProps> = ({
  open,
  onOpenChange,
  defaultMirrorPath = "",
}) => {
  const [text, setText] = useState("");
  const [useCustomFolder, setUseCustomFolder] = useState(false);
  const [customFolder, setCustomFolder] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    processed: number;
    openedCount: number;
    copiedCount: number;
    folderOpenedCount: number;
    notFound: string[];
    errors: { item: string; message: string }[];
  } | null>(null);

  // Parse items from input text (separated by newline, comma, semicolon, space)
  const items = useMemo(() => {
    return text
      .split(/[\r\n,;\t]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }, [text]);

  const targetFolder = useCustomFolder ? customFolder : defaultMirrorPath;

  const handlePickFolder = async () => {
    try {
      const folder = await window.electron?.settings?.pickFolder?.(customFolder || defaultMirrorPath);
      if (folder) {
        setCustomFolder(folder);
        setUseCustomFolder(true);
      }
    } catch {
      toast.error("Erro ao selecionar a pasta.");
    }
  };

  const handleExecute = async (action: "open" | "copy" | "openFolder") => {
    if (items.length === 0) {
      toast.warning("Por favor, cole ou digite pelo menos um nome de desenho.");
      return;
    }

    const doOpen = action === "open";
    const doCopy = action === "copy";
    const doOpenFolder = action === "openFolder";

    if (doCopy && !targetFolder) {
      toast.error(
        "Nenhuma pasta de destino definida. Configure a Pasta Espelho em Opções ou selecione uma pasta personalizada."
      );
      return;
    }

    setProcessing(true);
    setLastResult(null);

    const actionText = action === "openFolder" ? "Localizando pasta de" : action === "open" ? "Abrindo" : "Copiando";
    const toastId = toast.loading(`${actionText} ${items.length} desenho(s)...`);

    try {
      const res = await window.electron?.analyzer?.batchProcessDrawings?.({
        items,
        open: doOpen,
        copy: doCopy,
        openFolder: doOpenFolder,
        targetFolder: doCopy ? targetFolder : undefined,
      });

      toast.dismiss(toastId);

      if (res?.ok) {
        setLastResult({
          processed: res.processed || 0,
          openedCount: res.openedCount || 0,
          copiedCount: res.copiedCount || 0,
          folderOpenedCount: res.folderOpenedCount || 0,
          notFound: res.notFound || [],
          errors: res.errors || [],
        });

        const successMsgs: string[] = [];
        if (doOpen && res.openedCount) {
          successMsgs.push(`${res.openedCount} aberto(s)`);
        }
        if (doCopy && res.copiedCount) {
          successMsgs.push(`${res.copiedCount} copiado(s)`);
        }
        if (doOpenFolder && res.folderOpenedCount) {
          successMsgs.push(`${res.folderOpenedCount} pasta(s) localizada(s)`);
        }

        if (successMsgs.length > 0) {
          toast.success(`Desenhos processados: ${successMsgs.join(", ")}!`);
        }

        const notFoundList = res.notFound || [];
        if (notFoundList.length > 0) {
          toast.warning(`${notFoundList.length} desenho(s) não foram encontrados.`);
        }
      } else {
        toast.error(res?.message || "Erro ao processar desenhos em lote.");
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error("Ocorreu um erro na execução em lote.", {
        description: String(e?.message || e),
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col bg-card border-border text-foreground shadow-2xl overflow-hidden p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Files className="h-5 w-5 text-primary" />
            Abrir / Copiar Desenhos em Lote
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cole a lista de nomes ou códigos de desenhos (um por linha) para abrir vários de uma vez ou copiar para outra pasta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
          {/* Textarea Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                Lista de Desenhos
                {items.length > 0 && (
                  <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full text-[11px]">
                    {items.length} detectado(s)
                  </span>
                )}
              </span>
              {text && (
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setLastResult(null);
                  }}
                  className="text-muted-foreground hover:text-red-500 flex items-center gap-1 transition-colors text-[11px]"
                >
                  <Trash2 className="h-3 w-3" /> Limpar lista
                </button>
              )}
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Cole aqui os códigos ou nomes dos desenhos...\nExemplo:\n2_T00000499A\n2_T00000500A.DXF\nESP00004702A`}
              rows={5}
              className="font-mono text-xs bg-muted/40 border-border focus:border-primary resize-y min-h-[100px] max-h-[200px]"
            />
          </div>

          {/* Target Folder Configuration */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 text-amber-500" />
                Pasta Destino (para Cópia)
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground select-none">
                  <input
                    type="radio"
                    name="folderOption"
                    checked={!useCustomFolder}
                    onChange={() => setUseCustomFolder(false)}
                    className="accent-primary"
                  />
                  Pasta Espelho Padrão:
                </label>
                <span className="text-muted-foreground truncate font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border flex-1">
                  {defaultMirrorPath || "Não configurada nas Opções"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground select-none shrink-0">
                  <input
                    type="radio"
                    name="folderOption"
                    checked={useCustomFolder}
                    onChange={() => setUseCustomFolder(true)}
                    className="accent-primary"
                  />
                  Outra Pasta:
                </label>
                <Input
                  type="text"
                  value={customFolder}
                  onChange={(e) => {
                    setCustomFolder(e.target.value);
                    setUseCustomFolder(true);
                  }}
                  onClear={() => setCustomFolder("")}
                  placeholder="C:\Caminho\Da\Sua\Pasta..."
                  className="h-8 text-xs font-mono bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePickFolder}
                  className="h-8 text-xs gap-1 shrink-0"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Procurar...
                </Button>
              </div>
            </div>
          </div>

          {/* Results feedback banner */}
          {lastResult && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Resultado do Processamento
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1 bg-muted/40 rounded">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Total</div>
                  <div className="font-bold">{lastResult.processed}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold text-blue-500">Abertos</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{lastResult.openedCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold text-green-500">Copiados</div>
                  <div className="font-bold text-green-600 dark:text-green-400">{lastResult.copiedCount}</div>
                </div>
              </div>

              {lastResult.notFound.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <div className="flex items-center gap-1.5 text-amber-500 font-semibold text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {lastResult.notFound.length} desenho(s) não encontrados:
                  </div>
                  <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-muted-foreground bg-muted/60 p-2 rounded border border-border">
                    {lastResult.notFound.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border shrink-0 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={processing}
            className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
          >
            Fechar
          </Button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExecute("open")}
              disabled={processing || items.length === 0}
              className="text-xs font-semibold gap-1.5 border-blue-600/30 hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 h-9"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Abrir Todos
            </Button>

            <Button
              size="sm"
              onClick={() => handleExecute("copy")}
              disabled={processing || items.length === 0}
              className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Enviar Cópia DXF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
