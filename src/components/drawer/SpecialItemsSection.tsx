import React, { useState, useMemo } from "react";
import { Package, ChevronDown, Edit2, Search } from "lucide-react";
import { Row } from "../../types";
import { Input, searchIcon } from "../ui/input";
import { DrawingRowActions } from "../shared/DrawingRowActions";
import { ItemEditorModals } from "../shared/ItemEditorModals";
import { useItemEditor } from "../../hooks/useItemEditor";
import { isDupladoItem, matchesItemFilter } from "../../utils/itemHelpers";

interface SpecialItemsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  hasAdminPermission?: boolean;
  isPerm38?: boolean;
}

export function SpecialItemsSection({ isOpen, onToggle, data, hasAdminPermission, isPerm38 }: SpecialItemsSectionProps) {
  const rawSpecialItems = (data?.meta?.specialItems || []) as any[];
  const specialItems = useMemo(() => {
    if (isPerm38) {
      return rawSpecialItems.filter((item) => !isDupladoItem(item, data?.meta?.es08Matches));
    }
    return rawSpecialItems;
  }, [rawSpecialItems, isPerm38, data?.meta?.es08Matches]);

  // Filter State
  const [filterText, setFilterText] = useState("");

  const editor = useItemEditor({
    data,
    theme: "purple",
    descriptionSubtitle: "Alteração de descrição de item especial",
  });

  const filteredItems = specialItems.filter((item: any) =>
    matchesItemFilter(item, filterText, {
      includeReferencia: true,
      includeId: true,
    })
  );

  if (specialItems.length === 0) return null;

  return (
    <section className="rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-purple-400">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Itens Especiais</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              Itens que não possuem módulo associado na biblioteca padrão
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full ${specialItems.length > 0 ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-[#333]'}`} />
          <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-border/40 space-y-4">
          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="relative max-w-md flex-1 group">
              <Input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                onClear={() => setFilterText("")}
                placeholder="Buscar por item, desenho, dimensão ou descrição..."
                leftIcon={searchIcon}
                className="w-full bg-muted/50 border-border text-foreground h-9 rounded-lg text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all font-medium"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {filteredItems.length} de {specialItems.length} item(ns)
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner max-h-[360px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                    <th className="text-right px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[240px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]">
                  {filteredItems.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group/inner">
                      <td className="px-4 py-3 font-mono text-purple-400 font-medium">{item.itemBase}</td>
                      <td className="px-4 py-3 text-white/80 font-mono text-xs">{item.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[140px]">
                        <div className="flex items-center gap-2">
                          {hasAdminPermission && (
                            <button
                              type="button"
                              onClick={() => editor.handleOpenEditDimModal(item)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-purple-400 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Trocar Dimensão"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="truncate font-mono">
                            {item.dimensao || <span className="text-white/40 italic font-sans">vazio</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white text-[11px] leading-tight max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {hasAdminPermission && (
                            <button
                              type="button"
                              onClick={() => editor.handleOpenEditModal(item)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-purple-400 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Trocar Descrição"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="break-words">
                            {item.descricao || <span className="text-white/40 italic">vazio</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DrawingRowActions
                          drawingCode={item.desenho}
                          hasAdminPermission={hasAdminPermission}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : specialItems.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item corresponde à busca.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item especial detectado.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAIS DE EDIÇÃO/CONFIRMAÇÃO */}
      <ItemEditorModals editor={editor} />
    </section>
  );
}
