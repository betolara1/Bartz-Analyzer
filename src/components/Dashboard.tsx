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
  AlertTriangle, Eye, FolderOpen, BarChart3, AlertCircle, Download,
} from "lucide-react";
import { Toaster, toast } from "sonner";
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
    meta: p?.meta || {}, // <<< importante
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
    useState<"all" | "ok" | "erro" | "ferragens" | "muxarabi" | "coringa" | "curvo" | "duplado37mm" | "autofix">("all");

  // controle do watcher
  const [monitoring, setMonitoring] = useState(false);
  const [watchRoot, setWatchRoot] = useState<string | null>(null);

  // caminhos (+ flag do Auto-fix)
  const [cfg, setCfg] = useState({
    entrada: "",
    working: "",
    ok: "",
    erro: "",
    logsErrors: "",
    logsProcessed: "",
    drawings: "",
    enableAutoFix: false,
  });
  const pickFolderOptions = ["entrada", "working", "ok", "erro", "logsErrors", "logsProcessed", "drawings"] as const;
  const [probe, setProbe] = useState<any>({});

  // resultado de teste (todos)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  // drawer de detalhes
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Row | null>(null);

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
      .then((sv: any) => sv && setCfg((c) => ({ ...c, ...sv })));

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
          const i = prev.findIndex((r) => r.fullpath === row.fullpath);
          if (i >= 0) {
            const copy = prev.slice();
            copy[i] = row;
            return copy;
          }
          // When file moves from ERRO to OK, remove the old ERRO entry
          // by checking if we have the same filename in ERRO folder
          const baseName = row.filename;
          const filtered = prev.filter((r) => {
            const sameFile = r.filename === baseName;
            const isInErroFolder = r.fullpath.toLowerCase().includes('\\erro\\') || r.fullpath.toLowerCase().includes('/erro/');
            // If this is OK status and we find same file in ERRO folder, remove it
            if (row.status === 'OK' && sameFile && isInErroFolder) {
              console.log(`[Dashboard] Removing old ERRO entry: ${r.fullpath}`);
              return false;
            }
            return true;
          });
          return [row, ...filtered];
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
    return { ok, erro, onlyFerr, mux, auto, cor, curvo, dup37 };
  }, [rows]);

  const kpis = [
    { key: "all", title: "Todos", value: rows.length, icon: <Filter className="h-5 w-5" />, color: "#3498DB" },
    { key: "ok", title: "Corretos", value: resumo.ok, icon: <CheckCircle className="h-5 w-5" />, color: "#27AE60" },
    { key: "erro", title: "Inconformidades", value: resumo.erro, icon: <XCircle className="h-5 w-5" />, color: "#E74C3C" },
    { key: "ferragens", title: "Ferragens-only", value: resumo.onlyFerr, icon: <Package className="h-5 w-5" />, color: "#F39C12" },
    { key: "muxarabi", title: "Muxarabi", value: resumo.mux, icon: <Grid3X3 className="h-5 w-5" />, color: "#9B59B6" },
    { key: "coringa", title: "Cor Coringa", value: resumo.cor, icon: <Grid3X3 className="h-5 w-5" />, color: "#E67E22" },
    { key: "duplado37mm", title: "Duplado 37MM", value: resumo.dup37, icon: <AlertTriangle className="h-5 w-5" />, color: "#C0392B" },
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
      if (filter === "autofix") return (r.autoFixes || []).length > 0;
      if (filter === "curvo") return hasCurvo(r);
      return true;
    });

  // ===== helpers/ações =====
  function setPaths(patch: Partial<typeof cfg>) { setCfg(prev => ({ ...prev, ...patch })); }

  // abrir seletor de pasta e preencher o campo
  async function pickFolder(
    key: "entrada" | "working" | "ok" | "erro" | "logsErrors" | "logsProcessed" | "drawings"
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
      setTestResults({ entrada: null, working: null, ok: null, erro: null, logsErrors: null, logsProcessed: null, drawings: null });

      const res = await (window as any).electron?.settings?.testPaths?.(cfg);
      setProbe(res || {});
      setTestResults({
        entrada: !!res?.entrada?.write,
        working: !!res?.working?.write,
        ok: !!res?.ok?.write,
        erro: !!res?.erro?.write,
        logsErrors: !!res?.logsErrors?.write,
        logsProcessed: !!res?.logsProcessed?.write,
        drawings: !!res?.drawings?.write,
      });
    } catch {
      setTestResults({ entrada: false, working: false, ok: false, erro: false, logsErrors: false, logsProcessed: false, drawings: false });
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
    const confirmed = await new Promise<boolean>((resolve) => {
      const id = toast.custom((t) => (
        <div className="bg-amber-900/90 border border-amber-700 rounded-lg p-4 text-white">
          <div className="font-semibold mb-3">Tem certeza que deseja limpar o Relatório de Atividade?</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                toast.dismiss(t);
                resolve(true);
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
            >
              Sim, limpar
            </button>
            <button
              onClick={() => {
                toast.dismiss(t);
                resolve(false);
              }}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    });

    if (confirmed) {
      setRows([]);
      setSearch("");
      setFilter("all");
      setDetailOpen(false);
      setDetailData(null);
      toast.success("Relatório de Atividade limpo com sucesso!");
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
          <Button variant="outline" onClick={scan} className="gap-2 border-[#2C2C2C] hover:bg-[#2C2C2C]"><RefreshCw className="h-4 w-4" /> Reanalisar tudo</Button>
          <Button variant="outline" onClick={exportReport} className="gap-2 border-blue-700 hover:bg-blue-900/20 text-blue-400"><Download className="h-4 w-4" /> Exportar</Button>
          <Button variant="outline" onClick={clearReport} className="gap-2 border-amber-700 hover:bg-amber-900/20 text-amber-400"><AlertCircle className="h-4 w-4" /> Limpar</Button>
        </div>
      </div>

      {/* Caminhos + Relatório (2 colunas) */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna 1 - Caminhos de Rede */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[#A7A7A7] mb-1">Caminhos de Rede</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* ENTRADA */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="entrada" className="text-white text-sm">Pasta de Entrada</Label>
                <div className="flex gap-2">
                  <Input
                    id="entrada"
                    value={cfg.entrada}
                    onChange={(e) => setPaths({ entrada: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button
                    variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("entrada")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                {testResults["entrada"] === true && (
                  <p className="text-[#27AE60] text-xs">acesso confirmado</p>
                )}
                {testResults["entrada"] === false && (
                  <p className="text-[#E74C3C] text-xs">erro / sem acesso</p>
                )}
              </div>

              {/* WORKING */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="working" className="text-white text-sm">Pasta de Trabalho (Working)</Label>
                <div className="flex gap-2">
                  <Input
                    id="working"
                    value={cfg.working}
                    onChange={(e) => setPaths({ working: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button
                    variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("working")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                {testResults["working"] === true && (
                  <p className="text-[#27AE60] text-xs">acesso confirmado</p>
                )}
                {testResults["working"] === false && (
                  <p className="text-[#E74C3C] text-xs">erro / sem acesso</p>
                )}
              </div>

              {/* OK */}
              <div className="space-y-2">
                <Label htmlFor="ok" className="text-white text-sm">Pasta Final - OK</Label>
                <div className="flex gap-2">
                  <Input
                    id="ok"
                    value={cfg.ok}
                    onChange={(e) => setPaths({ ok: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("ok")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ERRO */}
              <div className="space-y-2">
                <Label htmlFor="erro" className="text-white text-sm">Pasta Final - Erro</Label>
                <div className="flex gap-2">
                  <Input
                    id="erro"
                    value={cfg.erro}
                    onChange={(e) => setPaths({ erro: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("erro")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* DRAWINGS */}
              <div className="space-y-2">
                <Label htmlFor="drawings" className="text-white text-sm">Pasta de Desenhos</Label>
                <div className="flex gap-2">
                  <Input
                    id="drawings"
                    value={cfg.drawings}
                    onChange={(e) => setPaths({ drawings: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("drawings")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* LOGS ERRORS */}
              <div className="space-y-2">
                <Label htmlFor="logsErrors" className="text-white text-sm">Logs - Errors</Label>
                <div className="flex gap-2">
                  <Input
                    id="logsErrors"
                    value={cfg.logsErrors}
                    onChange={(e) => setPaths({ logsErrors: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("logsErrors")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* LOGS PROCESSED */}
              <div className="space-y-2">
                <Label htmlFor="logsProcessed" className="text-white text-sm">Logs - Processed</Label>
                <div className="flex gap-2">
                  <Input
                    id="logsProcessed"
                    value={cfg.logsProcessed}
                    onChange={(e) => setPaths({ logsProcessed: e.target.value })}
                    className="bg-[#111111] border-[#2C2C2C] text-white text-sm flex-1"
                    placeholder="\\\\servidor\\share\\pasta"
                  />
                  <Button variant="outline" size="sm" title="Escolher pasta"
                    onClick={() => pickFolder("logsProcessed")}
                    className="border-[#2C2C2C] hover:bg-[#2C2C2C] shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={testAllAccess} className="gap-2 border-[#2C2C2C]">
                Testar acesso (todos)
              </Button>
              <Button variant="outline" onClick={savePaths} className="gap-2 border-[#2C2C2C]">
                <Save className="h-4 w-4" /> Salvar como padrão
              </Button>
              {!monitoring ? (
                <Button onClick={start} className="gap-2 bg-[#27AE60] hover:bg-[#27AE60]/90">
                  <Play className="h-4 w-4" /> Iniciar com esses paths
                </Button>
              ) : (
                <Button onClick={stop} className="gap-2 bg-[#E74C3C] hover:bg-[#E74C3C]/90">
                  <Pause className="h-4 w-4" /> Parar
                </Button>
              )}
            </div>

            {/* Toggle Auto-fix */}
            <div className="flex items-center gap-3 mt-2">
              <label className="text-sm text-[#A7A7A7] flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!(cfg as any).enableAutoFix}
                  onChange={(e) => setCfg(prev => ({ ...prev, enableAutoFix: e.target.checked }))}
                />
                <span className="text-white">
                  Auto-fix (trocar preço 0→0.10 • quantidade 0→1)
                </span>
              </label>
            </div>
          </div>

          {/* Coluna 2 - Relatório de Atividade */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[#A7A7A7] mb-1">Relatório de Atividade</h3>

            <div className="bg-[#111111] rounded-lg border border-[#2C2C2C] p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[#F1C40F]" />
                <span className="text-sm font-medium text-white">Arquivos Processados Hoje</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-medium text-[#27AE60]">{okFiles}</div>
                  <div className="text-xs text-[#A7A7A7]">Corretos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-medium text-[#E74C3C]">{errorFiles}</div>
                  <div className="text-xs text-[#A7A7A7]">Com Erro</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-medium text-[#F39C12]">{ferragensFiles}</div>
                  <div className="text-xs text-[#A7A7A7]">Ferragens</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-medium text-[#3498DB]">{autoFixedFiles}</div>
                  <div className="text-xs text-[#A7A7A7]">Auto-fix</div>
                </div>
              </div>

              <hr className="border-[#2C2C2C]" />

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A7A7A7]">Total processado</span>
                  <span className="text-sm font-medium text-white">{totalFiles} arquivos</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A7A7A7]">Taxa de sucesso</span>
                  <span className="text-sm font-medium text-[#27AE60]">
                    {totalFiles > 0 ? Math.round(((okFiles + ferragensFiles) / totalFiles) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A7A7A7]">Última atividade</span>
                  <span className="text-sm font-medium text-white">{lastActivity}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111111] rounded-lg border border-[#2C2C2C] p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-[#F39C12]" />
                <span className="text-sm font-medium text-white">Status do Sistema</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A7A7A7]">Monitoramento</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${monitoring ? "bg-[#27AE60]" : "bg-[#E74C3C]"}`} />
                    <span className="text-sm font-medium text-white">{monitoring ? "Ativo" : "Parado"}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A7A7A7]">Conexão</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-[#27AE60]" : "bg-[#F39C12]"}`} />
                    <span className="text-sm font-medium text-white">{isConnected ? "Electron" : "Dev Mode"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs + Tabela */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {kpis.map((k: any) => (
            <button
              key={k.key}
              onClick={() => setFilter(k.key)}
              className={`text-left bg-[#1B1B1B] border rounded-xl p-4 transition ${filter === k.key ? "border-[#F1C40F] shadow-[0_0_0_2px_rgba(241,196,15,0.2)]" : "border-[#2C2C2C]"}`}
            >
              <div className="flex items-center justify-between">
                <div className="opacity-80 text-sm">{k.title}</div>
                <div style={{ color: k.color }}>{k.icon}</div>
              </div>
              <div className="text-2xl font-semibold mt-1">{k.value}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-3 w-80 bg-[#1B1B1B] border-[#2C2C2C]"
            />
            <div className="flex items-center gap-2 text-[#A7A7A7]">
              <Calendar className="h-4 w-4" /> <span className="text-sm">Últimas 24h</span>
            </div>
          </div>
          <div className="text-sm text-[#A7A7A7]">Mostrando {filtered.length} de {rows.length} arquivos</div>
        </div>

        <div className="bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2C2C2C] hover:bg-[#2C2C2C]/50">
                <TableHead className="text-[#A7A7A7]">Arquivo</TableHead>
                <TableHead className="text-[#A7A7A7]">Status</TableHead>
                <TableHead className="text-[#A7A7A7]">Erros</TableHead>
                <TableHead className="text-[#A7A7A7] text-center">Auto-fix</TableHead>
                <TableHead className="text-[#A7A7A7]">Avisos</TableHead>
                <TableHead className="text-[#A7A7A7]">Tags</TableHead>
                <TableHead className="text-[#A7A7A7] whitespace-nowrap">Data/Hora</TableHead>
                <TableHead className="text-[#A7A7A7] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((file) => {
                const autoFixed = (file.autoFixes || []).length > 0;
                return (
                  <TableRow key={file.fullpath} className="border-[#2C2C2C] hover:bg-[#2C2C2C]/30">
                    <TableCell className="font-mono text-sm max-w-60 truncate">
                      {file.filename}
                    </TableCell>

                    <TableCell>
                      <StatusChip status={file.status} />
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-60">
                        {(file.errors || []).map((e, i) => <ErrorBadge key={i} error={e} />)}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {autoFixed ? "✓" : "—"}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(file.warnings || []).map((w, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[#F39C12] border-[#F39C12]/20 bg-[#F39C12]/10 text-[10px]"
                          >
                            {typeof w === "string" ? w.toUpperCase() : "AVISO"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-32">
                        {(file.tags || []).map((t, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/10 text-[10px]"
                          >
                            {formatTag(t)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell className="text-[#A7A7A7] text-sm whitespace-nowrap">
                      {file.timestamp || "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="inline-flex gap-1">
                        <button
                          title="Ver detalhes"
                          onClick={() => handleFileDetail(file)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded hover:bg-white/5"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Abrir na pasta"
                          onClick={() => handleOpenFolder(file.fullpath)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded hover:bg-white/5"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </button>
                        <button
                          title="Reprocessar"
                          onClick={() => reprocessOne(file.fullpath)}
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded hover:bg-white/5"
                        >
                          <RefreshCw className="h-4 w-4" />
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
      />

      {/* toasts */}
      <Toaster richColors position="bottom-left" closeButton />
    </div>
  );
}
