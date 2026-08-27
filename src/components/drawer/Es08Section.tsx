import React, { useEffect, useRef, useState } from "react";
import { Zap, ChevronDown, FileText, FolderOpen, FolderCheck, Copy, RefreshCw, Check, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Row } from "../../types";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface Es08SectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  uniqueDrawings: string[];
  dxfSearching: boolean;
  dxfResults: Record<string, any>;
  dxfFixing: Record<string, boolean>;
  onSearchAll: () => void;
  onFix: (drawing: string) => void;
  onMoveToOk: () => void;
  onOpenConfirmMove: () => void;
  onOpenConfirmMoveOk: () => void;
  isResolved: boolean;
  otherPendingCount: number;
  onResolve: () => void;
  hasAdminPermission?: boolean;
  canViewEs08?: boolean;
}

function drawingNeedsFix(info: any): boolean {
  if (!info) return false;
  const dim = Math.abs(parseFloat(info.panelInfo?.dimension || '0'));
  const isPanelOk = dim === 18 || dim === 15;
  const count37 = (info.fresaInfo?.count37 || 0) + (info.fresaInfo?.usinagemCount37 || 0);
  const count31 = (info.fresaInfo?.count31 || 0) + (info.fresaInfo?.usinagemCount31 || 0);
  const noDuplado = count37 === 0 && count31 === 0;
  return !(isPanelOk && noDuplado);
}

export function Es08Section({
  isOpen, onToggle, data, uniqueDrawings, dxfSearching, dxfResults, dxfFixing,
  onSearchAll, onFix, onMoveToOk, onOpenConfirmMove, onOpenConfirmMoveOk,
  isResolved, otherPendingCount, onResolve, hasAdminPermission, canViewEs08
}: Es08SectionProps) {
  const matches = (data?.meta?.es08Matches || []) as any[];

  // Filter State
  const [filterText, setFilterText] = useState("");

  const filteredItems = matches.filter((item: any) => {
    if (!filterText.trim()) return true;
    const search = filterText.toLowerCase();
    return (
      (item.itemBase || "es08").toLowerCase().includes(search) ||
      (item.desenho || "").toLowerCase().includes(search) ||
      (item.dimensao || "").toLowerCase().includes(search) ||
      (item.descricao || "").toLowerCase().includes(search) ||
      (item.id || "").toLowerCase().includes(search) ||
      (item.referencia || "").toLowerCase().includes(search)
    );
  });

  // Buscar os desenhos automaticamente assim que a seção é aberta pela primeira vez
  const autoSearchedRef = useRef(false);
  useEffect(() => {
    if (isOpen && uniqueDrawings.length > 0 && !autoSearchedRef.current && Object.keys(dxfResults).length === 0 && !dxfSearching) {
      autoSearchedRef.current = true;
      onSearchAll();
    }
    if (!isOpen) autoSearchedRef.current = false;
  }, [isOpen, uniqueDrawings.length, dxfResults, dxfSearching, onSearchAll]);

  if (!canViewEs08 || matches.length === 0) return null;

  const allOk = uniqueDrawings.length > 0 && uniqueDrawings.every(d => {
    const result = dxfResults[d];
    return result?.status === 'found' && !drawingNeedsFix(result.data);
  });

  const handleOpenDrawing = async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando e abrindo desenho ${drawingCode}...`);
    try {
      const res = await window.electron?.analyzer?.openDrawing?.(drawingCode);
      if (res?.ok) {
        toast.success(`Desenho ${drawingCode} aberto com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir o desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir desenho.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  };

  const handleOpenDrawingFolder = async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando e localizando pasta do desenho ${drawingCode}...`);
    try {
      const res = await window.electron?.analyzer?.openDrawingFolder?.(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta do desenho ${drawingCode} aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta do desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  };

  const handleOpenMirrorFolder = async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando pasta NESTING(DXF ALESSANDRO) ${drawingCode}...`);
    try {
      const res = await window.electron?.analyzer?.openMirrorFolder?.(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta NESTING(DXF ALESSANDRO) aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta NESTING(DXF ALESSANDRO): ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NESTING(DXF ALESSANDRO).", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  };

  const handleOpenAspanFolder = async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando pasta NANXING ${drawingCode}...`);
    try {
      const res = await window.electron?.analyzer?.openAspanFolder?.(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta NANXING aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta NANXING: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NANXING.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  };

  const handleCopyToMirror = async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Copiando desenho ${drawingCode} para a pasta espelho...`);
    try {
      const res = await window.electron?.analyzer?.copyDrawingByCodeToMirror?.(drawingCode);
      if (res?.ok) {
        toast.success(`Desenho ${drawingCode} copiado para a pasta espelho!`);
      } else {
        toast.error(`Falha ao copiar desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao copiar desenho.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  };

  return (
    <section className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(244,63,94,0.1)] transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none">Itens ES08 - Duplado (37MM / 31MM)</h3>
            <p className="text-[10px] dark:text-rose-300/60 text-muted-foreground font-medium uppercase tracking-widest mt-1">
              {matches.length} componente(s) detectado(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isResolved ? (
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse" />
          )}
          <div className={`p-2 rounded-full bg-rose-500/5 border border-rose-500/10 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-rose-400/50" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 space-y-3">
          {matches.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1 group">
                <Input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onClear={() => setFilterText("")}
                  placeholder="Buscar por item, desenho, dimensão ou descrição..."
                  className="w-full bg-muted/50 border-border text-foreground h-9 rounded-lg text-xs outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all font-medium"
                  style={{ paddingLeft: "2.5rem" }}
                />
                <Search
                  className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-rose-400 transition-colors pointer-events-none z-10"
                  style={{ top: "50%", transform: "translateY(-50%)" }}
                />
              </div>
              <button
                onClick={onSearchAll}
                disabled={dxfSearching}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 active:scale-[0.97] transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${dxfSearching ? 'animate-spin' : ''}`} />
                {dxfSearching ? "Buscando..." : "Buscar Novamente"}
              </button>
            </div>
          )}

          {filteredItems.length > 0 ? (
            <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner max-h-[360px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs min-w-[650px]">
                <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[100px]">Status</th>
                    <th className="text-right px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[310px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]">
                  {filteredItems.map((item, i) => {
                    const drawing = item.desenho;
                    const result = drawing ? dxfResults[drawing] : undefined;
                    const isFixing = drawing ? dxfFixing[drawing] : false;
                    const needsFix = result?.status === 'found' && drawingNeedsFix(result.data);

                    return (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors group/inner">
                        <td className="px-4 py-3 font-mono text-rose-400 font-medium">{item.itemBase}</td>
                        <td className="px-4 py-3 text-white/80 font-mono text-xs">{drawing || <span className="text-[#444] italic">vazio</span>}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">{item.dimensao || "—"}</td>
                        <td className="px-4 py-3 text-white text-[11px] leading-tight max-w-[280px] break-words">
                          {item.descricao || <span className="text-white/40 italic">vazio</span>}
                        </td>
                        <td className="px-4 py-3">
                          {!result ? (
                            <span className="text-[10px] uppercase font-bold text-[#555]">Pendente</span>
                          ) : result.status === 'searching' ? (
                            <span className="text-[10px] uppercase font-bold text-yellow-500 animate-pulse">Buscando</span>
                          ) : result.status === 'found' ? (
                            needsFix ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-500">
                                <AlertTriangle className="h-3 w-3" /> Corrigir
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-500">
                                <Check className="h-3 w-3" /> OK
                              </span>
                            )
                          ) : result.status === 'not_found' ? (
                            <span className="text-[10px] uppercase font-bold text-rose-500">Não encontrado</span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-red-500" title={result.message}>Falha</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Botão Primário: Abrir Desenho */}
                            {hasAdminPermission && (
                              <button
                                disabled={!drawing}
                                onClick={() => handleOpenDrawing(drawing)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                                title={drawing ? "Abrir arquivo do desenho" : "Sem desenho"}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Abrir</span>
                              </button>
                            )}

                            {/* Dropdown de Pastas */}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  disabled={!drawing}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Abrir pastas do desenho"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                                  <span className="hidden sm:inline font-semibold">Pastas</span>
                                  <ChevronDown className="h-3 w-3 opacity-60" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800 text-zinc-200 shadow-2xl z-[9999]">
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1.5">
                                  Pastas do Desenho ({drawing})
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onSelect={() => handleOpenDrawingFolder(drawing)}
                                  className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-amber-300"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span>NESTING (SERVIDOR)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => handleOpenMirrorFolder(drawing)}
                                  className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-purple-300"
                                >
                                  <FolderCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                  <span>NESTING (DXF ALESSANDRO)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => handleOpenAspanFolder(drawing)}
                                  className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-emerald-300"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  <span>NANXING</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Botão Enviar DXF */}
                            {hasAdminPermission && (
                              <button
                                disabled={!drawing}
                                onClick={() => handleCopyToMirror(drawing)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                                title={drawing ? "Enviar desenho para a pasta espelho DXF" : "Sem desenho"}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>Enviar DXF</span>
                              </button>
                            )}

                            {/* Botão de Corrigir (se aplicável) */}
                            {hasAdminPermission && (
                              <button
                                disabled={!needsFix || isFixing}
                                onClick={() => onFix(drawing)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                                  needsFix
                                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm active:scale-[0.97]"
                                    : "bg-rose-500/10 text-rose-400/40 border border-rose-500/10 opacity-40 cursor-not-allowed"
                                }`}
                                title={needsFix ? "Corrigir fresa/usinagem/painel (37mm → 18mm / 31mm → 15mm)" : "Nenhuma correção necessária"}
                              >
                                {isFixing ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Zap className="h-3 w-3" />
                                )}
                                <span>{isFixing ? "Corrigindo..." : "Corrigir"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-border/40 rounded-lg bg-card/20">
              Nenhum item encontrado para "{filterText}".
            </div>
          )}

          <div className={`mt-2 pt-4 border-t ${allOk ? 'border-emerald-500/20' : 'border-amber-500/20'} flex items-center gap-2`}>
            {allOk ? (
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] shrink-0">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
            )}
            <div className="flex flex-col">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${allOk ? 'dark:text-emerald-400 text-emerald-600' : 'dark:text-amber-400 text-amber-600'}`}>
                {allOk ? 'Validação Concluída' : 'Atenção Necessária'}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {allOk ? 'Todos os desenhos estão em conformidade.' : 'Alguns desenhos requerem correção DXF.'}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
