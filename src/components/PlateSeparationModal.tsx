import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  MessageSquare,
  Send,
  Database,
  CheckSquare,
  Square,
  Boxes,
  ArrowRight,
} from "lucide-react";

export interface PlateSeparationComment {
  id?: string;
  autor?: string;
  data?: string;
  texto: string;
}

export interface PlateSeparationTableItem {
  index: number;
  codigo: string;
  descricao: string;
  metros: string;
  quantidade: string;
  qtde_real: string;
  obs: string;
}

export interface PlateSeparationLancamentoErp {
  documento: number;
  data: string;
  usuario: string;
  tipoTransacao?: string;
  deposito?: number;
  centroCusto?: number;
  totalItens?: number;
  itens?: Array<{ codigo: string; descricao: string; quantidade: number }>;
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
  prioridade?: boolean;
  concluido_em: string;
  concluido_por: string;
  lancado_erp?: PlateSeparationLancamentoErp | null;
  loteTitle?: string;
  comentarios?: PlateSeparationComment[];
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
  currentUser,
  initialItems,
  onRefresh,
}) => {
  const [items, setItems] = useState<PlateSeparationItem[]>(initialItems || []);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedItems, setExpandedItems] = useState<Record<number | string, boolean>>({});

  // Active chat lot ID (derived directly from items state for instant sync)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Estado do modal de lançamento de movimento no ERP
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchingLoteItem, setLaunchingLoteItem] = useState<PlateSeparationItem | null>(null);
  const [launchPreview, setLaunchPreview] = useState<any | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [launchItems, setLaunchItems] = useState<
    Array<{
      index: number;
      codigo: string;
      descricao: string;
      metros: string;
      quantidade: string;
      qtde_real: string;
      obs: string;
      selected: boolean;
      finalQty: string;
    }>
  >([]);
  const [isSubmittingLaunch, setIsSubmittingLaunch] = useState(false);

  // Nome do usuário logado no Pedidos Online
  const loggedInUserName = useMemo(() => {
    return (
      currentUser?.txt_nome ||
      currentUser?.txt_login ||
      currentUser?.nome_usuario ||
      currentUser?.name ||
      "Usuário"
    );
  }, [currentUser]);

  // Chat scroll & sync refs
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PlateSeparationItem[]>(items);
  itemsRef.current = items;

  // Derive the active chat item directly from items
  const activeLotItem = useMemo(() => {
    if (!selectedLotId) return null;
    return items.find((i) => i.id === selectedLotId) || null;
  }, [items, selectedLotId]);

  const activeComments = useMemo(() => {
    return activeLotItem?.comentarios || [];
  }, [activeLotItem]);

  const prevCommentsCountRef = useRef<number>(activeComments.length);

  const scrollToBottom = useCallback((smooth = true) => {
    if (commentsScrollRef.current) {
      commentsScrollRef.current.scrollTo({
        top: commentsScrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

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

  // Carregar itens ao abrir o modal principal
  useEffect(() => {
    if (open) {
      fetchItems(false);
    }
  }, [open, fetchItems]);

  // Polling em tempo real de comentários quando a janela de chat do lote estiver aberta (1000ms)
  useEffect(() => {
    if (!selectedLotId) return;

    const currentLot = selectedLotId;
    prevCommentsCountRef.current = itemsRef.current.find((it) => it.id === currentLot)?.comentarios?.length || 0;
    setTimeout(() => scrollToBottom(false), 60);

    const syncCommentsTick = async () => {
      try {
        let newComments: PlateSeparationComment[] | null = null;

        // Tenta endpoint leve do arquivo individual
        const res = await window.electron?.analyzer?.getPlateSeparationComments?.(currentLot);
        if (res?.ok && Array.isArray(res.comentarios)) {
          newComments = res.comentarios;
        } else {
          // Fallback para getPlateSeparationData
          const fullRes = await window.electron?.analyzer?.getPlateSeparationData?.();
          if (fullRes?.ok && Array.isArray(fullRes.data)) {
            setItems(fullRes.data);
            const found = fullRes.data.find((it: any) => it.id === currentLot);
            if (found && Array.isArray(found.comentarios)) {
              newComments = found.comentarios;
            }
          }
        }

        if (newComments) {
          const prevCount = prevCommentsCountRef.current;
          if (newComments.length !== prevCount) {
            prevCommentsCountRef.current = newComments.length;

            // Se chegou mensagem nova de outro usuário, toca alerta sonoro
            if (newComments.length > prevCount) {
              const lastComment = newComments[newComments.length - 1];
              const myAuthor = (loggedInUserName || "Ralf").toLowerCase().trim();
              if (lastComment && String(lastComment.autor || "").toLowerCase().trim() !== myAuthor) {
                try {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
                  gain.gain.setValueAtTime(0.08, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.18);
                } catch {}
              }
            }

            setItems((prev) =>
              prev.map((it) => (it.id === currentLot ? { ...it, comentarios: newComments! } : it))
            );
            setTimeout(() => scrollToBottom(true), 80);
          }
        }
      } catch (err) {
        console.error("[PlateSeparationModal] Erro no live sync do chat:", err);
      }
    };

    syncCommentsTick();
    const intervalId = setInterval(syncCommentsTick, 1000);

    return () => clearInterval(intervalId);
  }, [selectedLotId, loggedInUserName, scrollToBottom]);

  // Sempre que a lista de comentários mudar, rola para o fim se novas mensagens chegarem
  useEffect(() => {
    if (selectedLotId && activeComments.length > 0) {
      scrollToBottom(true);
    }
  }, [activeComments.length, selectedLotId, scrollToBottom]);

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

  const handleOpenCommentsModal = (item: PlateSeparationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLotId(item.id);
    setNewCommentText("");
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotId || !newCommentText.trim()) return;

    setIsSendingComment(true);
    const author = loggedInUserName;
    const textToSend = newCommentText.trim();
    const currentLot = selectedLotId;
    setNewCommentText("");

    try {
      const res = await window.electron?.analyzer?.addPlateSeparationComment?.({
        id: currentLot,
        texto: textToSend,
        autor: author,
      });

      if (res?.ok) {
        if (res.comentarios) {
          const updatedComments = res.comentarios;
          prevCommentsCountRef.current = updatedComments.length;
          setItems((prev) =>
            prev.map((it) => (it.id === currentLot ? { ...it, comentarios: updatedComments } : it))
          );
          setTimeout(() => scrollToBottom(true), 60);
        }

        onRefresh?.();
      } else {
        toast.error(`Erro ao salvar comentário: ${res?.message || "Erro desconhecido"}`);
        setNewCommentText(textToSend);
      }
    } catch (err: any) {
      toast.error(`Falha na comunicação: ${err?.message || err}`);
      setNewCommentText(textToSend);
    } finally {
      setIsSendingComment(false);
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 50);
    }
  };

  // Abrir modal de confirmação e lançamento no ERP
  const handleOpenLaunchModal = async (item: PlateSeparationItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLaunchingLoteItem(item);
    const initialList = (item.tableItems || []).map((t) => {
      const defQty = t.qtde_real && t.qtde_real.trim() !== "" ? t.qtde_real : t.quantidade || "1";
      return {
        ...t,
        selected: true,
        finalQty: defQty,
      };
    });
    setLaunchItems(initialList);
    setLaunchModalOpen(true);
    setIsLoadingPreview(true);

    try {
      const prev = await window.electron?.analyzer?.getPlateSeparationErpPreview?.(item.id);
      if (prev?.ok) {
        setLaunchPreview(prev);
      } else {
        setLaunchPreview(null);
      }
    } catch {
      setLaunchPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Alternar seleção de item na tabela de lançamento
  const handleToggleLaunchItem = (idx: number) => {
    setLaunchItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it))
    );
  };

  // Alterar quantidade a lançar
  const handleLaunchQtyChange = (idx: number, newQty: string) => {
    setLaunchItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, finalQty: newQty } : it))
    );
  };

  // Confirmar e executar a baixa/lançamento no ERP DB2
  const handleConfirmLaunch = async () => {
    if (!launchingLoteItem) return;

    const selectedToLaunch = launchItems.filter(
      (it) => it.selected && parseFloat(it.finalQty.replace(",", ".")) > 0
    );

    if (selectedToLaunch.length === 0) {
      toast.error("Selecione ao menos um item com quantidade maior que zero para lançar.");
      return;
    }

    setIsSubmittingLaunch(true);
    try {
      const res = await window.electron?.analyzer?.postPlateSeparationMovement?.({
        id: launchingLoteItem.id,
        items: selectedToLaunch.map((it) => ({
          codigo: it.codigo,
          descricao: it.descricao,
          metros: it.metros,
          quantidade: it.finalQty,
          qtde_real: it.finalQty,
          obs: it.obs,
        })),
        usuario: loggedInUserName,
        usuarioId: currentUser?.pk_usuario || 0,
        deposito: launchPreview?.codigoDeposito || 1,
        centroCusto: launchPreview?.codigoCcusto || 1,
      });

      if (res?.ok) {
        toast.success(res.message || `Movimento RM #${res.nroDocument} lançado no ERP com sucesso!`);

        // Tocar alerta de sucesso
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch {}

        const currentLotId = launchingLoteItem.id;
        setItems((prev) =>
          prev.map((it) =>
            it.id === currentLotId
              ? {
                  ...it,
                  status: res.status || "Lançado",
                  lancado_erp: res.lancado_erp,
                  comentarios: res.comentarios || it.comentarios,
                }
              : it
          )
        );

        setLaunchModalOpen(false);
        onRefresh?.();
      } else {
        toast.error(res?.message || "Erro ao lançar movimento no ERP.");
      }
    } catch (err: any) {
      toast.error(`Falha na comunicação com o ERP: ${err?.message || err}`);
    } finally {
      setIsSubmittingLaunch(false);
    }
  };

  // Apenas lotes concluídos ou já lançados são exibidos (ocultando pendentes)
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const itemStatus = (item.status || "").toLowerCase().trim();
      const isLancado =
        itemStatus.includes("lançado") ||
        itemStatus.includes("lancado") ||
        !!item.lancado_erp;
      const isConcluido = itemStatus.includes("concluido");
      return isLancado || isConcluido;
    });
  }, [items]);

  // Filtragem e busca dentro dos itens visíveis (Concluídos e Lançados)
  const filteredItems = useMemo(() => {
    return visibleItems.filter((item) => {
      // Filtro de status
      if (statusFilter !== "todos") {
        const itemStatus = (item.status || "").toLowerCase().trim();
        const isItemLancado =
          itemStatus.includes("lançado") ||
          itemStatus.includes("lancado") ||
          !!item.lancado_erp;
        const isItemConcluido = !isItemLancado && itemStatus.includes("concluido");

        if (statusFilter === "concluido") {
          if (!isItemConcluido) return false;
        } else if (statusFilter === "lancado") {
          if (!isItemLancado) return false;
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

        // Verificar nos comentários
        const matchComments = (item.comentarios || []).some(
          (c) =>
            (c.texto || "").toLowerCase().includes(term) ||
            (c.autor || "").toLowerCase().includes(term)
        );

        if (
          !matchId &&
          !matchLote &&
          !matchFile &&
          !matchResp &&
          !matchConcPor &&
          !matchStatus &&
          !matchConcEm &&
          !matchTable &&
          !matchComments
        ) {
          return false;
        }
      }

      return true;
    });
  }, [visibleItems, statusFilter, searchTerm]);

  return (
    <>
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
                    {visibleItems.length} {visibleItems.length === 1 ? "lote" : "lotes"}
                  </span>
                </DialogTitle>
                <DialogDescription id="plate-separation-description" className="text-xs text-muted-foreground">
                  Monitoramento dos lotes concluídos no corte e lançamentos de estoque no ERP
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
                placeholder="Buscar por lote, código, descrição, responsável, comentário..."
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
                  Todos ({visibleItems.length})
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
                  {
                    visibleItems.filter((i) => {
                      const st = (i.status || "").toLowerCase();
                      const isLanc = st.includes("lançado") || st.includes("lancado") || !!i.lancado_erp;
                      return !isLanc && st.includes("concluido");
                    }).length
                  })
                </button>
                <button
                  onClick={() => setStatusFilter("lancado")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "lancado"
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Lançados (
                  {
                    visibleItems.filter((i) => {
                      const st = (i.status || "").toLowerCase();
                      return st.includes("lançado") || st.includes("lancado") || !!i.lancado_erp;
                    }).length
                  })
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
                  Nenhum lote concluído ou lançado encontrado
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {searchTerm || statusFilter !== "todos"
                    ? "Tente ajustar os termos de busca ou filtros selecionados."
                    : "Os lotes aparecerão aqui assim que forem concluídos no corte ou lançados no ERP."}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isExpanded = !!expandedItems[item.id];
                const isLancado =
                  (item.status || "").toLowerCase().includes("lançado") ||
                  (item.status || "").toLowerCase().includes("lancado") ||
                  !!item.lancado_erp;
                const isConcluido = !isLancado && (item.status || "").toLowerCase().includes("concluido");
                const tableItems = item.tableItems || [];
                const commentsCount = (item.comentarios || []).length;

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
                            isLancado
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : isConcluido
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {isLancado ? (
                            <Database className="h-3 w-3 text-blue-400" />
                          ) : isConcluido ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Clock className="h-3 w-3 text-amber-400" />
                          )}
                          {isLancado ? "Lançado" : isConcluido ? "Concluído" : (item.status || "Pendente")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
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

                        {/* Status Lançado ERP (badge do documento) ou Botão Lançar (apenas quando concluído e não lançado) */}
                        {isLancado ? (
                          item.lancado_erp && (
                            <div
                              className="h-8 px-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                              title={`Lançado no ERP por ${item.lancado_erp.usuario} em ${item.lancado_erp.data}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Doc #{item.lancado_erp.documento}</span>
                            </div>
                          )
                        ) : isConcluido ? (
                          <Button
                            size="sm"
                            onClick={(e) => handleOpenLaunchModal(item, e)}
                            className="h-8 px-3 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold gap-1.5 shadow-md transition-all shrink-0 cursor-pointer border border-emerald-400/30"
                            title="Lançar Movimento de Estoque (RM - Requisição de Materiais) no ERP"
                          >
                            <Database className="h-3.5 w-3.5 text-emerald-100" />
                            <span>Lançar no ERP (RM)</span>
                          </Button>
                        ) : null}

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

                        {/* Botão Comentários com Contagem */}
                        <Button
                          size="sm"
                          onClick={(e) => handleOpenCommentsModal(item, e)}
                          variant="outline"
                          className={`h-8 px-2.5 text-xs font-bold gap-1.5 shadow-md transition-all shrink-0 cursor-pointer ${
                            commentsCount > 0
                              ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                              : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                          title="Ver e adicionar comentários"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Comentários</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                              commentsCount > 0
                                ? "bg-cyan-500 text-black shadow-sm"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {commentsCount}
                          </span>
                        </Button>

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
                      <div className="p-4 bg-muted/10 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <Package className="h-3.5 w-3.5 text-cyan-400" />
                            Itens da Separação de Chapas ({tableItems.length})
                          </div>

                          {isConcluido && !isLancado && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => handleOpenLaunchModal(item, e)}
                                className="h-7 px-3 text-xs font-bold gap-1.5 shadow-sm transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Database className="h-3.5 w-3.5" />
                                Lançar Movimento (RM) no ERP
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Banner se já lançado */}
                        {item.lancado_erp && (
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <div>
                                <span>Movimento de Estoque RM oficial registrado no ERP: </span>
                                <strong className="text-white font-mono">Documento #{item.lancado_erp.documento}</strong>
                                <span className="text-emerald-400/80 ml-2">
                                  ({item.lancado_erp.data} por {item.lancado_erp.usuario})
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

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
              Exibindo <strong>{filteredItems.length}</strong> de <strong>{visibleItems.length}</strong> lote(s)
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dedicado de Comentários / Chat Instantâneo do Lote */}
      <Dialog open={!!selectedLotId} onOpenChange={(isOpen) => !isOpen && setSelectedLotId(null)}>
        <DialogContent className="bg-[#101217] border-cyan-500/30 text-foreground sm:max-w-xl w-[95vw] max-h-[85vh] p-0 overflow-hidden flex flex-col shadow-2xl z-[120]">
          {/* Header */}
          <DialogHeader className="p-4 bg-gradient-to-r from-cyan-950/60 via-cyan-900/20 to-transparent border-b border-border/80 shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    Comentários — Lote {selectedLotId}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                      {activeComments.length}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Histórico e mensagens instantâneas deste lote
                  </DialogDescription>
                </div>
              </div>

              {/* Live Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Ao Vivo
              </div>
            </div>
          </DialogHeader>

          {/* Lista de Mensagens do Chat com Auto-Scroll */}
          <div
            ref={commentsScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[420px] custom-scrollbar"
          >
            {activeComments.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/80 rounded-xl bg-muted/5">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-semibold text-foreground">Nenhum comentário registrado ainda</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                  Envie uma mensagem abaixo para iniciar a conversa em tempo real sobre este lote.
                </p>
              </div>
            ) : (
              activeComments.map((comm, idx) => {
                const currentMyAuthor = (loggedInUserName || "Ralf").toLowerCase().trim();
                const isMyMessage = Boolean(
                  currentMyAuthor && (comm.autor || "").toLowerCase().trim() === currentMyAuthor
                );

                return (
                  <div
                    key={idx}
                    className={`rounded-xl p-3 shadow-sm transition-all flex flex-col gap-1.5 ${
                      isMyMessage
                        ? "bg-cyan-950/40 border border-cyan-500/40 ml-4 hover:border-cyan-400/60"
                        : "bg-card/90 border border-border/80 mr-4 hover:border-cyan-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-bold flex items-center gap-1.5 ${
                          isMyMessage ? "text-cyan-300" : "text-sky-400"
                        }`}
                      >
                        <User className="h-3.5 w-3.5" />
                        {comm.autor || "Anônimo"} {isMyMessage && <span className="text-[10px] opacity-75 font-normal">(Você)</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {comm.data || "—"}
                      </span>
                    </div>
                    <p
                      className={`text-foreground text-xs leading-relaxed whitespace-pre-wrap pl-3.5 border-l-2 ${
                        isMyMessage ? "border-cyan-400/70" : "border-muted-foreground/30"
                      }`}
                    >
                      {comm.texto}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Formulário para Enviar Novo Comentário Instantâneo */}
          <form
            onSubmit={handleAddComment}
            className="p-3.5 bg-muted/30 border-t border-border/80 flex items-center gap-2 shrink-0"
          >
            <div
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs font-bold shrink-0 select-none shadow-sm"
              title={`Usuário logado: ${loggedInUserName}`}
            >
              <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[120px]">{loggedInUserName}</span>
            </div>

            <div className="relative flex-1">
              <Input
                ref={commentInputRef}
                type="text"
                placeholder="Digite sua mensagem e pressione Enter..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(e);
                  }
                }}
                className="h-9 text-xs bg-card border-border pr-2"
                disabled={isSendingComment}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={!newCommentText.trim() || isSendingComment}
              className="h-9 px-4 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1.5 shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSendingComment ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Enviar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dedicado de Confirmação e Lançamento de Movimento no ERP */}
      <Dialog
        open={launchModalOpen}
        onOpenChange={(isOpen) => !isOpen && !isSubmittingLaunch && setLaunchModalOpen(false)}
      >
        <DialogContent className="bg-[#0f131a] border-emerald-500/40 text-foreground sm:max-w-3xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col shadow-2xl z-[130]">
          {/* Header */}
          <DialogHeader className="p-5 bg-gradient-to-r from-emerald-950/80 via-teal-950/40 to-transparent border-b border-border/80 shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-md">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    Lançar Movimento de Estoque no ERP (RM)
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40">
                      Lote {launchingLoteItem?.id}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Geração de documento oficial e baixa de chapas no banco DB2 do ERP (bartznew)
                  </DialogDescription>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
                <span>Doc Previsto:</span>
                <span className="text-white font-extrabold">
                  {isLoadingPreview ? (
                    <RefreshCw className="h-3 w-3 animate-spin inline ml-1" />
                  ) : launchPreview?.nextDocument ? (
                    `#${launchPreview.nextDocument}`
                  ) : (
                    "Automático"
                  )}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Aviso se já lançado anteriormente */}
            {launchingLoteItem?.lancado_erp && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-bold block mb-0.5">
                    Atenção: Este lote já possui lançamento registrado no ERP!
                  </strong>
                  <span>
                    Documento anterior: <strong>#{launchingLoteItem.lancado_erp.documento}</strong> lançado em{" "}
                    <strong>{launchingLoteItem.lancado_erp.data}</strong> por{" "}
                    <strong>{launchingLoteItem.lancado_erp.usuario}</strong>. Confirmar este formulário gerará um novo
                    documento de baixa de estoque.
                  </span>
                </div>
              </div>
            )}

            {/* Metadados do ERP */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-muted/20 border border-border/80 rounded-xl text-xs">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase">Tipo Transação</span>
                <div className="font-mono font-bold text-foreground flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-extrabold">RM</span>
                  <span className="text-[11px] text-muted-foreground truncate">Requis. Materiais</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase">Depósito</span>
                <div className="font-mono font-bold text-foreground">
                  1 <span className="text-[11px] text-muted-foreground font-normal">(Almoxarifado)</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase">Centro de Custo</span>
                <div className="font-mono font-bold text-foreground">
                  1 <span className="text-[11px] text-muted-foreground font-normal">(Geral)</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase">Data do Movimento</span>
                <div className="font-mono font-bold text-emerald-400">
                  {launchPreview?.dataMoviment || new Date().toLocaleDateString("pt-BR")}
                </div>
              </div>
            </div>

            {/* Tabela de Chapas a Lançar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-emerald-400" />
                  Chapas para Baixa no Estoque ({launchItems.length})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Revise as quantidades e desmarque as que não devem ser movimentadas
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-card/80 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={launchItems.length > 0 && launchItems.every((it) => it.selected)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setLaunchItems((prev) => prev.map((it) => ({ ...it, selected: checked })));
                          }}
                          className="rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-32">Código</th>
                      <th className="py-2.5 px-3">Descrição do Material</th>
                      <th className="py-2.5 px-3 w-20 text-right">Metros</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qtd PDF</th>
                      <th className="py-2.5 px-3 w-36 text-center text-emerald-300">Qtd a Baixar (Chapas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {launchItems.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          item.selected ? "bg-emerald-950/15 hover:bg-emerald-950/25" : "opacity-50 hover:opacity-75"
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleLaunchItem(idx)}
                            className="rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
                          {item.codigo}
                        </td>
                        <td className="py-2 px-3 text-foreground font-medium">
                          {item.descricao}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {item.metros || "—"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                          {item.quantidade || "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={item.finalQty}
                              disabled={!item.selected || isSubmittingLaunch}
                              onChange={(e) => handleLaunchQtyChange(idx, e.target.value)}
                              className="h-7 w-28 text-xs font-mono font-bold text-center bg-card border-emerald-500/40 text-emerald-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sumário de Totais */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                Total de itens selecionados:{" "}
                <strong className="text-foreground">
                  {launchItems.filter((it) => it.selected && parseFloat(it.finalQty.replace(",", ".")) > 0).length}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total de chapas para baixa:</span>
                <span className="text-base font-extrabold font-mono text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                  {launchItems
                    .filter((it) => it.selected)
                    .reduce((acc, it) => acc + (parseFloat(it.finalQty.replace(",", ".")) || 0), 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingLaunch}
              onClick={() => setLaunchModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>

            <Button
              size="sm"
              disabled={
                isSubmittingLaunch ||
                launchItems.filter((it) => it.selected && parseFloat(it.finalQty.replace(",", ".")) > 0).length === 0
              }
              onClick={handleConfirmLaunch}
              className="h-9 px-5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold gap-2 shadow-lg cursor-pointer border border-emerald-400/30 disabled:opacity-50"
            >
              {isSubmittingLaunch ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Gravando no ERP DB2...</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 text-emerald-100" />
                  <span>Confirmar e Lançar no ERP</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-200" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
