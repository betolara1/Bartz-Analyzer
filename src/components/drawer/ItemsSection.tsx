import React, { useState, useMemo } from "react";
import { Boxes, ChevronDown, ChevronRight, Edit2, AlertTriangle, Trash2 } from "lucide-react";
import { Row } from "../../types";
import { Input, searchIcon } from "../ui/input";
import { DrawingRowActions } from "../shared/DrawingRowActions";
import { ItemEditorModals } from "../shared/ItemEditorModals";
import { useItemEditor, DEFAULT_CODE_LABELS } from "../../hooks/useItemEditor";
import { getItemId, isParentItem, getChildrenCount } from "../../utils/itemHelpers";

interface ItemsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  hasAdminPermission?: boolean;
}

export function ItemsSection({ isOpen, onToggle, data, hasAdminPermission }: ItemsSectionProps) {
  const allItems = (data?.meta?.allItems || []) as any[];

  // Filter State
  const [filterText, setFilterText] = useState("");

  // Collapse / Expand State for Parent Items (inicia vazio = todos fechados por padrão)
  const [expandedIds, setExpandedIds] = useState<Set<number | string>>(new Set());

  // Reseta para todos fechados sempre que mudar de arquivo no drawer
  React.useEffect(() => {
    setExpandedIds(new Set());
    setFilterText("");
  }, [data?.fullpath]);

  const editor = useItemEditor({
    data,
    theme: "sky",
    includePromobMetadata: true,
    enableDimensionPropagation: true,
    descriptionSubtitle: "Alteração textual da descrição do produto no XML",
    dimensionSubtitle: "Alteração de dimensões (Largura x Altura x Profundidade)",
    codeModalLabels: DEFAULT_CODE_LABELS,
  });

  const isExpandedId = React.useCallback(
    (id: number | string) => {
      return (
        expandedIds.has(id) ||
        expandedIds.has(String(id)) ||
        (typeof id === "string" && !isNaN(Number(id)) && expandedIds.has(Number(id)))
      );
    },
    [expandedIds]
  );

  const toggleExpand = (id: number | string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyExpanded =
        next.has(id) ||
        next.has(String(id)) ||
        (typeof id === "string" && !isNaN(Number(id)) && next.has(Number(id)));
      if (isCurrentlyExpanded) {
        next.delete(id);
        next.delete(String(id));
        if (typeof id === "string" && !isNaN(Number(id))) next.delete(Number(id));
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allParents = new Set<number | string>();
    (filterText.trim() ? filteredItems : allItems).forEach((it, idx) => {
      if (isParentItem(it)) {
        allParents.add(getItemId(it, idx));
      }
    });
    setExpandedIds(allParents);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const parentCount = useMemo(() => allItems.filter(isParentItem).length, [allItems]);

  // Filtro hierárquico: exibe o item correspondente, todos os seus filhos/descendentes abaixo e todos os seus pais/ancestrais acima
  const filteredItems = useMemo(() => {
    if (!filterText.trim()) return allItems;
    const search = filterText.toLowerCase().trim();

    // 1. Encontra todos os itens com correspondência direta
    const directMatchIds = new Set<number | string>();
    for (const item of allItems) {
      const match =
        (item.itemBase || "").toLowerCase().includes(search) ||
        (item.referencia || "").toLowerCase().includes(search) ||
        (item.desenho || "").toLowerCase().includes(search) ||
        (item.dimensao || "").toLowerCase().includes(search) ||
        (item.descricao || "").toLowerCase().includes(search) ||
        (item.id || "").toLowerCase().includes(search) ||
        (item.extraSearch || "").toLowerCase().includes(search);

      if (match) {
        directMatchIds.add(item.nodeId !== undefined ? item.nodeId : item.id);
      }
    }

    // 2. Expande para todos os descendentes (tudo abaixo) e ancestrais (tudo acima) dos nós encontrados
    const visibleIds = new Set<number | string>();
    for (const matchedId of directMatchIds) {
      visibleIds.add(matchedId);

      const item = allItems.find(
        (n: any) => (n.nodeId !== undefined ? n.nodeId : n.id) === matchedId
      );

      if (item) {
        // Adiciona todos os pais/ancestrais
        (item.ancestorIds || []).forEach((ancId: number | string) => visibleIds.add(ancId));
        // Adiciona todos os filhos/descendentes
        (item.descendantIds || []).forEach((descId: number | string) => visibleIds.add(descId));
      }
    }

    // 3. Retorna os itens visíveis na ordem original da árvore XML
    return allItems.filter((item: any) => {
      const id = item.nodeId !== undefined ? item.nodeId : item.id;
      return visibleIds.has(id);
    });
  }, [allItems, filterText]);

  // Quando o filtro de texto muda, expande automaticamente os nós pais dos itens filtrados para que os resultados fiquem visíveis por padrão
  const prevFilterTextRef = React.useRef("");
  React.useEffect(() => {
    const trimmed = filterText.trim();
    if (trimmed && trimmed !== prevFilterTextRef.current) {
      const allParentsInFiltered = new Set<number | string>();
      filteredItems.forEach((it, idx) => {
        if (isParentItem(it)) {
          allParentsInFiltered.add(getItemId(it, idx));
        }
      });
      setExpandedIds(allParentsInFiltered);
    } else if (!trimmed && prevFilterTextRef.current) {
      setExpandedIds(new Set());
    }
    prevFilterTextRef.current = trimmed;
  }, [filterText, filteredItems]);

  // Itens visíveis: exibe apenas os nós raiz e filhos cujos pais/ancestrais estejam expandidos em expandedIds
  const visibleItems = useMemo(() => {
    const filteredIdSet = new Set(
      filteredItems.map((it: any, idx: number) => getItemId(it, idx))
    );

    return filteredItems.filter((item: any) => {
      // Se não tem ancestrais ou é nível 0: sempre visível
      if (!item.ancestorIds || item.ancestorIds.length === 0 || (item.depth || 0) === 0) {
        return true;
      }

      // Ancestrais que estão presentes no conjunto filtrado
      const relevantAncestors = item.ancestorIds.filter((ancId: number | string) =>
        filteredIdSet.has(ancId) ||
        filteredIdSet.has(String(ancId)) ||
        (typeof ancId === "string" && !isNaN(Number(ancId)) && filteredIdSet.has(Number(ancId)))
      );

      // Se nenhum ancestral relevante existe neste filtro, trata como raiz
      if (relevantAncestors.length === 0) {
        return true;
      }

      // Sub-itens só aparecem se todos os seus ancestrais relevantes estiverem expandidos
      return relevantAncestors.every((ancId: number | string) => isExpandedId(ancId));
    });
  }, [filteredItems, isExpandedId]);

  if (allItems.length === 0) return null;

  return (
    <section className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-sky-400">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Itens do Pedido (Completo)</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              Estrutura hierárquica do XML com itens pais e sub-itens
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full ${allItems.length > 0 ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'bg-[#333]'}`} />
          <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-border/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-md flex-1 group">
                <Input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onClear={() => setFilterText("")}
                  placeholder="Buscar por item, desenho, dimensão ou descrição..."
                  leftIcon={searchIcon}
                  className="w-full bg-muted/50 border-border text-foreground h-9 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium"
                />
              </div>

              {parentCount > 0 && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shadow-sm whitespace-nowrap"
                    title="Expandir todos os itens pais"
                  >
                    Expandir Tudo
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
                    title="Recolher todos os itens pais"
                  >
                    Recolher Tudo
                  </button>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground font-medium shrink-0 self-end sm:self-center">
              {filterText.trim()
                ? `${filteredItems.length} de ${allItems.length} item(ns)`
                : `${allItems.length} item(ns)`}
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner max-h-[460px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base / Código</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                    <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                    <th className="text-right px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[280px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232323]">
                  {visibleItems.map((item: any, i: number) => {
                    const depth = item.depth || 0;
                    const isParent = isParentItem(item);
                    const childCount = getChildrenCount(item);
                    const itemId = getItemId(item, i);
                    const isExpanded = isExpandedId(itemId);

                    return (
                      <tr
                        key={item.uniqueId || item.nodeId || i}
                        className={`transition-colors group/inner ${
                          depth > 0
                            ? "bg-[#141414]/60 hover:bg-[#181818]"
                            : isParent
                            ? "bg-[#161616] hover:bg-[#1c1c1c] font-medium"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono">
                          <div
                            className="flex items-center gap-1.5"
                            style={{ paddingLeft: `${depth * 20}px` }}
                          >
                            {depth > 0 && (
                              <span className="text-zinc-600 select-none font-sans text-xs">└─</span>
                            )}

                            {isParent ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(itemId)}
                                className="p-0.5 rounded hover:bg-white/10 text-sky-400 cursor-pointer transition-colors shrink-0"
                                title={isExpanded ? "Recolher sub-itens" : "Expandir sub-itens"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}

                            {hasAdminPermission && (
                              <button
                                type="button"
                                onClick={() => editor.handleOpenEditCodeModal(item)}
                                className="inline-flex items-center justify-center h-5 w-5 rounded text-sky-400 hover:bg-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 opacity-60 group-hover/inner:opacity-100"
                                title="Trocar Item Base / Código"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                onClick={() => {
                                  if (isParent) toggleExpand(itemId);
                                }}
                                className={`text-sky-400 ${
                                  isParent
                                    ? "text-sky-300 font-bold cursor-pointer hover:underline"
                                    : "font-medium"
                                }`}
                              >
                                {item.itemBase || item.referencia || "—"}
                              </span>

                              {isParent && childCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(itemId);
                                  }}
                                  className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 cursor-pointer transition-colors"
                                  title={isExpanded ? `Clique para recolher ${childCount} itens` : `Clique para expandir ${childCount} itens`}
                                >
                                  {childCount} {childCount === 1 ? "item" : "itens"}
                                </button>
                              )}

                              {item.referencia && item.referencia !== item.itemBase && (
                                <span className="text-[10px] text-muted-foreground block font-sans">
                                  Ref: {item.referencia}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/80 font-mono text-xs">{item.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[140px]">
                          <div className="flex items-center gap-2">
                            {hasAdminPermission && (
                              <button
                                type="button"
                                onClick={() => editor.handleOpenEditDimModal(item)}
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
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
                                className="inline-flex items-center justify-center h-6 w-6 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
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
                            extraActions={
                              hasAdminPermission && (
                                <button
                                  onClick={() => editor.handleOpenDeleteConfirm(item)}
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                                  title={isParentItem(item) ? "Excluir item e todos os sub-itens" : "Excluir item"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
          ) : allItems.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item corresponde à busca.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
              <p className="text-xs italic text-[#555]">Nenhum item detectado no XML.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAIS DE EDIÇÃO/CONFIRMAÇÃO/EXCLUSÃO */}
      <ItemEditorModals editor={editor} />
    </section>
  );
}
