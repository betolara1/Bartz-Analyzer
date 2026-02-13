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
import { X, FileJson, AlertTriangle, Search, CheckCircle, Check, Grid3X3, ChevronDown, ChevronRight, FileText, Package, Zap, Database, Layers, Info, RefreshCw } from "lucide-react";

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
  onFileMoved,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Row | null;
  onFileMoved?: (oldPath: string, newPath: string) => void;
  onAction?: (path: string, action: string) => void;
}) {
  const [coringaFrom, setCoringaFrom] = React.useState<string | null>(null);
  const [coringaTo, setCoringaTo] = React.useState<string>("");
  const [isReplacing, setIsReplacing] = React.useState(false);
  const [lastReplace, setLastReplace] = React.useState<any | null>(null);
  const [showFull, setShowFull] = React.useState(false);

  // Estados para seções colapsáveis
  const [machinesOpen, setMachinesOpen] = React.useState(false);
  const [importKeyOpen, setImportKeyOpen] = React.useState(false);
  const [orderInfoOpen, setOrderInfoOpen] = React.useState(false);
  const [specialItemsOpen, setSpecialItemsOpen] = React.useState(false);
  const [muxarabiOpen, setMuxarabiOpen] = React.useState(false);

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
  // dxfResults key = drawingCode, val = result object or status
  const [dxfResults, setDxfResults] = React.useState<Record<string, {
    status: 'idle' | 'searching' | 'found' | 'error' | 'not_found';
    data?: {
      path: string;
      name: string;
      panelInfo?: any;
      fresaInfo?: any;
    };
    message?: string;
  }>>({});
  const [dxfFixing, setDxfFixing] = React.useState<Record<string, boolean>>({});

  // Estados para busca de produto ERP
  const [erpSearchCode, setErpSearchCode] = React.useState('');
  const [erpSearchDesc, setErpSearchDesc] = React.useState('');
  const [erpSearchType, setErpSearchType] = React.useState('');
  const [erpSearchResults, setErpSearchResults] = React.useState<Array<{ code: string; description: string }>>([]);
  const [erpSearching, setErpSearching] = React.useState(false);

  // Estados para busca de pedido (baseado nos primeiros 5 dígitos do filename)
  const [orderNum, setOrderNum] = React.useState<string | null>(null);
  const [orderComments, setOrderComments] = React.useState<any[]>([]);
  const [orderLoading, setOrderLoading] = React.useState(false);
  const [cg1Done, setCg1Done] = React.useState(false);
  const [cg2Done, setCg2Done] = React.useState(false);

  // Filtrar coringas baseados no tipo selecionado na busca (ERP)
  const filteredCoringaMatches = React.useMemo(() => {
    const rawMatches = (data?.meta?.coringaMatches || []) as string[];
    if (!erpSearchType) return rawMatches;

    // Mapeamento de tipo para prefixo
    const map: Record<string, string> = {
      'CHAPAS': 'CHAPA_',
      'FITAS': 'FITA_',
      'TAPAFURO': 'TAPAFURO_',
      'PAINEL': 'PAINEL_'
    };

    const prefix = map[erpSearchType];
    if (!prefix) return rawMatches;

    return rawMatches.filter(m => m.toUpperCase().startsWith(prefix));
  }, [data, erpSearchType]);

  // Se o filtro mudar e o item selecionado não estiver mais na lista, seleciona o primeiro disponível
  React.useEffect(() => {
    if (filteredCoringaMatches.length > 0) {
      if (!coringaFrom || !filteredCoringaMatches.includes(coringaFrom)) {
        setCoringaFrom(filteredCoringaMatches[0]);
      }
    } else {
      setCoringaFrom(null);
    }
  }, [filteredCoringaMatches, coringaFrom]);

  React.useEffect(() => {
    setDxfResults({});
    setDxfFixing({});
    setOrderNum(null);
    setOrderComments([]);
    setOrderLoading(false);
    setLastReplace(null);
    setCg1Done(false);
    setCg2Done(false);

    if (data?.filename) {
      // Tentar pegar os primeiros 5 dígitos (ex: 65946)
      const match = data.filename.match(/^(\d{5})/);
      if (match && match[1]) {
        const num = match[1];
        setOrderNum(num);
        fetchOrderComments(num);
      }
    }
  }, [data?.fullpath, data?.filename]);

  async function fetchOrderComments(num: string) {
    setOrderLoading(true);
    try {
      const res = await (window as any).electron?.analyzer?.getOrderComments?.(num);
      if (res?.ok) {
        setOrderComments(res.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar comentários do pedido:", e);
    } finally {
      setOrderLoading(false);
    }
  }

  // Identificar desenhos únicos
  const uniqueDrawings = React.useMemo(() => {
    if (!data?.meta?.es08Matches) return [];
    const set = new Set<string>();
    (data.meta.es08Matches as any[]).forEach(m => {
      if (m.desenho) set.add(m.desenho);
    });
    return Array.from(set);
  }, [data]);

  // Shared function to move file to OK directory
  const handleMoveToOk = async () => {
    if (!data?.fullpath) return;
    const id = toast.loading('Movendo arquivo para FINAL OK...');
    try {
      const res = await (window as any).electron?.analyzer?.moveToOk?.(data.fullpath);
      if (res?.ok) {
        toast.success('Arquivo movido com sucesso!');
        if (onFileMoved && res.destPath) {
          onFileMoved(data.fullpath, res.destPath);
        }
        onOpenChange(false);
      } else {
        toast.error(`Erro ao mover: ${res?.message}`);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message || e}`);
    } finally {
      toast.dismiss(id);
    }
  };

  // Função para buscar arquivo DXF pelo código de desenho (busca todos únicos)
  async function searchAllDrawings() {
    if (uniqueDrawings.length === 0) {
      toast.warning("Nenhum código de desenho encontrado.");
      return;
    }

    setDxfSearching(true);
    const id = toast.loading(`Buscando ${uniqueDrawings.length} desenho(s)...`);

    // Inicializar status 'searching' para todos
    setDxfResults(prev => {
      const next = { ...prev };
      uniqueDrawings.forEach(d => next[d] = { status: 'searching' });
      return next;
    });

    try {
      const promises = uniqueDrawings.map(async (drawing) => {
        try {
          const result = await (window as any).electron?.analyzer?.findDrawingFile?.(drawing, data?.fullpath);
          return { drawing, result };
        } catch (e) {
          return { drawing, error: e };
        }
      });

      const results = await Promise.all(promises);

      setDxfResults(prev => {
        const next = { ...prev };
        results.forEach(({ drawing, result, error }) => {
          if (error) {
            next[drawing] = { status: 'error', message: String(error) };
          } else if (result?.found && result?.path) {
            next[drawing] = {
              status: 'found',
              data: {
                path: result.path,
                name: result.name || drawing,
                panelInfo: result.panelInfo,
                fresaInfo: result.fresaInfo
              }
            };
          } else {
            next[drawing] = { status: 'not_found', message: result?.message };
          }
        });
        return next;
      });

      const foundCount = results.filter(r => r.result?.found).length;
      if (foundCount > 0) toast.success(`Busca concluída: ${foundCount}/${uniqueDrawings.length} encontrados.`);
      else toast.warning('Nenhum desenho encontrado.');

    } catch (e: any) {
      toast.error(`Erro na busca geral: ${String(e?.message || e)}`);
    } finally {
      setDxfSearching(false);
      toast.dismiss(id);
    }
  }

  // Função para corrigir FRESA_12_37 para FRESA_12_18 (específica por desenho)
  async function fixFresa37to18(drawingCode: string) {
    const res = dxfResults[drawingCode];
    if (res?.status !== 'found' || !res.data?.path) {
      toast.error("Arquivo DXF não disponível para correção.");
      return;
    }

    setDxfFixing(prev => ({ ...prev, [drawingCode]: true }));
    const id = toast.loading(`Corrigindo ${drawingCode}...`);

    try {
      const result = await (window as any).electron?.analyzer?.fixFresa37to18?.(res.data.path);

      if (result?.ok) {
        toast.success(`✅ ${drawingCode} corrigido! substituições: ${result.changes?.fresa37Replacements}`);
        if (onAction && data) {
          onAction(data.fullpath, `[Manual] DXF: corrigido Fresa 37mm para 18mm no desenho "${drawingCode}"`);
        }

        // Atualizar o estado local para refletir a correção imediatamente
        setDxfResults(prev => {
          const next = { ...prev };
          const current = next[drawingCode];
          if (current?.status === 'found' && current.data) {
            next[drawingCode] = {
              ...current,
              data: {
                ...current.data,
                panelInfo: current.data.panelInfo ? {
                  ...current.data.panelInfo,
                  dimension: '18' // Força o status de 18mm
                } : undefined,
                fresaInfo: current.data.fresaInfo ? {
                  ...current.data.fresaInfo,
                  fresa37List: [], // Limpa a lista de fresas pendentes
                  usinagem37List: [], // Limpa a lista de usinagens pendentes
                  count37: 0,
                  usinagemCount37: 0
                } : undefined
              }
            };
          }
          return next;
        });
      } else {
        toast.error(`Erro em ${drawingCode}: ${result?.message || 'Falha ao corrigir'}`);
      }
    } catch (e: any) {
      toast.error(`Erro na correção: ${String(e?.message || e)}`);
    } finally {
      setDxfFixing(prev => ({ ...prev, [drawingCode]: false }));
      toast.dismiss(id);
    }
  }

  // Função para buscar produto no ERP
  async function handleErpSearch() {
    if (!erpSearchCode && !erpSearchDesc && !erpSearchType) {
      toast.warning('Por favor, preencha um dos campos para buscar.');
      return;
    }

    setErpSearching(true);
    setErpSearchResults([]);
    const id = toast.loading(`Buscando no ERP...`);

    try {
      const result = await (window as any).electron?.analyzer?.searchErpProduct?.({
        code: erpSearchCode,
        desc: erpSearchDesc,
        type: erpSearchType
      });

      if (result?.ok && result?.results && result.results.length > 0) {
        setErpSearchResults(result.results);
        toast.dismiss(id);
        toast.success(`✓ Encontrados ${result.results.length} produto(s)`);
      } else {
        setErpSearchResults([]);
        toast.dismiss(id);
        toast.warning(result?.message || 'Nenhum produto encontrado.');
      }
    } catch (e: any) {
      setErpSearchResults([]);
      toast.dismiss(id);
      toast.error(`Erro ao buscar produto: ${String(e?.message || e)}`);
    } finally {
      setErpSearching(false);
      toast.dismiss(id);
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
        className="w-[50%] sm:w-[50%] sm:max-w-none p-0 bg-[#161616] text-white border-l border-zinc-800"
      >
        <div className="h-full flex flex-col">
          {/* HEADER */}
          <SheetHeader className="px-6 py-6 bg-[#1B1B1B] border-b border-[#2C2C2C] relative overflow-hidden shrink-0">
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none rounded-full blur-3xl ${data?.status === 'OK' ? 'bg-emerald-500' :
              data?.status === 'ERRO' ? 'bg-rose-500' : 'bg-zinc-500'
              }`} />

            <div className="flex items-start gap-4 relative z-10">
              <div className={`p-3 rounded-xl bg-[#111] border border-[#232323] shadow-inner ${data?.status === 'OK' ? 'text-emerald-400' :
                data?.status === 'ERRO' ? 'text-rose-400' : 'text-zinc-400'
                }`}>
                <FileJson className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <SheetTitle className="text-xl font-bold text-white tracking-tight leading-tight truncate pr-6">
                  {data?.filename || "Arquivo sem nome"}
                </SheetTitle>
                <div className="mt-1 flex items-center gap-3">
                  <SheetDescription className="text-xs text-[#A7A7A7] font-medium flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> Processado em {data?.timestamp || "-"}
                  </SheetDescription>
                  <div className="h-1 w-1 rounded-full bg-[#333]" />
                  <div className="flex gap-1.5">
                    <StatusChip status={data?.status} />
                  </div>
                </div>

                {/* Tags Pill-Style */}
                {(data?.tags || []).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(data?.tags || []).map((t, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[#3498DB] border-[#3498DB]/20 bg-[#3498DB]/5 text-[9px] font-bold tracking-widest px-2.5 py-0.5"
                      >
                        {formatTag(t)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#161616]">
            {/* ERROS */}
            {(data?.errors?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 overflow-hidden shadow-[0_4px_20px_rgba(244,63,94,0.05)]">
                <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-widest flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Inconformidades Detectadas
                  </div>
                  <Badge variant="outline" className="bg-rose-500 text-white border-none text-[10px] h-5 px-2">
                    {data?.errors?.length}
                  </Badge>
                </div>
                <ul className="divide-y divide-rose-500/10">
                  {data!.errors!.map((e, i) => {
                    const isMachineError = (e || "").toString().toUpperCase().includes("PROBLEMA NA GERAÇÃO DE MÁQUINAS");
                    return (
                      <li key={i} className="px-5 py-3 group hover:bg-rose-500/5 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span className="text-rose-100/90 text-sm leading-relaxed">{e}</span>
                          </div>
                          {isMachineError && (
                            <button
                              onClick={handleMoveToOk}
                              className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg hover:shadow-rose-900/40 active:scale-95 transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mover para OK
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* AVISOS */}
            {(data?.warnings?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-widest flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Avisos do Sistema
                  </div>
                  <Badge variant="outline" className="bg-amber-500 text-black border-none text-[10px] h-5 px-2">
                    {data?.warnings?.length}
                  </Badge>
                </div>
                <ul className="divide-y divide-amber-500/10">
                  {data!.warnings!.map((w, i) => (
                    <li key={i} className="px-5 py-3 group hover:bg-amber-500/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-amber-100/90 text-sm leading-relaxed">{w}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* MÁQUINAS (dedupadas) */}
            {machines.length > 0 && (
              <section className="rounded-xl border border-[#232323] bg-[#1B1B1B] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#2C2C2C]">
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer group"
                  onClick={() => setMachinesOpen(!machinesOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-[#3498DB]">
                      <Grid3X3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">Máquinas Detectadas</h3>
                      <p className="text-[10px] text-[#A7A7A7] font-medium uppercase tracking-widest">{machines.length} plugins identificados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-[#3498DB] shadow-[0_0_8px_rgba(52,152,219,0.5)]" />
                    <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${machinesOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown className="h-4 w-4 text-[#666]" />
                    </div>
                  </div>
                </div>
                {machinesOpen && (
                  <div className="px-5 pb-5 pt-2">
                    <div className="rounded-lg overflow-hidden border border-[#232323] bg-[#111]">
                      <table className="w-full text-xs">
                        <thead className="bg-[#1B1B1B]">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-[#666] uppercase font-bold tracking-widest text-[9px]">ID do Plugin</th>
                            <th className="text-left px-4 py-2.5 text-[#666] uppercase font-bold tracking-widest text-[9px]">Nome amigável</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232323]">
                          {machines.map((m, i) => (
                            <tr key={`${m.id ?? i}`} className="group/row hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 font-mono text-[#3498DB]">{m.id || "-"}</td>
                              <td className="px-4 py-3 text-white font-medium">{m.name || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* CHAVE DE IMPORTAÇÃO */}
            {data?.meta?.importKey && (
              <section className="rounded-xl border border-[#232323] bg-[#1B1B1B] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#2C2C2C]">
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer group"
                  onClick={() => setImportKeyOpen(!importKeyOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-emerald-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">Chave de Importação</h3>
                      <p className="text-[10px] text-[#A7A7A7] font-medium uppercase tracking-widest">Token de validação único</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${importKeyOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown className="h-4 w-4 text-[#666]" />
                    </div>
                  </div>
                </div>
                {importKeyOpen && (
                  <div className="px-5 pb-5 pt-2">
                    <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#232323] relative">
                      <div className="absolute top-2 right-2 text-emerald-400 opacity-20"><Zap className="h-8 w-8" /></div>
                      <div className="font-mono text-[10px] break-all select-all text-emerald-300/80 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                        {data.meta.importKey}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* BUSCA DE PEDIDO (informações do PHP) */}
            {orderNum && (
              <section className="rounded-xl border border-[#232323] bg-[#1B1B1B] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#2C2C2C]">
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer group"
                  onClick={() => setOrderInfoOpen(!orderInfoOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-[#3498DB]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">Informações do Pedido</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        Pedido <span className="text-white">#{orderNum}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`h-2 w-2 rounded-full ${orderComments.some(c => c.txt_comentario?.trim()) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#333]'}`} />
                    <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${orderInfoOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown className="h-4 w-4 text-[#666]" />
                    </div>
                  </div>
                </div>
                {orderInfoOpen && (
                  <div className="px-5 pb-5 pt-2">
                    {orderLoading ? (
                      <div className="flex items-center justify-center py-8 space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3498DB] animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3498DB] animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3498DB] animate-bounce"></div>
                      </div>
                    ) : orderComments.length > 0 ? (
                      <div className="space-y-4">
                        {orderComments.map((c, i) => (
                          <div key={i} className="p-4 rounded-lg bg-[#111] border border-[#232323] space-y-2 group/comment hover:border-[#333] transition-colors">
                            {c.txt_titulo && (
                              <div className="text-[9px] uppercase font-bold text-[#3498DB] tracking-widest mb-1 opacity-80 group-hover/comment:opacity-100 transition-opacity">
                                {c.txt_titulo}
                              </div>
                            )}
                            <div className="text-sm text-white/90 leading-relaxed font-medium">
                              {c.txt_comentario || "Nenhum comentário registrado."}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 rounded-lg bg-[#111] border border-dashed border-[#232323] space-y-2 opacity-60">
                        <AlertTriangle className="h-8 w-8 text-[#A7A7A7]" />
                        <p className="text-sm italic text-[#555]">Nenhum comentário encontrado no servidor.</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ITENS ESPECIAIS (ES0?) exceto ES08 */}
            <section className="rounded-xl border border-[#232323] bg-[#1B1B1B] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#2C2C2C]">
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer group"
                onClick={() => setSpecialItemsOpen(!specialItemsOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-purple-400">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Itens Especiais (ES0?)</h3>
                    <p className="text-[10px] text-[#A7A7A7] font-medium uppercase tracking-widest">Detecção de parâmetros customizados</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${(Array.isArray(data?.meta?.specialItems) && data!.meta!.specialItems.length > 0) ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-[#333]'}`} />
                  <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${specialItemsOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-4 w-4 text-[#666]" />
                  </div>
                </div>
              </div>
              {specialItemsOpen && (
                <div className="px-5 pb-5 pt-2">
                  {Array.isArray(data?.meta?.specialItems) && data!.meta!.specialItems.length > 0 ? (
                    <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner">
                      <table className="w-full text-xs">
                        <thead className="bg-[#1B1B1B] text-[#666] border-b border-[#232323]">
                          <tr>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base</th>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Dimensão</th>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232323]">
                          {data!.meta!.specialItems.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors group/inner">
                              <td className="px-4 py-3 font-mono text-purple-400">{item.itemBase}</td>
                              <td className="px-4 py-3 text-white/80">{item.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                              <td className="px-4 py-3 text-[#A7A7A7] truncate max-w-[100px]">{item.dimensao}</td>
                              <td className="px-4 py-3 text-white/60 text-[11px] leading-tight max-w-[180px] break-words">
                                {item.descricao || <span className="text-[#444] italic">vazio</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
                      <p className="text-xs italic text-[#555]">Nenhum item especial ES0 detectado.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ITENS MUXARABI (MX008) */}
            <section className="rounded-xl border border-[#232323] bg-[#1B1B1B] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#2C2C2C]">
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer group"
                onClick={() => setMuxarabiOpen(!muxarabiOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#111] border border-[#232323] text-orange-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Itens Muxarabi (MX008)</h3>
                    <p className="text-[10px] text-[#A7A7A7] font-medium uppercase tracking-widest">Validação de grades e furos</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${(Array.isArray(data?.meta?.muxarabiItems) && data!.meta!.muxarabiItems.length > 0) ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-[#333]'}`} />
                  <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${muxarabiOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-4 w-4 text-[#666]" />
                  </div>
                </div>
              </div>
              {muxarabiOpen && (
                <div className="px-5 pb-5 pt-2">
                  {Array.isArray(data?.meta?.muxarabiItems) && data!.meta!.muxarabiItems.length > 0 ? (
                    <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden shadow-inner">
                      <table className="w-full text-xs">
                        <thead className="bg-[#1B1B1B] text-[#666] border-b border-[#232323]">
                          <tr>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Item Base</th>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Desenho</th>
                            <th className="text-left px-4 py-3 uppercase font-bold tracking-widest text-[9px]">Descrição</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232323]">
                          {data!.meta!.muxarabiItems.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 font-mono text-orange-400">{item.itemBase}</td>
                              <td className="px-4 py-3 text-white/80">{item.desenho || <span className="text-[#444] italic">vazio</span>}</td>
                              <td className="px-4 py-3 text-white/60 text-[11px] leading-tight break-words max-w-[250px]">
                                {item.descricao || <span className="text-[#444] italic">vazio</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-[#232323] opacity-40">
                      <p className="text-xs italic text-[#555]">Nenhum item muxarabi detectado.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ES08 (DUPLADO 37MM) - Dados complementares */}
            {Array.isArray(data?.meta?.es08Matches) && (data!.meta!.es08Matches!.length > 0) && (
              <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 overflow-hidden shadow-[0_4px_20px_rgba(244,63,94,0.1)]">
                <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-widest flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Itens ES08 - Duplado 37MM
                  </div>
                  <Badge variant="outline" className="bg-rose-500 text-white border-none text-[10px] h-5 px-2">
                    {data?.meta?.es08Matches.length}
                  </Badge>
                </div>

                <div className="p-5 space-y-6">
                  {/* Grid de Itens ES08 */}
                  <div className="grid grid-cols-1 gap-3">
                    {(data?.meta?.es08Matches as any[]).map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-black/40 border border-rose-500/10 group hover:border-rose-500/30 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-[9px] uppercase font-bold text-rose-300 tracking-widest opacity-60">ID do Item</div>
                          <span className="font-mono text-[10px] text-white bg-[#0a0a0a] px-2 py-0.5 rounded border border-white/5">{item.id || "—"}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Database className="h-3 w-3 text-zinc-500" />
                            <span className="text-xs text-zinc-400">Ref:</span>
                            <span className="text-xs text-white/90 font-medium truncate">{item.referencia || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Layers className="h-3 w-3 text-zinc-500" />
                            <span className="text-xs text-zinc-400">Dese:</span>
                            <span className="text-xs text-white/90 font-medium truncate">{item.desenho || "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Buscar arquivo DXF (Múltiplos desenhos) */}
                  <div className="pt-5 border-t border-rose-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <Search className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-tight">Busca de Desenho DXF</h4>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">{uniqueDrawings.length} arquivos detectados</p>
                        </div>
                      </div>
                      <button
                        onClick={searchAllDrawings}
                        disabled={dxfSearching}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg active:scale-95"
                      >
                        {dxfSearching ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Buscando...
                          </span>
                        ) : "Buscar Todos"}
                      </button>
                    </div>

                    {/* Lista de Resultados por Desenho */}
                    <div className="space-y-4">
                      {uniqueDrawings.map((drawing) => {
                        const result = dxfResults[drawing];
                        const isFixing = dxfFixing[drawing];
                        const dxfData = result?.data;

                        return (
                          <div key={drawing} className="rounded-xl border border-[#232323] bg-[#111] overflow-hidden shadow-inner group/dxf">
                            {/* Cabeçalho do Card DXF */}
                            <div className="px-4 py-2.5 bg-[#1B1B1B] border-b border-[#232323] flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-zinc-500 group-hover/dxf:text-rose-400 transition-colors" />
                                <div className="font-mono text-[10px] text-zinc-300 truncate">{drawing}</div>
                              </div>
                              <div className="text-[10px] uppercase font-bold tracking-widest">
                                {!result ? (
                                  <span className="text-[#444]">Pendente</span>
                                ) : result.status === 'searching' ? (
                                  <span className="text-yellow-500 animate-pulse">Buscando</span>
                                ) : result.status === 'found' ? (
                                  <span className="text-emerald-500">Localizado</span>
                                ) : result.status === 'not_found' ? (
                                  <span className="text-rose-500">Não Encontrado</span>
                                ) : (
                                  <span className="text-red-500">Falha</span>
                                )}
                              </div>
                            </div>

                            {/* Conteúdo do Resultado DXF */}
                            {result?.status === 'found' && dxfData && (
                              <div className="p-4 space-y-4">
                                <div className="p-3 bg-[#0a0a0a] rounded-lg border border-white/[0.03]">
                                  <div className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-widest pl-1">Diretório do Arquivo</div>
                                  <div className="font-mono text-[10px] text-zinc-400 break-all select-all leading-relaxed pr-1 underline underline-offset-4 decoration-rose-500/20">
                                    {dxfData.path}
                                  </div>
                                </div>

                                {dxfData.panelInfo && (
                                  <div className={`p-3 rounded-lg border ${Math.abs(parseFloat(dxfData.panelInfo.dimension)) === 18 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                                    {Math.abs(parseFloat(dxfData.panelInfo.dimension)) === 18 ? (
                                      <div className="text-emerald-400 font-bold flex items-center gap-2 text-[10px] uppercase tracking-wide">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Painel de 18mm Verificado</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        <div className="text-blue-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                                          <Info className="h-3.5 w-3.5" />
                                          PAINEL PRINCIPAL:
                                        </div>
                                        <div className="text-white text-sm font-medium pl-5">
                                          {dxfData.panelInfo.panelCode} <span className="font-mono text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded ml-1">({dxfData.panelInfo.dimension})</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {dxfData.fresaInfo && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {/* SEÇÃO FRESAS */}
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-[9px] font-bold text-purple-400 uppercase tracking-widest pl-1">
                                        <Zap className="h-3 w-3" /> FRESAS <span className="opacity-40">({dxfData.fresaInfo.fresa37List?.length || 0})</span>
                                      </div>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                                        {dxfData.fresaInfo.fresa37List?.map((item: any, idx: number) => (
                                          <div key={`fresa-${idx}`} className="bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg flex items-center justify-between group/item">
                                            <span className="text-[9px] font-mono text-purple-300">#{item.index} (L{item.line})</span>
                                            <div className="flex gap-1">
                                              {item.hasNegative37 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" title="-37mm" />}
                                              {item.hasPositive37 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" title="37mm" />}
                                            </div>
                                          </div>
                                        ))}
                                        {(!dxfData.fresaInfo.fresa37List || dxfData.fresaInfo.fresa37List.length === 0) && (
                                          <div className="text-[9px] italic text-[#333] pl-1">Sem itens</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* SEÇÃO USINAGENS */}
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-[9px] font-bold text-blue-400 uppercase tracking-widest pl-1">
                                        <Layers className="h-3 w-3" /> USINAGENS <span className="opacity-40">({dxfData.fresaInfo.usinagem37List?.length || 0})</span>
                                      </div>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                                        {dxfData.fresaInfo.usinagem37List?.map((item: any, idx: number) => (
                                          <div key={`usinagem-${idx}`} className="bg-blue-500/5 border border-blue-500/10 p-2 rounded-lg flex items-center justify-between group/item">
                                            <span className="text-[9px] font-mono text-blue-300">#{item.index} (L{item.line})</span>
                                            <div className="flex gap-1">
                                              {item.hasNegative37 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" title="-37mm" />}
                                              {item.hasPositive37 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" title="37mm" />}
                                            </div>
                                          </div>
                                        ))}
                                        {(!dxfData.fresaInfo.usinagem37List || dxfData.fresaInfo.usinagem37List.length === 0) && (
                                          <div className="text-[9px] italic text-[#333] pl-1">Sem itens</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Botão de Correção (Unificado) */}
                                {(
                                  (dxfData.fresaInfo?.count37 > 0 || dxfData.fresaInfo?.usinagemCount37 > 0) ||
                                  (dxfData.panelInfo?.dimension === '-37' || dxfData.panelInfo?.dimension === '37')
                                ) && (
                                    <button
                                      onClick={() => fixFresa37to18(drawing)}
                                      disabled={isFixing}
                                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/50 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-3 shadow-lg shadow-rose-900/20 active:scale-95"
                                    >
                                      {isFixing ? (
                                        <>
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                          Executando Correção Automática...
                                        </>
                                      ) : (
                                        <>
                                          <Zap className="h-4 w-4" />
                                          Corrigir TUDO (Fresa + Usinagem + Painel)
                                        </>
                                      )}
                                    </button>
                                  )}
                              </div>
                            )}

                            {/* Mensagem de Erro/Não encontrado */}
                            {result?.message && (
                              <div className="p-4 text-xs text-rose-300 bg-rose-500/10 border-t border-rose-500/20 flex items-center gap-3 italic">
                                <AlertTriangle className="h-5 w-5 opacity-50 shrink-0" />
                                {result.message}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {uniqueDrawings.length === 0 && (
                        <div className="text-center text-zinc-600 text-[10px] py-10 rounded-xl border border-dashed border-[#232323] uppercase font-bold tracking-widest">
                          Nenhum desenho identificado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Redundant check removed */}

            {/* MOVER PARA OK - Sempre visível se houver desenhos, com aviso se não estiver 100% */}
            {uniqueDrawings.length > 0 && (
              (() => {
                const allOk = uniqueDrawings.every(d => {
                  const info = dxfResults[d]?.data;
                  if (!info) return false;
                  const isPanel18 = Math.abs(parseFloat(info.panelInfo?.dimension || '0')) === 18;
                  const noFresa37 = (info.fresaInfo?.count37 || 0) === 0;
                  const noUsinagem37 = (info.fresaInfo?.usinagemCount37 || 0) === 0;
                  return isPanel18 && noFresa37 && noUsinagem37;
                });

                return (
                  <div className={`mt-6 pt-6 border-t ${allOk ? 'border-emerald-500/20' : 'border-amber-500/20'} flex items-center justify-between bg-black/20 -mx-5 px-5 py-4 rounded-b-xl`}>
                    <div className="flex items-center gap-2">
                      {allOk ? (
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${allOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {allOk ? 'Validação Concluída' : 'Atenção Necessária'}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {allOk ? 'Todos os desenhos estão em conformidade.' : 'Alguns desenhos requerem correção DXF.'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleMoveToOk}
                      className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95 ${allOk
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                        : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                        }`}
                    >
                      Mover para OK
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })()
            )}

            {/* ERP SEARCH PANEL - visible if Coringa detected OR item without code */}
            {
              ((Array.isArray(data?.meta?.coringaMatches) && data.meta.coringaMatches.length > 0) || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO"))) && (
                <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.1)]">
                  <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Conexão Direta ERP: Busca de Produto
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/10 text-[11px] text-blue-200/70 leading-relaxed">
                      Pesquise códigos originais no servidor para preencher campos coringa ou referências vazias.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Código do Produto</label>
                        <input
                          placeholder="Ex: 10.01.0001"
                          value={erpSearchCode}
                          onChange={(e) => {
                            setErpSearchCode(e.target.value);
                            if (e.target.value) {
                              setErpSearchDesc('');
                              setErpSearchType('');
                            }
                          }}
                          disabled={!!erpSearchDesc || !!erpSearchType}
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none disabled:opacity-30 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Tipo de Item</label>
                        <select
                          value={erpSearchType}
                          onChange={(e) => {
                            setErpSearchType(e.target.value);
                            if (e.target.value) setErpSearchCode('');
                          }}
                          disabled={!!erpSearchCode}
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-xs focus:border-blue-500 outline-none disabled:opacity-30 transition-all font-bold"
                        >
                          <option value="">TODOS OS TIPOS</option>
                          <option value="CHAPAS">CHAPAS</option>
                          <option value="FITAS">FITAS</option>
                          <option value="TAPAFURO">TAPAFURO</option>
                          <option value="PAINEL">PAINEL</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Descrição (Cor, Acabamento, Espessura)</label>
                      <input
                        placeholder="Ex: BRANCO SUPREMO 18MM"
                        value={erpSearchDesc}
                        onChange={(e) => {
                          setErpSearchDesc(e.target.value);
                          if (e.target.value) setErpSearchCode('');
                        }}
                        disabled={!!erpSearchCode}
                        className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none disabled:opacity-30 transition-all"
                      />
                    </div>

                    <button
                      disabled={erpSearching || (!erpSearchCode && !erpSearchDesc && !erpSearchType)}
                      onClick={handleErpSearch}
                      className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {erpSearching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Acessando Servidor...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Executar Busca no ERP
                        </>
                      )}
                    </button>

                    {/* Resultados em Tabela Estilizada */}
                    {erpSearchResults.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="rounded-lg border border-[#232323] bg-[#0a0a0a] overflow-hidden shadow-inner">
                          <table className="w-full text-[10px]">
                            <thead className="bg-[#1B1B1B] text-[#666] border-b border-[#232323]">
                              <tr>
                                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest">Cod</th>
                                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest">Descrição detalhada</th>
                                <th className="w-16"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#151515]">
                              {erpSearchResults.map((prod, idx) => (
                                <tr key={idx} className="hover:bg-blue-500/5 transition-colors group">
                                  <td className="px-3 py-2 font-mono text-blue-400 font-bold">{prod.code}</td>
                                  <td className="px-3 py-2 text-white/70 font-medium">{prod.description}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => {
                                        if (Array.isArray(data?.meta?.coringaMatches) && data.meta.coringaMatches.length > 0) {
                                          setCoringaTo(prod.code);
                                        }
                                        const showRefPanel = ((data?.meta?.referenciaEmpty?.length ?? 0) > 0 || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO")));
                                        if (showRefPanel) {
                                          setRefFillValue(prod.code);
                                        }
                                        toast.success(`Código "${prod.code}" selecionado`, {
                                          description: "O valor foi copiado para os campos de substituição abaixo.",
                                          icon: <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        });
                                      }}
                                      className="p-1 px-2 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-bold uppercase tracking-tighter"
                                    >
                                      Copi
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )
            }

            {/* COR CORINGA - quick replace UI */}
            {
              Array.isArray(data?.meta?.coringaMatches) && (data!.meta!.coringaMatches!.length > 0) && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden shadow-[0_4px_20px_rgba(245,158,11,0.1)]">
                  <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Cor Coringa Detectada
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-500/10 text-[11px] text-amber-200/70 leading-relaxed">
                      Sigla genérica identificada no XML. Escolha a sigla original e o novo código para substituição definitiva.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Sigla Encontrada</label>
                        <select
                          value={coringaFrom ?? ""}
                          disabled={!!lastReplace}
                          onChange={(e) => setCoringaFrom(e.target.value)}
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-sm focus:border-amber-500 outline-none disabled:opacity-50 transition-all font-bold"
                        >
                          {filteredCoringaMatches.map((m, i) => (
                            <option key={i} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Novo Código/Valor</label>
                        <input
                          placeholder="Digite o código..."
                          value={coringaTo}
                          disabled={!!lastReplace}
                          onChange={(e) => setCoringaTo(e.target.value)}
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-sm focus:border-amber-500 outline-none disabled:opacity-50 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <button
                      disabled={!coringaFrom || !coringaTo || isReplacing || !!lastReplace}
                      onClick={() => setConfirmCoringaOpen(true)}
                      className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {isReplacing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Aplicar Substituição de Cor
                    </button>

                    {/* CG1 / CG2 bulk replace UI */}
                    {(hasCG1 || hasCG2) && (
                      <div className="mt-4 border-t border-amber-500/10 pt-4 space-y-4">
                        <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider text-center opacity-60">
                          Troca de Siglas Compartilhadas (Lote)
                        </div>
                        <div className={`grid gap-4 ${hasCG1 && hasCG2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {hasCG1 && (
                            <div className="space-y-2">
                              <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">CG1 →</label>
                              <div className="flex gap-2">
                                <input
                                  value={cg1Replace}
                                  disabled={cg1Done}
                                  onChange={(e) => setCg1Replace(e.target.value)}
                                  placeholder="Ex: LA"
                                  className="w-full bg-[#111] border border-[#2C2C2C] text-white px-2 py-1.5 rounded-lg text-[11px] outline-none font-mono"
                                />
                                <button
                                  disabled={!cg1Replace || cg1Done}
                                  onClick={async () => {
                                    if (!data) return;
                                    const id = toast.loading('Trocando CG1...');
                                    try {
                                      const res = await (window as any).electron?.analyzer?.replaceCgGroups?.(data.fullpath, { 'CG1': cg1Replace.trim() });
                                      if (res?.ok) {
                                        toast.success('CG1 trocado com sucesso.');
                                        if (onAction && data) onAction(data.fullpath, `[Manual] Coringa Grupo: trocada sigla CG1 para "${cg1Replace}"`);
                                        setCg1Done(true);
                                        await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                                      }
                                    } catch (e: any) { toast.error(String(e?.message || e)); }
                                    finally { toast.dismiss(id); }
                                  }}
                                  className="px-2 bg-amber-600/20 text-amber-500 border border-amber-600/30 rounded-lg hover:bg-amber-600 hover:text-white transition-all"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                          {hasCG2 && (
                            <div className="space-y-2">
                              <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">CG2 →</label>
                              <div className="flex gap-2">
                                <input
                                  value={cg2Replace}
                                  disabled={cg2Done}
                                  onChange={(e) => setCg2Replace(e.target.value)}
                                  placeholder="Ex: MO"
                                  className="w-full bg-[#111] border border-[#2C2C2C] text-white px-2 py-1.5 rounded-lg text-[11px] outline-none font-mono"
                                />
                                <button
                                  disabled={!cg2Replace || cg2Done}
                                  onClick={async () => {
                                    if (!data) return;
                                    const id = toast.loading('Trocando CG2...');
                                    try {
                                      const res = await (window as any).electron?.analyzer?.replaceCgGroups?.(data.fullpath, { 'CG2': cg2Replace.trim() });
                                      if (res?.ok) {
                                        toast.success('CG2 trocado com sucesso.');
                                        if (onAction && data) onAction(data.fullpath, `[Manual] Coringa Grupo: trocada sigla CG2 para "${cg2Replace}"`);
                                        setCg2Done(true);
                                        await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                                      }
                                    } catch (e: any) { toast.error(String(e?.message || e)); }
                                    finally { toast.dismiss(id); }
                                  }}
                                  className="px-2 bg-amber-800/20 text-amber-700 border border-amber-800/30 rounded-lg hover:bg-amber-800 hover:text-white transition-all"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )
            }

            {/* REFERENCIA empty fill UI */}
            {
              ((data?.meta?.referenciaEmpty?.length ?? 0) > 0 || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO"))) && (
                <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 overflow-hidden shadow-[0_4px_20px_rgba(244,63,94,0.1)]">
                  <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Itens com Referência Pendente
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="p-3 bg-rose-900/20 rounded-lg border border-rose-500/10 text-[11px] text-rose-200/70 leading-relaxed">
                      Selecione o item detectado sem código e informe o valor correto (obtido na busca ERP acima).
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Selecionar Item do XML</label>
                        <select
                          value={selectedRefSingle ?? ''}
                          onChange={(e) => setSelectedRefSingle(e.target.value || null)}
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-rose-500 transition-all font-bold"
                        >
                          <option value="">-- SELECIONE O COMPONENTE --</option>
                          {((data?.meta?.referenciaEmpty || []) as any[]).filter(r => !!r.id).map((r, i) => {
                            const key = `${r.id}|${r.descricao || ''}`;
                            return (
                              <option key={i} value={key}>
                                ID: {r.id} {r.descricao ? `| ${r.descricao.slice(0, 35)}...` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Detalhes do Item Selecionado */}
                      {selectedRefSingle && (() => {
                        const item = (data?.meta?.referenciaEmpty as any[])?.find(r => `${r.id}|${r.descricao || ''}` === selectedRefSingle);
                        if (!item) return null;
                        return (
                          <div className="p-4 rounded-xl bg-black/40 border border-rose-500/10 space-y-4 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity"><Package className="h-12 w-12 text-rose-500" /></div>
                            <div className="relative z-10">
                              <div className="text-[9px] text-rose-300 font-bold uppercase mb-1.5 opacity-60 tracking-tighter">Descrição Completa</div>
                              <div className="text-xs text-white/90 italic font-medium leading-relaxed">"{item.descricao || '—'}"</div>
                            </div>
                            {item.caminhoItemCatalog && (
                              <div className="relative z-10">
                                <div className="text-[9px] text-rose-300 font-bold uppercase mb-1.5 opacity-60 tracking-tighter">Localização no Catálogo</div>
                                <div className="text-[10px] text-zinc-400 font-mono break-all leading-tight bg-[#0a0a0a] p-2 rounded-lg border border-white/[0.03]">
                                  {item.caminhoItemCatalog}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-1.5">
                        <label className="text-[9px] text-[#A7A7A7] uppercase font-bold tracking-widest pl-1">Novo Código de Referência (ERP)</label>
                        <input
                          value={refFillValue}
                          onChange={(e) => setRefFillValue(e.target.value)}
                          placeholder="Ex: 10.01.2023"
                          className="w-full bg-[#111] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-rose-500 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <button
                      disabled={!selectedRefSingle || !refFillValue}
                      onClick={() => setConfirmRefOpen(true)}
                      className="w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Confirmar Preenchimento
                    </button>
                  </div>
                </section>
              )}

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
                          if (onAction && data) {
                            onAction(data.fullpath, `[Manual] Coringa: substituído "${coringaFrom}" por "${coringaTo}"`);
                          }
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
            </AlertDialog >

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
                          toast.success(`Substituições aplicadas (total: ${Object.values(res.counts || {}).reduce((s: any, n: any) => s + (n || 0), 0)})`);
                          setLastReplace({ backupPath: res.backupPath, map: map, counts: res.counts });
                        } else {
                          toast.error(`Falha: ${res?.message || 'nenhuma ocorrência encontrada'}`);
                        }
                      } catch (e: any) {
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
            </AlertDialog >

            {/* CONFIRMAÇÃO - Preencher REFERENCIA */}
            <AlertDialog open={confirmRefOpen} onOpenChange={setConfirmRefOpen}>
              <AlertDialogContent className="bg-[#1a1a1a] border border-rose-500/30">
                <AlertDialogTitle className="text-white">Confirmar preenchimento de REFERENCIA?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-300">
                  {(() => {
                    const [selId, ...selDescParts] = (selectedRefSingle || '').split('|');
                    const selDesc = selDescParts.join('|');
                    return (
                      <>
                        Você está prestes a preencher REFERENCIA do item:
                        <div className="mt-2 p-2 bg-white/5 rounded border border-white/10">
                          <div className="font-bold text-rose-300">ID: {selId}</div>
                          {selDesc && <div className="text-xs italic text-zinc-400">"{selDesc}"</div>}
                        </div>
                        <div className="mt-2">
                          Novo código: <span className="font-mono font-bold text-rose-300">{refFillValue}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="mt-2 text-[10px] opacity-50 italic">Será criado um backup do arquivo original.</div>
                </AlertDialogDescription>
                <div className="flex gap-2 justify-end">
                  <AlertDialogCancel className="bg-zinc-700 text-white hover:bg-zinc-600">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!data || !selectedRefSingle) return;
                      setConfirmRefOpen(false);
                      const id = toast.loading('Trocando REFERENCIA...');
                      try {
                        const [selId, ...selDescParts] = (selectedRefSingle || '').split('|');
                        const selDesc = selDescParts.join('|');
                        const replacements = [{ id: selId, descricao: selDesc, value: refFillValue }];
                        const res = await (window as any).electron?.analyzer?.fillReferenciaByIds?.(data.fullpath, replacements);
                        if (res?.ok) {
                          toast.success(`Preenchidas ${Object.values(res.counts || {}).reduce((s: any, n: any) => s + (n || 0), 0)} ocorrência(s)`);
                          if (onAction && data) {
                            onAction(data.fullpath, `[Manual] Referência: preenchido ID "${selectedRefSingle}" com valor "${refFillValue}"`);
                          }
                          setLastReplace({ backupPath: res.backupPath, type: 'fill-referencia-ids', replacements, counts: res.counts });
                          setRefFillValue('');
                          setSelectedRefSingle(null);
                        } else {
                          toast.error(`Falha: ${res?.message || 'nenhuma ocorrência encontrada'}`);
                        }
                      } catch (e: any) {
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
          </div>
        </div>
      </SheetContent>
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
