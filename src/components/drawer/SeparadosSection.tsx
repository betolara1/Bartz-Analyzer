import React, { useState, useMemo } from "react";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Search,
  Edit2,
} from "lucide-react";
import { Row } from "../../types";
import { Input, searchIcon } from "../ui/input";
import { ItemEditorModals } from "../shared/ItemEditorModals";
import { useItemEditor, ItemEditorCodeLabels } from "../../hooks/useItemEditor";
import { getItemId, isParentItem, getChildrenCount } from "../../utils/itemHelpers";

interface SeparadosSectionProps {
  data: Row | null;
  hasAdminPermission?: boolean;
}

const SEPARADOS_CODE_LABELS: ItemEditorCodeLabels = {
  title: "Trocar Código do Item",
  subtitle: "Alteração do código do item e referência no XML (ITEM_BASE / REFERENCIA)",
  currentLabel: "Código Atual",
  newLabel: "Novo Código",
  placeholder: "Digite o novo código...",
  confirmTitle: "Confirmar Troca de Código",
  loadingToast: "Salvando novo código do item...",
  successPrefix: "Código",
  errorPrefix: "código",
  primaryAttrName: "REFERENCIA",
};

/**
 * Extrai o prefixo (iniciais) de um itemBase.
 * Exemplo: "AA2185" → "AA", "LN4004" → "LN", "ES02MS" → "ES", "PO1234" → "PO"
 * Captura todas as letras iniciais antes do primeiro dígito.
 */
function extractPrefix(itemBase: string): string {
  if (!itemBase) return "OUTROS";
  const upper = itemBase.toUpperCase().trim();
  const match = upper.match(/^([A-Z]+)/);
  return match ? match[1] : "OUTROS";
}

export function SeparadosSection({ data, hasAdminPermission }: SeparadosSectionProps) {
  const allItems = (data?.meta?.allItems || []) as any[];

  // Filter state
  const [filterText, setFilterText] = useState("");

  // Expanded prefix groups
  const [expandedPrefixes, setExpandedPrefixes] = useState<Set<string>>(new Set());

  // Expanded parent items within groups
  const [expandedIds, setExpandedIds] = useState<Set<number | string>>(new Set());

  // Reset when file changes
  React.useEffect(() => {
    setExpandedPrefixes(new Set());
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
    codeModalLabels: SEPARADOS_CODE_LABELS,
  });

  const toggleExpandItem = (id: number | string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePrefix = (prefix: string) => {
    setExpandedPrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  };

  // Group items by prefix — only root-level items (depth 0)
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};

    for (const item of allItems) {
      // Only group root-level items (depth 0 or no ancestors)
      if ((item.depth || 0) > 0 && item.ancestorIds && item.ancestorIds.length > 0) {
        continue;
      }

      const prefix = extractPrefix(item.itemBase || item.referencia || "");
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(item);
    }

    return groups;
  }, [allItems]);

  // Filtered groups based on search
  const filteredGroups = useMemo(() => {
    if (!filterText.trim()) return groupedItems;

    const search = filterText.toLowerCase().trim();
    const result: Record<string, any[]> = {};

    for (const [prefix, items] of Object.entries(groupedItems)) {
      if (prefix.toLowerCase().includes(search)) {
        result[prefix] = items;
        continue;
      }

      const filtered = items.filter((item: any) => {
        return (
          (item.itemBase || "").toLowerCase().includes(search) ||
          (item.referencia || "").toLowerCase().includes(search) ||
          (item.desenho || "").toLowerCase().includes(search) ||
          (item.dimensao || "").toLowerCase().includes(search) ||
          (item.descricao || "").toLowerCase().includes(search)
        );
      });

      if (filtered.length > 0) {
        result[prefix] = filtered;
      }
    }

    return result;
  }, [groupedItems, filterText]);

  // Sort prefixes alphabetically
  const sortedPrefixes = useMemo(() => {
    return Object.keys(filteredGroups).sort((a, b) => {
      if (a === "OUTROS") return 1;
      if (b === "OUTROS") return -1;
      return a.localeCompare(b);
    });
  }, [filteredGroups]);

  // Total count of root items
  const totalRootItems = useMemo(() => {
    return Object.values(groupedItems).reduce((sum, items) => sum + items.length, 0);
  }, [groupedItems]);

  // Get all descendant items for a given parent
  const getDescendants = (item: any): any[] => {
    const descendantIds = item.descendantIds || item.childNodeIds || [];
    if (descendantIds.length === 0) return [];

    return allItems.filter((child: any) => {
      const childId = child.nodeId !== undefined ? child.nodeId : child.id;
      return descendantIds.includes(childId);
    });
  };

  if (allItems.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md flex-1 group">
          <Input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onClear={() => setFilterText("")}
            placeholder="Buscar por prefixo, código, desenho ou descrição..."
            leftIcon={searchIcon}
            className="w-full bg-[#111] border border-[#282828] text-white h-9 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium placeholder:text-[#555]"
          />
        </div>

        <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <span>{sortedPrefixes.length} grupo(s)</span>
          <span>•</span>
          <span>{totalRootItems} itens raiz</span>
        </div>
      </div>

      {/* Prefix Groups Accordion */}
      {sortedPrefixes.length > 0 ? (
        <div className="space-y-2">
          {sortedPrefixes.map((prefix) => {
            const items = filteredGroups[prefix] || [];
            const isExpanded = expandedPrefixes.has(prefix);

            return (
              <div
                key={prefix}
                className="rounded-xl border border-[#232323] bg-[#141414] overflow-hidden transition-all duration-200"
              >
                {/* Group Header */}
                <div
                  onClick={() => togglePrefix(prefix)}
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors select-none group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono font-bold text-xs">
                      {prefix}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-wide">
                          Grupo {prefix}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-400">
                          {items.length} {items.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-md hover:bg-white/[0.05] text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Group Content — Table */}
                {isExpanded && (
                  <div className="border-t border-[#232323]">
                    <div className="rounded-b-lg bg-[#111] overflow-hidden shadow-inner max-h-[350px] overflow-y-auto overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs min-w-[600px]">
                        <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                          <tr>
                            <th className="text-left px-4 py-2.5 uppercase font-bold tracking-widest text-[9px]">Item Base / Ref</th>
                            <th className="text-left px-4 py-2.5 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                            <th className="text-left px-4 py-2.5 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                            <th className="text-left px-4 py-2.5 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232323]">
                          {items.map((item: any, i: number) => {
                            const itemId = getItemId(item, i);
                            const isParent = isParentItem(item);
                            const isItemExpanded = expandedIds.has(itemId);
                            const childCount = getChildrenCount(item);
                            const descendants = isItemExpanded ? getDescendants(item) : [];

                            return (
                              <React.Fragment key={`${prefix}-${itemId}`}>
                                {/* Parent / Root Item Row */}
                                <tr className={`hover:bg-white/[0.03] transition-colors ${isParent ? "bg-white/[0.015]" : ""}`}>
                                  <td className="px-4 py-3 font-mono text-sky-400">
                                    <div className="flex items-center gap-1.5">
                                      {isParent ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpandItem(itemId);
                                          }}
                                          className="flex items-center justify-center h-5 w-5 rounded-md text-sky-400 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 transition-all cursor-pointer shrink-0"
                                          title={isItemExpanded ? "Recolher sub-itens" : "Expandir sub-itens"}
                                        >
                                          {isItemExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-sky-400" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                                          )}
                                        </button>
                                      ) : (
                                        <span className="w-5" />
                                      )}

                                      {hasAdminPermission && (
                                        <button
                                          type="button"
                                          onClick={() => editor.handleOpenEditCodeModal(item)}
                                          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                                          title="Trocar Código do Item"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                      )}

                                      <div className="truncate flex items-center gap-1.5 flex-wrap">
                                        <span
                                          onClick={isParent ? () => toggleExpandItem(itemId) : undefined}
                                          className={`truncate ${isParent ? "text-sky-300 font-bold cursor-pointer hover:underline" : "font-medium"}`}
                                        >
                                          {item.itemBase || item.referencia || "—"}
                                        </span>
                                        {isParent && childCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleExpandItem(itemId);
                                            }}
                                            className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 cursor-pointer transition-colors"
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
                                </tr>

                                {/* Descendant / Child Rows */}
                                {isItemExpanded && descendants.map((child: any, ci: number) => (
                                  <tr
                                    key={`${prefix}-${itemId}-child-${ci}`}
                                    className="hover:bg-white/[0.03] transition-colors bg-white/[0.008]"
                                  >
                                    <td className="px-4 py-2.5 font-mono text-sky-400/70">
                                      <div className="flex items-center gap-1.5" style={{ paddingLeft: `${Math.min(child.depth || 1, 4) * 12}px` }}>
                                        <span className="text-[#555] font-sans text-[10px] pl-1 select-none">└</span>
                                        {hasAdminPermission && (
                                          <button
                                            type="button"
                                            onClick={() => editor.handleOpenEditCodeModal(child)}
                                            className="inline-flex items-center justify-center h-5 w-5 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                                            title="Trocar Código do Item"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        <span className="truncate font-medium text-sky-400/80">
                                          {child.itemBase || child.referencia || "—"}
                                        </span>
                                        {child.referencia && child.referencia !== child.itemBase && (
                                          <span className="text-[10px] text-muted-foreground/70 font-sans">
                                            Ref: {child.referencia}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-white/60 font-mono text-xs">{child.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground/70 truncate max-w-[140px]">
                                      <div className="flex items-center gap-2">
                                        {hasAdminPermission && (
                                          <button
                                            type="button"
                                            onClick={() => editor.handleOpenEditDimModal(child)}
                                            className="inline-flex items-center justify-center h-5 w-5 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                                            title="Trocar Dimensão"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        <span className="truncate font-mono">
                                          {child.dimensao || <span className="text-white/30 italic font-sans">vazio</span>}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-white/70 text-[11px] leading-tight max-w-[280px]">
                                      <div className="flex items-center gap-2">
                                        {hasAdminPermission && (
                                          <button
                                            type="button"
                                            onClick={() => editor.handleOpenEditModal(child)}
                                            className="inline-flex items-center justify-center h-5 w-5 rounded-md text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 active:scale-[0.97] transition-all cursor-pointer shrink-0 shadow-sm"
                                            title="Trocar Descrição"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        <span className="break-words">
                                          {child.descricao || <span className="text-white/30 italic">vazio</span>}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
          <p className="text-xs italic text-[#555]">Nenhum item corresponde à busca.</p>
        </div>
      )}

      {/* Modais de Edição/Confirmação de Item */}
      <ItemEditorModals editor={editor} />
    </div>
  );
}
