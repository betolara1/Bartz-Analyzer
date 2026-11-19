import React from "react";
import { Layers, ChevronDown, Wand2, FileText } from "lucide-react";
import { Row } from "../../types";
import { DropdownMenuItem, DropdownMenuSeparator } from "../ui/dropdown-menu";
import { DrawingRowActions } from "../shared/DrawingRowActions";
import { useDrawingActions } from "../../hooks/useDrawingActions";

interface MuxarabiSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  hasAdminPermission?: boolean;
}

export function MuxarabiSection({ isOpen, onToggle, data, hasAdminPermission }: MuxarabiSectionProps) {
  const muxarabiItems = (data?.meta?.muxarabiItems || []) as any[];
  const { handleOpenMuxarabi, handleInjectMuxarabi } = useDrawingActions();

  if (muxarabiItems.length === 0) return null;

  return (
    <section className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-orange-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Itens Muxarabi (MX008)</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Validação de grades e furos</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full ${muxarabiItems.length > 0 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-[#333]'}`} />
          <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="px-5 pb-5 pt-2">
          {muxarabiItems.length > 0 ? (
            <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner max-h-[360px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs min-w-[450px]">
                <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                    <th className="text-right px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[310px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]">
                  {muxarabiItems.map((item: any, i: number) => {
                    const match = item.descricao?.match(/(\d+\s*x\s*\d+)/i);
                    const sizeCode = match ? match[1].replace(/\s+/g, '').toLowerCase() : null;
                    const thMatch = item.descricao?.match(/(\d{2})\s*mm/i);
                    const thickness = thMatch ? thMatch[1] : '18';

                    return (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors group/inner">
                        <td className="px-4 py-3 font-mono text-orange-400 font-medium">{item.itemBase}</td>
                        <td className="px-4 py-3 text-white/80 font-mono text-xs">{item.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                        <td className="px-4 py-3 text-white text-[11px] leading-tight break-words max-w-[300px]">
                          {item.descricao || <span className="text-white/40 italic">vazio</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DrawingRowActions
                            drawingCode={item.desenho}
                            hasAdminPermission={hasAdminPermission}
                            openButtonTitle={item.desenho ? "Abrir desenho principal do item" : "Sem desenho"}
                            extraDropdownItems={
                              hasAdminPermission && sizeCode && (
                                <>
                                  <DropdownMenuSeparator className="bg-zinc-800" />
                                  <DropdownMenuItem
                                    onSelect={() => handleOpenMuxarabi(sizeCode)}
                                    className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-orange-300"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                    <span>Abrir Muxarabi ({sizeCode})</span>
                                  </DropdownMenuItem>
                                </>
                              )
                            }
                            extraActions={
                              hasAdminPermission && (
                                <button
                                  disabled={!item.desenho || !sizeCode}
                                  onClick={() => handleInjectMuxarabi(item.desenho, sizeCode!, thickness)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title={`Injetar as usinagens do muxarabi ${sizeCode || 'desconhecido'} (chapa ${thickness}mm) no desenho ITE automaticamente (50mm da borda)`}
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  <span>Aplicar</span>
                                </button>
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item muxarabi detectado.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
