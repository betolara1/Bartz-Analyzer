import React, { useState } from "react";
import { Layers, ChevronDown, Edit2, Search } from "lucide-react";
import { Row } from "../../types";
import { Input, searchIcon } from "../ui/input";
import { DrawingRowActions } from "../shared/DrawingRowActions";
import { ItemEditorModals } from "../shared/ItemEditorModals";
import { useItemEditor } from "../../hooks/useItemEditor";
import { matchesItemFilter } from "../../utils/itemHelpers";

interface PoItemsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  hasAdminPermission?: boolean;
}

export function PoItemsSection({ isOpen, onToggle, data, hasAdminPermission }: PoItemsSectionProps) {
  const poItems = (data?.meta?.poItems || []) as any[];

  // Filter State
  const [filterText, setFilterText] = useState("");

  const editor = useItemEditor({
    data,
    theme: "indigo",
    descriptionSubtitle: "Alteração de descrição de item POXXXX",
  });

  const filteredItems = poItems.filter((item: any) =>
    matchesItemFilter(item, filterText, {
      includeReferencia: true,
      includeId: true,
    })
  );

  if (poItems.length === 0) return null;

  return (
    <section className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-indigo-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Itens POXXXX</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Detecção de códigos padrão POXXXX / POXXXXAA</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full ${poItems.length > 0 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-[#333]'}`} />
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
                className="w-full bg-muted/50 border-border text-foreground h-9 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {filteredItems.length} de {poItems.length} item(ns)
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="rounded-lg border border-border/40 overflow-hidden bg-card/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <th className="px-4 py-3">Item Base</th>
                    <th className="px-4 py-3">Desenho</th>
                    <th className="px-4 py-3">Dimensão</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredItems.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors group/inner">
                      <td className="px-4 py-3 font-mono text-indigo-400 font-medium">
                        {item.itemBase}
                      </td>
                      <td className="px-4 py-3 text-foreground/80 font-mono text-xs">
                        {item.desenho || <span className="text-muted-foreground/40 italic">vazio</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground/80 text-xs">
                        <div className="flex items-center gap-2">
                          {hasAdminPermission && (
                            <button
                              type="button"
                              onClick={() => editor.handleOpenEditDimModal(item)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Trocar Dimensão"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="truncate font-mono">
                            {item.dimensao || <span className="text-muted-foreground/40 italic font-sans">vazio</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground text-[11px] leading-tight max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {hasAdminPermission && (
                            <button
                              type="button"
                              onClick={() => editor.handleOpenEditModal(item)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Trocar Descrição"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <span className="break-words">
                            {item.descricao || <span className="text-muted-foreground/40 italic">vazio</span>}
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
          ) : poItems.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item corresponde à busca.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item POXXXX detectado.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAIS DE EDIÇÃO/CONFIRMAÇÃO */}
      <ItemEditorModals editor={editor} />
    </section>
  );
}
