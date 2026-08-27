import React, { useState } from "react";
import { KeyRound, CheckCircle2, Copy, Download, Loader2, FileBox, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Row } from "../../types";

interface ImportKeySectionProps {
  data: Row | null;
}

export function ImportKeySection({ data }: ImportKeySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const key = data?.meta?.importKey;
  const [downloading, setDownloading] = useState(false);

  const handleCopy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    toast.success("Chave ERP copiada para a área de transferência!");
  };

  const handleDownloadPromob = async () => {
    if (!data?.filename) return;

    setDownloading(true);
    const id = toast.loading("Buscando arquivo .promob no Pedidos Online...");
    try {
      const res = await window.electron?.analyzer?.downloadPromob?.(data.filename);
      if (res?.ok) {
        if (res.count && res.count > 1) {
          toast.success(`${res.count} arquivo(s) .promob baixado(s) com sucesso!`, {
            description: `Salvo em: ${res.destPath}`,
          });
        } else {
          toast.success(`Arquivo .promob baixado com sucesso!`, {
            description: `${res.filename} → ${res.destPath}`,
          });
        }
      } else {
        toast.error(res?.message || "Erro ao baixar o arquivo .promob.");
      }
    } catch (error: any) {
      toast.error("Erro ao baixar .promob.", {
        description: String(error?.message || error),
      });
    } finally {
      setDownloading(false);
      toast.dismiss(id);
    }
  };

  return (
    <section className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm transition-all">
      <div
        className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-muted/40 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <KeyRound className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Chave de Importação ERP
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
            Focco ERP
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-foreground' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-3.5 border-t border-border/60">
          <div className="relative group pt-1">
            <div className={`p-3.5 rounded-xl border font-mono text-xs flex items-center justify-between transition-all ${
              key 
                ? 'bg-sky-500/5 border-sky-500/25 text-sky-300 shadow-inner' 
                : 'bg-muted/30 border-border/60 text-muted-foreground/50 italic'
            }`}>
              <div className="flex items-center gap-2.5 truncate pr-8">
                {key && <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />}
                <span className="truncate select-all">{key || "Chave não disponível para este item"}</span>
              </div>
              
              {key && (
                <button 
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 hover:text-white transition-all absolute right-2.5 cursor-pointer"
                  title="Copiar chave"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Botão Baixar .promob */}
          <button
            onClick={handleDownloadPromob}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-500/30 shadow-md shadow-emerald-900/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando e Baixando...</span>
              </>
            ) : (
              <>
                <FileBox className="h-4 w-4" />
                <span>Baixar Arquivo .Promob</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}


