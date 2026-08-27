import React from "react";
import { Clock, FolderOpen, RotateCcw, Copy, Loader2, FileCode, CheckCircle2 } from "lucide-react";
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
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-card/90 p-4 sm:p-5 shadow-lg backdrop-blur-md">
      {/* Decorative subtle ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-blue-500/5 blur-3xl" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Info details */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Data do Processamento
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Ativo
              </span>
            </div>
            <div className="text-sm sm:text-base font-semibold font-mono text-foreground tracking-tight">
              {data?.timestamp || "--/--/---- --:--"}
            </div>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <button
            onClick={onReprocess}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 active:scale-[0.97] transition-all cursor-pointer shadow-sm hover:border-blue-500/40"
            title="Reprocessar este arquivo XML"
          >
            <RotateCcw className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>Reprocessar</span>
          </button>

          <button
            onClick={onOpenFolder}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 active:scale-[0.97] transition-all cursor-pointer shadow-sm hover:border-amber-500/40"
            title="Abrir pasta do arquivo no Explorer"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Abrir Pasta</span>
          </button>

          {canCopyXml && onCopyXml && (
            <button
              onClick={onCopyXml}
              disabled={copyingXml || !data?.fullpath}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-[0.97] transition-all cursor-pointer shadow-sm hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Copiar XML modificado para a Pasta de Busca XML configurada"
            >
              {copyingXml ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <span>Copiar para XML</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

