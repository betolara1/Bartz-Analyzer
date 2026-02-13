// src/components/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { StatusChip, type Status } from "./StatusChip";
import { ErrorBadge } from "./ErrorBadge";
import {
  CheckCircle, XCircle, Package, Grid3X3, Zap, Filter,
  Play, Pause, RefreshCw, Calendar, Save,
  AlertTriangle, Eye, FolderOpen, BarChart3, AlertCircle, Download, Check,
  ArrowRightLeft, ListTodo, FileText, CheckCircle2, TrendingUp, Activity
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import FileDetailDrawer from "./FileDetailDrawer";

// tipos
type Row = {
  filename: string;
  fullpath: string;
  status?: Status;
  errors?: string[];
  autoFixes?: string[];
  warnings?: string[];
  tags?: string[];
  timestamp?: string;
  meta?: {
    ferragensOnly?: boolean;
    machines?: { id: string; name?: string }[];
    [k: string]: any;
  };
  initialStatus?: Status;
  history?: string[];
  initialErrors?: string[];
};

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
    timestamp: new Date().toLocaleString(),
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
// helper para “Curvo” (fora do toRow!)
const hasCurvo = (r: Row) =>
  (r.tags || []).includes("curvo") ||
  (r.warnings || []).some(w => /curvo/i.test(String(w)));

export default function Dashboard() {
  // tabela / filtros
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<"all" | "ok" | "erro" | "ferragens" | "muxarabi" | "coringa" | "curvo" | "duplado37mm" | "autofix" | "sem_codigo">("all");

  // controle do watcher
  const [monitoring, setMonitoring] = useState(false);
  const [watchRoot, setWatchRoot] = useState<string | null>(null);

  // caminhos (+ flag do Auto-fix)
  const [cfg, setCfg] = useState({
    entrada: "",
    exportacao: "",
    ok: "",
    erro: "",
    logsErrors: "",
    logsProcessed: "",
    drawings: "",
    enableAutoFix: true,
  });
  const pickFolderOptions = ["entrada", "exportacao", "ok", "erro", "logsErrors", "logsProcessed", "drawings"] as const;
  const [probe, setProbe] = useState<any>({});

  // resultado de teste (todos)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  // drawer de detalhes
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Row | null>(null);

  // confirmações
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false);

  const mounted = useRef(true);
  const isConnected = !!(window as any).electron?.analyzer;

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

    (window as any).electron?.settings?.load?.()
      .then((sv: any) => sv && setCfg((c) => ({ ...c, ...sv, enableAutoFix: true })));

    (window as any).electron?.analyzer?.onEvent?.((msg: any) => {
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
        setDetailData((prev) => (prev && prev.fullpath === row.fullpath ? row : prev));

        notifyFromPayload(payload);
        return;
      }
      if (evt === "error") {
        toast.error(payload?.message || "Erro no verificador");
      }
    });

    return () => { mounted.current = false; };
  }, []);

  // KPIs
  const resumo = useMemo(() => {
    const ok = rows.filter((r) => r.status === "OK").length;
    const erro = rows.filter((r) => r.status === "ERRO").length;
    const onlyFerr = rows.filter((r) => r.status === "FERRAGENS-ONLY").length;
    const mux = rows.filter((r) => (r.tags || []).includes("muxarabi")).length;
    const auto = rows.filter((r) => (r.autoFixes || []).length > 0).length;
    const cor = rows.filter((r) => (r.tags || []).includes("coringa")).length;
    const curvo = rows.filter(hasCurvo).length;
    const dup37 = rows.filter((r) => (r.tags || []).includes("duplado37mm")).length;
    const semCod = rows.filter((r) => (r.tags || []).includes("sem_codigo")).length;
    return { ok, erro, onlyFerr, mux, auto, cor, curvo, dup37, semCod };
  }, [rows]);

  const kpis = [
    { key: "all", title: "Todos", value: rows.length, icon: <Filter className="h-5 w-5" />, color: "#3498DB" },
    { key: "ok", title: "Corretos", value: resumo.ok, icon: <CheckCircle className="h-5 w-5" />, color: "#27AE60" },
    { key: "erro", title: "Inconformidades", value: resumo.erro, icon: <XCircle className="h-5 w-5" />, color: "#E74C3C" },
    { key: "ferragens", title: "Ferragens-only", value: resumo.onlyFerr, icon: <Package className="h-5 w-5" />, color: "#F39C12" },
    { key: "muxarabi", title: "Muxarabi", value: resumo.mux, icon: <Grid3X3 className="h-5 w-5" />, color: "#9B59B6" },
    { key: "coringa", title: "Cor Coringa", value: resumo.cor, icon: <Grid3X3 className="h-5 w-5" />, color: "#E67E22" },
    { key: "duplado37mm", title: "Duplado 37MM", value: resumo.dup37, icon: <AlertTriangle className="h-5 w-5" />, color: "#C0392B" },
    { key: "sem_codigo", title: "Sem Código", value: resumo.semCod, icon: <AlertCircle className="h-5 w-5" />, color: "#E74C3C" },
    { key: "autofix", title: "Auto-fixed", value: resumo.auto, icon: <Zap className="h-5 w-5" />, color: "#1ABC9C" },
    { key: "curvo", title: "Curvo", value: resumo.curvo, icon: <Grid3X3 className="h-5 w-5" />, color: "#ee5700ff" },
  ] as const;

  const filtered = rows
    .filter((r) => r.filename.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => {
      if (filter === "all") return true;
      if (filter === "ok") return r.status === "OK";
      if (filter === "erro") return r.status === "ERRO";
      if (filter === "ferragens") return r.status === "FERRAGENS-ONLY" || (r.tags || []).includes("ferragens");
      if (filter === "muxarabi") return (r.tags || []).includes("muxarabi");
      if (filter === "coringa") return (r.tags || []).includes("coringa");
      if (filter === "duplado37mm") return (r.tags || []).includes("duplado37mm");
      if (filter === "sem_codigo") return (r.tags || []).includes("sem_codigo");
      if (filter === "autofix") return (r.autoFixes || []).length > 0;
      if (filter === "curvo") return hasCurvo(r);
      return true;
    });

  // ===== helpers/ações =====
  function setPaths(patch: Partial<typeof cfg>) { setCfg(prev => ({ ...prev, ...patch })); }

  // abrir seletor de pasta e preencher o campo
  async function pickFolder(
    key: "entrada" | "exportacao" | "ok" | "erro" | "logsErrors" | "logsProcessed" | "drawings"
  ) {
    try {
      const current = (cfg as any)[key] || "";
      const chosen = await (window as any).electron?.settings?.pickFolder?.(current);
      if (chosen) setPaths({ [key]: chosen } as any);
    } catch { }
  }

  // testar acesso de TODOS os paths
  async function testAllAccess() {
    try {
      setTestResults({ entrada: null, exportacao: null, ok: null, erro: null, logsErrors: null, logsProcessed: null, drawings: null });

      const res = await (window as any).electron?.settings?.testPaths?.(cfg);
      setProbe(res || {});
      setTestResults({
        entrada: !!res?.entrada?.write,
        exportacao: !!res?.exportacao?.write,
        ok: !!res?.ok?.write,
        erro: !!res?.erro?.write,
        logsErrors: !!res?.logsErrors?.write,
        logsProcessed: !!res?.logsProcessed?.write,
        drawings: !!res?.drawings?.write,
      });
    } catch {
      setTestResults({ entrada: false, exportacao: false, ok: false, erro: false, logsErrors: false, logsProcessed: false, drawings: false });
    }
  }

  async function savePaths() { await (window as any).electron?.settings?.save?.(cfg); await testAllAccess(); }
  async function start() {
    const ok = await (window as any).electron?.analyzer?.start?.(cfg);
    if (!ok) toast.error("Confira os caminhos e permissões.");
  }
  async function stop() { await (window as any).electron?.analyzer?.stop?.(); }
  async function scan() { await (window as any).electron?.analyzer?.scanOnce?.(); }

  async function clearReport() {
    setConfirmClearOpen(true);
  }

  async function executeClearReport() {
    setConfirmClearOpen(false);
    setRows([]);
    setSearch("");
    setFilter("all");
    setDetailOpen(false);
    setDetailData(null);
    toast.success("Relatório de Atividade limpo com sucesso!");
  }

  async function handleClearFolders() {
    setConfirmExcluirOpen(true);
  }

  async function executeClearFolders() {
    setConfirmExcluirOpen(false);
    const id = toast.loading("Excluindo arquivos...");
    try {
      const res = await (window as any).electron?.analyzer?.clearFolders?.();
      if (res?.ok) {
        toast.success(`Arquivos removidos com sucesso: ${res.count || 0}`);
        scan();
      } else {
        toast.error(`Falha ao remover: ${res?.message || "erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      toast.dismiss(id);
    }
  }

  async function exportReport() {
    const toastId = toast.loading("Exportando relatório...");
    try {
      const okFiles = rows.filter(r => r.status === "OK").length;
      const errorFiles = rows.filter(r => r.status === "ERRO").length;

      const reportData = {
        rows,
        totalFiles: rows.length,
        okFiles,
        errorFiles
      };

      const result = await (window as any).electron?.analyzer?.exportReport?.(reportData);

      if (result?.ok) {
        toast.dismiss(toastId);
        toast.success(`Relatório exportado com sucesso!\n${result.filesCount} arquivo(s) processado(s)`, {
          duration: 5000,
          description: `Arquivo: Relatorio_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`
        });
      } else {
        toast.dismiss(toastId);
        toast.error(result?.message || "Erro ao exportar relatório");
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(`Erro ao exportar: ${String(e?.message || e)}`);
    }
  }

  async function handleOpenFolder(fullPath: string) {
    try {
      const ok = await (window as any).electron?.analyzer?.openInFolder?.(fullPath);
      if (ok) toast.info("Abrindo pasta do arquivo…");
      else toast.warning("Não consegui abrir a pasta desse arquivo.");
    } catch (e: any) {
      toast.error(`Falha ao abrir pasta: ${String(e?.message || e)}`);
    }
  }

  async function reprocessOne(fullPath: string) {
    const id = toast.loading("Processando arquivo…");
    try {
      const ok = await (window as any).electron?.analyzer?.reprocessOne?.(fullPath);
      if (ok) toast.success("Arquivo processado — reavaliado e movido se necessário.");
      else toast.warning("Tentei reprocessar, mas não houve alteração.");
    } catch (e: any) {
      toast.error(`Erro ao reprocessar: ${String(e?.message || e)}`);
    } finally {
      toast.dismiss(id);
    }
  }

  async function handleManualAction(fullpath: string, action: string) {
    setRows((prev) => {
      const idx = prev.findIndex(r => r.fullpath === fullpath);
      if (idx < 0) return prev;
      const copy = [...prev];
      const row = { ...copy[idx] };
      const timePrefix = new Date().toLocaleTimeString('pt-BR');
      row.history = [...(row.history || []), `[${timePrefix}] ${action}`];
      copy[idx] = row;
      // Se for o arquivo que está aberto no detalhe, atualiza ele também
      setDetailData(prevData => (prevData && prevData.fullpath === fullpath ? row : prevData));
      return copy;
    });
  }

  function handleFileDetail(file: Row) {
    setDetailData(file);
    setDetailOpen(true);
  }

  function handleFileMoved(oldPath: string, newPath: string) {
    setRows(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(r => r.fullpath === oldPath);
      if (idx !== -1) {
        copy[idx] = {
          ...copy[idx],
          fullpath: newPath,
          filename: newPath.split(/[\\/]/).pop() || copy[idx].filename,
          status: "OK",
          errors: [],
          // Remove tag de erro se existir
          tags: (copy[idx].tags || []).filter(t => t.toLowerCase() !== "duplado 37mm" && t.toLowerCase() !== "duplado37mm"),
        };
      }
      return copy;
    });
  }

  // métricas p/ card lateral
  const totalFiles = rows.length;
  const okFiles = rows.filter(r => r.status === "OK").length;
  const errorFiles = rows.filter(r => r.status === "ERRO").length;
  const ferragensFiles = rows.filter(r => r.status === "FERRAGENS-ONLY" || (r.tags || []).includes("ferragens")).length;
  const autoFixedFiles = rows.filter(r => (r.autoFixes || []).length > 0).length;
  const lastActivity = rows[0]?.timestamp ?? "--:--";

  // ---- UI ----
  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Header */}
      <div className="border-b border-[#2C2C2C] bg-[#1B1B1B] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[#F1C40F] rounded flex items-center justify-center text-black font-bold">B</div>
          <div>
            <div className="text-lg font-semibold">Bartz Verificador XML</div>
            {watchRoot && <div className="text-xs opacity-70">Monitorando: {watchRoot}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!monitoring ? (
            <Button onClick={start} className="gap-2 bg-[#27AE60] hover:bg-[#27AE60]/90"><Play className="h-4 w-4" /> Iniciar</Button>
          ) : (
            <Button onClick={stop} className="gap-2 bg-[#E74C3C] hover:bg-[#E74C3C]/90"><Pause className="h-4 w-4" /> Parar</Button>
          )}
          <Button variant="outline" onClick={exportReport} className="gap-2 border-blue-700 hover:bg-blue-900/20 text-blue-400"><Download className="h-4 w-4" /> Exportar</Button>
          <Button variant="outline" onClick={clearReport} className="gap-2 border-amber-700 hover:bg-amber-900/20 text-amber-400"><AlertCircle className="h-4 w-4" /> Limpar</Button>
          <Button variant="outline" onClick={handleClearFolders} className="gap-2 border-red-700 hover:bg-red-900/20 text-red-500"><XCircle className="h-4 w-4" /> Excluir arquivos</Button>
        </div>
      </div>

      {/* Caminhos + Relatório (2 colunas) */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna 1 - Caminhos de Rede */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[#A7A7A7]">Caminhos de Rede</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${monitoring ? "bg-[#27AE60]" : "bg-[#E74C3C]"}`} />
                <span className="text-xs text-[#A7A7A7]">{monitoring ? "Monitoramento Ativo" : "Monitoramento Parado"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Grupo 1: Origem & Destino */}
              <div className="bg-[#1B1B1B] rounded-xl border border-[#2C2C2C] p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[#2C2C2C] pb-2 mb-2">
                  <ArrowRightLeft className="h-4 w-4 text-[#3498DB]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#3498DB]">Origem & Destino</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ENTRADA */}
                  <div className="space-y-2">
                    <Label htmlFor="entrada" className="text-[#A7A7A7] text-xs">Pasta de Entrada</Label>
                    <div className="flex gap-2">
                      <Input
                        id="entrada"
                        value={cfg.entrada}
                        onChange={(e) => setPaths({ entrada: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1 focus:border-[#3498DB]"
                        placeholder="\\servidor\share\entrada"
                      />
                      <Button
                        variant="outline" size="sm" title="Escolher pasta"
                        onClick={() => pickFolder("entrada")}
                        className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                    {testResults["entrada"] === true && <p className="text-[#27AE60] text-[10px] flex items-center gap-1"><Check className="h-3 w-3" /> acesso confirmado</p>}
                    {testResults["entrada"] === false && <p className="text-[#E74C3C] text-[10px] flex items-center gap-1"><XCircle className="h-3 w-3" /> erro / sem acesso</p>}
                  </div>

                  {/* EXPORTACAO */}
                  <div className="space-y-2">
                    <Label htmlFor="exportacao" className="text-[#A7A7A7] text-xs">Pasta de Exportação</Label>
                    <div className="flex gap-2">
                      <Input
                        id="exportacao"
                        value={cfg.exportacao}
                        onChange={(e) => setPaths({ exportacao: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1 focus:border-[#3498DB]"
                        placeholder="\\servidor\share\exportacao"
                      />
                      <Button
                        variant="outline" size="sm" title="Escolher pasta"
                        onClick={() => pickFolder("exportacao")}
                        className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                    {testResults["exportacao"] === true && <p className="text-[#27AE60] text-[10px] flex items-center gap-1"><Check className="h-3 w-3" /> acesso confirmado</p>}
                    {testResults["exportacao"] === false && <p className="text-[#E74C3C] text-[10px] flex items-center gap-1"><XCircle className="h-3 w-3" /> erro / sem acesso</p>}
                  </div>
                </div>
              </div>

              {/* Grupo 2: Resultados */}
              <div className="bg-[#1B1B1B] rounded-xl border border-[#2C2C2C] p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[#2C2C2C] pb-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-[#27AE60]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#27AE60]">Resultados & Desenhos</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* OK */}
                  <div className="space-y-2">
                    <Label htmlFor="ok" className="text-[#A7A7A7] text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#27AE60]" /> Pasta Final - OK</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ok"
                        value={cfg.ok}
                        onChange={(e) => setPaths({ ok: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => pickFolder("ok")} className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* ERRO */}
                  <div className="space-y-2">
                    <Label htmlFor="erro" className="text-[#A7A7A7] text-xs flex items-center gap-1"><XCircle className="h-3 w-3 text-[#E74C3C]" /> Pasta Final - Erro</Label>
                    <div className="flex gap-2">
                      <Input
                        id="erro"
                        value={cfg.erro}
                        onChange={(e) => setPaths({ erro: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => pickFolder("erro")} className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* DRAWINGS */}
                  <div className="space-y-2">
                    <Label htmlFor="drawings" className="text-[#A7A7A7] text-xs flex items-center gap-1"><FileText className="h-3 w-3 text-[#F1C40F]" /> Pasta de Desenhos</Label>
                    <div className="flex gap-2">
                      <Input
                        id="drawings"
                        value={cfg.drawings}
                        onChange={(e) => setPaths({ drawings: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => pickFolder("drawings")} className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupo 3: Registros */}
              <div className="bg-[#1B1B1B] rounded-xl border border-[#2C2C2C] p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[#2C2C2C] pb-2 mb-2">
                  <ListTodo className="h-4 w-4 text-[#9B59B6]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9B59B6]">Registros (Logs)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LOGS ERRORS */}
                  <div className="space-y-2">
                    <Label htmlFor="logsErrors" className="text-[#A7A7A7] text-xs">Logs - Errors</Label>
                    <div className="flex gap-2">
                      <Input
                        id="logsErrors"
                        value={cfg.logsErrors}
                        onChange={(e) => setPaths({ logsErrors: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => pickFolder("logsErrors")} className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* LOGS PROCESSED */}
                  <div className="space-y-2">
                    <Label htmlFor="logsProcessed" className="text-[#A7A7A7] text-xs">Logs - Processed</Label>
                    <div className="flex gap-2">
                      <Input
                        id="logsProcessed"
                        value={cfg.logsProcessed}
                        onChange={(e) => setPaths({ logsProcessed: e.target.value })}
                        className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => pickFolder("logsProcessed")} className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0">
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={testAllAccess} className="gap-2 border-[#2C2C2C] bg-[#1B1B1B] hover:bg-[#2C2C2C] text-xs h-9">
                  <RefreshCw className="h-3.5 w-3.5" /> Testar acesso
                </Button>
                <Button variant="outline" onClick={savePaths} className="gap-2 border-[#2C2C2C] bg-[#1B1B1B] hover:bg-[#2C2C2C] text-xs h-9">
                  <Save className="h-3.5 w-3.5" /> Salvar padrão
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-[#A7A7A7] flex items-center gap-2 cursor-pointer select-none border border-[#2C2C2C] rounded-md px-3 h-9 bg-[#1B1B1B]">
                  <input
                    type="checkbox"
                    checked={true}
                    readOnly
                    className="accent-[#27AE60] h-3.5 w-3.5"
                  />
                  <span>Auto-fix Ativo</span>
                </label>

                {!monitoring ? (
                  <Button onClick={start} className="gap-2 bg-[#27AE60] hover:bg-[#27AE60]/90 h-9 px-4 text-xs font-semibold">
                    <Play className="h-3.5 w-3.5" /> Iniciar Monitoramento
                  </Button>
                ) : (
                  <Button onClick={stop} className="gap-2 bg-[#E74C3C] hover:bg-[#E74C3C]/90 h-9 px-4 text-xs font-semibold">
                    <Pause className="h-3.5 w-3.5" /> Parar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2 - Relatório de Atividade */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-[#A7A7A7] mb-1">Relatório de Atividade</h3>

            <div className="bg-[#1B1B1B] rounded-xl border border-[#2C2C2C] p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#F1C40F]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#A7A7A7]">Resultados do Dia</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-[#2C2C2C] text-[#A7A7A7]">
                  Hoje, {new Date().toLocaleDateString('pt-BR')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111111] p-3 rounded-lg border border-[#232323] flex flex-col items-center justify-center space-y-1">
                  <CheckCircle2 className="h-5 w-5 text-[#27AE60] opacity-80" />
                  <div className="text-2xl font-bold text-[#27AE60]">{okFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-[#A7A7A7] font-medium">Corretos</div>
                </div>
                <div className="bg-[#111111] p-3 rounded-lg border border-[#232323] flex flex-col items-center justify-center space-y-1">
                  <XCircle className="h-5 w-5 text-[#E74C3C] opacity-80" />
                  <div className="text-2xl font-bold text-[#E74C3C]">{errorFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-[#A7A7A7] font-medium">Com Erro</div>
                </div>
                <div className="bg-[#111111] p-3 rounded-lg border border-[#232323] flex flex-col items-center justify-center space-y-1">
                  <Package className="h-5 w-5 text-[#F39C12] opacity-80" />
                  <div className="text-2xl font-bold text-[#F39C12]">{ferragensFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-[#A7A7A7] font-medium">Ferragens</div>
                </div>
                <div className="bg-[#111111] p-3 rounded-lg border border-[#232323] flex flex-col items-center justify-center space-y-1">
                  <Zap className="h-5 w-5 text-[#1ABC9C] opacity-80" />
                  <div className="text-2xl font-bold text-[#1ABC9C]">{autoFixedFiles}</div>
                  <div className="text-[10px] uppercase tracking-tighter text-[#A7A7A7] font-medium">Auto-fix</div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#A7A7A7] font-semibold flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Taxa de Sucesso
                      </span>
                      <span className="text-2xl font-bold text-white">
                        {totalFiles > 0 ? Math.round(((okFiles + ferragensFiles) / totalFiles) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-[#A7A7A7] font-semibold">Total Processado</span>
                      <div className="text-lg font-medium text-white">{totalFiles} <span className="text-xs text-[#A7A7A7]">XMLs</span></div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-[#111111] rounded-full overflow-hidden border border-[#232323]">
                    <div
                      className="h-full bg-gradient-to-r from-[#27AE60] to-[#2ECC71] transition-all duration-500"
                      style={{ width: `${totalFiles > 0 ? ((okFiles + ferragensFiles) / totalFiles) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A7A7A7] bg-[#111111] p-2 rounded border border-[#232323]">
                  <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Última atividade</span>
                  <span className="text-white font-medium">{lastActivity}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* KPIs + Tabela */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {kpis.map((k: any) => {
            const isActive = filter === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setFilter(k.key)}
                className={`group text-left bg-[#1B1B1B] border rounded-xl p-4 transition-all duration-300 relative overflow-hidden active:scale-95 ${isActive
                  ? "border-opacity-100 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                  : "border-[#2C2C2C] hover:border-white/20 hover:-translate-y-1"
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
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-[#111] border border-[#232323] transition-colors duration-300 ${isActive ? 'bg-opacity-50' : 'group-hover:bg-[#222]'}`} style={{ color: k.color }}>
                    {React.cloneElement(k.icon as React.ReactElement, { className: "h-4 w-4" })}
                  </div>
                  {isActive && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: k.color, boxShadow: `0 0 8px ${k.color}` }} />}
                </div>
                <div className="space-y-0.5">
                  <div className={`text-[10px] uppercase tracking-widest font-bold transition-colors duration-300 ${isActive ? 'text-white' : 'text-[#A7A7A7]'}`}>
                    {k.title}
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white">{k.value}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Input
                placeholder="Buscar arquivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-80 bg-[#161616] border-[#2C2C2C] text-sm focus:border-[#3498DB] focus:ring-1 focus:ring-[#3498DB]/20 transition-all"
              />
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A7A7A7] group-focus-within:text-[#3498DB] transition-colors" />
            </div>
            <div className="flex items-center gap-2 text-[#A7A7A7] bg-[#1B1B1B] px-3 py-1.5 rounded-lg border border-[#2C2C2C]">
              <Calendar className="h-3.5 w-3.5" /> <span className="text-xs font-medium">Últimas 24h</span>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#666] bg-[#161616] px-3 py-1 rounded-full border border-[#232323]">
            Mostrando <span className="text-white">{filtered.length}</span> de <span className="text-white">{rows.length}</span> arquivos
          </div>
        </div>

        <div className="bg-[#161616] border border-[#232323] rounded-xl overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-[#1B1B1B]/50">
              <TableRow className="border-[#232323] hover:bg-transparent">
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest pl-6">Arquivo</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Status</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Inconformidades (Erros)</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest text-center">Auto-fix</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Avisos do Sistema</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest">Tags</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">Data / Hora</TableHead>
                <TableHead className="text-[#666] text-[10px] uppercase font-bold tracking-widest text-center pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((file) => {
                const autoFixed = (file.autoFixes || []).length > 0;
                return (
                  <TableRow key={file.fullpath} className="border-[#232323] hover:bg-white/[0.02] transition-colors group/row">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 transition-shadow duration-300 ${file.status === 'OK' ? 'bg-[#27AE60] shadow-[0_0_8px_rgba(39,174,96,0.5)]' :
                          file.status === 'ERRO' ? 'bg-[#E74C3C] shadow-[0_0_8px_rgba(231,76,60,0.5)]' :
                            'bg-[#F39C12] shadow-[0_0_8px_rgba(243,156,18,0.5)]'
                          }`} />
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-white group-hover/row:text-[#3498DB] transition-colors truncate max-w-[280px]">
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

                    <TableCell className="text-center">
                      {autoFixed ? (
                        <div className="flex justify-center">
                          <div className="h-6 w-6 rounded-lg bg-[#1ABC9C]/10 border border-[#1ABC9C]/20 flex items-center justify-center shadow-[0_0_15px_rgba(26,188,156,0.1)] group-hover/row:border-[#1ABC9C]/40 transition-all">
                            <Zap className="h-3.5 w-3.5 text-[#1ABC9C]" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#444]">—</span>
                      )}
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
                        {(file.tags || []).length > 0 ? (
                          (file.tags || []).map((t, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/5 text-[9px] font-bold uppercase py-0 px-2 h-5"
                            >
                              {formatTag(t)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[#444] text-[10px]">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-[#888] text-[11px] font-medium whitespace-nowrap">
                      {file.timestamp || "-"}
                    </TableCell>

                    <TableCell className="text-center pr-6 py-4">
                      <div className="inline-flex gap-2 p-1.5 bg-[#111] rounded-lg border border-[#232323] transition-colors group-hover/row:border-[#2C2C2C]">
                        <button
                          title="Ver detalhes"
                          onClick={() => handleFileDetail(file)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-[#222] hover:text-[#3498DB] transition-all text-[#A7A7A7]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Abrir na pasta"
                          onClick={() => handleOpenFolder(file.fullpath)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-[#222] hover:text-[#F1C40F] transition-all text-[#A7A7A7]"
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
      </div>

      {/* Drawer de detalhes */}
      <FileDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={detailData}
        onFileMoved={handleFileMoved}
        onAction={handleManualAction}
      />

      {/* CONFIRMAÇÕES */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-amber-500/30">
          <AlertDialogTitle className="text-white">Confirmação de Limpeza</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Tem certeza que deseja limpar o Relatório de Atividade? Essa ação não pode ser desfeita.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600 border-none">Cancelar</AlertDialogCancel>
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
        <AlertDialogContent className="bg-[#1a1a1a] border border-rose-500/30">
          <AlertDialogTitle className="text-white">Confirmação de Exclusão</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Deseja excluir fisicamente os arquivos das pastas (OK, erro, logs)? Esta ação removerá os arquivos do disco permanentemente.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeClearFolders}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Sim, excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* toasts */}
      <Toaster richColors position="bottom-left" closeButton />
    </div>
  );
}
