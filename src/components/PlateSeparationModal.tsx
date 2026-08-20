import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import {
  Layers,
  RefreshCw,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Filter,
  Package,
  Calendar,
} from "lucide-react";

export interface PlateSeparationTableItem {
  index: number;
  codigo: string;
  descricao: string;
  metros: string;
  quantidade: string;
  qtde_real: string;
  obs: string;
}

export interface PlateSeparationItem {
  id: string;
  fileName: string;
  filePath: string;
  pdfPath: string;
  pdfExists: boolean;
  size: number;
  mtime: string | null;
  birthtime: string | null;
  responsavel: string;
  status: string;
  concluido_em: string;
  concluido_por: string;
  loteTitle?: string;
  tableItems: PlateSeparationTableItem[];
  rawJson?: any;
}

interface PlateSeparationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: any;
  initialItems?: PlateSeparationItem[];
  onRefresh?: () => void;
}

export const PlateSeparationModal: React.FC<PlateSeparationModalProps> = ({
  open,
  onOpenChange,
  initialItems,
  onRefresh,
}) => {
  const [items, setItems] = useState<PlateSeparationItem[]>(initialItems || []);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedItems, setExpandedItems] = useState<Record<number | string, boolean>>({});

  // Sincronizar com itens passados pelo Dashboard background monitor
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
    }
  }, [initialItems]);

  const fetchItems = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const res = await window.electron?.analyzer?.getPlateSeparationData?.();
      if (res?.ok && Array.isArray(res.data)) {
        setItems(res.data);
        if (showToast) {
          toast.success(`${res.data.length} arquivo(s) de separação de chapas carregado(s).`);
        }
      } else {
        toast.error(res?.message || "Erro ao carregar arquivos de Separação de Chapas.");
      }
    } catch (err: any) {
      console.error("[PlateSeparationModal] Erro ao buscar itens:", err);
      toast.error(`Falha na comunicação: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchItems(false);
    }
  }, [open, fetchItems]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenPdf = async (item: PlateSeparationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.pdfExists || !item.pdfPath) {
      toast.error(`Arquivo PDF correspondente (${item.id}.pdf) não foi encontrado na pasta.`);
      return;
    }

    try {
      const res = await window.electron?.analyzer?.openPlateSeparationFile?.(item.pdfPath);
      if (res?.ok) {
        toast.success(`Abrindo PDF: ${item.id}.pdf`);
      } else {
        toast.error(`Erro ao abrir PDF: ${res?.message || "Arquivo não pôde ser aberto"}`);
      }
    } catch (err: any) {
      toast.error(`Erro ao tentar abrir PDF: ${err?.message || err}`);
    }
  };

  // Filtragem e busca
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro de status
      if (statusFilter !== "todos") {
        const itemStatus = (item.status || "").toLowerCase().trim();
        if (statusFilter === "concluido") {
          if (!itemStatus.includes("concluido")) return false;
        } else if (statusFilter === "pendente") {
          if (itemStatus.includes("concluido")) return false;
        } else if (itemStatus !== statusFilter.toLowerCase().trim()) {
          return false;
        }
      }

      // Filtro de texto / busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = item.id.toLowerCase().includes(term);
        const matchLote = (item.loteTitle || "").toLowerCase().includes(term);
        const matchFile = item.fileName.toLowerCase().includes(term);
        const matchResp = (item.responsavel || "").toLowerCase().includes(term);
        const matchConcPor = (item.concluido_por || "").toLowerCase().includes(term);
        const matchStatus = (item.status || "").toLowerCase().includes(term);
        const matchConcEm = (item.concluido_em || "").toLowerCase().includes(term);

        // Verificar nas linhas dos itens da tabela
        const matchTable = (item.tableItems || []).some(
          (t) =>
            t.codigo.toLowerCase().includes(term) ||
            t.descricao.toLowerCase().includes(term) ||
            t.quantidade.toLowerCase().includes(term) ||
            t.qtde_real.toLowerCase().includes(term) ||
            t.obs.toLowerCase().includes(term)
        );

        if (!matchId && !matchLote && !matchFile && !matchResp && !matchConcPor && !matchStatus && !matchConcEm && !matchTable) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusFilter, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="plate-separation-description"
        className="bg-card border-border sm:max-w-6xl w-[92vw] max-w-[92vw] max-h-[90vh] p-0 overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-cyan-950/50 via-cyan-900/10 to-transparent p-5 pr-14 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-cyan-600/20 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400 shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Separação de Chapas
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                  {items.length} {items.length === 1 ? "arquivo" : "arquivos"}
                </span>
              </DialogTitle>
              <DialogDescription id="plate-separation-description" className="text-xs text-muted-foreground">
                Monitoramento e leitura dos arquivos de controle do corte e separação
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-[10px] font-medium border border-cyan-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Auto-Sync (5s)
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchItems(true);
                onRefresh?.();
              }}
              disabled={loading}
              className="gap-2 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 md:flex-none md:w-80 group">
            <Input
              type="text"
              placeholder="Buscar por lote, código, descrição, responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              className="w-full bg-muted/50 border-border text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium h-9"
              style={{ paddingLeft: "2.5rem" }}
            />
            <Search
              className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10"
              style={{ top: "50%", transform: "translateY(-50%)" }}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex rounded-lg bg-background p-1 border border-border text-xs">
              <button
                onClick={() => setStatusFilter("todos")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "todos"
                    ? "bg-cyan-600 text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter("pendente")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "pendente"
                    ? "bg-amber-600 text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pendentes (
                {items.filter((i) => !(i.status || "").toLowerCase().includes("concluido")).length})
              </button>
              <button
                onClick={() => setStatusFilter("concluido")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "concluido"
                    ? "bg-emerald-600 text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Concluídos (
                {items.filter((i) => (i.status || "").toLowerCase().includes("concluido")).length})
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">
                Lendo arquivos de controle da Separação de Chapas...
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
              <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Nenhum arquivo de separação de chapas encontrado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {searchTerm || statusFilter !== "todos"
                  ? "Tente ajustar os termos de busca ou filtros selecionados."
                  : "Nenhum arquivo JSON foi encontrado na pasta de controle."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = !!expandedItems[item.id];
              const isConcluido = (item.status || "").toLowerCase().includes("concluido");
              const tableItems = item.tableItems || [];

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card/60 hover:border-cyan-500/40 transition-all duration-200 overflow-hidden shadow-sm"
                >
                  {/* Item Header Row */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-4 bg-muted/40 hover:bg-muted/70 cursor-pointer flex items-center justify-between gap-4 border-b border-border/50"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-bold text-sm flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-cyan-400" />
                        Lote {item.id}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold border flex items-center gap-1 ${
                          isConcluido
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {isConcluido ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {item.status || "Pendente"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                        {item.concluido_em && (
                          <div className="flex items-center gap-1" title="Data de Conclusão">
                            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                            {item.concluido_em}
                          </div>
                        )}

                        {item.responsavel && (
                          <div className="flex items-center gap-1" title="Responsável">
                            <User className="h-3.5 w-3.5 text-cyan-400" />
                            {item.responsavel}
                          </div>
                        )}
                      </div>

                      {/* Botão Abrir PDF */}
                      {item.pdfExists && (
                        <Button
                          size="sm"
                          onClick={(e) => handleOpenPdf(item, e)}
                          variant="outline"
                          className="h-8 px-3 text-xs border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-300 font-bold gap-1.5 shadow-md transition-all shrink-0 cursor-pointer"
                          title="Abrir o arquivo PDF correspondente"
                        >
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                          Abrir PDF
                        </Button>
                      )}

                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-cyan-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section */}
                  {isExpanded && (
                    <div className="p-4 bg-muted/10 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Package className="h-3.5 w-3.5 text-cyan-400" />
                        Itens da Separação de Chapas ({tableItems.length})
                      </div>

                      {tableItems.length > 0 && (
                        <div className="bg-card/90 rounded-xl border border-border overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-muted/60 border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <th className="py-2.5 px-3.5 w-32">Código</th>
                                  <th className="py-2.5 px-3.5">Descrição do Item</th>
                                  <th className="py-2.5 px-3.5 w-24 text-right">Metros</th>
                                  <th className="py-2.5 px-3.5 w-28 text-right">Quantidade</th>
                                  <th className="py-2.5 px-3.5 w-36 text-center text-cyan-300">Qtde Chapas Real</th>
                                  <th className="py-2.5 px-3.5 min-w-[140px]">Obs</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40 font-medium">
                                {tableItems.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 px-3.5 font-mono text-cyan-400 font-bold whitespace-nowrap">
                                      {row.codigo || "—"}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-foreground font-semibold">
                                      {row.descricao || "—"}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right font-mono text-muted-foreground">
                                      {row.metros || "—"}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-foreground">
                                      {row.quantidade || "—"}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-center">
                                      {row.qtde_real ? (
                                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-xs">
                                          {row.qtde_real}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/50 italic">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-muted-foreground italic">
                                      {row.obs ? (
                                        <span className="text-foreground not-italic font-normal bg-muted/40 px-2 py-0.5 rounded">
                                          {row.obs}
                                        </span>
                                      ) : (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Exibindo <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> arquivo(s)
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
