import React from "react";
import { Clock, Folder, RotateCcw, Copy, Loader2 } from "lucide-react";
import { Row } from "../../types";

interface InfoSectionProps {
  data: Row | null;
  onReprocess: () => void;
  onOpenFolder: () => void;
  onCopyXml?: () => void;
  canCopyXml?: boolean;
  copyingXml?: boolean;
}

export function InfoSection({
  data,
  onReprocess,
  onOpenFolder,
  onCopyXml,
  canCopyXml,
  copyingXml,
}: InfoSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1 bg-muted/30 p-3 rounded-xl border border-border hover:border-primary/50 transition-colors">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Data do Processamento
        </div>
        <div className="text-sm font-medium text-foreground">{data?.timestamp || "--/--/---- --:--"}</div>
      </div>
      
      <div className="space-y-1 bg-muted/30 p-3 rounded-xl border border-border hover:border-primary/50 transition-colors">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ações Rápidas</div>
        <div className="flex gap-2 flex-wrap">  
          <button 
            onClick={onReprocess}
            className="flex-1 min-w-[85px] bg-muted hover:bg-muted/80 text-foreground text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg border border-border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <RotateCcw className="h-3 w-3" /> Reprocessar
          </button>
          <button 
            onClick={onOpenFolder}
            className="flex-1 min-w-[85px] bg-muted hover:bg-muted/80 text-foreground text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg border border-border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Folder className="h-3 w-3" /> Pasta
          </button>
          {canCopyXml && onCopyXml && (
            <button 
              onClick={onCopyXml}
              disabled={copyingXml || !data?.fullpath}
              className="flex-1 min-w-[120px] bg-muted hover:bg-muted/80 text-foreground text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg border border-border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copiar XML modificado para a Pasta de Busca XML configurada"
            >
              {copyingXml ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Copiar para XML
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
