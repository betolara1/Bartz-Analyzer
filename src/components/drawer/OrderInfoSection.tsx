import React from "react";
import { Info, ChevronDown, Database, RefreshCw, AlertTriangle } from "lucide-react";

interface OrderInfoSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  loading: boolean;
  comments: any[];
  onFetch: () => void;
}

function cleanComment(text: string): string {
  if (!text) return "";
  // Remove the entire div block containing "Alterado para"
  let cleaned = text.replace(/<div[^>]*style=['"][^'"]*border-top:[^'"]*['"][^>]*>[\s\S]*?\[Alterado para[\s\S]*?<\/div>/gi, "");
  // Just in case there is a standalone "[Alterado para ...]" without the div wrapper
  cleaned = cleaned.replace(/\[Alterado para[^\]]*\]/gi, "");
  return cleaned.trim();
}

export function OrderInfoSection({ isOpen, onToggle, loading, comments, onFetch }: OrderInfoSectionProps) {
  return (
    <section className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-blue-400">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Informações do Pedido</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Consulta de observações de fábrica</p>
          </div>
        </div>
        <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-4 w-4 text-[#666]" />
        </div>
      </div>
      
      {isOpen && (
        <div className="px-5 pb-5 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Dados do Servidor</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFetch(); }}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {loading ? "Buscando..." : "Sincronizar"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 rounded-lg bg-[#111] border border-[#232323] animate-pulse">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Carregando dados...</div>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((c, i) => {
                const commentText = cleanComment(c.txt_comentario || "Nenhum comentário registrado.");
                const lines = commentText.split(/<br\s*\/?>/gi);
                return (
                  <div key={i} className="p-4 rounded-lg bg-[#111] border border-[#232323] space-y-2 group/comment hover:border-[#333] transition-colors">
                    {c.txt_titulo && (
                      <div className="text-[9px] uppercase font-bold text-[#3498DB] tracking-widest mb-1 opacity-80 group-hover/comment:opacity-100 transition-opacity">
                        {c.txt_titulo}
                      </div>
                    )}
                    <div className="text-sm text-white leading-relaxed font-medium">
                      {lines.map((line: string, idx: number) => (
                        <React.Fragment key={idx}>
                          {line}
                          {idx < lines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 rounded-lg bg-[#111] border border-dashed border-[#232323] space-y-2 opacity-60">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm italic text-muted-foreground">Nenhum comentário encontrado no servidor.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
