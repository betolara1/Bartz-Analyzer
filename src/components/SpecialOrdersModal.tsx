import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState<SpecialOrder | null>(null);
  const [orders, setOrders] = useState<SpecialOrder[]>(specialOrders || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});

  const toggleCommentExpand = (commentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Sync with specialOrders prop passed from Dashboard background monitor
  useEffect(() => {
    if (specialOrders) {
      setOrders(specialOrders);
    }
  }, [specialOrders]);

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
          setOrders(res.data as SpecialOrder[]);
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

      // Check comments
      return order.comentarios.some((c) => {
        const titleStr = String(c.txt_titulo || "").toLowerCase();
        const commentStr = String(c.txt_comentario || "").toLowerCase();
        const authorStr = String(c.nome_usuario || "").toLowerCase();
        return titleStr.includes(term) || commentStr.includes(term) || authorStr.includes(term);
      });
    });
  }, [orders, searchTerm, statusFilter]);

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
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-medium border border-purple-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Auto-Sync (5s)
            </span>

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
                className={`px-3 py-1 rounded-md font-medium transition-colors ${statusFilter === "todos"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Todos ({orders.length})
              </button>
              <button
                onClick={() => setStatusFilter("em_aberto")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${statusFilter === "em_aberto"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Em Aberto (
                {orders.filter((o) => (o.status_engenharia || "").toLowerCase().includes("aberto")).length})
              </button>
              <button
                onClick={() => setStatusFilter("concluido")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${statusFilter === "concluido"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Concluídos (
                {orders.filter((o) => (o.status_engenharia || "").toLowerCase().includes("conclui")).length})
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
            filteredOrders.map((order) => {
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
                      <Button
                        size="sm"
                        onClick={(e) => handleDownloadOrderXml(order, e)}
                        disabled={downloadingOrderXmlId === order.pk_pedido_engenharia}
                        variant="outline"
                        className="h-8 px-3 text-xs border-purple-500/40 hover:bg-purple-500/20 text-purple-300 font-bold gap-1.5 shadow-md transition-all shrink-0 cursor-pointer"
                        title="Buscar e importar XML do pedido na pasta de entrada"
                      >
                        {downloadingOrderXmlId === order.pk_pedido_engenharia ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                        ) : (
                          <Download className="h-3.5 w-3.5 text-purple-400" />
                        )}
                        Baixar pedido
                      </Button>

                      {/* Botão Concluído */}
                      {isAberto ? (
                        <Button
                          size="sm"
                          onClick={(e) => promptCompleteOrder(order, e)}
                          disabled={completingId === order.pk_pedido_engenharia}
                          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 gap-1.5 shadow-md transition-all shrink-0 cursor-pointer"
                          title="Marcar pedido de engenharia como Concluído"
                        >
                          {completingId === order.pk_pedido_engenharia ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Concluir
                        </Button>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Concluído
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-300 text-xs font-medium border border-purple-500/20">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {order.comentarios.length}
                      </div>

                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

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
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                          Comentários do Pedido ({order.comentarios.length})
                        </div>

                        {order.comentarios.length === 0 ? (
                          <div className="p-3 rounded-lg bg-muted/20 border border-dashed border-border text-xs italic text-muted-foreground">
                            Nenhum comentário registrado para este pedido.
                          </div>
                        ) : (
                          order.comentarios.map((comment) => {
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
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
