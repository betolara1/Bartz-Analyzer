import React, { useState, useMemo } from "react";
import { Boxes, ChevronDown, ChevronRight, Edit2, AlertTriangle, Search, FileText, FolderOpen, FolderCheck, Copy } from "lucide-react";
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
  }, [data?.fullpath]);

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newDescription, setNewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Helper methods to identify hierarchy
  const getItemId = (item: any, index: number): number | string => {
    if (item.nodeId !== undefined && item.nodeId !== null) return item.nodeId;
    if (item.id !== undefined && item.id !== null) return item.id;
    return index;
  };

  const isParentItem = (item: any): boolean => {
    if (Array.isArray(item.childNodeIds) && item.childNodeIds.length > 0) return true;
    if (Array.isArray(item.descendantIds) && item.descendantIds.length > 0) return true;
    return false;
  };

  const getChildrenCount = (item: any): number => {
    if (Array.isArray(item.descendantIds) && item.descendantIds.length > 0) {
      return item.descendantIds.length;
    }
    if (Array.isArray(item.childNodeIds) && item.childNodeIds.length > 0) {
      return item.childNodeIds.length;
    }
    return 0;
  };

  const toggleExpand = (id: number | string) => {
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

  const expandAll = () => {
    const allParents = new Set<number | string>();
    allItems.forEach((it, idx) => {
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

  // Itens visíveis: quando não há busca por texto, exibe apenas os pais raiz e filhos cujos pais estejam em expandedIds
  const visibleItems = useMemo(() => {
    if (filterText.trim()) {
      return filteredItems;
    }

    return filteredItems.filter((item: any) => {
      // Itens raiz (nível 0) sempre aparecem
      if (!item.ancestorIds || item.ancestorIds.length === 0 || (item.depth || 0) === 0) {
        return true;
      }
      // Sub-itens só aparecem se todos os seus ancestrais estiverem expandidos
      return item.ancestorIds.every((ancId: number | string) => expandedIds.has(ancId));
    });
  }, [filteredItems, expandedIds, filterText]);

  if (allItems.length === 0) return null;

  const handleOpenEditModal = (item: any) => {
    setSelectedItem(item);
    setNewDescription(item.descricao || "");
    setIsEditModalOpen(true);
  };

  const handleApplyDescriptionChange = async () => {
    if (!data || !selectedItem || !newDescription.trim()) return;

    setIsSaving(true);
    const id = toast.loading("Salvando nova descrição...");
    try {
      const res = await window.electron?.analyzer?.replaceItemDescription?.(
        data.fullpath,
        selectedItem.ids || [selectedItem.id],
        newDescription.trim(),
        selectedItem.desenho
      );

      if (res?.ok) {
        toast.success("Descrição alterada com sucesso!");
        setIsConfirmModalOpen(false);
        setSelectedItem(null);
      } else {
        toast.error(`Falha ao alterar descrição: ${res?.message || "erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error("Erro ao alterar.", { description: String(error?.message || error) });
    } finally {
      setIsSaving(false);
      toast.dismiss(id);
    }
  };

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
    <section className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div className="px-5 py-4 flex items-center justify-between border-b border-sky-200 dark:border-sky-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-sky-400">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Todos os Itens</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Listagem de todos os componentes do arquivo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${allItems.length > 0 ? 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'bg-[#333]'}`} />
        </div>
      </div>
      <div className="px-5 pb-5 pt-4 space-y-3">
        {allItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-md group">
              <Input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                onClear={() => setFilterText("")}
                placeholder="Buscar por item, desenho, dimensão ou descrição..."
                className="w-full bg-muted/50 border-border text-foreground h-9 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium"
                style={{ paddingLeft: "2.5rem" }}
              />
              <Search
                className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-sky-400 transition-colors pointer-events-none z-10"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>

            {parentCount > 0 && !filterText.trim() && (
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={expandAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border/60 transition-all cursor-pointer shadow-xs"
                  title="Expandir todos os itens pais"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-sky-400" />
                  <span>Expandir Tudo</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border/60 transition-all cursor-pointer shadow-xs"
                  title="Recolher todos os itens pais"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                  <span>Recolher Tudo</span>
                </button>
              </div>
            )}
          </div>
        )}

        {visibleItems.length > 0 ? (
          <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner max-h-[380px] overflow-y-auto overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323] sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base / Ref</th>
                  <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                  <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                  <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                  <th className="text-right px-4 py-3 uppercase font-bold tracking-widest text-[9px] w-[240px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]">
                {visibleItems.map((item: any, i: number) => {
                  const itemId = getItemId(item, i);
                  const isParent = isParentItem(item);
                  const isExpanded = expandedIds.has(itemId);
                  const childCount = getChildrenCount(item);

                  return (
                    <tr
                      key={itemId}
                      className={`hover:bg-white/[0.03] transition-colors group/inner ${
                        isParent ? "bg-white/[0.015]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sky-400">
                        <div
                          className="flex items-center gap-1.5"
                          style={{
                            paddingLeft: `${Math.min(item.depth || 0, 4) * 12}px`,
                          }}
                        >
                          {isParent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(itemId);
                              }}
                              className="flex items-center justify-center h-5 w-5 rounded-md text-sky-400 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 transition-all cursor-pointer shrink-0"
                              title={isExpanded ? "Clique para recolher sub-itens" : "Clique para expandir sub-itens"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-sky-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                              )}
                            </button>
                          ) : (item.depth || 0) > 0 ? (
                            <span className="text-[#555] font-sans text-[10px] pl-1 select-none">
                              └
                            </span>
                          ) : (
                            <span className="w-5" />
                          )}

                          <div className="truncate flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={isParent ? () => toggleExpand(itemId) : undefined}
                              className={`truncate ${
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
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">{item.dimensao}</td>
                      <td className="px-4 py-3 text-white text-[11px] leading-tight max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {hasAdminPermission && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
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
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {/* Botão Primário: Abrir Desenho */}
                          {hasAdminPermission && (
                            <button
                              disabled={!item.desenho}
                              onClick={() => handleOpenDrawing(item.desenho)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                              title={item.desenho ? "Abrir arquivo do desenho" : "Sem desenho"}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>Abrir</span>
                            </button>
                          )}

                          {/* Dropdown de Pastas */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                disabled={!item.desenho}
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
                                Pastas do Desenho ({item.desenho})
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() => handleOpenDrawingFolder(item.desenho)}
                                className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-amber-300"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                <span>NESTING (SERVIDOR)</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => handleOpenMirrorFolder(item.desenho)}
                                className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-purple-300"
                              >
                                <FolderCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                <span>NESTING (DXF ALESSANDRO)</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => handleOpenAspanFolder(item.desenho)}
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
                              disabled={!item.desenho}
                              onClick={() => handleCopyToMirror(item.desenho)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                              title={item.desenho ? "Enviar desenho para a pasta espelho DXF" : "Sem desenho"}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>Enviar DXF</span>
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
        ) : allItems.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
            <p className="text-xs italic text-[#555]">Nenhum item corresponde à busca.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
            <p className="text-xs italic text-[#555]">Nenhum item detectado.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: EDITAR DESCRIÇÃO */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#151515] border border-sky-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Edit2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Trocar Descrição</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Alteração de descrição do item</p>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Descrição Atual</label>
                <div className="px-3 py-2.5 rounded-lg bg-[#0E0E0E] border border-[#232323] text-xs text-zinc-400 select-all font-medium leading-relaxed">
                  {selectedItem.descricao || <span className="italic text-zinc-600">vazio</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Nova Descrição</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onClear={() => setNewDescription("")}
                  placeholder="Digite a nova descrição do item..."
                  className="w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium"
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedItem(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                disabled={!newDescription.trim() || newDescription.trim() === selectedItem.descricao}
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsConfirmModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR ALTERAÇÃO */}
      {isConfirmModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#151515] border border-sky-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Confirmar Troca de Descrição</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Aviso de segurança</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Você tem certeza que deseja alterar a descrição deste produto no arquivo XML? Esta alteração será gravada diretamente nas tags correspondentes.
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-[#0E0E0E] border border-[#232323]">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">De:</div>
                  <div className="text-xs text-rose-400 font-medium line-through leading-relaxed">
                    {selectedItem.descricao || "—"}
                  </div>
                </div>
                <div className="border-t border-[#232323] pt-2">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Para:</div>
                  <div className="text-xs text-emerald-400 font-bold leading-relaxed">
                    {newDescription}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 font-medium italic">
                * Um backup do arquivo original será criado antes de aplicar esta alteração.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                disabled={isSaving}
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setIsEditModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                disabled={isSaving}
                onClick={handleApplyDescriptionChange}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? "Salvando..." : "Confirmar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
