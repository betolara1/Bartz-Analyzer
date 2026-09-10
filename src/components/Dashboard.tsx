// src/components/Dashboard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { ChipStatus as StatusChip } from "./ChipStatus";
import { BadgeErro as ErrorBadge } from "./BadgeErro";
import { type Status, type Row } from "../types";
import {
  CheckCircle, XCircle, Package, Grid3X3, Zap, Filter,
  Play, Pause, RefreshCw, Calendar, Save,
  AlertTriangle, Eye, FolderOpen, BarChart3, AlertCircle, Download, Check,
  ArrowRightLeft, ListTodo, FileText, CheckCircle2, TrendingUp, Activity, Send,
  CircleHelp, Sliders, Search, FileSearch, Loader2, Copy, Files, User, LogOut, Sparkles,
  ChevronLeft, ChevronRight, ChevronDown, Trash2, Layers, MessageSquare
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import FileDetailDrawer from "./FileDetailDrawer";
import ThemeToggle from "./ThemeToggle";
import { PATH_CONFIGS, type PathConfigKey } from "./ConfigurationScreen";
import { BatchDrawingsModal } from "./BatchDrawingsModal";
import { SpecialOrdersModal } from "./SpecialOrdersModal";
import { PlateSeparationModal } from "./PlateSeparationModal";


// ...
function toRow(p: any): Row | null {
  const full = typeof p?.arquivo === "string" ? p.arquivo.trim() : "";
  if (!full) return null;
  const filename = full.split(/[\\/]/).pop() || "desconhecido.xml";

  const erros: string[] = Array.isArray(p?.erros)
    ? p.erros.map((e: any) => e?.descricao ?? String(e))
    : [];

  const autoFixes: string[] = Array.isArray(p?.autoFixes)
    ? p.autoFixes.map((a: any) => String(a))
    : [];

  const warnings: string[] = Array.isArray(p?.warnings)
    ? p.warnings.map((w: any) => String(w))
    : [];

  let status: Status;
  if (p?.meta?.ferragensOnly) status = "FERRAGENS-ONLY";
  else status = erros.length === 0 ? "OK" : "ERRO";

  const tags: string[] = Array.isArray(p?.tags) ? p.tags : [];

  const manualFixes: string[] = Array.isArray(p?.manualFixes)
    ? p.manualFixes.map((m: any) => String(m))
    : [];

  return {
    filename,
    fullpath: full,
    status,
    errors: erros,
    autoFixes,
    manualFixes,
    warnings,
    tags,
    timestamp: p?.timestamp || new Date().toLocaleString(),
    timestampMs: p?.timestampMs || parseTimestamp(p?.timestamp),
    meta: p?.meta || {},
    initialStatus: status, // Será sobrescrito se já existir no loop do prev
    history: [],
    initialErrors: status === "ERRO" ? erros : [],
  };
}
function formatTag(tag: string) {
  const t = (tag || "").trim().toLowerCase();
  if (t === "ferragens" || t === "ferragens-only") return "FERRAGENS";
  if (t === "muxarabi") return "MUXARABI";
  if (t === "muxarabi_autofix" || t === "muxarabi-autofix") return "MUXARABI_AUTO-FIX";
  if (t === "duplado_autofix" || t === "duplado-autofix" || t === "duplado37mm_autofix") return "DUPLADO_AUTO-FIX";
  if (t === "coringa" || t === "cor coringa") return "COR CORINGA";
  if (t === "qtd-zero" || t === "qtd zero") return "QTD ZERO";
  if (t === "preco-zero" || t === "preço zero") return "PREÇO ZERO";
  if (t === "curvo") return "CURVO";
  if (t === "duplado37mm" || t === "duplado 37mm") return "DUPLADO 37MM";
  if (t === "sem_codigo" || t === "sem codigo") return "SEM CÓDIGO";
  return t.toUpperCase();
}

function filterTags(tags: string[]): string[] {
  if (!tags) return [];
  const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedTags = tags.map(t => norm(t));

  const autofixBases = new Set<string>();
  normalizedTags.forEach(t => {
    if (t.endsWith('_autofix')) {
      autofixBases.add(t.replace(/_autofix$/, ''));
    } else if (t.endsWith('autofix')) {
      autofixBases.add(t.replace(/autofix$/, ''));
    }
  });

  return tags.filter(t => {
    const n = norm(t);
    // Não exibe a tag "curvo" na coluna de TAGS da tabela
    if (n === 'curvo') return false;

    // Assegura que tags específicas de autofix sejam mantidas
    if (n.endsWith('autofix') || n.endsWith('_autofix')) return true;

    // Filtra a tag original/base se a versão autofix estiver presente
    if (autofixBases.has(n)) return false;
    if (n.includes('duplado') && Array.from(autofixBases).some(b => b.includes('duplado'))) {
      return false;
    }
    return true;
  });
}

// helper para “Curvo” (fora do toRow!)
const hasCurvo = (r: Row) =>
  (r.tags || []).includes("curvo") ||
  (r.warnings || []).some(w => /curvo/i.test(String(w)));

const normalizeTagForMatch = (t: string) =>
  (t || "").toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "");

const parseTimestamp = (timestampStr?: string): number => {
  if (!timestampStr) return Date.now();
  const parts = timestampStr.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const [_, day, month, year, hour, minute, second] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (!isNaN(date.getTime())) return date.getTime();
  }
  const dateObj = new Date(timestampStr);
  return isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
};

const getRowISODate = (r: Row): string => {
  if (!r.timestamp) return "";
  const match = r.timestamp.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return "";
};

const getTodayISODate = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getPathIcon = (key: string) => {
  switch (key) {
    case "ok":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "erro":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "drawings":
      return <FileText className="h-3 w-3 text-primary" />;
    default:
      return null;
  }
};

export default function Dashboard({
  onNavigateToConfig,
  currentUser,
  onLogout,
}: {
  onNavigateToConfig?: () => void;
  currentUser?: any;
  onLogout?: () => void;
}) {
  // tabela / filtros
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<"all" | "ok" | "erro" | "muxarabi" | "coringa" | "curvo" | "duplado37mm" | "sem_codigo" | "autofix">("all");
  const [selectedDay, setSelectedDay] = useState<string>(getTodayISODate());
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [reportsAndMetricsOpen, setReportsAndMetricsOpen] = useState(true);

  // Atualiza automaticamente a data selecionada se o dia mudar e o usuário estiver visualizando "Hoje"
  useEffect(() => {
    let lastToday = getTodayISODate();

    const checkDate = () => {
      const currentToday = getTodayISODate();
      if (currentToday !== lastToday) {
        setSelectedDay((prevSelected) => {
          // Se estava na data de hoje anterior, atualiza para o novo hoje
          if (prevSelected === lastToday) {
            return currentToday;
          }
          return prevSelected;
        });
        lastToday = currentToday;
      }
    };

    const interval = setInterval(checkDate, 30000); // verifica a cada 30 segundos
    window.addEventListener("focus", checkDate); // também verifica quando o app volta ao foco

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkDate);
    };
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handlePrevDay = useCallback(() => {
    const baseDate = selectedDay ? new Date(selectedDay + "T00:00:00") : new Date();
    baseDate.setDate(baseDate.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDay(`${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`);
    setCurrentPage(1);
  }, [selectedDay]);

  const handleNextDay = useCallback(() => {
    const baseDate = selectedDay ? new Date(selectedDay + "T00:00:00") : new Date();
    baseDate.setDate(baseDate.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDay(`${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`);
    setCurrentPage(1);
  }, [selectedDay]);

  // controle do watcher
  const [monitoring, setMonitoring] = useState(false);
  const [watchRoot, setWatchRoot] = useState<string | null>(null);

  // caminhos (+ flag do Auto-fix)
  const [cfg, setCfg] = useState({
    entrada: "",
    exportacao: "",
    ok: "",
    erro: "",
    drawings: "",
    drawingsCopy: "",
    drawingsAspan: "",
    simplificado: "",
    busca: "",
    downloadPromob: "",
    enableAutoFix: true,
  });

  // drawer de detalhes
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Row | null>(null);

  // confirmações e modais
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false);
  const [confirmBulkMoveOpen, setConfirmBulkMoveOpen] = useState(false);
  const [specialOrdersOpen, setSpecialOrdersOpen] = useState(false);
  const [plateSeparationOpen, setPlateSeparationOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [confirmOverwriteXml, setConfirmOverwriteXml] = useState<{ sourcePath: string; fileName: string } | null>(null);

  const mounted = useRef(true);
  const isConnected = !!window.electron?.analyzer;

  // persistência do relatório: só salvar depois de restaurar o histórico do disco
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // XML Search State
  const [searchXmlTerm, setSearchXmlTerm] = useState("");
  const [searchXmlResults, setSearchXmlResults] = useState<{ name: string; fullPath: string }[]>([]);
  const [selectedXmlPath, setSelectedXmlPath] = useState("");
  const [copyingXml, setCopyingXml] = useState(false);
  const [searchingXml, setSearchingXml] = useState(false);

  // Special Orders Background Monitor
  const [specialOrders, setSpecialOrders] = useState<any[]>([]);
  const isFirstSpecialOrdersCheck = useRef(true);
  const knownSpecialOrderIds = useRef<Set<number>>(new Set());
  const knownSpecialCommentIds = useRef<Set<number>>(new Set());
  const knownSpecialOrderOkIds = useRef<Set<number>>(new Set());

  // Separação de Chapas Background Monitor
  const [plateSeparationItems, setPlateSeparationItems] = useState<any[]>([]);
  const isFirstPlateSeparationCheck = useRef(true);
  const knownPlateSeparationIds = useRef<Set<string>>(new Set());
  const knownPlateCommentIds = useRef<Set<string>>(new Set());
  const [unreadPlateLotIds, setUnreadPlateLotIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("bartz_unread_plate_lots");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [plateLotToOpenChat, setPlateLotToOpenChat] = useState<string | null>(null);

  // Permissão 36 - Botão Especiais
  const hasSpecialOrdersPermission = useMemo(() => {
    if (!currentUser) return false;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).includes(36);
  }, [currentUser]);

  // Permissão 39 - Separação Chapas
  const hasPlateSeparationPermission = useMemo(() => {
    if (!currentUser) return false;
    const userId = Number(currentUser.pk_usuario ?? currentUser.id ?? 0);
    if (userId === 39) return true;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).includes(39);
  }, [currentUser]);

  // Permissão ou ID 37 / 38 - Admin Analisador
  const hasAdminPermission = useMemo(() => {
    if (!currentUser) return false;
    const userId = Number(currentUser.pk_usuario ?? currentUser.id ?? 0);
    if (userId === 37 || userId === 38) return true;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).some((id: number) => id === 37 || id === 38);
  }, [currentUser]);

  // Permissão 38 - Engenharia (Notificações de conclusão)
  const isPerm38 = useMemo(() => {
    if (!currentUser) return false;
    const userId = Number(currentUser.pk_usuario ?? currentUser.id ?? 0);
    if (userId === 38) return true;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).includes(38);
  }, [currentUser]);

function createCanvasBadgeDataUrl(count: number): string | null {
  if (!count || count <= 0) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, 2 * Math.PI);
    ctx.fillStyle = "#9333ea";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = count > 99 ? "99+" : String(count);
    ctx.fillText(text, 16, 17);

    return canvas.toDataURL("image/png");
  } catch (err) {
    return null;
  }
}

  const checkSpecialOrdersUpdates = useCallback(async () => {
    if (!hasSpecialOrdersPermission) return;

    try {
      const res = await window.electron?.analyzer?.getSpecialOrders?.();
      if (res?.ok && Array.isArray(res.data)) {
        const fetchedOrders = res.data as any[];
        setSpecialOrders(fetchedOrders);

        const openCount = fetchedOrders.filter((o) =>
          String(o.status_engenharia || "").toLowerCase().includes("aberto")
        ).length;

        // Sync Windows Taskbar Badge Overlay Icon with PNG dataUrl from Canvas
        const dataUrl = createCanvasBadgeDataUrl(openCount);
        window.electron?.analyzer?.setTaskbarBadge?.({ count: openCount, dataUrl });

        if (isFirstSpecialOrdersCheck.current) {
          const orderIds = new Set<number>();
          const commentIds = new Set<number>();
          const okOrderIds = new Set<number>();

          fetchedOrders.forEach((o) => {
            orderIds.add(o.pk_pedido_engenharia);
            (o.comentarios || []).forEach((c: any) => commentIds.add(c.pk_pedido_comentario));
            if (o.ok_analisador) {
              okOrderIds.add(o.pk_pedido_engenharia);
            }
          });

          knownSpecialOrderIds.current = orderIds;
          knownSpecialCommentIds.current = commentIds;
          knownSpecialOrderOkIds.current = okOrderIds;
          isFirstSpecialOrdersCheck.current = false;
        } else {
          // Detect orders marked OK by Analisador (Notificando Permissão 38)
          if (isPerm38) {
            fetchedOrders.forEach((order) => {
              if (order.ok_analisador && !knownSpecialOrderOkIds.current.has(order.pk_pedido_engenharia)) {
                knownSpecialOrderOkIds.current.add(order.pk_pedido_engenharia);

                const orderNum = order.num_pedido || order.pk_pedido;
                const analistaName = order.ok_analisador_usuario_nome || "Analisador (Permissão 37)";
                const notifTitle = `✅ Pedido #${orderNum}: Analisador OK!`;
                const notifBody = `${analistaName} finalizou a parte dele. O pedido está liberado para você concluir.`;

                // Send Windows Native Notification + Flash Taskbar
                window.electron?.analyzer?.sendNotification?.({
                  title: notifTitle,
                  body: notifBody,
                  count: openCount,
                });

                toast.success(notifTitle, {
                  description: notifBody,
                  duration: 12000,
                  action: {
                    label: "Ver Pedido",
                    onClick: () => setSpecialOrdersOpen(true),
                  },
                });
              }
            });
          }

          fetchedOrders.forEach((order) => {
            // Detect new special order
            if (!knownSpecialOrderIds.current.has(order.pk_pedido_engenharia)) {
              knownSpecialOrderIds.current.add(order.pk_pedido_engenharia);

              const notifTitle = `🔔 Novo Pedido Especial recebido!`;
              const notifBody = `Pedido #${order.num_pedido || order.pk_pedido} (${order.situacao_pedido || "Engenharia"})`;

              // Send Windows Native Notification + Flash Taskbar
              window.electron?.analyzer?.sendNotification?.({
                title: notifTitle,
                body: notifBody,
                count: openCount,
              });

              toast.info(notifTitle, {
                description: notifBody,
                duration: 10000,
                action: {
                  label: "Visualizar",
                  onClick: () => setSpecialOrdersOpen(true),
                },
              });
            }

            // Detect new comment on special order
            (order.comentarios || []).forEach((comment: any) => {
              if (!knownSpecialCommentIds.current.has(comment.pk_pedido_comentario)) {
                knownSpecialCommentIds.current.add(comment.pk_pedido_comentario);

                const cleanComment = (comment.txt_comentario || "")
                  .replace(/<div[^>]*style=['"][^'"]*border-top:[^'"]*['"][^>]*>[\s\S]*?\[Alterado para[\s\S]*?<\/div>/gi, "")
                  .replace(/\[Alterado para[^\]]*\]/gi, "")
                  .trim();

                const notifTitle = `💬 Novo comentário no Pedido #${order.num_pedido || order.pk_pedido}`;
                const notifBody = comment.txt_titulo || cleanComment.substring(0, 60) || "Arquivo anexado ou comentário";

                // Send Windows Native Notification + Flash Taskbar
                window.electron?.analyzer?.sendNotification?.({
                  title: notifTitle,
                  body: notifBody,
                  count: openCount,
                });

                toast.info(notifTitle, {
                  description: notifBody,
                  duration: 9000,
                  action: {
                    label: "Ver Pedido",
                    onClick: () => setSpecialOrdersOpen(true),
                  },
                });
              }
            });
          });
        }
      }
    } catch (err) {
      console.error("[SpecialOrders Background Check]", err);
    }
  }, [hasSpecialOrdersPermission, isPerm38]);

  useEffect(() => {
    if (!hasSpecialOrdersPermission) return;
    checkSpecialOrdersUpdates();
    const interval = setInterval(checkSpecialOrdersUpdates, 5000);
    return () => clearInterval(interval);
  }, [hasSpecialOrdersPermission, checkSpecialOrdersUpdates]);

  // Separação de Chapas Update Check & Notifications
  const checkPlateSeparationUpdates = useCallback(async () => {
    if (!hasPlateSeparationPermission) return;

    try {
      const res = await window.electron?.analyzer?.getPlateSeparationData?.();
      if (res?.ok && Array.isArray(res.data)) {
        const fetchedItems = res.data as any[];
        setPlateSeparationItems(fetchedItems);

        const isLotCompletedPendingLaunch = (item: any) => {
          const st = String(item.status || "").toLowerCase();
          const isLancado = st.includes("lançado") || st.includes("lancado") || !!item.lancado_erp;
          return !isLancado && st.includes("concluido");
        };

        const completedCount = fetchedItems.filter(isLotCompletedPendingLaunch).length;

        const myName = (
          currentUser?.txt_nome ||
          currentUser?.txt_login ||
          currentUser?.nome_usuario ||
          currentUser?.name ||
          ""
        ).toLowerCase().trim();

        if (isFirstPlateSeparationCheck.current) {
          const itemIds = new Set<string>();
          const commentIds = new Set<string>();
          fetchedItems.forEach((it) => {
            if (isLotCompletedPendingLaunch(it)) {
              itemIds.add(String(it.id));
            }
            (it.comentarios || []).forEach((c: any) => {
              const cid = String(c.id || `${it.id}_${c.data || ""}_${c.texto || ""}`);
              commentIds.add(cid);
            });
          });
          knownPlateSeparationIds.current = itemIds;
          knownPlateCommentIds.current = commentIds;
          isFirstPlateSeparationCheck.current = false;
        } else {
          // 1. Detectar novos lotes concluídos pendentes de lançamento
          fetchedItems.forEach((item) => {
            const isConcluido = isLotCompletedPendingLaunch(item);
            if (isConcluido && !knownPlateSeparationIds.current.has(String(item.id))) {
              knownPlateSeparationIds.current.add(String(item.id));

              const notifTitle = `✅ Lote de Separação Concluído!`;
              const notifBody = `Lote ${item.id} ${item.loteTitle ? `(${item.loteTitle})` : ""}${item.concluido_por ? ` - ${item.concluido_por}` : ""}`;

              // Send Windows Native Notification + Flash Taskbar
              window.electron?.analyzer?.sendNotification?.({
                title: notifTitle,
                body: notifBody,
                count: completedCount,
              });

              toast.success(notifTitle, {
                description: notifBody,
                duration: 10000,
                action: {
                  label: "Visualizar",
                  onClick: () => setPlateSeparationOpen(true),
                },
              });
            }
          });

          // 2. Detectar novas mensagens/comentários nos lotes da Separação de Chapas
          fetchedItems.forEach((item) => {
            const isLancado =
              String(item.status || "").toLowerCase().includes("lançado") ||
              String(item.status || "").toLowerCase().includes("lancado") ||
              !!item.lancado_erp;
            const isConcluido = !isLancado && String(item.status || "").toLowerCase().includes("concluido");
            const abaNome = isConcluido ? "Concluídos" : isLancado ? "Lançados" : "Pendentes";

            (item.comentarios || []).forEach((comment: any) => {
              const cid = String(comment.id || `${item.id}_${comment.data || ""}_${comment.texto || ""}`);
              if (!knownPlateCommentIds.current.has(cid)) {
                knownPlateCommentIds.current.add(cid);

                const author = String(comment.autor || "").trim();
                const isFromMe = myName && author.toLowerCase() === myName;

                if (!isFromMe) {
                  const itemIdStr = String(item.id);
                  setUnreadPlateLotIds((prev) => {
                    const next = new Set(prev);
                    next.add(itemIdStr);
                    try {
                      localStorage.setItem("bartz_unread_plate_lots", JSON.stringify(Array.from(next)));
                    } catch {}
                    return next;
                  });

                  // Alerta sonoro agradável
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

                  const notifTitle = `💬 Nova Mensagem — Lote ${item.id} [${abaNome}]`;
                  const cleanText = String(comment.texto || "").replace(/\s+/g, " ").trim();
                  const notifBody = `${author ? `${author}: ` : ""}"${cleanText.length > 70 ? cleanText.substring(0, 67) + "..." : cleanText}"`;

                  // Envia notificação nativa do Windows + Flash na Barra de Tarefas
                  window.electron?.analyzer?.sendNotification?.({
                    title: notifTitle,
                    body: notifBody,
                    count: completedCount,
                  });

                  // Balãozinho / Toast no Bartz-Analyzer
                  toast.info(notifTitle, {
                    description: notifBody,
                    duration: 10000,
                    action: {
                      label: "Ver Mensagem",
                      onClick: () => {
                        setPlateLotToOpenChat(itemIdStr);
                        setPlateSeparationOpen(true);
                      },
                    },
                  });
                }
              }
            });
          });
        }
      }
    } catch (err) {
      console.error("[PlateSeparation Background Check]", err);
    }
  }, [hasPlateSeparationPermission, currentUser]);

  const handleMarkPlateLotAsRead = useCallback((lotId: string) => {
    setUnreadPlateLotIds((prev) => {
      if (!prev.has(lotId)) return prev;
      const next = new Set(prev);
      next.delete(lotId);
      try {
        localStorage.setItem("bartz_unread_plate_lots", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hasPlateSeparationPermission) return;
    checkPlateSeparationUpdates();
    const interval = setInterval(checkPlateSeparationUpdates, 5000);
    return () => clearInterval(interval);
  }, [hasPlateSeparationPermission, checkPlateSeparationUpdates]);

  const completedPlatesCount = useMemo(() => {
    return plateSeparationItems.filter((i) => {
      const st = String(i.status || "").toLowerCase();
      const isLancado = st.includes("lançado") || st.includes("lancado") || !!i.lancado_erp;
      return !isLancado && st.includes("concluido");
    }).length;
  }, [plateSeparationItems]);

  const openOrdersCount = useMemo(() => {
    return specialOrders.filter((o) =>
      String(o.status_engenharia || "").toLowerCase().includes("aberto")
    ).length;
  }, [specialOrders]);

  useEffect(() => {
    const trimmed = searchXmlTerm.trim();
    if (!trimmed) {
      setSearchXmlResults([]);
      setSelectedXmlPath("");
      setSearchingXml(false);
      return;
    }

    let active = true;
    setSearchingXml(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await window.electron?.analyzer?.searchXmlFiles?.(trimmed);
        if (!active) return;

        if (res?.ok && res.results) {
          setSearchXmlResults(res.results);
          setSelectedXmlPath("");
        } else {
          setSearchXmlResults([]);
          setSelectedXmlPath("");
          if (res?.message) {
            toast.error(`Erro na busca de XML: ${res.message}`);
          }
        }
      } catch (e: any) {
        if (active) {
          toast.error("Erro ao comunicar com o buscador.", { description: String(e?.message || e) });
        }
      } finally {
        if (active) setSearchingXml(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(delayDebounce);
    };
  }, [searchXmlTerm]);

  const executeImportXml = async (xmlPath: string) => {
    if (!monitoring) {
      await start();
    }

    setCopyingXml(true);
    const id = toast.loading("Copiando arquivo XML para a pasta de entrada...");
    try {
      const res = await window.electron?.analyzer?.copyXmlToEntrada?.(xmlPath);
      if (res?.ok) {
        toast.success("XML copiado e importado com sucesso!");
        setSearchXmlTerm("");
        setSearchXmlResults([]);
        setSelectedXmlPath("");
      } else {
        toast.error(`Falha ao importar XML: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao copiar arquivo.", { description: String(error?.message || error) });
    } finally {
      setCopyingXml(false);
      toast.dismiss(id);
      setConfirmOverwriteXml(null);
    }
  };

  const handleImportXml = async () => {
    if (!selectedXmlPath) return;

    const fileName = selectedXmlPath.split(/[/\\]/).pop() || "";

    // 1. Verificar se já existe na lista em memória (Dashboard rows)
    const existsInRows = rows.some((r) => {
      const rName = r.filename || (r.fullpath ? r.fullpath.split(/[/\\]/).pop() : "");
      return rName?.toLowerCase() === fileName.toLowerCase();
    });

    // 2. Verificar se já existe no disco (pastas entrada, ok, erro ou exportacao)
    let existsOnDisk = false;
    try {
      const checkRes = await window.electron?.analyzer?.checkXmlDownloaded?.(selectedXmlPath, fileName);
      if (checkRes?.exists) {
        existsOnDisk = true;
      }
    } catch (e) {
      console.error("Erro ao verificar existência do XML:", e);
    }

    if (existsInRows || existsOnDisk) {
      setConfirmOverwriteXml({ sourcePath: selectedXmlPath, fileName });
      return;
    }

    // Caso contrário, baixa diretamente sem confirmação
    await executeImportXml(selectedXmlPath);
  };

  // Busca de Desenhos (DXF) na Pasta de Desenhos configurada
  const [searchDrawingTerm, setSearchDrawingTerm] = useState("");
  const [searchDrawingResults, setSearchDrawingResults] = useState<{ name: string; fullPath: string }[]>([]);
  const [selectedDrawingPath, setSelectedDrawingPath] = useState("");
  const [openingDrawing, setOpeningDrawing] = useState(false);
  const [locatingDrawing, setLocatingDrawing] = useState(false);
  const [openingMirrorFolder, setOpeningMirrorFolder] = useState(false);
  const [copyingDrawingToMirror, setCopyingDrawingToMirror] = useState(false);
  const [openingAspanFolder, setOpeningAspanFolder] = useState(false);
  const [searchingDrawings, setSearchingDrawings] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedPedidoInfo, setSelectedPedidoInfo] = useState<{ pedido?: string; pedidoFilename?: string; pedidoSource?: 'historico' | 'erp' | 'busca' } | null>(null);
  const [resolvingPedido, setResolvingPedido] = useState(false);

  useEffect(() => {
    const trimmed = searchDrawingTerm.trim();
    if (!trimmed) {
      setSearchDrawingResults([]);
      setSelectedDrawingPath("");
      setSearchingDrawings(false);
      return;
    }

    let active = true;
    setSearchingDrawings(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await window.electron?.analyzer?.searchDrawingFiles?.(trimmed);
        if (!active) return;

        if (res?.ok && res.results) {
          setSearchDrawingResults(res.results);
          setSelectedDrawingPath("");
        } else {
          setSearchDrawingResults([]);
          setSelectedDrawingPath("");
          if (res?.message) {
            toast.error(`Erro na busca de desenhos: ${res.message}`);
          }
        }
      } catch (e: any) {
        if (active) {
          toast.error("Erro ao comunicar com o buscador.", { description: String(e?.message || e) });
        }
      } finally {
        if (active) setSearchingDrawings(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(delayDebounce);
    };
  }, [searchDrawingTerm]);

  // Só resolve o pedido do desenho que o usuário realmente selecionou no dropdown —
  // não faz sentido consultar o ERP/pasta de busca pra todos os resultados de uma vez
  // (um termo curto pode casar 100+ arquivos e sobrecarregar o DB2 à toa).
  useEffect(() => {
    if (!selectedDrawingPath) {
      setSelectedPedidoInfo(null);
      return;
    }
    const selected = searchDrawingResults.find((r) => r.fullPath === selectedDrawingPath);
    if (!selected) {
      setSelectedPedidoInfo(null);
      return;
    }

    let active = true;
    setSelectedPedidoInfo(null);
    setResolvingPedido(true);

    // Se o histórico local não achar, o backend cai num fallback que varre o conteúdo
    // da Pasta de Busca (pode levar até ~30s no pior caso, numa pasta de rede grande).
    const slowLookupWarning = setTimeout(() => {
      if (active) toast.info("Ainda procurando o pedido... pode levar até 30s quando precisa varrer a pasta de rede.");
    }, 4000);

    (async () => {
      try {
        const res = await window.electron?.analyzer?.resolveDrawingPedido?.(selected.name);
        if (!active) return;
        if (res?.ok) {
          setSelectedPedidoInfo(res.pedido ? { pedido: res.pedido, pedidoFilename: res.pedidoFilename, pedidoSource: res.pedidoSource } : null);
        }
      } catch (e) {
        // busca de pedido é informativa, não bloqueia o uso do desenho — falha silenciosa
      } finally {
        clearTimeout(slowLookupWarning);
        if (active) setResolvingPedido(false);
      }
    })();

    return () => {
      active = false;
      clearTimeout(slowLookupWarning);
    };
  }, [selectedDrawingPath, searchDrawingResults]);

  const handleOpenDrawingFromSearch = async () => {
    if (!selectedDrawingPath) return;
    setOpeningDrawing(true);
    const id = toast.loading("Abrindo desenho...");
    try {
      const res = await window.electron?.analyzer?.openDrawingByPath?.(selectedDrawingPath);
      if (res?.ok) {
        toast.success("Desenho aberto com sucesso!");
      } else {
        toast.error(`Falha ao abrir desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir desenho.", { description: String(error?.message || error) });
    } finally {
      setOpeningDrawing(false);
      toast.dismiss(id);
    }
  };

  const handleShowDrawingInFolder = async () => {
    if (!selectedDrawingPath) return;
    setLocatingDrawing(true);
    try {
      const res = await window.electron?.analyzer?.showDrawingInFolder?.(selectedDrawingPath);
      if (!res?.ok) {
        toast.error(`Não foi possível localizar o arquivo: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir local do arquivo.", { description: String(error?.message || error) });
    } finally {
      setLocatingDrawing(false);
    }
  };

  const handleOpenMirrorFolderFromSearch = async () => {
    if (!selectedDrawingPath && !searchDrawingResults.length) return;
    const item = searchDrawingResults.find(r => r.fullPath === selectedDrawingPath);
    const drawingCode = item?.name ? item.name.replace(/\.dxf$/i, '') : '';
    setOpeningMirrorFolder(true);
    const id = toast.loading(`Buscando pasta NESTING(DXF ALESSANDRO) ${drawingCode}...`);
    try {
      const res = await window.electron?.analyzer?.openMirrorFolder?.(drawingCode);
      if (res?.ok) {
        toast.success("Pasta NESTING(DXF ALESSANDRO) aberta com sucesso!");
      } else {
        toast.error(`Não foi possível abrir a pasta NESTING(DXF ALESSANDRO): ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NESTING(DXF ALESSANDRO).", { description: String(error?.message || error) });
    } finally {
      setOpeningMirrorFolder(false);
      toast.dismiss(id);
    }
  };

  const handleCopyDrawingToMirror = async () => {
    if (!selectedDrawingPath) return;
    setCopyingDrawingToMirror(true);
    const id = toast.loading("Copiando desenho para a pasta espelho...");
    try {
      const res = await window.electron?.analyzer?.copyDrawingToMirror?.(selectedDrawingPath);
      if (res?.ok) {
        toast.success("Desenho copiado para a pasta espelho com sucesso!");
      } else {
        toast.error(`Falha ao copiar desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao copiar desenho.", { description: String(error?.message || error) });
    } finally {
      setCopyingDrawingToMirror(false);
      toast.dismiss(id);
    }
  };

  const handleOpenAspanFolderFromSearch = async () => {
    if (!selectedDrawingPath && !searchDrawingResults.length) return;
    const item = searchDrawingResults.find(r => r.fullPath === selectedDrawingPath);
    const drawingCode = item?.name ? item.name.replace(/\.dxf$/i, '') : '';
    setOpeningAspanFolder(true);
    const id = toast.loading("Abrindo pasta NANXING...");
    try {
      const res = await window.electron?.analyzer?.openAspanFolder?.(drawingCode);
      if (res?.ok) {
        toast.success("Pasta NANXING aberta com sucesso!");
      } else {
        toast.error(`Não foi possível abrir a pasta NANXING: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NANXING.", { description: String(error?.message || error) });
    } finally {
      setOpeningAspanFolder(false);
      toast.dismiss(id);
    }
  };

  function notifyFromPayload(p: any) {
    try {
      const base = (p?.arquivo || "").split(/[\\/]/).pop() || "arquivo";
      const isOK = !(p?.erros || []).length;
      if (isOK) toast.success(`${base} ✓ OK`);
      else toast.warning(`${base} com inconformidades (${(p?.erros || []).length})`);
      if (p?.movedTo) toast.info(`Movido para: ${p.movedTo}`);
    } catch { }
  }

  // listeners + cfg
  useEffect(() => {
    mounted.current = true;

    window.electron?.settings?.load?.()
      .then((sv: any) => {
        if (sv) {
          const merged = {
            entrada: sv.entrada || "",
            exportacao: sv.exportacao || "",
            ok: sv.ok || "",
            erro: sv.erro || "",
            drawings: sv.drawings || "",
            drawingsCopy: sv.drawingsCopy || "",
            drawingsAspan: sv.drawingsAspan || "",
            simplificado: sv.simplificado || "",
            busca: sv.busca || "",
            downloadPromob: sv.downloadPromob || "",
            enableAutoFix: sv.enableAutoFix !== undefined ? sv.enableAutoFix : true,
          };
          setCfg(merged);
          if (merged.entrada && merged.exportacao && merged.ok && merged.erro) {
            window.electron?.analyzer?.start?.(merged).then((ok: boolean) => {
              if (!ok) toast.error("Confira os caminhos e permissões.");
            });
          }
        }
      });

    // Restaurar análises da sessão anterior (persistidas em disco pelo processo principal).
    // Eventos que chegarem antes da restauração têm prioridade (merge por filename).
    const historyPromise = window.electron?.analyzer?.loadHistory?.();
    if (historyPromise && typeof historyPromise.then === "function") {
      historyPromise
        .then((saved: any) => {
          if (!mounted.current) return;
          if (Array.isArray(saved) && saved.length > 0) {
            setRows((prev: Row[]) => {
              const have = new Set(prev.map((r) => r.filename));
              const restored = saved
                .map((r: any) => ({
                  ...r,
                  timestampMs: r.timestampMs || parseTimestamp(r.timestamp),
                }))
                .filter((r: any) => r?.filename && r?.fullpath && !have.has(r.filename));
              return [...prev, ...restored];
            });
            toast.info(`${saved.length} análise(s) restaurada(s) da sessão anterior.`);
          }
        })
        .catch(() => { })
        .finally(() => { hydrated.current = true; });
    } else {
      hydrated.current = true; // preload sem suporte a histórico — segue sem persistência
    }

    window.electron?.analyzer?.onEvent?.((msg: any) => {
      if (!mounted.current) return;
      const { evt, payload } = msg || {};

      if (evt === "started") {
        setMonitoring(true);
        setWatchRoot(payload?.watching ?? null);
        toast.success("Monitoramento iniciado");
        return;
      }
      if (evt === "stopped") {
        setMonitoring(false);
        setWatchRoot(null);
        toast.info("Monitoramento parado");
        return;
      }
      if (evt === "file-validated") {
        const row = toRow(payload);
        if (!row) return;

        setRows((prev: Row[]) => {
          // Tentar achar pelo fullpath primeiro, depois pelo filename (caso tenha movido)
          let i = prev.findIndex((r) => r.fullpath === row.fullpath);
          if (i < 0) {
            i = prev.findIndex((r) => r.filename === row.filename);
          }

          let updatedRow = { ...row };

          if (i >= 0) {
            // Preservar initialStatus, initialErrors e history do registro anterior (mesmo se mudou de pasta)
            updatedRow.initialStatus = prev[i].initialStatus || row.status;
            updatedRow.initialErrors = (prev[i].initialErrors?.length ?? 0) > 0
              ? prev[i].initialErrors
              : updatedRow.initialErrors;
            updatedRow.history = [...(prev[i].history || [])];

            // Se houve autoFixes novos neste processamento, registrar no histórico
            if ((payload?.autoFixes || []).length > 0) {
              const fixStr = `[Robô] Auto-fix: ${payload.autoFixes.join(", ")}`;
              if (!updatedRow.history.includes(fixStr)) {
                updatedRow.history.push(fixStr);
              }
            }

            const copy = prev.slice();
            copy[i] = updatedRow;
            return copy;
          }

          // Novo arquivo detectado
          updatedRow.initialStatus = row.status;
          updatedRow.initialErrors = row.status === "ERRO" ? row.errors : [];
          if ((payload?.autoFixes || []).length > 0) {
            updatedRow.history = [`[Robô] Auto-fix: ${payload.autoFixes.join(", ")}`];
          }

          // When file moves from ERRO to OK, remove the old ERRO entry
          const baseName = row.filename;
          const filtered = prev.filter((r) => {
            const sameFile = r.filename === baseName;
            const isInErroFolder = r.fullpath.toLowerCase().includes('\\erro\\') || r.fullpath.toLowerCase().includes('/erro/');
            if (row.status === 'OK' && sameFile && isInErroFolder) return false;
            return true;
          });
          return [updatedRow, ...filtered];
        });

        // if the detail drawer currently shows this file, refresh its data so the UI (coringa select) updates
        setDetailData((prev) => {
          if (!prev) return null;
          if (prev.fullpath === row.fullpath || prev.filename === row.filename) {
            return row;
          }
          return prev;
        });

        notifyFromPayload(payload);
        return;
      }
      if (evt === "error") {
        toast.error(payload?.message || "Erro no verificador");
      }
    });

    return () => { mounted.current = false; };
  }, []);

  // Autosave do relatório: qualquer mudança nas linhas é persistida em disco (debounce de 800ms).
  // Assim, fechar o programa não perde as análises — elas voltam na próxima abertura.
  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.electron?.analyzer?.saveHistory?.(rows)?.catch?.(() => { });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [rows]);

  const rowsFilteredByDay = useMemo(() => {
    if (!selectedDay) return rows;
    return rows.filter((r) => getRowISODate(r) === selectedDay);
  }, [rows, selectedDay]);

  // KPIs
  const resumo = useMemo(() => {
    const ok = rowsFilteredByDay.filter((r) => r.status === "OK").length;
    const erro = rowsFilteredByDay.filter((r) => r.status === "ERRO").length;
    const mux = rowsFilteredByDay.filter((r) => (r.tags || []).some(t => normalizeTagForMatch(t).includes("muxarabi"))).length;
    const cor = rowsFilteredByDay.filter((r) => (r.tags || []).some(t => normalizeTagForMatch(t).includes("coringa"))).length;
    const curvo = rowsFilteredByDay.filter(hasCurvo).length;
    const dup37 = rowsFilteredByDay.filter((r) => (r.tags || []).some(t => normalizeTagForMatch(t).includes("duplado"))).length;
    const semCod = rowsFilteredByDay.filter((r) => (r.tags || []).some(t => normalizeTagForMatch(t).includes("semcodigo"))).length;
    const autofix = rowsFilteredByDay.filter((r) => (r.autoFixes || []).length > 0).length;
    return { ok, erro, mux, cor, curvo, dup37, semCod, autofix };
  }, [rowsFilteredByDay]);

  const kpis = useMemo(() => [
    { key: "all", title: "Todos", value: rowsFilteredByDay.length, icon: <Filter className="h-4 w-4" />, color: "#38BDF8" },
    { key: "ok", title: "Corretos", value: resumo.ok, icon: <CheckCircle2 className="h-4 w-4" />, color: "#34D399" },
    { key: "erro", title: "Inconformidades", value: resumo.erro, icon: <XCircle className="h-4 w-4" />, color: "#FB7185" },
    { key: "autofix", title: "Auto-Fix", value: resumo.autofix, icon: <Zap className="h-4 w-4" />, color: "#2DD4BF" },
    { key: "muxarabi", title: "Muxarabi", value: resumo.mux, icon: <Grid3X3 className="h-4 w-4" />, color: "#C084FC" },
    { key: "coringa", title: "Cor Coringa", value: resumo.cor, icon: <Grid3X3 className="h-4 w-4" />, color: "#FBBF24" },
    { key: "duplado37mm", title: "Duplado 37MM", value: resumo.dup37, icon: <AlertTriangle className="h-4 w-4" />, color: "#F43F5E" },
    { key: "curvo", title: "Curvo", value: resumo.curvo, icon: <Grid3X3 className="h-4 w-4" />, color: "#FB923C" },
  ] as const, [rowsFilteredByDay.length, resumo]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return rowsFilteredByDay
      .filter((r) => {
        if (!term) return true;
        const nameMatch = r.filename.toLowerCase().includes(term);
        const errorMatch = (r.errors || []).some((e: any) => {
          const desc = typeof e === "string" ? e : (e?.descricao || "");
          return desc.toLowerCase().includes(term);
        });
        const warningMatch = (r.warnings || []).some(w => String(w).toLowerCase().includes(term));
        const tagMatch = (r.tags || []).some(t => t.toLowerCase().includes(term));
        const autoFixMatch = ((r.autoFixes || []).length > 0) && "auto-fix".includes(term);
        return nameMatch || errorMatch || warningMatch || tagMatch || autoFixMatch;
      })
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "ok") return r.status === "OK";
        if (filter === "erro") return r.status === "ERRO";
        if (filter === "muxarabi") return (r.tags || []).some(t => normalizeTagForMatch(t).includes("muxarabi"));
        if (filter === "coringa") return (r.tags || []).some(t => normalizeTagForMatch(t).includes("coringa"));
        if (filter === "duplado37mm") return (r.tags || []).some(t => normalizeTagForMatch(t).includes("duplado"));
        if (filter === "sem_codigo") return (r.tags || []).some(t => normalizeTagForMatch(t).includes("semcodigo"));
        if (filter === "curvo") return hasCurvo(r);
        if (filter === "autofix") return (r.autoFixes || []).length > 0;
        return true;
      });
  }, [rowsFilteredByDay, search, filter]);

  const totalPages = useMemo(() => Math.ceil(filtered.length / itemsPerPage), [filtered.length]);
  const paginatedData = useMemo(() => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filtered, currentPage]);

  // ===== helpers/ações =====

  async function start() {
    const ok = await window.electron?.analyzer?.start?.(cfg);
    if (!ok) toast.error("Confira os caminhos e permissões.");
  }
  async function stop() { await window.electron?.analyzer?.stop?.(); }
  async function scan() { await window.electron?.analyzer?.scanOnce?.(); }

  async function clearReport() {
    setConfirmClearOpen(true);
  }

  async function executeClearReport() {
    setConfirmClearOpen(false);
    setRows([]);
    setSearch("");
    setFilter("all");
    setCurrentPage(1);
    setDetailOpen(false);
    setDetailData(null);
    // limpar também o histórico persistido em disco, imediatamente
    window.electron?.analyzer?.saveHistory?.([])?.catch?.(() => { });
    toast.success("Relatório de Atividade limpo com sucesso!");
  }

  async function handleClearFolders() {
    setConfirmExcluirOpen(true);
  }

  async function executeClearFolders() {
    setConfirmExcluirOpen(false);
    const id = toast.loading("Excluindo arquivos...");
    try {
      const res = await window.electron?.analyzer?.clearTargetFolders?.();
      if (res?.ok) {
        toast.success(`Arquivos removidos com sucesso: ${res.count || 0}`);
        // Limpar o relatório de atividade junto com a exclusão física (inclusive o histórico em disco)
        setRows([]);
        setSearch("");
        setFilter("all");
        setCurrentPage(1);
        setDetailOpen(false);
        setDetailData(null);
        window.electron?.analyzer?.saveHistory?.([])?.catch?.(() => { });
        scan();
      } else {
        toast.error(`Falha ao remover: ${res?.message || "erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error("Ocorreu um erro.", { description: String(e?.message || e) });
    } finally {
      toast.dismiss(id);
    }
  }

  async function exportReport() {
    const toastId = toast.loading("Exportando relatório...");
    try {
      const targetRows = rowsFilteredByDay;
      const okFiles = targetRows.filter(r => r.status === "OK").length;
      const errorFiles = targetRows.filter(r => r.status === "ERRO").length;

      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const targetDate = selectedDay ? selectedDay : `Completo_${todayStr}`;

      const reportData = {
        rows: targetRows,
        totalFiles: targetRows.length,
        okFiles,
        errorFiles,
        targetDate
      };

      const result = await window.electron?.analyzer?.exportReport?.(reportData);

      if (result?.ok) {
        toast.dismiss(toastId);
        const label = selectedDay
          ? selectedDay.split('-').reverse().join('-')
          : `Completo_${todayStr.split('-').reverse().join('-')}`;
        toast.success(`Relatório exportado com sucesso!\n${result.filesCount || targetRows.length} arquivo(s) processado(s)`, {
          duration: 5000,
          description: `Arquivo: Relatorio_${label}`
        });
      } else {
        toast.dismiss(toastId);
        toast.error(result?.message || "Erro ao exportar relatório");
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error("Erro ao exportar relatório.", { description: String(e?.message || e) });
    }
  }

  const handleOpenFolder = useCallback(async (fullPath: string) => {
    try {
      const ok = await window.electron?.analyzer?.openInFolder?.(fullPath);
      if (ok) toast.info("Abrindo pasta do arquivo…");
      else toast.warning("Não consegui abrir a pasta desse arquivo.");
    } catch (e: any) {
      toast.error("Falha ao abrir pasta.", { description: String(e?.message || e) });
    }
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!deleteTarget) return;
    setConfirmDeleteOpen(false);
    const id = toast.loading("Excluindo projeto…");
    try {
      const res = await window.electron?.analyzer?.deleteProject?.(deleteTarget.fullpath);
      if (res?.ok) {
        toast.success(`Projeto "${deleteTarget.filename}" excluído com sucesso.`);
        setRows(prev => prev.filter(r => r.fullpath !== deleteTarget.fullpath && r.filename !== deleteTarget.filename));
        // Fechar drawer se estiver mostrando o arquivo excluído
        setDetailData(prev => (prev && (prev.fullpath === deleteTarget.fullpath || prev.filename === deleteTarget.filename) ? null : prev));
        if (detailData?.fullpath === deleteTarget.fullpath || detailData?.filename === deleteTarget.filename) setDetailOpen(false);
      } else {
        toast.error("Falha ao excluir.", { description: res?.message || "Erro desconhecido" });
      }
    } catch (e: any) {
      toast.error("Erro ao excluir projeto.", { description: String(e?.message || e) });
    } finally {
      toast.dismiss(id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, detailData]);

  const reprocessOne = useCallback(async (fullPath: string) => {
    const id = toast.loading("Processando arquivo…");
    try {
      const ok = await window.electron?.analyzer?.reprocessOne?.(fullPath);
      if (ok) toast.success("Arquivo processado — reavaliado e movido se necessário.");
      else toast.warning("Tentei reprocessar, mas não houve alteração.");
    } catch (e: any) {
      toast.error("Erro ao reprocessar.", { description: String(e?.message || e) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleManualAction = useCallback(async (fullpath: string, action: string) => {
    setRows((prev) => {
      const idx = prev.findIndex(r => r.fullpath === fullpath);
      if (idx < 0) return prev;
      const copy = [...prev];
      const row = { ...copy[idx] };
      const timePrefix = new Date().toLocaleTimeString('pt-BR');
      const cleanFix = action.replace(/^\[Manual\]\s*/i, '').replace(/^\[Automático\]\s*/i, '').trim();
      row.history = [...(row.history || []), `[${timePrefix}] ${action}`];
      if (cleanFix) {
        row.manualFixes = Array.from(new Set([...(row.manualFixes || []), cleanFix]));
      }
      copy[idx] = row;
      setDetailData(prevData => (prevData && (prevData.fullpath === fullpath || prevData.filename === row.filename) ? row : prevData));
      return copy;
    });
  }, []);

  const handleFileDetail = useCallback((file: any) => {
    setDetailData(file);
    setDetailOpen(true);
  }, []);

  const handleFileMoved = useCallback((oldPath: string, newPath: string) => {
    setRows(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(r => r.fullpath === oldPath);
      if (idx !== -1) {
        const manualFix = "Movido manualmente para a pasta OK";
        const updatedRow = {
          ...copy[idx],
          fullpath: newPath,
          filename: newPath.split(/[\\/]/).pop() || copy[idx].filename,
          status: "OK" as const,
          errors: [],
          tags: (copy[idx].tags || []).filter(t => t.toLowerCase() !== "duplado 37mm" && t.toLowerCase() !== "duplado37mm"),
          manualFixes: Array.from(new Set([...(copy[idx].manualFixes || []), manualFix])),
          history: [...(copy[idx].history || []), `[${new Date().toLocaleTimeString('pt-BR')}] [Manual] ${manualFix}`],
        };
        copy[idx] = updatedRow;

        // Atualizar também o estado do modal se ele estiver aberto para este arquivo
        setDetailData(prevDetail => (prevDetail && (prevDetail.fullpath === oldPath || prevDetail.filename === updatedRow.filename) ? updatedRow : prevDetail));
      }
      return copy;
    });
  }, []);

  // Arquivos elegíveis para bulk move: APENAS "SEM GERAÇÃO DE MÁQUINAS" como único erro
  const bulkMoveEligible = useMemo(() =>
    rows.filter(r =>
      r.status === "ERRO" &&
      (r.errors || []).length === 1 &&
      (r.errors || [])[0]?.toUpperCase().includes("SEM GERAÇÃO DE MÁQUINAS")
    ), [rows]);

  const executeBulkMoveToOk = useCallback(async () => {
    setConfirmBulkMoveOpen(false);
    const total = bulkMoveEligible.length;
    if (total === 0) return;
    const id = toast.loading(`Movendo ${total} arquivo(s) para OK...`);
    let success = 0;
    let fail = 0;
    for (const file of bulkMoveEligible) {
      try {
        const res = await window.electron?.analyzer?.moveToOk?.(file.fullpath);
        if (res?.ok) {
          success++;
          const destPath = res.destPath;
          if (destPath) {
            setRows(prev => {
              const copy = [...prev];
              const idx = copy.findIndex(r => r.fullpath === file.fullpath);
              if (idx !== -1) {
                copy[idx] = { ...copy[idx], fullpath: destPath, filename: destPath.split(/[\\\/]/).pop() || copy[idx].filename, status: "OK", errors: [] };
              }
              return copy;
            });
          }
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }
    toast.dismiss(id);
    if (success > 0) toast.success(`${success} arquivo(s) movido(s) para OK com sucesso!`);
    if (fail > 0) toast.error(`${fail} arquivo(s) falharam ao mover.`);
  }, [bulkMoveEligible]);

  // métricas p/ card lateral
  const { totalFiles, okFiles, errorFiles, lastActivity } = useMemo(() => ({
    totalFiles: rowsFilteredByDay.length,
    okFiles: rowsFilteredByDay.filter(r => r.status === "OK").length,
    errorFiles: rowsFilteredByDay.filter(r => r.status === "ERRO").length,
    lastActivity: rowsFilteredByDay[0]?.timestamp ?? "--:--",
  }), [rowsFilteredByDay]);

  // ---- UI ----
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/80 bg-gradient-to-r from-card via-card/95 to-card px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm backdrop-blur-md sticky top-0 z-30">
        {/* App Title & Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-lg shadow-lg shadow-amber-500/20 border border-yellow-300/60 shrink-0">
            B
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-base font-bold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
              <span>Bartz Verificador XML</span>
              <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full shadow-inner">
                v6.5.3
              </span>
              {monitoring && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Monitorando
                </span>
              )}
            </div>
            {watchRoot && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-sm" title={watchRoot}>
                <FolderOpen className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <span className="font-mono text-muted-foreground/80 truncate">{watchRoot}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Hero Actions: Iniciar / Parar & Especiais & Chapas */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/80 shadow-inner">
            {!monitoring ? (
              <Button
                onClick={start}
                className="h-8 px-3.5 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold gap-1.5 rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Iniciar</span>
              </Button>
            ) : (
              <Button
                onClick={stop}
                className="h-8 px-3.5 text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold gap-1.5 rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Pause className="h-3.5 w-3.5 fill-current animate-pulse" />
                <span>Parar</span>
              </Button>
            )}

            {hasSpecialOrdersPermission && (
              <Button
                variant="outline"
                onClick={() => setSpecialOrdersOpen(true)}
                className={`h-8 px-3 text-xs gap-1.5 font-bold transition-all rounded-xl border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 shadow-sm cursor-pointer active:scale-95 ${
                  openOrdersCount > 0
                    ? "border-purple-500/80 shadow-md shadow-purple-500/20 text-purple-200"
                    : ""
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Especiais</span>
                {openOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold shadow-sm">
                    {openOrdersCount}
                  </span>
                )}
              </Button>
            )}

            {hasPlateSeparationPermission && (
              <Button
                variant="outline"
                onClick={() => setPlateSeparationOpen(true)}
                className={`h-8 px-3 text-xs gap-1.5 font-bold transition-all rounded-xl border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 shadow-sm cursor-pointer active:scale-95 ${
                  completedPlatesCount > 0
                    ? "border-cyan-500/80 shadow-md shadow-cyan-500/20 text-cyan-200"
                    : ""
                }`}
                title="Abrir Separação de Chapas"
              >
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span>Separação Chapas</span>
                {completedPlatesCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-extrabold shadow-sm">
                    {completedPlatesCount}
                  </span>
                )}
                {unreadPlateLotIds.size > 0 && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold shadow-sm animate-pulse"
                    title={`${unreadPlateLotIds.size} lote(s) com novas mensagens`}
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    <span>{unreadPlateLotIds.size}</span>
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Maintenance & Report Actions */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/80 shadow-inner">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportReport}
              className="h-8 px-2.5 text-xs text-sky-400 hover:bg-sky-500/15 hover:text-sky-300 gap-1.5 font-semibold rounded-xl cursor-pointer transition-all active:scale-95"
              title="Exportar Relatório"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearReport}
              className="h-8 px-2.5 text-xs text-amber-400 hover:bg-amber-500/15 hover:text-amber-300 gap-1.5 font-semibold rounded-xl cursor-pointer transition-all active:scale-95"
              title="Limpar Tabela"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFolders}
              className="h-8 px-2.5 text-xs text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 gap-1.5 font-semibold rounded-xl cursor-pointer transition-all active:scale-95"
              title="Excluir Arquivos"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Excluir arquivos</span>
            </Button>
          </div>

          {/* Settings & User Profile Group */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/80 shadow-inner">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.electron?.updater?.checkForUpdates?.()}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
              title="Verificar Atualizações"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden xl:inline font-medium">Atualizar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToConfig}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
              title="Opções de Configuração"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="font-medium">Opções</span>
            </Button>

            <ThemeToggle />

            {currentUser && (
              <div className="flex items-center gap-1 pl-1.5 border-l border-border/60 ml-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-border/80 text-xs font-semibold text-foreground shadow-sm">
                  <User className="h-3.5 w-3.5 text-purple-400" />
                  <span className="max-w-[110px] truncate" title={currentUser.txt_nome || currentUser.txt_login}>
                    {currentUser.txt_nome || currentUser.txt_login}
                  </span>
                </div>
                {onLogout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 rounded-xl cursor-pointer transition-all active:scale-95"
                    title="Sair do sistema"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sistema de Busca e Cópia de XML + Busca de Desenhos */}
      <div className="px-6 mt-4">
        <button
          onClick={() => setSearchPanelOpen(!searchPanelOpen)}
          className="w-full flex items-center justify-between bg-card/70 hover:bg-card border border-border/80 rounded-2xl px-5 py-3 transition-all duration-200 group cursor-pointer shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Search className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {hasAdminPermission ? "Pesquisa de XML e Desenhos" : "Pesquisa e Importação de XML"}
              </span>
              <p className="text-[10px] text-muted-foreground font-medium">Localização e importação rápida de arquivos do servidor</p>
            </div>
          </div>
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${searchPanelOpen ? 'rotate-180 text-foreground' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            searchPanelOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className={`grid grid-cols-1 ${hasAdminPermission ? "lg:grid-cols-2" : ""} gap-4`}>
              {/* Coluna 1: Pesquisa e Importação de XML */}
              <div className="bg-card/90 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-sky-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Pesquisa de XML</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Servidor / Local
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="relative group">
                    <Input
                      type="text"
                      placeholder="Digite o nome do arquivo XML..."
                      value={searchXmlTerm}
                      onChange={(e) => setSearchXmlTerm(e.target.value)}
                      onClear={() => setSearchXmlTerm("")}
                      leftIcon={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
                      className="w-full bg-muted/40 border-border/80 text-xs focus:border-sky-500 font-medium h-9 rounded-xl"
                    />
                    {searchingXml && (
                      <Loader2
                        className="absolute right-8 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-400 animate-spin pointer-events-none z-10"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full min-w-0">
                    <select
                      value={selectedXmlPath}
                      onChange={(e) => setSelectedXmlPath(e.target.value)}
                      className="flex-1 min-w-0 bg-muted/40 hover:bg-muted/60 text-foreground text-xs py-2 px-3 rounded-xl border border-border/80 focus:outline-none focus:border-sky-500 transition-all font-medium h-9 [color-scheme:dark] truncate cursor-pointer"
                      disabled={searchingXml || searchXmlResults.length === 0}
                    >
                      {searchingXml ? (
                        <option value="" className="bg-[#18181b] text-zinc-100">Buscando no servidor...</option>
                      ) : searchXmlResults.length === 0 ? (
                        <option value="" className="bg-[#18181b] text-zinc-100">Nenhum resultado encontrado</option>
                      ) : (
                        <>
                          <option value="" className="bg-[#18181b] text-zinc-100">Selecione um arquivo ({searchXmlResults.length} encontrados)...</option>
                          {searchXmlResults.map((res, index) => (
                            <option key={index} value={res.fullPath} className="bg-[#18181b] text-zinc-100">
                              {res.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>

                    <Button
                      onClick={handleImportXml}
                      disabled={!selectedXmlPath || copyingXml}
                      className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 h-9 gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {copyingXml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      <span>{copyingXml ? "Importando..." : "Importar"}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Coluna 2: Pesquisa de Desenhos */}
              {hasAdminPermission && (
                <div className="bg-card/90 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-amber-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Pesquisa de Desenhos (DXF)</h4>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchModalOpen(true)}
                      className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-lg font-semibold cursor-pointer"
                      title="Abrir ou copiar múltiplos desenhos de uma só vez"
                    >
                      <Files className="h-3.5 w-3.5" />
                      <span>Em Lote</span>
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full min-w-0">
                      <div className="relative flex-1 min-w-0 group">
                        <Input
                          type="text"
                          placeholder="Digite o código do desenho..."
                          value={searchDrawingTerm}
                          onChange={(e) => setSearchDrawingTerm(e.target.value)}
                          onClear={() => setSearchDrawingTerm("")}
                          leftIcon={<FileSearch className="h-3.5 w-3.5 text-muted-foreground" />}
                          className="w-full bg-muted/40 border-border/80 text-xs focus:border-amber-500 font-medium h-9 rounded-xl"
                        />
                        {searchingDrawings && (
                          <Loader2
                            className="absolute right-8 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400 animate-spin pointer-events-none z-10"
                          />
                        )}
                      </div>

                      <select
                        value={selectedDrawingPath}
                        onChange={(e) => setSelectedDrawingPath(e.target.value)}
                        className="flex-1 min-w-0 bg-muted/40 hover:bg-muted/60 text-foreground text-xs py-2 px-3 rounded-xl border border-border/80 focus:outline-none focus:border-amber-500 transition-all font-medium h-9 [color-scheme:dark] truncate cursor-pointer"
                        disabled={searchingDrawings || searchDrawingResults.length === 0}
                      >
                        {searchingDrawings ? (
                          <option value="" className="bg-[#18181b] text-zinc-100">Buscando desenhos...</option>
                        ) : searchDrawingResults.length === 0 ? (
                          <option value="" className="bg-[#18181b] text-zinc-100">Nenhum resultado encontrado</option>
                        ) : (
                          <>
                            <option value="" className="bg-[#18181b] text-zinc-100">Selecione um desenho ({searchDrawingResults.length} encontrados)...</option>
                            {searchDrawingResults.map((res, index) => (
                              <option key={index} value={res.fullPath} className="bg-[#18181b] text-zinc-100">
                                {res.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    {selectedDrawingPath && (
                      resolvingPedido ? (
                        <div className="text-[10px] text-muted-foreground px-1 flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                          <span>Localizando pedido associado...</span>
                        </div>
                      ) : selectedPedidoInfo?.pedido ? (
                        <div className="text-[10px] text-muted-foreground px-1 flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                            Pedido {selectedPedidoInfo.pedido}
                          </span>
                          {selectedPedidoInfo.pedidoFilename && <span className="opacity-70 truncate max-w-xs font-mono">({selectedPedidoInfo.pedidoFilename})</span>}
                        </div>
                      ) : null
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          onClick={handleShowDrawingInFolder}
                          disabled={!selectedDrawingPath || locatingDrawing}
                          variant="ghost"
                          size="sm"
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg border border-border/60 hover:bg-muted/80"
                          title="Abrir pasta NESTING (SERVIDOR)"
                        >
                          <FolderOpen className="h-3 w-3 text-sky-400" />
                          <span>Servidor</span>
                        </Button>

                        <Button
                          onClick={handleOpenMirrorFolderFromSearch}
                          disabled={!selectedDrawingPath || !cfg.drawingsCopy || openingMirrorFolder}
                          variant="ghost"
                          size="sm"
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg border border-border/60 hover:bg-muted/80"
                          title={cfg.drawingsCopy ? "Abrir pasta NESTING(DXF ALESSANDRO)" : "Configure em Opções"}
                        >
                          <FolderOpen className="h-3 w-3 text-emerald-400" />
                          <span>Alessandro</span>
                        </Button>

                        <Button
                          onClick={handleOpenAspanFolderFromSearch}
                          disabled={!selectedDrawingPath || !cfg.drawingsAspan || openingAspanFolder}
                          variant="ghost"
                          size="sm"
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg border border-border/60 hover:bg-muted/80"
                          title={cfg.drawingsAspan ? "Abrir pasta NANXING" : "Configure em Opções"}
                        >
                          <FolderOpen className="h-3 w-3 text-purple-400" />
                          <span>Nanxing</span>
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleCopyDrawingToMirror}
                          disabled={!selectedDrawingPath || !cfg.drawingsCopy || copyingDrawingToMirror}
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 h-8 px-3 rounded-xl gap-1.5 cursor-pointer active:scale-95"
                          title="Copiar para pasta NESTING(DXF ALESSANDRO)"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Enviar DXF</span>
                        </Button>

                        <Button
                          onClick={handleOpenDrawingFromSearch}
                          disabled={!selectedDrawingPath || openingDrawing}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold h-8 px-3.5 rounded-xl active:scale-95 disabled:opacity-50 gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{openingDrawing ? "Abrindo..." : "Abrir"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer de detalhes */}
      <FileDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={detailData}
        onFileMoved={handleFileMoved}
        onAction={handleManualAction}
        currentUser={currentUser}
      />

      {/* Relatório + KPIs (2 colunas perfeitamente balanceadas) */}
      <div className="px-6 mt-4 space-y-3">
        <button
          onClick={() => setReportsAndMetricsOpen(!reportsAndMetricsOpen)}
          className="w-full flex items-center justify-between bg-card/70 hover:bg-card border border-border/80 rounded-2xl px-5 py-3 transition-all duration-200 group cursor-pointer shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Relatório de Atividade & Métricas
              </span>
              <p className="text-[10px] text-muted-foreground font-medium">Indicadores de conformidade e filtros rápidos de projetos</p>
            </div>
          </div>
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${reportsAndMetricsOpen ? 'rotate-180 text-foreground' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            reportsAndMetricsOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Coluna 1 - Resumo do Dia e Performance */}
              <div className="lg:col-span-5 bg-card/90 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Desempenho Diário</span>
                  </div>
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/80">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevDay}
                      title="Dia anterior"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <input
                      type="date"
                      value={selectedDay}
                      onChange={(e) => {
                        setSelectedDay(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-card text-foreground text-[10px] font-bold py-0.5 px-2 rounded-lg border border-border/60 focus:outline-none cursor-pointer"
                      style={{ colorScheme: "dark" }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextDay}
                      title="Próximo dia"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    {selectedDay !== getTodayISODate() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDay(getTodayISODate());
                          setCurrentPage(1);
                        }}
                        className="h-6 px-1.5 text-[9px] text-emerald-400 font-bold uppercase bg-emerald-500/10 rounded-md"
                      >
                        Hoje
                      </Button>
                    )}
                    {selectedDay && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDay("");
                          setCurrentPage(1);
                        }}
                        className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground font-semibold uppercase bg-muted/60 rounded-md"
                      >
                        Todas
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3 text-emerald-400" /> Taxa de Conformidade
                      </span>
                      <div className="text-2xl font-black text-foreground">
                        {totalFiles > 0 ? Math.round((okFiles / totalFiles) * 100) : 0}%
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Analisado</span>
                      <div className="text-base font-bold text-foreground">{totalFiles} <span className="text-xs font-normal text-muted-foreground">arquivos</span></div>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/80">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                      style={{ width: `${totalFiles > 0 ? (okFiles / totalFiles) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold tracking-tighter opacity-80 leading-none">Corretos</div>
                        <div className="text-base font-bold leading-tight">{okFiles}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold tracking-tighter opacity-80 leading-none">Inconformidades</div>
                        <div className="text-base font-bold leading-tight">{errorFiles}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground p-2 rounded-xl bg-muted/20 border border-border/40">
                  <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3 text-muted-foreground/70" /> Última atividade</span>
                  <span className="text-foreground font-mono font-medium">{lastActivity}</span>
                </div>
              </div>

              {/* Coluna 2 - KPIs (Grid 4x2 Perfeitamente Simétrico) */}
              <div className="lg:col-span-7 bg-card/90 rounded-2xl border border-border/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Filtros Rápidos por Categoria</h4>
                  </div>
                  {filter !== 'all' && (
                    <button
                      onClick={() => { setFilter('all'); setCurrentPage(1); }}
                      className="text-[10px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
                    >
                      Limpar Filtro
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {kpis.map((k: any) => {
                    const isActive = filter === k.key;
                    return (
                      <button
                        key={k.key}
                        onClick={() => { setFilter(k.key); setCurrentPage(1); }}
                        className={`group text-left rounded-xl p-3 transition-all duration-200 relative overflow-hidden active:scale-95 border cursor-pointer ${
                          isActive
                            ? "bg-card shadow-md shadow-primary/10 border-primary"
                            : "bg-muted/30 hover:bg-muted/60 border-border/70 hover:border-border"
                        }`}
                        style={{
                          borderColor: isActive ? k.color : undefined,
                          boxShadow: isActive ? `0 0 12px ${k.color}25, inset 0 0 8px ${k.color}10` : undefined
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isActive ? 'bg-card' : 'bg-background/80 group-hover:bg-card'
                            }`}
                            style={{ color: k.color, borderColor: `${k.color}30` }}
                          >
                            {k.icon}
                          </div>
                          {isActive && (
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.color, boxShadow: `0 0 6px ${k.color}` }} />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className={`text-[10px] uppercase tracking-wider font-bold truncate transition-colors ${
                            isActive ? 'text-foreground font-extrabold' : 'text-muted-foreground'
                          }`}>
                            {k.title}
                          </div>
                          <div className="text-xl font-black tracking-tight text-foreground">{k.value}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Arquivos */}
      <div className="p-6 space-y-5">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-full max-w-md">
              <Input
                type="text"
                placeholder="Buscar arquivo, erro, tag..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                onClear={() => { setSearch(""); setCurrentPage(1); }}
                leftIcon={<Search className="h-4 w-4" />}
                className="w-full bg-card/80 border-border/80 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all rounded-xl shadow-inner"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {bulkMoveEligible.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmBulkMoveOpen(true)}
                className="gap-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold h-8 rounded-xl active:scale-[0.98] transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Enviar 'SEM GERAÇÃO' para OK ({bulkMoveEligible.length})</span>
              </Button>
            )}
            <div className="text-xs font-semibold text-muted-foreground bg-card/80 px-3.5 py-1.5 rounded-xl border border-border/80 flex items-center gap-2 shadow-sm">
              <Files className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Mostrando <strong className="text-foreground font-bold">{filtered.length}</strong> de <strong className="text-foreground font-bold">{rows.length}</strong> arquivos</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/80">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest pl-6 py-3.5">Arquivo</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest py-3.5">Status</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest py-3.5">Inconformidades (Erros)</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest py-3.5">Avisos do Sistema</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest py-3.5">Tags</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest whitespace-nowrap py-3.5">Data / Hora</TableHead>
                <TableHead className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-widest text-center pr-6 py-3.5">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/40">
              {paginatedData.map((file) => {
                const autoFixed = (file.autoFixes || []).length > 0;
                return (
                  <TableRow key={file.fullpath} className="border-border hover:bg-muted/30 transition-colors group/row">
                    <TableCell className="pl-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full shrink-0 transition-shadow duration-300 ${
                            file.status === 'OK'
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                              : file.status === 'ERRO'
                              ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)] animate-pulse'
                              : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                          }`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            className="font-mono text-xs sm:text-sm text-foreground group-hover/row:text-primary font-medium transition-colors truncate max-w-[420px]"
                            title={file.filename}
                          >
                            {file.filename}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <StatusChip status={file.status} />
                    </TableCell>

                    <TableCell className="py-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-64">
                        {(file.errors || []).length > 0 ? (
                          (file.errors || []).map((e, i) => <ErrorBadge key={i} error={e} />)
                        ) : (
                          <span className="text-muted-foreground/25 font-mono text-xs select-none">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {(file.warnings || []).length > 0 ? (
                          (file.warnings || []).map((w, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-amber-400 border-amber-500/25 bg-amber-500/10 text-[9px] font-bold uppercase py-0.5 px-2 rounded-md"
                            >
                              {typeof w === "string" ? w.toUpperCase() : "AVISO"}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground/25 font-mono text-xs select-none">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-44">
                        {(() => {
                          const displayTags = filterTags(file.tags || []);
                          const hasAutofixTag = displayTags.some(t => t.toLowerCase().includes("autofix"));
                          const showGenericAutofix = autoFixed && !hasAutofixTag;
                          const hasTags = displayTags.length > 0 || showGenericAutofix;
                          return hasTags ? (
                            <>
                              {showGenericAutofix && (
                                <Badge
                                  variant="outline"
                                  className="text-teal-400 border-teal-500/25 bg-teal-500/10 text-[9px] font-bold uppercase py-0.5 px-2 rounded-md flex items-center gap-1"
                                >
                                  <Zap className="h-2.5 w-2.5 text-teal-400" /> AUTO-FIX
                                </Badge>
                              )}
                              {displayTags.map((t, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-sky-400 border-sky-500/25 bg-sky-500/10 text-[9px] font-bold uppercase py-0.5 px-2 rounded-md"
                                >
                                  {formatTag(t)}
                                </Badge>
                              ))}
                            </>
                          ) : (
                            <span className="text-muted-foreground/25 font-mono text-xs select-none">—</span>
                          );
                        })()}
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs font-mono whitespace-nowrap py-3.5">
                      {file.timestamp || "—"}
                    </TableCell>

                    <TableCell className="text-center pr-6 py-3.5">
                      <div className="inline-flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/80 transition-colors group-hover/row:border-border">
                        <button
                          title="Ver detalhes"
                          onClick={() => handleFileDetail(file)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-sky-500/20 hover:text-sky-400 transition-all text-muted-foreground cursor-pointer active:scale-95"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Abrir na pasta"
                          onClick={() => handleOpenFolder(file.fullpath)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-amber-500/20 hover:text-amber-400 transition-all text-muted-foreground cursor-pointer active:scale-95"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Excluir projeto"
                          onClick={() => { setDeleteTarget(file); setConfirmDeleteOpen(true); }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all text-muted-foreground cursor-pointer active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <div>Página {currentPage} de {totalPages}</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>


      {/* CONFIRMAÇÕES */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent className="bg-card border border-amber-500/30 text-foreground w-[480px] max-w-[92vw] p-6 shadow-2xl rounded-2xl overflow-hidden flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmação de Limpeza</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Tem certeza que deseja limpar o Relatório de Atividade? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <AlertDialogCancel className="bg-muted/80 text-foreground hover:bg-muted border border-border/60 rounded-xl px-4 py-2 h-9 text-xs font-semibold cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeClearReport}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-4 py-2 h-9 text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Sim, limpar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmExcluirOpen} onOpenChange={setConfirmExcluirOpen}>
        <AlertDialogContent className="bg-card border border-rose-500/30 text-foreground w-[480px] max-w-[92vw] p-6 shadow-2xl rounded-2xl overflow-hidden flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmação de Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Deseja excluir fisicamente os arquivos das pastas (OK, erro, logs)? Esta ação removerá os arquivos do disco permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <AlertDialogCancel className="bg-muted/80 text-foreground hover:bg-muted border border-border/60 rounded-xl px-4 py-2 h-9 text-xs font-semibold cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeClearFolders}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-4 py-2 h-9 text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Sim, excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkMoveOpen} onOpenChange={setConfirmBulkMoveOpen}>
        <AlertDialogContent className="bg-card border border-emerald-500/30 text-foreground w-[480px] max-w-[92vw] p-6 shadow-2xl rounded-2xl overflow-hidden flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Enviar Erros de Máquinas para OK</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
              Deseja mover <strong className="text-foreground">{bulkMoveEligible.length}</strong> arquivo(s) que possuem <strong className="text-foreground">apenas</strong> o erro "SEM GERAÇÃO DE MÁQUINAS" para a pasta OK?
              <br /><br />
              <span className="text-muted-foreground/60 text-xs">Arquivos com outros erros além desse não serão movidos.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <AlertDialogCancel className="bg-muted/80 text-foreground hover:bg-muted border border-border/60 rounded-xl px-4 py-2 h-9 text-xs font-semibold cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkMoveToOk}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-4 py-2 h-9 text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Sim, enviar para OK
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="bg-card border border-rose-500/30 text-foreground w-[480px] max-w-[92vw] p-6 shadow-2xl rounded-2xl overflow-hidden flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Excluir Projeto
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirmação de exclusão permanente
              </p>
            </div>
          </div>

          <AlertDialogDescription asChild>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>Deseja realmente excluir o projeto?</p>
              <div className="p-3 bg-muted/60 rounded-xl border border-border/80 font-mono text-xs text-foreground break-all select-all leading-relaxed">
                {deleteTarget?.filename}
              </div>
              <p className="text-rose-400 text-xs flex items-center gap-1.5 pt-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Esta ação é irreversível. O arquivo será removido permanentemente.
              </p>
            </div>
          </AlertDialogDescription>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <AlertDialogCancel
              onClick={() => setConfirmDeleteOpen(false)}
              className="bg-muted/80 text-foreground hover:bg-muted border border-border/60 rounded-xl px-4 py-2 h-9 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-4 py-2 h-9 text-xs gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sim, excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmação para substituir XML já baixado */}
      <AlertDialog
        open={!!confirmOverwriteXml}
        onOpenChange={(open) => !open && setConfirmOverwriteXml(null)}
      >
        <AlertDialogContent className="bg-card border border-amber-500/30 text-foreground w-[480px] max-w-[92vw] p-6 shadow-2xl rounded-2xl overflow-hidden flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Substituir arquivo XML?
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Este arquivo já foi baixado anteriormente.
              </p>
            </div>
          </div>

          <AlertDialogDescription asChild>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>O seguinte arquivo já se encontra no sistema:</p>
              <div className="p-3 bg-muted/60 rounded-xl border border-border/80 font-mono text-xs text-foreground break-all select-all leading-relaxed">
                {confirmOverwriteXml?.fileName}
              </div>
              <p className="pt-1">
                Deseja substituir o arquivo existente e reprocessá-lo com a versão mais recente do servidor?
              </p>
            </div>
          </AlertDialogDescription>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <AlertDialogCancel
              onClick={() => setConfirmOverwriteXml(null)}
              className="bg-muted/80 text-foreground hover:bg-muted border border-border/60 rounded-xl px-4 py-2 h-9 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOverwriteXml) {
                  executeImportXml(confirmOverwriteXml.sourcePath);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl px-4 py-2 h-9 text-xs gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Substituir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {hasAdminPermission && (
        <BatchDrawingsModal
          open={batchModalOpen}
          onOpenChange={setBatchModalOpen}
          defaultMirrorPath={cfg.drawingsCopy}
        />
      )}

      <SpecialOrdersModal
        open={specialOrdersOpen}
        onOpenChange={setSpecialOrdersOpen}
        currentUser={currentUser}
        specialOrders={specialOrders}
        onRefresh={checkSpecialOrdersUpdates}
      />

      {hasPlateSeparationPermission && (
        <PlateSeparationModal
          open={plateSeparationOpen}
          onOpenChange={(op) => {
            setPlateSeparationOpen(op);
            if (!op) setPlateLotToOpenChat(null);
          }}
          currentUser={currentUser}
          initialItems={plateSeparationItems}
          onRefresh={checkPlateSeparationUpdates}
          unreadLotIds={unreadPlateLotIds}
          onMarkLotAsRead={handleMarkPlateLotAsRead}
          initialLotIdToOpen={plateLotToOpenChat}
        />
      )}

      {/* toasts */}
    </div>
  );
}
