import React, { useState } from "react";
import { MessageSquareText, ChevronDown, Database, RefreshCw, AlertTriangle, FileText, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";

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
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const displayComments = React.useMemo(() => {
    const map = new Map<number, any>();
    const withoutId: any[] = [];

    (comments || []).forEach((c) => {
      const id = c.pk_pedido_comentario;
      if (!id) {
        withoutId.push(c);
        return;
      }

      const incomingFiles: string[] = [];
      if (Array.isArray(c.anexos)) {
        c.anexos.forEach((f: any) => {
          if (f && typeof f === "string") {
            const trimmed = f.trim();
            if (trimmed && !incomingFiles.includes(trimmed)) {
              incomingFiles.push(trimmed);
            }
          }
        });
      }
      if (c.txt_arquivo && typeof c.txt_arquivo === "string") {
        const trimmed = c.txt_arquivo.trim();
        if (trimmed && !incomingFiles.includes(trimmed)) {
          incomingFiles.push(trimmed);
        }
      }

      if (!map.has(id)) {
        map.set(id, {
          ...c,
          anexos: incomingFiles,
        });
      } else {
        const existing = map.get(id);
        const current = existing.anexos || [];
        for (const f of incomingFiles) {
          if (!current.includes(f)) {
            current.push(f);
          }
        }
        existing.anexos = current;
      }
    });

    return [...Array.from(map.values()), ...withoutId];
  }, [comments]);

  const handleDownloadFile = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await window.electron?.analyzer?.downloadCommentFile?.(filename);
      if (res?.ok && res.destPath) {
        toast.success("Arquivo baixado com sucesso!", {
          description: `Salvo em: ${res.destPath}`,
        });
      } else if (res?.message && !res.message.toLowerCase().includes("cancelado")) {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error("[OrderInfoSection] Erro no download:", err);
      toast.error("Falha ao baixar o arquivo.");
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground tracking-tight">Informações do Pedido</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Observações de fábrica & Comentários</p>
          </div>
        </div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-foreground' : ''}`}>
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      
      {isOpen && (
        <div className="px-5 pb-5 pt-2 space-y-3.5 border-t border-border/60">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Dados do Servidor</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFetch(); }}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? "Buscando..." : "Sincronizar"}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-muted/30 border border-border animate-pulse space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="text-[11px] font-medium text-muted-foreground tracking-wide">Carregando dados do servidor...</div>
            </div>
          ) : displayComments.length > 0 ? (
            <div className="space-y-2.5">
              {displayComments.map((c, i) => {
                const commentText = cleanComment(c.txt_comentario || "Nenhum comentário registrado.");
                const lines = commentText.split(/<br\s*\/?>/gi);

                const anexos: string[] = [];
                if (Array.isArray(c.anexos)) {
                  c.anexos.forEach((f: any) => {
                    if (f && typeof f === "string") {
                      const trimmed = f.trim();
                      if (trimmed && !anexos.includes(trimmed)) {
                        anexos.push(trimmed);
                      }
                    }
                  });
                }
                if (c.txt_arquivo && typeof c.txt_arquivo === "string") {
                  const trimmed = c.txt_arquivo.trim();
                  if (trimmed && !anexos.includes(trimmed)) {
                    anexos.push(trimmed);
                  }
                }

                return (
                  <div key={c.pk_pedido_comentario || i} className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5 group/comment hover:border-border/80 transition-colors">
                    {c.txt_titulo && (
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span>{c.txt_titulo}</span>
                      </div>
                    )}
                    <div className="text-xs text-zinc-200 leading-relaxed font-medium">
                      {lines.map((line: string, idx: number) => (
                        <React.Fragment key={idx}>
                          {line}
                          {idx < lines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Anexos do comentário */}
                    {anexos.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>Arquivo{anexos.length > 1 ? "s" : ""} Anexo{anexos.length > 1 ? "s" : ""} ({anexos.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {anexos.map((file: string, fIdx: number) => (
                            <div
                              key={fIdx}
                              className="p-2 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 hover:bg-indigo-500/15 transition-colors"
                            >
                              <div className="flex items-center gap-2 overflow-hidden text-xs text-indigo-200">
                                <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                                <span className="truncate font-semibold text-xs" title={file}>
                                  {file}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file);
                                }}
                                disabled={downloadingFile === file}
                                className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-0 gap-1.5 shrink-0 font-medium shadow-sm transition-all rounded-md flex items-center cursor-pointer disabled:opacity-50"
                              >
                                {downloadingFile === file ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                <span className="ml-1">Baixar Anexo</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-muted/20 border border-dashed border-border space-y-1.5 opacity-60">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs italic text-muted-foreground">Nenhum comentário encontrado no servidor.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
