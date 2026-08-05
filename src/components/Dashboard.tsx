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
  ChevronLeft, ChevronRight, ChevronDown
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import FileDetailDrawer from "./FileDetailDrawer";
import ThemeToggle from "./ThemeToggle";
import { PATH_CONFIGS, type PathConfigKey } from "./ConfigurationScreen";
import { BatchDrawingsModal } from "./BatchDrawingsModal";
import { SpecialOrdersModal } from "./SpecialOrdersModal";


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

  return {
    filename,
    fullpath: full,
    status,
    errors: erros,
    autoFixes,
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

  // Permissão 36 - Botão Especiais
  const hasSpecialOrdersPermission = useMemo(() => {
    if (!currentUser) return false;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).includes(36);
  }, [currentUser]);

  // Permissão 37 - Admin Analisador
  const hasAdminPermission = useMemo(() => {
    if (!currentUser) return false;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p))).includes(37);
  }, [currentUser]);

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

        // Sync Windows Taskbar Badge Overlay Icon
        window.electron?.analyzer?.setTaskbarBadge?.(openCount);

        if (isFirstSpecialOrdersCheck.current) {
          const orderIds = new Set<number>();
          const commentIds = new Set<number>();

          fetchedOrders.forEach((o) => {
            orderIds.add(o.pk_pedido_engenharia);
            (o.comentarios || []).forEach((c: any) => commentIds.add(c.pk_pedido_comentario));
          });

          knownSpecialOrderIds.current = orderIds;
          knownSpecialCommentIds.current = commentIds;
          isFirstSpecialOrdersCheck.current = false;
        } else {
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
  }, [hasSpecialOrdersPermission]);

  useEffect(() => {
    if (!hasSpecialOrdersPermission) return;
    checkSpecialOrdersUpdates();
    const interval = setInterval(checkSpecialOrdersUpdates, 5000);
    return () => clearInterval(interval);
  }, [hasSpecialOrdersPermission, checkSpecialOrdersUpdates]);

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

  const handleImportXml = async () => {
    if (!selectedXmlPath) return;

    if (!monitoring) {
      await start();
    }

    setCopyingXml(true);
    const id = toast.loading("Copiando arquivo XML para a pasta de entrada...");
    try {
      const res = await window.electron?.analyzer?.copyXmlToEntrada?.(selectedXmlPath);
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
    }
  };

  // Busca de Desenhos (DXF) na Pasta de Desenhos configurada
  const [searchDrawingTerm, setSearchDrawingTerm] = useState("");
  const [searchDrawingResults, setSearchDrawingResults] = useState<{ name: string; fullPath: string }[]>([]);
  const [selectedDrawingPath, setSelectedDrawingPath] = useState("");
  const [openingDrawing, setOpeningDrawing] = useState(false);
  const [locatingDrawing, setLocatingDrawing] = useState(false);
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
    const id = toast.loading("Abrindo pasta Desenho ASPAN...");
    try {
      const res = await window.electron?.analyzer?.openAspanFolder?.(drawingCode);
      if (res?.ok) {
        toast.success("Pasta Desenho ASPAN aberta com sucesso!");
      } else {
        toast.error(`Não foi possível abrir a pasta Desenho ASPAN: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta Desenho ASPAN.", { description: String(error?.message || error) });
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
    { key: "all", title: "Todos", value: rowsFilteredByDay.length, icon: <Filter className="h-5 w-5" />, color: "#3498DB" },
    { key: "ok", title: "Corretos", value: resumo.ok, icon: <CheckCircle className="h-5 w-5" />, color: "#27AE60" },
    { key: "erro", title: "Inconformidades", value: resumo.erro, icon: <XCircle className="h-5 w-5" />, color: "#E74C3C" },
    { key: "muxarabi", title: "Muxarabi", value: resumo.mux, icon: <Grid3X3 className="h-5 w-5" />, color: "#9B59B6" },
    { key: "coringa", title: "Cor Coringa", value: resumo.cor, icon: <Grid3X3 className="h-5 w-5" />, color: "#E67E22" },
    { key: "duplado37mm", title: "Duplado 37MM", value: resumo.dup37, icon: <AlertTriangle className="h-5 w-5" />, color: "#C0392B" },
    { key: "sem_codigo", title: "Sem Código", value: resumo.semCod, icon: <AlertCircle className="h-5 w-5" />, color: "#E74C3C" },
    { key: "curvo", title: "Curvo", value: resumo.curvo, icon: <Grid3X3 className="h-5 w-5" />, color: "#ee5700ff" },
    { key: "autofix", title: "Robô Auto-Fix", value: resumo.autofix, icon: <Zap className="h-5 w-5" />, color: "#1ABC9C" },
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
      row.history = [...(row.history || []), `[${timePrefix}] ${action}`];
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
        const updatedRow = {
          ...copy[idx],
          fullpath: newPath,
          filename: newPath.split(/[\\/]/).pop() || copy[idx].filename,
          status: "OK" as const,
          errors: [],
          tags: (copy[idx].tags || []).filter(t => t.toLowerCase() !== "duplado 37mm" && t.toLowerCase() !== "duplado37mm"),
        };
        copy[idx] = updatedRow;

        // Atualizar também o estado do modal se ele estiver aberto para este arquivo
        setDetailData(prevDetail => (prevDetail && (prevDetail.fullpath === oldPath || prevDetail.filename === updatedRow.filename) ? updatedRow : prevDetail));
      }
      return copy;
    });
  }, []);

  // Arquivos elegíveis para bulk move: APENAS "PROBLEMA NA GERAÇÃO DE MÁQUINAS" como único erro
  const bulkMoveEligible = useMemo(() =>
    rows.filter(r =>
      r.status === "ERRO" &&
      (r.errors || []).length === 1 &&
      (r.errors || [])[0]?.toUpperCase().includes("PROBLEMA NA GERAÇÃO DE MÁQUINAS")
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
      <div className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* App Title & Info */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md border border-purple-500/30">
            B
          </div>
          <div>
            <div className="text-base font-bold text-foreground flex items-center gap-2">
              Bartz Verificador XML
              <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-full">
                v5.22.0
              </span>
            </div>
            {watchRoot && (
              <div className="text-xs text-muted-foreground max-w-xs truncate" title={watchRoot}>
                Monitorando: <span className="font-mono text-foreground/80">{watchRoot}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Hero Actions: Iniciar / Parar & Especiais */}
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/50">
            {!monitoring ? (
              <Button
                onClick={start}
                className="h-8.5 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Iniciar
              </Button>
            ) : (
              <Button
                onClick={stop}
                className="h-8.5 px-3.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold border-0 gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5 fill-current animate-pulse" />
                Parar
              </Button>
            )}

            {hasSpecialOrdersPermission && (
              <Button
                variant="outline"
                onClick={() => setSpecialOrdersOpen(true)}
                className={`h-8.5 px-3 text-xs gap-1.5 font-bold transition-all border-purple-500/40 text-purple-400 hover:bg-purple-500/10 cursor-pointer ${
                  openOrdersCount > 0
                    ? "bg-purple-950/50 border-purple-500/80 shadow-md shadow-purple-500/20 text-purple-200"
                    : ""
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Especiais
                {openOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold animate-pulse ml-0.5 shadow-sm">
                    {openOrdersCount}
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Maintenance & Report Actions */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportReport}
              className="h-8.5 px-2.5 text-xs text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 gap-1.5 font-medium cursor-pointer"
              title="Exportar Relatório"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearReport}
              className="h-8.5 px-2.5 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5 font-medium cursor-pointer"
              title="Limpar Tabela"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Limpar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFolders}
              className="h-8.5 px-2.5 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-1.5 font-medium cursor-pointer"
              title="Excluir Arquivos"
            >
              <XCircle className="h-3.5 w-3.5" />
              Excluir arquivos
            </Button>
          </div>

          {/* Settings & User Profile Group */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.electron?.updater?.checkForUpdates?.()}
              className="h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
              title="Verificar Atualizações"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Atualizar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToConfig}
              className="h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
              title="Opções de Configuração"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Opções</span>
            </Button>

            <ThemeToggle />

            {currentUser && (
              <div className="flex items-center gap-1 pl-2 border-l border-border/40 ml-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border/60 text-xs font-semibold text-foreground">
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
                    className="h-8.5 w-8.5 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg cursor-pointer"
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
          className="w-full flex items-center justify-between bg-card hover:bg-card/80 border border-border rounded-xl px-5 py-3 transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[#F1C40F]">
              <Search className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Pesquisa de XML e Desenhos
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${searchPanelOpen ? 'rotate-180' : ''}`} />
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            searchPanelOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
          }`}
        >
          <div className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-[#F1C40F]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pesquisa e Importação de XML</h4>
            </div>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="relative flex-1 group">
                <Input
                  type="text"
                  placeholder="Digite o nome do arquivo XML..."
                  value={searchXmlTerm}
                  onChange={(e) => setSearchXmlTerm(e.target.value)}
                  onClear={() => setSearchXmlTerm("")}
                  className="w-full bg-muted/50 border-border text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium h-9"
                  style={{ paddingLeft: "2.5rem" }}
                />
                <Search
                  className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10"
                  style={{ top: "50%", transform: "translateY(-50%)" }}
                />
                {searchingXml && (
                  <Loader2
                    className="absolute right-8 h-3.5 w-3.5 text-primary animate-spin pointer-events-none z-10"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                )}
              </div>

              <select
                value={selectedXmlPath}
                onChange={(e) => setSelectedXmlPath(e.target.value)}
                className="flex-1 md:flex-none md:w-80 bg-muted hover:bg-muted/80 text-foreground text-xs py-2 px-3 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all select-none font-medium h-9"
                disabled={searchingXml || searchXmlResults.length === 0}
              >
                {searchingXml ? (
                  <option value="">Buscando...</option>
                ) : searchXmlResults.length === 0 ? (
                  <option value="">Nenhum resultado encontrado</option>
                ) : (
                  <>
                    <option value="">Selecione um arquivo ({searchXmlResults.length} encontrados)...</option>
                    {searchXmlResults.map((res, index) => (
                      <option key={index} value={res.fullPath}>
                        {res.name}
                      </option>
                    ))}
                  </>
                )}
              </select>

              <Button
                onClick={handleImportXml}
                disabled={!selectedXmlPath || copyingXml}
                className="bg-primary text-primary-foreground text-xs font-bold uppercase py-2 px-4 rounded-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9"
              >
                {copyingXml ? "Importando..." : "Importar"}
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSearch className="h-4.5 w-4.5 text-[#F1C40F]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pesquisa de Desenhos</h4>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchModalOpen(true)}
                className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                title="Abrir ou copiar múltiplos desenhos de uma só vez"
              >
                <Files className="h-3.5 w-3.5" />
                Abrir / Copiar em Lote
              </Button>
            </div>
            <div className="space-y-2.5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <div className="relative flex-1 group">
                  <Input
                    type="text"
                    placeholder="Digite o nome do desenho..."
                    value={searchDrawingTerm}
                    onChange={(e) => setSearchDrawingTerm(e.target.value)}
                    onClear={() => setSearchDrawingTerm("")}
                    className="w-full bg-muted/50 border-border text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium h-9"
                    style={{ paddingLeft: "2.5rem" }}
                  />
                  <FileSearch
                    className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                  {searchingDrawings && (
                    <Loader2
                      className="absolute right-8 h-3.5 w-3.5 text-primary animate-spin pointer-events-none z-10"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />
                  )}
                </div>

                <select
                  value={selectedDrawingPath}
                  onChange={(e) => setSelectedDrawingPath(e.target.value)}
                  className="flex-1 bg-muted hover:bg-muted/80 text-foreground text-xs py-2 px-3 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all select-none font-medium h-9"
                  disabled={searchingDrawings || searchDrawingResults.length === 0}
                >
                  {searchingDrawings ? (
                    <option value="">Buscando...</option>
                  ) : searchDrawingResults.length === 0 ? (
                    <option value="">Nenhum resultado encontrado</option>
                  ) : (
                    <>
                      <option value="">Selecione um desenho ({searchDrawingResults.length} encontrados)...</option>
                      {searchDrawingResults.map((res, index) => (
                        <option key={index} value={res.fullPath}>
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
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Procurando pedido...
                  </div>
                ) : selectedPedidoInfo?.pedido ? (
                  <div className="text-[10px] text-muted-foreground px-1">
                    <span className="font-semibold text-primary">Pedido {selectedPedidoInfo.pedido}</span>
                    {selectedPedidoInfo.pedidoFilename && <span className="ml-1.5 opacity-70">({selectedPedidoInfo.pedidoFilename})</span>}
                    {selectedPedidoInfo.pedidoSource === 'erp' && (
                      <span className="ml-1.5 opacity-70 italic">— encontrado no ERP</span>
                    )}
                    {selectedPedidoInfo.pedidoSource === 'busca' && (
                      <span className="ml-1.5 opacity-70 italic">— encontrado na Pasta de Busca</span>
                    )}
                  </div>
                ) : null
              )}

              <div className="flex items-center justify-end gap-2 flex-wrap">
                <Button
                  onClick={handleShowDrawingInFolder}
                  disabled={!selectedDrawingPath || locatingDrawing}
                  variant="outline"
                  className="text-xs font-bold uppercase py-2 px-3 rounded-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 gap-1.5"
                  title="Abrir pasta Desenho NESTING"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Desenho NESTING
                </Button>

                {hasAdminPermission && (
                  <Button
                    onClick={handleCopyDrawingToMirror}
                    disabled={!selectedDrawingPath || !cfg.drawingsCopy || copyingDrawingToMirror}
                    variant="outline"
                    className="text-xs font-bold uppercase py-2 px-3 rounded-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 gap-1.5"
                    title={cfg.drawingsCopy ? "Enviar para pasta Desenho DXF" : "Configure Desenho DXF em Opções para habilitar"}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Desenho DXF
                  </Button>
                )}

                <Button
                  onClick={handleOpenAspanFolderFromSearch}
                  disabled={!selectedDrawingPath || !cfg.drawingsAspan || openingAspanFolder}
                  variant="outline"
                  className="text-xs font-bold uppercase py-2 px-3 rounded-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 gap-1.5"
                  title={cfg.drawingsAspan ? "Abrir pasta Desenho ASPAN" : "Configure Desenho ASPAN em Opções para habilitar"}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Desenho ASPAN
                </Button>

                <Button
                  onClick={handleOpenDrawingFromSearch}
                  disabled={!selectedDrawingPath || openingDrawing}
                  className="bg-primary text-primary-foreground text-xs font-bold uppercase py-2 px-4 rounded-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {openingDrawing ? "Abrindo..." : "Abrir"}
                </Button>
              </div>
            </div>
          </div>
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

      {/* Relatório + KPIs (2 colunas) */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna 1 - Relatório de Atividade */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Relatório de Atividade</h3>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#F1C40F]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultados do Dia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevDay}
                    title="Dia anterior"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-md border border-border/50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDay}
                      onChange={(e) => {
                        setSelectedDay(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-muted hover:bg-muted/80 text-muted-foreground text-[10.5px] font-bold py-1 px-3 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer transition-all"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNextDay}
                    title="Próximo dia"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-md border border-border/50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {selectedDay !== getTodayISODate() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDay(getTodayISODate());
                        setCurrentPage(1);
                      }}
                      className="h-6 px-2 text-[9px] text-[#27AE60] hover:text-[#2ECC71] font-bold uppercase tracking-wider bg-[#27AE60]/10 hover:bg-[#27AE60]/20 rounded-md border border-[#27AE60]/20"
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
                      className="h-6 px-2 text-[9px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider bg-muted/40 hover:bg-muted/60 rounded-md border border-border/50"
                    >
                      Todas as datas
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded-lg border border-border flex flex-col items-center justify-center space-y-1">
                  <CheckCircle2 className="h-5 w-5 text-[#27AE60] opacity-80" />
                  <div className="text-2xl font-bold text-[#27AE60]">{okFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-muted-foreground font-medium">Corretos</div>
                </div>
                <div className="bg-muted p-3 rounded-lg border border-border flex flex-col items-center justify-center space-y-1">
                  <XCircle className="h-5 w-5 text-[#E74C3C] opacity-80" />
                  <div className="text-2xl font-bold text-[#E74C3C]">{errorFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-muted-foreground font-medium">Com Erro</div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Taxa de Sucesso
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        {totalFiles > 0 ? Math.round((okFiles / totalFiles) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Processado</span>
                      <div className="text-lg font-medium text-foreground">{totalFiles} <span className="text-xs text-muted-foreground">XMLs</span></div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-gradient-to-r from-[#27AE60] to-[#2ECC71] transition-all duration-500"
                      style={{ width: `${totalFiles > 0 ? (okFiles / totalFiles) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted p-2 rounded border border-border">
                  <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Última atividade</span>
                  <span className="text-white font-medium">{lastActivity}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2 - KPIs */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Métricas & Filtros</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {kpis.map((k: any) => {
                const isActive = filter === k.key;
                return (
                  <button
                    key={k.key}
                    onClick={() => { setFilter(k.key); setCurrentPage(1); }}
                    className={`group text-left bg-card border rounded-xl py-3 px-4 transition-all duration-300 relative overflow-hidden active:scale-95 ${isActive
                      ? "border-primary shadow-[0_0_20px_rgba(0,0,0,0.2)] dark:shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                      : "border-border hover:border-primary/20 hover:-translate-y-1"
                      }`}
                    style={{
                      borderColor: isActive ? k.color : '#2C2C2C',
                      boxShadow: isActive ? `0 0 15px ${k.color}33, inset 0 0 10px ${k.color}11` : ''
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute top-0 right-0 w-16 h-16 opacity-10 pointer-events-none"
                        style={{ background: `radial-gradient(circle at center, ${k.color} 0%, transparent 70%)` }}
                      />
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-background border border-border transition-colors duration-300 ${isActive ? 'bg-opacity-50' : 'group-hover:bg-muted'}`} style={{ color: k.color }}>
                        {React.cloneElement(k.icon as React.ReactElement, { className: "h-4 w-4" })}
                      </div>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: k.color, boxShadow: `0 0 8px ${k.color}` }} />}
                    </div>
                    <div className="space-y-0.5">
                      <div className={`text-[10px] uppercase tracking-widest font-bold transition-colors duration-300 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {k.title}
                      </div>
                      <div className="text-2xl font-bold tracking-tight text-foreground">{k.value}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Arquivos */}
      <div className="p-6 space-y-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Input
                type="text"
                placeholder="Buscar arquivo, erro, tag..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                onClear={() => { setSearch(""); setCurrentPage(1); }}
                className="w-80 bg-muted/50 border-border text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                style={{ paddingLeft: "2.5rem" }}
              />
              <Filter
                className="absolute left-3 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {bulkMoveEligible.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmBulkMoveOpen(true)}
                className="gap-2 border-emerald-700 hover:bg-emerald-900/20 text-emerald-400 text-[11px] h-7"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar 'PROBLEMA NA GERAÇÃO DE MÁQUINAS' para OK? ({bulkMoveEligible.length})
              </Button>
            )}
            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border">
              Mostrando <span className="text-foreground">{filtered.length}</span> de <span className="text-foreground">{rows.length}</span> arquivos
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest pl-6">Arquivo</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Status</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Inconformidades (Erros)</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Avisos do Sistema</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Tags</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">Data / Hora</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest text-center pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedData.map((file) => {
                const autoFixed = (file.autoFixes || []).length > 0;
                return (
                  <TableRow key={file.fullpath} className="border-border hover:bg-primary/[0.02] transition-colors group/row">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 transition-shadow duration-300 ${file.status === 'OK' ? 'bg-[#27AE60] shadow-[0_0_8px_rgba(39,174,96,0.5)]' :
                          file.status === 'ERRO' ? 'bg-[#E74C3C] shadow-[0_0_8px_rgba(231,76,60,0.5)]' :
                            'bg-[#F39C12] shadow-[0_0_8px_rgba(243,156,18,0.5)]'
                          }`} />
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-foreground group-hover/row:text-primary transition-colors truncate max-w-[280px]">
                            {file.filename}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusChip status={file.status} />
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 max-w-60">
                        {(file.errors || []).length > 0 ? (
                          (file.errors || []).map((e, i) => <ErrorBadge key={i} error={e} />)
                        ) : (
                          <span className="text-[#444] text-[10px]">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {(file.warnings || []).length > 0 ? (
                          (file.warnings || []).map((w, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[#F39C12] border-[#F39C12]/20 bg-[#F39C12]/5 text-[9px] font-bold uppercase py-0 px-2 h-5"
                            >
                              {typeof w === "string" ? w.toUpperCase() : "AVISO"}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[#444] text-[10px]">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 max-w-32">
                        {(() => {
                          const displayTags = filterTags(file.tags || []);
                          const hasTags = displayTags.length > 0 || autoFixed;
                          return hasTags ? (
                            <>
                              {autoFixed && (
                                <Badge
                                  variant="outline"
                                  className="text-[#1ABC9C] border-[#1ABC9C]/20 bg-[#1ABC9C]/5 text-[9px] font-bold uppercase py-0 px-2 h-5 flex items-center gap-1"
                                >
                                  <Zap className="h-2.5 w-2.5 text-[#1ABC9C]" /> AUTO-FIX
                                </Badge>
                              )}
                              {displayTags.map((t, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/5 text-[9px] font-bold uppercase py-0 px-2 h-5"
                                >
                                  {formatTag(t)}
                                </Badge>
                              ))}
                            </>
                          ) : (
                            <span className="text-[#444] text-[10px]">—</span>
                          );
                        })()}
                      </div>
                    </TableCell>

                    <TableCell className="text-[#888] text-[11px] font-medium whitespace-nowrap">
                      {file.timestamp || "-"}
                    </TableCell>

                    <TableCell className="text-center pr-6 py-4">
                      <div className="inline-flex gap-2 p-1.5 bg-background rounded-lg border border-border transition-colors group-hover/row:border-border/80">
                        <button
                          title="Ver detalhes"
                          onClick={() => handleFileDetail(file)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted hover:text-primary transition-all text-muted-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Abrir na pasta"
                          onClick={() => handleOpenFolder(file.fullpath)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted hover:text-primary transition-all text-muted-foreground"
                        >
                          <FolderOpen className="h-4 w-4" />
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
        <AlertDialogContent className="bg-card border border-amber-500/30">
          <AlertDialogTitle className="text-foreground">Confirmação de Limpeza</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Tem certeza que deseja limpar o Relatório de Atividade? Essa ação não pode ser desfeita.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeClearReport}
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              Sim, limpar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmExcluirOpen} onOpenChange={setConfirmExcluirOpen}>
        <AlertDialogContent className="bg-card border border-rose-500/30">
          <AlertDialogTitle className="text-foreground">Confirmação de Exclusão</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Deseja excluir fisicamente os arquivos das pastas (OK, erro, logs)? Esta ação removerá os arquivos do disco permanentemente.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeClearFolders}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Sim, excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkMoveOpen} onOpenChange={setConfirmBulkMoveOpen}>
        <AlertDialogContent className="bg-card border border-emerald-500/30">
          <AlertDialogTitle className="text-foreground">Enviar Erros de Máquinas para OK</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Deseja mover <strong className="text-foreground">{bulkMoveEligible.length}</strong> arquivo(s) que possuem <strong className="text-foreground">apenas</strong> o erro "PROBLEMA NA GERAÇÃO DE MÁQUINAS" para a pasta OK?
            <br /><br />
            <span className="text-muted-foreground/60 text-xs">Arquivos com outros erros além desse não serão movidos.</span>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkMoveToOk}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Sim, enviar para OK
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDrawingsModal
        open={batchModalOpen}
        onOpenChange={setBatchModalOpen}
        defaultMirrorPath={cfg.drawingsCopy}
      />

      <SpecialOrdersModal
        open={specialOrdersOpen}
        onOpenChange={setSpecialOrdersOpen}
        currentUser={currentUser}
        specialOrders={specialOrders}
        onRefresh={checkSpecialOrdersUpdates}
      />

      {/* toasts */}
    </div>
  );
}
