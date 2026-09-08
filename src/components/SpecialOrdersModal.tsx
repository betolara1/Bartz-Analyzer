import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Search,
  MessageSquare,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Layers,
  Paperclip,
  Download,
} from "lucide-react";

export interface SpecialOrderComment {
  pk_pedido_comentario: number;
  pk_pedido: number;
  txt_titulo?: string;
  txt_comentario?: string;
  int_situacao?: number;
  dat_data?: string;
  nome_usuario?: string;
  txt_arquivo?: string;
}

export interface SpecialOrder {
  pk_pedido_engenharia: number;
  pk_pedido: number;
  num_pedido?: string | number;
  txt_cliente?: string;
  status_engenharia?: string;
  bit_lido?: number;
  dat_envio?: string;
  situacao_pedido?: string;
  nome_usuario?: string;
  ok_analisador?: number | boolean;
  ok_analisador_usuario_id?: number | null;
  ok_analisador_usuario_nome?: string | null;
  ok_analisador_data?: string | null;
  comentarios: SpecialOrderComment[];
}

interface SpecialOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: any;
  specialOrders?: SpecialOrder[];
  onRefresh?: () => void;
}

function cleanCommentText(text?: string): string {
  if (!text) return "";
  // Remove block standard HTML tags like divs with style alterado
  let cleaned = text.replace(/<div[^>]*style=['"][^'"]*border-top:[^'"]*['"][^>]*>[\s\S]*?\[Alterado para[\s\S]*?<\/div>/gi, "");
  cleaned = cleaned.replace(/\[Alterado para[^\]]*\]/gi, "");
  // Replace <br> with newlines for cleaner rendering
  return cleaned.trim();
}

export const SpecialOrdersModal: React.FC<SpecialOrdersModalProps> = ({
  open,
  onOpenChange,
  currentUser,
  specialOrders,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadingOrderXmlId, setDownloadingOrderXmlId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [markingOkId, setMarkingOkId] = useState<number | null>(null);
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState<SpecialOrder | null>(null);
  const [orders, setOrders] = useState<SpecialOrder[]>(specialOrders || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("em_aberto");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const [xmlExistenceMap, setXmlExistenceMap] = useState<Record<string, boolean>>({});
  const [isCheckingXml, setIsCheckingXml] = useState(false);

  // Permissões do Usuário
  const userPerms = useMemo(() => {
    if (!currentUser) return [];
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p)));
  }, [currentUser]);

  // Permissão 37 - Analisador
  const isPerm37 = useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 37) return true;
    return userPerms.includes(37);
  }, [userPerms, currentUser]);

  // Permissão 38 - Engenharia (Conclusão)
  const isPerm38 = useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 38) return true;
    return userPerms.includes(38);
  }, [userPerms, currentUser]);

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const toggleCommentExpand = (commentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const checkXmlExistence = useCallback(async (ordersList?: SpecialOrder[]) => {
    const list = ordersList || ordersRef.current;
    if (!list || list.length === 0) return;

    const orderNumbers = Array.from(
      new Set(
        list
          .map((o) => String(o.num_pedido || o.pk_pedido || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (orderNumbers.length === 0) return;

    setIsCheckingXml(true);
    try {
      if (window.electron?.analyzer?.checkOrdersXmlExistence) {
        const res = await window.electron.analyzer.checkOrdersXmlExistence(orderNumbers);
        if (res?.ok && res.existsMap) {
          setXmlExistenceMap((prev) => ({ ...prev, ...res.existsMap }));
        }
      } else {
        // Fallback usando busca individual
        const newMap: Record<string, boolean> = {};
        await Promise.all(
          orderNumbers.map(async (num) => {
            try {
              const res = await window.electron?.analyzer?.searchXmlFiles?.(num);
              newMap[num] = !!(res?.ok && Array.isArray(res.results) && res.results.length > 0);
            } catch {
              newMap[num] = false;
            }
          })
        );
        setXmlExistenceMap((prev) => ({ ...prev, ...newMap }));
      }
    } catch (err) {
      console.error("[SpecialOrdersModal] Erro ao verificar existência de XMLs na pasta:", err);
    } finally {
      setIsCheckingXml(false);
    }
  }, []);

  // Sync with specialOrders prop passed from Dashboard background monitor
  useEffect(() => {
    if (specialOrders) {
      setOrders(specialOrders);
      checkXmlExistence(specialOrders);
    }
  }, [specialOrders, checkXmlExistence]);

  // Reset filter to 'em_aberto' ONLY when the modal transitions from closed to open
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setStatusFilter("em_aberto");
      setCurrentPage(1);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Periodic XML check while modal is open
  useEffect(() => {
    if (!open) return;
    checkXmlExistence();
    const xmlInterval = setInterval(() => {
      checkXmlExistence();
    }, 30000);
    return () => clearInterval(xmlInterval);
  }, [open, checkXmlExistence]);

  const handleDownloadOrderXml = async (order: SpecialOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const numPedido = String(order.num_pedido || order.pk_pedido || "").trim();
    if (!numPedido) {
      toast.error("Número do pedido inválido.");
      return;
    }

    setDownloadingOrderXmlId(order.pk_pedido_engenharia);
    const toastId = toast.loading(`Buscando XML do Pedido #${numPedido} na pasta de busca...`);

    try {
      const searchRes = await window.electron?.analyzer?.searchXmlFiles?.(numPedido);
      if (!searchRes?.ok) {
        toast.error(`Falha ao pesquisar XML do Pedido #${numPedido}: ${searchRes?.message || "Erro desconhecido"}`);
        return;
      }

      const results = searchRes.results || [];
      if (results.length === 0) {
        toast.error(`Nenhum arquivo XML encontrado para o Pedido #${numPedido} na Pasta de Busca XML.`);
        setXmlExistenceMap((prev) => ({ ...prev, [numPedido.toLowerCase()]: false }));
        return;
      }

      let copiedCount = 0;
      for (const file of results) {
        const copyRes = await window.electron?.analyzer?.copyXmlToEntrada?.(file.fullPath);
        if (copyRes?.ok) {
          copiedCount++;
        }
      }

      if (copiedCount > 0) {
        toast.success(`XML do Pedido #${numPedido} copiado e importado com sucesso! (${copiedCount} arquivo(s))`);
        checkXmlExistence();
      } else {
        toast.error(`Não foi possível copiar o XML do Pedido #${numPedido} para a pasta de entrada.`);
      }
    } catch (err: any) {
      console.error("[SpecialOrdersModal] Erro ao baixar XML do pedido:", err);
      toast.error("Erro ao importar XML do pedido.", { description: String(err?.message || err) });
    } finally {
      setDownloadingOrderXmlId(null);
      toast.dismiss(toastId);
    }
  };

  const handleDownloadFile = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await window.electron?.analyzer?.downloadCommentFile?.(filename);
      if (res?.ok && res.destPath) {
        toast.success("Arquivo baixado com sucesso!", {
          description: `Salvo em: ${res.destPath}`,
          action: {
            label: "Abrir Arquivo",
            onClick: () => window.electron?.analyzer?.openFile?.(res.destPath!),
          },
        });
      } else if (res?.message && !res.message.toLowerCase().includes("cancelado")) {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error("[SpecialOrdersModal] Erro no download:", err);
      toast.error("Falha ao baixar o arquivo.");
    } finally {
      setDownloadingFile(null);
    }
  };

  const promptCompleteOrder = (order: SpecialOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmCompleteOrder(order);
  };

  const executeCompleteOrder = async (order: SpecialOrder) => {
    setCompletingId(order.pk_pedido_engenharia);
    try {
      const userId = currentUser?.pk_usuario;
      const res = await window.electron?.analyzer?.completeEngineeringOrder?.({
        pk_pedido_engenharia: order.pk_pedido_engenharia,
        pk_usuario_alteracao: userId,
      });

      if (res?.ok) {
        toast.success(`Pedido #${order.num_pedido || order.pk_pedido} marcado como Concluído!`);
        fetchSpecialOrders(false);
        onRefresh?.();
      } else {
        toast.error(res?.message || "Erro ao concluir pedido.");
      }
    } catch (err: any) {
      console.error("[SpecialOrdersModal] Erro ao concluir pedido:", err);
      toast.error("Erro de comunicação ao concluir pedido.");
    } finally {
      setCompletingId(null);
    }
  };

  const executeMarkOrderOk = async (order: SpecialOrder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMarkingOkId(order.pk_pedido_engenharia);
    try {
      const userId = currentUser?.pk_usuario || currentUser?.id;
      const userName = currentUser?.txt_nome || currentUser?.nome || currentUser?.txt_login || "Analisador";
      const res = await window.electron?.analyzer?.markSpecialOrderOk?.({
        pk_pedido_engenharia: order.pk_pedido_engenharia,
        pk_pedido: order.pk_pedido,
        pk_usuario: userId,
        nome_usuario: userName,
      });

      if (res?.ok) {
        const orderNum = order.num_pedido || order.pk_pedido;
        toast.success(`Pedido #${orderNum}: Parte finalizada com sucesso!`, {
          description: "Tudo certo! Notificação enviada para a Engenharia (Permissão 38). Você pode seguir em frente.",
          duration: 7000,
        });
        fetchSpecialOrders(false);
        onRefresh?.();
      } else {
        toast.error(res?.message || "Erro ao marcar pedido como OK.");
      }
    } catch (err: any) {
      console.error("[SpecialOrdersModal] Erro ao marcar OK:", err);
      toast.error("Erro de comunicação ao marcar OK.");
    } finally {
      setMarkingOkId(null);
    }
  };

  const fetchSpecialOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        const res = await window.electron?.analyzer?.getSpecialOrders?.();
        if (res?.ok && Array.isArray(res.data)) {
          const list = res.data as SpecialOrder[];
          setOrders(list);
          checkXmlExistence(list);
          if (!isBackground) {
            setExpandedOrders({});
          }
        } else if (!isBackground) {
          toast.error(res?.message || "Não foi possível carregar os pedidos especiais.");
          setOrders([]);
        }
      }
    } catch (err: any) {
      if (!isBackground) {
        console.error("[SpecialOrdersModal] Erro ao buscar pedidos:", err);
        toast.error("Erro de comunicação ao buscar pedidos especiais.");
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (open) {
      fetchSpecialOrders(false);
      const interval = setInterval(() => {
        fetchSpecialOrders(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [open, fetchSpecialOrders]);

  const toggleExpand = (id: number) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

function filterValidComments(comments: SpecialOrderComment[] = []): SpecialOrderComment[] {
  return comments.filter((c) => {
    const sit = c.int_situacao !== null && c.int_situacao !== undefined ? Number(c.int_situacao) : 0;
    const isSituacaoOk = sit === 0 || sit === 1;
    const title = String(c.txt_titulo || "").toLowerCase();
    const text = String(c.txt_comentario || "").toLowerCase();
    const isDesconsiderado = title.includes("desconsiderad") || text.includes("desconsiderad");
    return isSituacaoOk && !isDesconsiderado;
  });
}

  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      // Filter by status
      if (statusFilter !== "todos") {
        const currentStatus = (order.status_engenharia || "").toLowerCase();
        if (statusFilter === "em_aberto" && !currentStatus.includes("aberto")) {
          return false;
        }
        if (statusFilter === "concluido" && !currentStatus.includes("conclui")) {
          return false;
        }
      }

      if (!term) return true;

      // Filter by term
      const numPedStr = String(order.num_pedido || order.pk_pedido || "").toLowerCase();
      const clienteStr = String(order.txt_cliente || "").toLowerCase();
      const statusEngStr = String(order.status_engenharia || "").toLowerCase();
      const usuarioStr = String(order.nome_usuario || "").toLowerCase();
      const situacaoStr = String(order.situacao_pedido || "").toLowerCase();

      if (
        numPedStr.includes(term) ||
        clienteStr.includes(term) ||
        statusEngStr.includes(term) ||
        usuarioStr.includes(term) ||
        situacaoStr.includes(term)
      ) {
        return true;
      }

      // Check valid comments only
      const validComments = filterValidComments(order.comentarios);
      return validComments.some((c) => {
        const titleStr = String(c.txt_titulo || "").toLowerCase();
        const commentStr = String(c.txt_comentario || "").toLowerCase();
        const authorStr = String(c.nome_usuario || "").toLowerCase();
        return titleStr.includes(term) || commentStr.includes(term) || authorStr.includes(term);
      });
    });
  }, [orders, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", total];
    }
    if (current >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, "...", current - 1, current, current + 1, "...", total];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="special-orders-description"
        className="bg-card border-border sm:max-w-6xl w-[92vw] max-w-[92vw] max-h-[90vh] p-0 overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-purple-900/40 via-purple-600/10 to-transparent p-5 pr-14 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Pedidos Especiais (Engenharia)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
                </span>
              </DialogTitle>
              <DialogDescription id="special-orders-description" className="text-xs text-muted-foreground">
                Pedidos registrados na Engenharia do Pedidos Online com todos os comentários vinculados
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSpecialOrders(false)}
              disabled={loading || isSyncing}
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading || isSyncing ? "animate-spin text-purple-400" : ""}`} />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 md:flex-none md:w-80 group">
            <Input
              type="text"
              placeholder="Buscar por pedido, comentário, usuário..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onClear={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
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
                onClick={() => {
                  setStatusFilter("em_aberto");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === "em_aberto"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Em Aberto (
                {orders.filter((o) => (o.status_engenharia || "").toLowerCase().includes("aberto")).length})
              </button>
              <button
                onClick={() => {
                  setStatusFilter("concluido");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === "concluido"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Concluídos (
                {orders.filter((o) => (o.status_engenharia || "").toLowerCase().includes("conclui")).length})
              </button>
              <button
                onClick={() => {
                  setStatusFilter("todos");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === "todos"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({orders.length})
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">
                Consultando Pedidos Online no banco de dados...
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
              <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Nenhum pedido especial encontrado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {searchTerm || statusFilter !== "todos"
                  ? "Tente ajustar os termos de busca ou filtros selecionados."
                  : "Nenhum pedido cadastrado na tabela tab_pedido_engenharia."}
              </p>
            </div>
          ) : (
            paginatedOrders.map((order) => {
              const isExpanded = !!expandedOrders[order.pk_pedido_engenharia];
              const isAberto = (order.status_engenharia || "").toLowerCase().includes("aberto");

              return (
                <div
                  key={order.pk_pedido_engenharia}
                  className="rounded-xl border border-border bg-card/60 hover:border-purple-500/40 transition-all duration-200 overflow-hidden shadow-sm"
                >
                  {/* Order Header Card */}
                  <div
                    onClick={() => toggleExpand(order.pk_pedido_engenharia)}
                    className="p-4 bg-muted/40 hover:bg-muted/70 cursor-pointer flex items-center justify-between gap-4 border-b border-border/50"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-300 font-bold text-sm flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-purple-400" />
                        Pedido #{order.num_pedido || order.pk_pedido}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold border flex items-center gap-1 ${isAberto
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                      >
                        {isAberto ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {order.status_engenharia || "Pendente"}
                      </span>

                      {/* Order Situation */}
                      {order.situacao_pedido && (
                        <span className="text-xs px-2.5 py-1 rounded-md font-medium bg-muted text-muted-foreground border border-border">
                          {order.situacao_pedido}
                        </span>
                      )}

                      {/* Customer Name */}
                      {order.txt_cliente && (
                        <span className="text-xs font-semibold text-foreground">
                          {order.txt_cliente}
                        </span>
                      )}

                      {/* Analisador OK Badge */}
                      {Boolean(order.ok_analisador) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              Parte do Analisador OK
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs bg-popover text-popover-foreground border border-border shadow-md">
                            {order.ok_analisador_usuario_nome
                              ? `Liberado por ${order.ok_analisador_usuario_nome}${order.ok_analisador_data ? ` em ${order.ok_analisador_data}` : ""}.`
                              : "Parte do Analisador finalizada com sucesso."}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                        {order.dat_envio && (
                          <div className="flex items-center gap-1" title="Data de Envio/Modificação">
                            <Calendar className="h-3.5 w-3.5 text-purple-400" />
                            {order.dat_envio}
                          </div>
                        )}

                        {order.nome_usuario && (
                          <div className="flex items-center gap-1" title="Usuário Engenharia">
                            <User className="h-3.5 w-3.5 text-purple-400" />
                            {order.nome_usuario}
                          </div>
                        )}
                      </div>

                      {/* Botão Baixar pedido */}
                      {(() => {
                        const numKey = String(order.num_pedido || order.pk_pedido || "").trim().toLowerCase();
                        const hasXml = !!xmlExistenceMap[numKey];
                        const isDownloading = downloadingOrderXmlId === order.pk_pedido_engenharia;

                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                <Button
                                  size="sm"
                                  onClick={(e) => handleDownloadOrderXml(order, e)}
                                  disabled={!hasXml || isDownloading}
                                  variant="outline"
                                  className={`h-8 px-3 text-xs font-bold gap-1.5 shadow-md transition-all shrink-0 ${
                                    hasXml
                                      ? "border-purple-500/40 hover:bg-purple-500/20 text-purple-300 cursor-pointer active:scale-95"
                                      : "border-border/60 bg-muted/20 text-muted-foreground/40 opacity-50 cursor-not-allowed pointer-events-none"
                                  }`}
                                  title={
                                    hasXml
                                      ? "Buscar e importar XML do pedido na pasta de entrada"
                                      : "Arquivo XML não encontrado na pasta de busca"
                                  }
                                >
                                  {isDownloading ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                                  ) : (
                                    <Download className={`h-3.5 w-3.5 ${hasXml ? "text-purple-400" : "text-muted-foreground/40"}`} />
                                  )}
                                  Baixar pedido
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs bg-popover text-popover-foreground border border-border shadow-md">
                              {hasXml
                                ? "XML encontrado na Pasta de Busca. Clique para baixar e copiar para a pasta de entrada."
                                : "Nenhum arquivo XML encontrado na Pasta de Busca para este pedido. Botão desativado."}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Botão Concluir (Permissão 38) ou OK (Permissão 37) */}
                      {isAberto ? (
                        <>
                          {/* Botão Concluir: SOMENTE para Permissão 38 */}
                          {isPerm38 && (
                            <Button
                              size="sm"
                              onClick={(e) => promptCompleteOrder(order, e)}
                              disabled={completingId === order.pk_pedido_engenharia}
                              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 gap-1.5 shadow-md transition-all shrink-0 cursor-pointer active:scale-95"
                              title="Marcar pedido de engenharia como Concluído"
                            >
                              {completingId === order.pk_pedido_engenharia ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Concluir
                            </Button>
                          )}

                          {/* Permissão 37: Botão OK (se ainda não liberado) ou Badge Parte OK */}
                          {isPerm37 && !isPerm38 && (
                            !order.ok_analisador ? (
                              <Button
                                size="sm"
                                onClick={(e) => executeMarkOrderOk(order, e)}
                                disabled={markingOkId === order.pk_pedido_engenharia}
                                className="h-8 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 gap-1.5 shadow-md transition-all shrink-0 cursor-pointer active:scale-95"
                                title="Confirmar que a sua parte foi finalizada e notificar a Engenharia (Permissão 38)"
                              >
                                {markingOkId === order.pk_pedido_engenharia ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                OK
                              </Button>
                            ) : (
                              <span
                                className="text-xs px-2.5 py-1 rounded-md font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm shrink-0"
                                title="Sua parte foi finalizada com sucesso! Notificação enviada para a Engenharia (Permissão 38)."
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Parte OK
                              </span>
                            )
                          )}

                          {/* Se for usuário com ambas as permissões (37 e 38) e ainda não deu OK */}
                          {isPerm37 && isPerm38 && !order.ok_analisador && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => executeMarkOrderOk(order, e)}
                              disabled={markingOkId === order.pk_pedido_engenharia}
                              className="h-8 px-3 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 font-bold gap-1 shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
                              title="Marcar parte do Analisador como OK"
                            >
                              {markingOkId === order.pk_pedido_engenharia ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              )}
                              OK
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Concluído
                        </span>
                      )}

                      {(() => {
                        const validComments = filterValidComments(order.comentarios);
                        return (
                          <>
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-300 text-xs font-medium border border-purple-500/20">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {validComments.length}
                            </div>

                            <div className="text-muted-foreground">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Banner Visual Informativo quando a parte do Analisador estiver OK */}
                  {Boolean(order.ok_analisador) && (
                    <div className="mx-4 my-2.5 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/30 to-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200 shadow-sm animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-inner">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-300 flex items-center gap-2">
                            <span>
                              {isPerm37
                                ? "Sua parte está OK — Tudo certo, pode seguir em frente!"
                                : "Parte do Analisador Finalizada!"}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              Liberado
                            </span>
                          </div>
                          <div className="text-emerald-200/80 text-[11px] mt-0.5 leading-snug">
                            {isPerm37
                              ? "A notificação foi enviada para a Engenharia (Permissão 38) para conclusão do pedido."
                              : `O Analisador finalizou a verificação deste pedido${order.ok_analisador_usuario_nome ? ` (${order.ok_analisador_usuario_nome})` : ""}. Pronto para conclusão da Engenharia.`}
                            {order.ok_analisador_data && ` Registrado em ${order.ok_analisador_data}.`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Details & Comments Section */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 bg-card">
                      {/* Secondary info for mobile */}
                      <div className="flex md:hidden items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                        {order.dat_envio && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-purple-400" />
                            {order.dat_envio}
                          </div>
                        )}
                        {order.nome_usuario && (
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-purple-400" />
                            {order.nome_usuario}
                          </div>
                        )}
                      </div>

                      {/* Comments List */}
                      {(() => {
                        const validComments = filterValidComments(order.comentarios);
                        return (
                          <div className="space-y-2.5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                              Comentários do Pedido ({validComments.length})
                            </div>

                            {validComments.length === 0 ? (
                              <div className="p-3 rounded-lg bg-muted/20 border border-dashed border-border text-xs italic text-muted-foreground">
                                Nenhum comentário registrado para este pedido.
                              </div>
                            ) : (
                              validComments.map((comment) => {
                                const isCommentExpanded = !!expandedComments[comment.pk_pedido_comentario];
                                const cleanedText = cleanCommentText(comment.txt_comentario);
                                const lines = cleanedText.split(/<br\s*\/?>|\n/gi);

                                return (
                                  <div
                                    key={comment.pk_pedido_comentario}
                                    className="rounded-lg bg-muted/40 border border-border/80 overflow-hidden hover:border-purple-500/30 transition-colors"
                                  >
                                    <div
                                      onClick={(e) => toggleCommentExpand(comment.pk_pedido_comentario, e)}
                                      className="p-3 cursor-pointer flex items-center justify-between gap-3 bg-muted/30 hover:bg-muted/60 transition-colors select-none"
                                    >
                                      <div className="font-bold text-purple-300 text-xs flex items-center gap-2">
                                        {comment.txt_titulo || "Comentário de Fábrica"}
                                      </div>

                                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                        {comment.nome_usuario && (
                                          <span className="flex items-center gap-1">
                                            <User className="h-3 w-3 text-purple-400" />
                                            {comment.nome_usuario}
                                          </span>
                                        )}
                                        {comment.dat_data && (
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-purple-400" />
                                            {comment.dat_data}
                                          </span>
                                        )}
                                        <div className="text-muted-foreground ml-1">
                                          {isCommentExpanded ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-purple-400" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isCommentExpanded && (
                                      <div className="p-3 pt-2 space-y-2 border-t border-border/30 bg-card">
                                        <div className="text-xs text-foreground leading-relaxed whitespace-pre-line font-medium">
                                          {lines.map((line, idx) => (
                                            <React.Fragment key={idx}>
                                              {line}
                                              {idx < lines.length - 1 && <br />}
                                            </React.Fragment>
                                          ))}
                                        </div>

                                        {comment.txt_arquivo && (
                                          <div className="mt-2.5 p-2 px-3 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 overflow-hidden text-xs text-purple-200">
                                              <Paperclip className="h-4 w-4 text-purple-400 shrink-0" />
                                              <span className="truncate font-semibold text-xs" title={comment.txt_arquivo}>
                                                {comment.txt_arquivo}
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadFile(comment.txt_arquivo!);
                                              }}
                                              disabled={downloadingFile === comment.txt_arquivo}
                                              className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white border-0 gap-1.5 shrink-0 font-medium shadow-sm transition-all"
                                            >
                                              {downloadingFile === comment.txt_arquivo ? (
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Download className="h-3 w-3" />
                                              )}
                                              Baixar Anexo
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {filteredOrders.length > 0 ? (
              <span>
                Mostrando <span className="font-semibold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span>–
                <span className="font-semibold text-foreground">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> de{" "}
                <span className="font-semibold text-foreground">{filteredOrders.length}</span> {filteredOrders.length === 1 ? "pedido" : "pedidos"}
              </span>
            ) : (
              <span>0 pedidos</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-xs border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {getPageNumbers(currentPage, totalPages).map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        onClick={() => setCurrentPage(item as number)}
                        className={`h-8 min-w-[32px] px-2 rounded-md text-xs font-semibold transition-colors ${
                          currentPage === item
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-xs border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs shrink-0">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog for Completing Order */}
      <AlertDialog
        open={!!confirmCompleteOrder}
        onOpenChange={(open) => !open && setConfirmCompleteOrder(null)}
      >
        <AlertDialogContent className="bg-card border border-emerald-500/30 max-w-md z-[110]">
          <AlertDialogTitle className="text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Confirmar Conclusão do Pedido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            Deseja realmente marcar o <strong className="text-foreground">Pedido #{confirmCompleteOrder?.num_pedido || confirmCompleteOrder?.pk_pedido}</strong> como <strong className="text-emerald-400 font-bold">Concluído</strong>?
            <br /><br />
            Esta ação atualizará o status e registrará a data/hora de modificação no banco de dados do Pedidos Online.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-none cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCompleteOrder) {
                  executeCompleteOrder(confirmCompleteOrder);
                  setConfirmCompleteOrder(null);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              Sim, Concluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
