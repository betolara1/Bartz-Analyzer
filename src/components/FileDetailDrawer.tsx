// src/components/FileDetailDrawer.tsx
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { StatusChip, type Status } from "./StatusChip";
import { X, FileJson, AlertTriangle } from "lucide-react";

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
    machines?: Array<{ id?: string; name?: string }>;
    [k: string]: any;
  };
};

export default function FileDetailDrawer({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Row | null;
}) {
  const [coringaFrom, setCoringaFrom] = React.useState<string | null>(null);
  const [coringaTo, setCoringaTo] = React.useState<string>("");
  const [isReplacing, setIsReplacing] = React.useState(false);
  const [lastReplace, setLastReplace] = React.useState<any | null>(null);
  const [showFull, setShowFull] = React.useState(false);
  
  // Estados para diálogos de confirmação
  const [confirmCoringaOpen, setConfirmCoringaOpen] = React.useState(false);
  const [confirmCgOpen, setConfirmCgOpen] = React.useState(false);
  const [confirmRefOpen, setConfirmRefOpen] = React.useState(false);

  // --- helpers locais ---
  const truncateText = (s: string, max = 4000) =>
    s && s.length > max ? s.slice(0, max) + "\n… (resumo — clique em “Mostrar completo”)" : s;

  const cap = <T,>(arr: T[] | undefined, max = 20): T[] =>
    Array.isArray(arr) ? arr.slice(0, max) : [];

  // dedupe de máquinas (por ID+nome)
  const machines = React.useMemo(() => {
    const raw = (data?.meta?.machines ?? []) as Array<{ id?: string; name?: string }>;
    const map = new Map<string, { id?: string; name?: string }>();
    for (const m of raw) {
      const key = `${m?.id ?? ""}|${m?.name ?? ""}`;
      if (!map.has(key)) map.set(key, { id: m?.id, name: m?.name });
    }
    return Array.from(map.values());
  }, [data]);

  // keep coringaFrom synced when data changes
  React.useEffect(() => {
    const matches = (data?.meta?.coringaMatches || []) as string[];
    setCoringaFrom(matches && matches.length ? String(matches[0]) : null);
    setCoringaTo("");
  }, [data]);

  // detect if any coringa matches contain CG1 or CG2
  const hasCG1 = React.useMemo(() => {
    return !!((data?.meta?.coringaMatches || []) as string[]).find(m => /cg1/i.test(String(m)));
  }, [data]);
  const hasCG2 = React.useMemo(() => {
    return !!((data?.meta?.coringaMatches || []) as string[]).find(m => /cg2/i.test(String(m)));
  }, [data]);
  const [cg1Replace, setCg1Replace] = React.useState('');
  const [cg2Replace, setCg2Replace] = React.useState('');
  const [refFillValue, setRefFillValue] = React.useState('');
  const [selectedRefSingle, setSelectedRefSingle] = React.useState<string | null>(null);
  
  // Estado para busca de arquivo DXF
  const [dxfSearching, setDxfSearching] = React.useState(false);
  const [dxfFound, setDxfFound] = React.useState<{ path: string; name: string; panelInfo?: any; fresaInfo?: any } | false | null>(null);
  const [dxfFixing, setDxfFixing] = React.useState(false);

  // Resetar DXF encontrado quando dados mudam
  React.useEffect(() => {
    setDxfFound(null);
  }, [data?.fullpath]);

  // Função para buscar arquivo DXF pelo código de desenho
  async function searchDrawingDXF() {
    if (!data?.meta?.es08Matches || data.meta.es08Matches.length === 0) {
      toast.warning("Nenhum código de desenho encontrado neste arquivo.");
      return;
    }

    const firstDrawing = (data.meta.es08Matches as any[])[0]?.desenho;
    if (!firstDrawing) {
      toast.warning("Código de desenho não identificado.");
      return;
    }

    setDxfSearching(true);
    const id = toast.loading(`Buscando desenho: ${firstDrawing}...`);

    try {
      const result = await (window as any).electron?.analyzer?.findDrawingFile?.(firstDrawing, data?.fullpath);
      if (result?.found && result?.path) {
        setDxfFound({ 
          path: result.path, 
          name: result.name || firstDrawing,
          panelInfo: result.panelInfo,
          fresaInfo: result.fresaInfo
        });
        
        // Mostrar informações adicionais do XML
        let successMsg = `✓ Desenho encontrado: ${result.name}`;
        if (result.panelInfo) {
          successMsg += `\n📋 Primeiro PAINEL: ${result.panelInfo.panelCode} (${result.panelInfo.dimension})`;
        }
        if (result.fresaInfo) {
          successMsg += `\n🔧 FRESA encontrada: ${result.fresaInfo.fresaCode}`;
          successMsg += `\n   Status: ${result.fresaInfo.status}`;
        }
        
        toast.success(successMsg);
      } else {
        setDxfFound(false);
        toast.error(`Desenho "${firstDrawing}" não encontrado em desenho_dxf.`);
      }
    } catch (e: any) {
      setDxfFound(false);
      toast.error(`Erro na busca: ${String(e?.message || e)}`);
    } finally {
      setDxfSearching(false);
      toast.dismiss(id);
    }
  }

  // Função para corrigir FRESA_12_37 para FRESA_12_18
  async function fixFresa37to18() {
    if (!dxfFound || typeof dxfFound !== 'object' || !dxfFound.path) {
      toast.error("Nenhum arquivo DXF selecionado.");
      return;
    }

    setDxfFixing(true);
    const id = toast.loading("Corrigindo arquivo DXF...");

    try {
      const result = await (window as any).electron?.analyzer?.fixFresa37to18?.(dxfFound.path);
      
      if (result?.ok) {
        toast.dismiss(id);
        toast.success(`✅ Arquivo corrigido com sucesso!\n📝 Alterações:\n- PANEL: ${result.changes?.panelModified ? '✓' : '—'}\n- Primeira FRESA_12_37: ${result.changes?.fresaModified ? '✓' : '—'}\n- Total FRESA_12_37→18: ${result.changes?.fresa37Replacements}`);
      } else {
        toast.dismiss(id);
        toast.error(`Erro: ${result?.message || 'Falha ao corrigir'}`);
      }
    } catch (e: any) {
      toast.dismiss(id);
      toast.error(`Erro na correção: ${String(e?.message || e)}`);
    } finally {
      setDxfFixing(false);
    }
  }

  // whether meta has referencia entries collected by validateXml
  const hasReferenciaArray = React.useMemo(() => {
    return Array.isArray((data?.meta as any)?.referenciaEmpty) && ((data?.meta as any)?.referenciaEmpty.length > 0);
  }, [data]);

  // show the panel when we have collected referenciaEmpty OR when the file contains the error "ITEM SEM CÓDIGO"
  const showReferenciaPanel = React.useMemo(() => {
    const errs = data?.errors || [];
    return hasReferenciaArray || errs.includes("ITEM SEM CÓDIGO");
  }, [data, hasReferenciaArray]);

  // if file revalidated and the replaced token no longer exists, clear lastReplace
  React.useEffect(() => {
    if (!lastReplace) return;
    const matches = (data?.meta?.coringaMatches || []) as string[];
    if (!matches || !matches.length) { setLastReplace(null); return; }
    if (!matches.includes(String(lastReplace.from))) setLastReplace(null);
  }, [data, lastReplace]);

  // JSON completo (sem XML bruto; inclui meta)
  const prettyFull = React.useMemo(() => {
    if (!data) return "{}";
    const safe = {
      status: data.status,
      filename: data.filename,
      fullpath: data.fullpath,
      timestamp: data.timestamp,
      errors: data.errors || [],
      warnings: data.warnings || [],
      autoFixes: data.autoFixes || [],
      tags: data.tags || [],
      meta: {
        ...(data.meta || {}),
        // usa versão dedupada das máquinas
        machines,
      },
    };
    return JSON.stringify(safe, null, 2);
  }, [data, machines]);

  // JSON resumido (listas e tamanho limitados)
  const prettyCompact = React.useMemo(() => {
    if (!data) return "{}";
    const safeSmall = {
      status: data.status,
      filename: data.filename,
      fullpath: data.fullpath,
      timestamp: data.timestamp,
      errors: cap(data.errors, 10),
      warnings: cap(data.warnings, 10),
      autoFixes: cap(data.autoFixes, 10),
      tags: cap(data.tags, 20),
      meta: {
        ...(data.meta ? { ...data.meta } : {}),
        machines: cap(machines, 12),
      },
      _note: "visualização resumida (listas truncadas)",
    };
    return truncateText(JSON.stringify(safeSmall, null, 2), 4000);
  }, [data, machines]);

  const jsonToShow = showFull ? prettyFull : prettyCompact;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[460px] p-0 bg-[#161616] text-white border-l border-zinc-800"
      >
        <div className="h-full flex flex-col">
          {/* HEADER */}
          <SheetHeader className="px-5 py-4 border-b border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate pr-10 text-white">
                  {data?.filename || "-"}
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-400">
                  Processado em {data?.timestamp || "-"}
                </SheetDescription>

                {/* tags */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(data?.tags || []).map((t, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/10 text-[10px]"
                    >
                      {formatTag(t)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* status + fechar */}
              <div className="ml-auto flex items-start gap-2">
                <StatusChip status={data?.status} />
                <SheetClose asChild>
                  <button
                    className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-white/10"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* ERROS */}
            {(data?.errors?.length ?? 0) > 0 && (
              <section className="rounded-lg border border-rose-500/20 bg-rose-500/10">
                <div className="px-4 py-2 text-rose-300 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Erros ({data?.errors?.length})
                </div>
                <ul className="px-5 pb-3 space-y-1">
                  {data!.errors!.map((e, i) => (
                    <li key={i} className="text-rose-200 text-sm">
                      • {e}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* AVISOS */}
            {(data?.warnings?.length ?? 0) > 0 && (
              <section className="rounded-lg border border-amber-500/20 bg-amber-500/10">
                <div className="px-4 py-2 text-amber-300 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Avisos ({data?.warnings?.length})
                </div>
                <ul className="px-5 pb-3 space-y-1">
                  {data!.warnings!.map((w, i) => (
                    <li key={i} className="text-amber-200 text-sm">
                      • {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* MÁQUINAS (dedupadas) */}
            {machines.length > 0 && (
              <div className="mt-1">
                <div className="text-sm font-medium mb-2 opacity-80">
                  Máquinas detectadas
                </div>
                <div className="bg-[#151515] border border-[#2C2C2C] rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1F1F1F] text-[#A7A7A7]">
                      <tr>
                        <th className="text-left px-3 py-2">ID do Plugin</th>
                        <th className="text-left px-3 py-2">Nome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machines.map((m, i) => (
                        <tr key={`${m.id ?? i}`} className="border-t border-[#2C2C2C]">
                          <td className="px-3 py-2 font-mono">{m.id || "-"}</td>
                          <td className="px-3 py-2">{m.name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ES08 (DUPLADO 37MM) - Dados complementares */}
            {Array.isArray(data?.meta?.es08Matches) && (data!.meta!.es08Matches!.length > 0) && (
              <div className="mt-1">
                <div className="text-sm font-medium mb-2 opacity-80 text-rose-300">
                  Itens ES08 - Duplado 37MM
                </div>
                <div className="space-y-3 overflow-x-auto pb-2">
                  {(data?.meta?.es08Matches as any[]).map((item, i) => (
                    <div key={i} className="bg-[#1a1a1a] border border-rose-500/30 rounded-md p-3 min-w-full">
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-start gap-2 overflow-x-auto">
                          <span className="text-zinc-400 whitespace-nowrap">ID:</span>
                          <span className="text-white font-mono break-all">{item.id || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 whitespace-nowrap">Referencia:</span>
                          <span className="text-white break-all">{item.referencia || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 whitespace-nowrap">Desenho:</span>
                          <span className="text-white break-all">{item.desenho || "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Buscar arquivo DXF */}
                <div className="mt-3 pt-3 border-t border-rose-500/20">
                  <div className="bg-[#1a1a1a] border border-[#2C2C2C] rounded-md p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-rose-300">Busca de Desenho DXF</div>
                      <button
                        onClick={searchDrawingDXF}
                        disabled={dxfSearching}
                        className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
                      >
                        {dxfSearching ? "Buscando..." : "Buscar"}
                      </button>
                    </div>

                    {/* Tabela de resultado */}
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-[#2C2C2C]">
                          <td className="px-2 py-2 text-zinc-400">Código:</td>
                          <td className="px-2 py-2 text-white font-mono">
                            {((data?.meta?.es08Matches as any[])?.[0]?.desenho || "—")}
                          </td>
                        </tr>
                        <tr className="border-b border-[#2C2C2C]">
                          <td className="px-2 py-2 text-zinc-400">Status:</td>
                          <td className="px-2 py-2">
                            {dxfFound === null ? (
                              <span className="text-zinc-400">Aguardando busca...</span>
                            ) : dxfFound === false ? (
                              <span className="text-rose-400 font-medium">✗ Não encontrado</span>
                            ) : (
                              <span className="text-green-400 font-medium">✓ Encontrado</span>
                            )}
                          </td>
                        </tr>
                        {dxfFound && typeof dxfFound === 'object' && (
                          <>
                            <tr className="border-b border-[#2C2C2C]">
                              <td className="px-2 py-2 text-zinc-400">Nome:</td>
                              <td className="px-2 py-2 text-white font-mono break-all">
                                {dxfFound.name}
                              </td>
                            </tr>
                            <tr className="border-b border-[#2C2C2C]">
                              <td className="px-2 py-2 text-zinc-400">Caminho:</td>
                              <td className="px-2 py-2 text-white font-mono text-[10px] break-all">
                                {dxfFound.path}
                              </td>
                            </tr>
                            {dxfFound.panelInfo && (
                              <tr className="border-b border-[#2C2C2C] bg-blue-500/5">
                                <td className="px-2 py-2 text-blue-400 font-medium">📋 Primeiro PAINEL:</td>
                                <td className="px-2 py-2 text-blue-300">
                                  {dxfFound.panelInfo.panelCode} <span className="font-mono text-blue-400">({dxfFound.panelInfo.dimension})</span>
                                </td>
                              </tr>
                            )}
                            {dxfFound.fresaInfo && (
                              <tr className="border-b border-[#2C2C2C] bg-purple-500/5">
                                <td className="px-2 py-2 text-purple-400 font-medium">🔧 FRESA:</td>
                                <td className="px-2 py-2">
                                  <div className="space-y-1">
                                    <div className="text-purple-300 font-mono">{dxfFound.fresaInfo.fresaCode}</div>
                                    <div className="text-purple-200 text-sm">{dxfFound.fresaInfo.status}</div>
                                    {dxfFound.fresaInfo.firstFresa37 && (
                                      <div className="mt-2 pt-2 border-t border-purple-500/30 text-xs">
                                        <div className="text-purple-300 font-semibold">Primeira FRESA_12_37:</div>
                                        <div className="ml-2 space-y-1 mt-1">
                                          {dxfFound.fresaInfo.firstFresa37.hasNegative37 && (
                                            <div className="text-purple-200">✓ Código 30 = -37</div>
                                          )}
                                          {dxfFound.fresaInfo.firstFresa37.hasPositive37 && (
                                            <div className="text-purple-200">✓ Código 39 = 37</div>
                                          )}
                                          {!dxfFound.fresaInfo.firstFresa37.hasNegative37 && !dxfFound.fresaInfo.firstFresa37.hasPositive37 && (
                                            <div className="text-purple-300">• Nenhum dos valores encontrado</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {(
                                      (dxfFound.fresaInfo.count37 > 0 && (dxfFound.fresaInfo.firstFresa37?.hasNegative37 || dxfFound.fresaInfo.firstFresa37?.hasPositive37)) ||
                                      (dxfFound.panelInfo?.dimension === '-37' || dxfFound.panelInfo?.dimension === '37')
                                    ) && (
                                      <div className="mt-3 pt-2 border-t border-purple-500/30">
                                        <button
                                          onClick={fixFresa37to18}
                                          disabled={dxfFixing}
                                          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:opacity-50 text-white font-semibold rounded text-sm transition"
                                        >
                                          {dxfFixing ? "⏳ Trocando..." : "🔧 Trocar Valores"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* COR CORINGA - quick replace UI */}
            {Array.isArray(data?.meta?.coringaMatches) && (data!.meta!.coringaMatches!.length > 0) && (
              <section className="rounded-lg border border-amber-500/20 bg-amber-500/10">
                <div className="px-4 py-2 text-amber-300 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Cor Coringa detectada
                </div>
                <div className="px-4 pb-3 space-y-3">
                  <div className="text-sm text-zinc-200">Selecione a cor coringa encontrada (apenas as detectadas no XML):</div>

                  {/* select (only detected matches) */}
                  <div>
                    <label className="text-xs text-zinc-300 mb-1 block">Coringa encontrada</label>
                    <select
                      value={coringaFrom ?? ""}
                      onChange={(e) => setCoringaFrom(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded"
                    >
                      {((data?.meta?.coringaMatches || []) as string[]).map((m, i) => (
                        <option key={i} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* replacement input */}
                  <div>
                    <label className="text-xs text-zinc-300 mb-1 block">Substituir por</label>
                    <input
                      placeholder="Digite a cor/substituição..."
                      value={coringaTo}
                      onChange={(e) => setCoringaTo(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!coringaFrom || !coringaTo || isReplacing}
                      onClick={() => setConfirmCoringaOpen(true)}
                      className="px-3 py-2 rounded bg-amber-500 text-black font-medium disabled:opacity-50"
                    >
                      Trocar
                    </button>

                    <button
                      onClick={async () => {
                        if (!data) return;
                        const id = toast.loading('Atualizando arquivo...');
                        try {
                          const ok = await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                          if (ok) toast.success('Arquivo reprocessado.');
                          else toast.error('Falha ao reprocessar.');
                        } catch (e: any) {
                          toast.error(String(e?.message || e));
                        } finally { toast.dismiss(id); }
                      }}
                      className="px-3 py-2 rounded border border-amber-500 text-amber-300 bg-transparent hover:bg-amber-900/10"
                    >
                      Atualizar arquivo
                    </button>
                    {lastReplace && (
                      <button
                        onClick={async () => {
                          if (!data) return;
                          const id = toast.loading('Desfazendo ultima troca...');
                          try {
                            const res = await (window as any).electron?.analyzer?.undoReplace?.(data.fullpath);
                            if (res?.ok) {
                              toast.success('Troca desfeita. Arquivo restaurado.');
                              setLastReplace(null);
                            } else {
                              toast.error(`Falha: ${res?.message || 'não foi possível desfazer'}`);
                            }
                          } catch (e: any) {
                            toast.error(String(e?.message || e));
                          } finally { toast.dismiss(id); }
                        }}
                        className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Desfazer última troca
                      </button>
                    )}
                  </div>
                  {/* CG1 / CG2 bulk replace UI (only show if detected) */}
                  {(hasCG1 || hasCG2) && (
                    <div className="mt-3 border-t border-amber-600/20 pt-3">
                      <div className="text-sm text-zinc-200 mb-2">Troca em lote por sigla (CG1 / CG2)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-zinc-300 mb-1 block">CG1 →</label>
                          <input value={cg1Replace} onChange={(e)=>setCg1Replace(e.target.value)} placeholder="Ex: LA" className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-300 mb-1 block">CG2 →</label>
                          <input value={cg2Replace} onChange={(e)=>setCg2Replace(e.target.value)} placeholder="Ex: MO" className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          disabled={!(cg1Replace || cg2Replace)}
                          onClick={() => setConfirmCgOpen(true)}
                          className="px-3 py-2 rounded bg-amber-500 text-black font-medium disabled:opacity-50"
                        >
                          Trocar CG1/CG2
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* REFERENCIA empty fill UI - INDEPENDENT SECTION */}
            {showReferenciaPanel && (
              <section className="rounded-lg border border-rose-500/20 bg-rose-500/10">
                <div className="px-4 py-2 text-rose-300 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Itens com REFERENCIA vazia {hasReferenciaArray ? `(${(data!.meta!.referenciaEmpty!.length)})` : ""}
                </div>
                <div className="px-4 pb-3 space-y-3">
                  {!hasReferenciaArray && (
                    <div className="text-xs text-zinc-300 mb-2">
                      Foi detectado o erro <span className="font-mono">ITEM SEM CÓDIGO</span>, mas os IDs ainda não foram coletados na metadados.
                      Clique em "Reprocessar" (ícone de refresh na lista) ou no botão abaixo para revalidar o arquivo e preencher a lista de IDs.
                      <div className="mt-2">
                        <button
                          onClick={async () => {
                            if (!data) return;
                            const id = toast.loading('Reprocessando arquivo para coletar IDs...');
                            try {
                              const ok = await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                              if (ok) toast.success('Arquivo reprocessado. Aguarde a atualização do painel.');
                              else toast.warning('Reprocessamento não retornou dados novos.');
                            } catch (e:any) { toast.error(String(e?.message || e)); }
                            finally { toast.dismiss(id); }
                          }}
                          className="px-3 py-2 rounded bg-rose-500 text-black font-medium"
                        >
                          Reprocessar agora
                        </button>
                      </div>
                    </div>
                  )}

                  {hasReferenciaArray && (
                    <>
                      <div className="text-xs text-zinc-300 mb-2">Selecione o ID e digite o código para preencher REFERENCIA:</div>
                      {/* single-select + input */}
                      <div className="mb-3">
                        <label className="text-xs text-zinc-300 mb-1 block">Selecionar ID</label>
                        <select
                          value={selectedRefSingle ?? ''}
                          onChange={(e) => setSelectedRefSingle(e.target.value || null)}
                          className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded mb-2"
                        >
                          <option value="">-- selecionar --</option>
                          {((data!.meta!.referenciaEmpty! ) as any[]).filter((r:any)=>!!r.id).map((r:any,i:number)=> (
                            <option key={i} value={r.id}>{r.id}</option>
                          ))}
                        </select>
                        <label className="text-xs text-zinc-300 mb-1 block">Código REFERENCIA</label>
                        <input value={refFillValue} onChange={(e)=>setRefFillValue(e.target.value)} placeholder="Ex: ABC123" className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded mb-2" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={!selectedRefSingle || !refFillValue}
                          onClick={() => setConfirmRefOpen(true)}
                          className="px-3 py-2 rounded bg-rose-500 text-black font-medium disabled:opacity-50 flex-1"
                        >
                          Preencher REFERENCIA
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* LOG JSON (Resumo/Completo) */}
            <section className="rounded-lg border border-zinc-700 bg-zinc-900/40">
              <div className="px-4 py-2 text-xs uppercase tracking-wide text-zinc-400 flex items-center justify-between border-b border-zinc-800">
                <span className="inline-flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  Log JSON {showFull ? "(completo)" : "(resumo)"}
                </span>
                <button
                  onClick={() => setShowFull((v) => !v)}
                  className="text-[11px] px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                >
                  {showFull ? "Mostrar resumo" : "Mostrar completo"}
                </button>
              </div>
              <pre className="px-4 py-3 max-h-[50vh] overflow-auto text-xs leading-relaxed text-zinc-200 font-mono whitespace-pre">
{jsonToShow}
              </pre>
            </section>
          </div>
        </div>
      </SheetContent>

      {/* CONFIRMAÇÃO - Trocar Cor Coringa */}
      <AlertDialog open={confirmCoringaOpen} onOpenChange={setConfirmCoringaOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-amber-500/30">
          <AlertDialogTitle className="text-white">Confirmar troca de cor coringa?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Você está prestes a substituir <span className="font-mono font-bold text-amber-300">{coringaFrom}</span> por <span className="font-mono font-bold text-amber-300">{coringaTo}</span>.
            <div className="mt-2 text-xs">Será criado um backup do arquivo original.</div>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!data || !coringaFrom) return;
                setConfirmCoringaOpen(false);
                setIsReplacing(true);
                const id = toast.loading('Substituindo cor...');
                try {
                  const res = await (window as any).electron?.analyzer?.replaceCoringa?.(data.fullpath, coringaFrom, coringaTo);
                  if (res?.ok) {
                    toast.success(`Substituídos ${res.replaced || 0} ocorrência(s)`);
                    setLastReplace({ backupPath: res.backupPath, from: coringaFrom, to: coringaTo, replaced: res.replaced });
                  } else {
                    toast.error(`Falha: ${res?.message || 'nenhuma ocorrência encontrada'}`);
                  }
                } catch (e: any) {
                  toast.error(String(e?.message || e));
                } finally {
                  toast.dismiss(id);
                  setIsReplacing(false);
                }
              }}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              Confirmar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO - Trocar CG1/CG2 */}
      <AlertDialog open={confirmCgOpen} onOpenChange={setConfirmCgOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-amber-500/30">
          <AlertDialogTitle className="text-white">Confirmar troca em lote (CG1/CG2)?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Você está prestes a substituir:
            <ul className="mt-2 ml-4 space-y-1 text-xs">
              {cg1Replace && <li>• <span className="font-mono">CG1</span> → <span className="font-mono font-bold text-amber-300">{cg1Replace}</span></li>}
              {cg2Replace && <li>• <span className="font-mono">CG2</span> → <span className="font-mono font-bold text-amber-300">{cg2Replace}</span></li>}
            </ul>
            <div className="mt-2 text-xs">Será criado um backup do arquivo original.</div>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!data) return;
                setConfirmCgOpen(false);
                const map: any = {};
                if (cg1Replace) map['CG1'] = cg1Replace;
                if (cg2Replace) map['CG2'] = cg2Replace;
                const id = toast.loading('Aplicando trocas CG1/CG2...');
                try {
                  const res = await (window as any).electron?.analyzer?.replaceCgGroups?.(data.fullpath, map);
                  if (res?.ok) {
                    toast.success(`Substituições aplicadas (total: ${Object.values(res.counts||{}).reduce((s:any,n:any)=>s+(n||0),0)})`);
                    setLastReplace({ backupPath: res.backupPath, map: map, counts: res.counts });
                  } else {
                    toast.error(`Falha: ${res?.message || 'nenhuma ocorrência encontrada'}`);
                  }
                } catch (e:any) { 
                  toast.error(String(e?.message || e)); 
                } finally { 
                  toast.dismiss(id); 
                }
              }}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              Confirmar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO - Preencher REFERENCIA */}
      <AlertDialog open={confirmRefOpen} onOpenChange={setConfirmRefOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-rose-500/30">
          <AlertDialogTitle className="text-white">Confirmar preenchimento de REFERENCIA?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Você está prestes a preencher REFERENCIA do item <span className="font-mono font-bold text-rose-300">{selectedRefSingle}</span> com <span className="font-mono font-bold text-rose-300">{refFillValue}</span>.
            <div className="mt-2 text-xs">Será criado um backup do arquivo original.</div>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!data || !selectedRefSingle) return;
                setConfirmRefOpen(false);
                const id = toast.loading('Trocando REFERENCIA...');
                try {
                  const replacements = [{ id: selectedRefSingle, value: refFillValue }];
                  const res = await (window as any).electron?.analyzer?.fillReferenciaByIds?.(data.fullpath, replacements);
                  if (res?.ok) {
                    toast.success(`Preenchidas ${Object.values(res.counts||{}).reduce((s:any,n:any)=>s+(n||0),0)} ocorrência(s)`);
                    setLastReplace({ backupPath: res.backupPath, type: 'fill-referencia-ids', replacements, counts: res.counts });
                    setRefFillValue('');
                    setSelectedRefSingle(null);
                  } else {
                    toast.error(`Falha: ${res?.message || 'nenhuma ocorrência encontrada'}`);
                  }
                } catch (e:any) { 
                  toast.error(String(e?.message || e)); 
                } finally { 
                  toast.dismiss(id); 
                }
              }}
              className="bg-rose-500 text-black hover:bg-rose-600"
            >
              Confirmar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

/* helpers */
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
