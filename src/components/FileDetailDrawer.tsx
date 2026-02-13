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
import { X, FileJson, AlertTriangle, Search, CheckCircle, Check, Grid3X3, ChevronDown, ChevronRight } from "lucide-react";

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

              {/* status */}
              <div className="ml-auto flex items-start gap-2">
                <StatusChip status={data?.status} />
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
                  {data!.errors!.map((e, i) => {
                    const isMachineError = (e || "").toString().toUpperCase().includes("PROBLEMA NA GERAÇÃO DE MÁQUINAS");

                    return (
                      <li key={i} className="text-rose-200 text-sm flex items-center justify-between gap-4 py-0.5">
                        <span>• {e}</span>
                        {isMachineError && (
                          <button
                            onClick={handleMoveToOk}
                            className="shrink-0 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Check className="h-3 w-3" />
                            Mover p/ OK
                          </button>
                        )}
                      </li>
                    );
                  })}
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
                <div
                  className="text-sm font-medium mb-2 opacity-80 flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
                  onClick={() => setMachinesOpen(!machinesOpen)}
                >
                  <div className="flex items-center gap-2">
                    {machinesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Máquinas detectadas
                  </div>
                </div>
                {machinesOpen && (
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
                )}
              </div>
            )}


            {/* CHAVE DE IMPORTAÇÃO */}
            {data?.meta?.importKey && (
              <section className="rounded-lg border border-zinc-700 bg-zinc-800/20 overflow-hidden">
                <div
                  className="px-4 py-2 text-zinc-300 text-sm font-medium flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-zinc-700"
                  onClick={() => setImportKeyOpen(!importKeyOpen)}
                >
                  <div className="flex items-center gap-2">
                    {importKeyOpen ? <ChevronDown className="h-4 w-4 text-emerald-400" /> : <ChevronRight className="h-4 w-4 text-emerald-400" />}
                    Chave de Importação
                  </div>
                </div>
                {importKeyOpen && (
                  <div className="p-3">
                    <div className="bg-black/40 p-2 rounded border border-zinc-700 font-mono text-[10px] break-all select-all text-emerald-300/90 leading-relaxed">
                      {data.meta.importKey}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* BUSCA DE PEDIDO (informações do PHP) */}
            {orderNum && (
              <section className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 overflow-hidden">
                <div
                  className="px-4 py-2 text-indigo-300 text-sm font-medium flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-indigo-500/10"
                  onClick={() => setOrderInfoOpen(!orderInfoOpen)}
                >
                  <div className="flex items-center gap-2">
                    {orderInfoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Informações do Pedido: <span className="text-white font-bold ml-1">{orderNum}</span>
                  </div>
                </div>
                {orderInfoOpen && (
                  <div className="p-4 space-y-3">
                    {orderLoading ? (
                      <div className="text-xs text-zinc-400 animate-pulse">Buscando dados no sistema...</div>
                    ) : orderComments.length > 0 ? (
                      <div className="space-y-4">
                        {orderComments.map((c, i) => (
                          <div key={i} className="space-y-1">
                            {c.txt_titulo && (
                              <div className="text-[10px] uppercase font-bold text-indigo-200 opacity-80">
                                {c.txt_titulo}
                              </div>
                            )}
                            <div className="text-sm text-white leading-relaxed bg-black/20 p-2 rounded border border-indigo-500/5">
                              {c.txt_comentario || "Sem comentário."}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500 italic">
                        Nenhum comentário encontrado para este pedido.
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ITENS ESPECIAIS (ES0?) exceto ES08 */}
            <section className="rounded-lg border border-purple-500/20 bg-purple-500/10 overflow-hidden">
              <div
                className="px-4 py-2 text-purple-300 text-sm font-medium flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-purple-500/10"
                onClick={() => setSpecialItemsOpen(!specialItemsOpen)}
              >
                <div className="flex items-center gap-2">
                  {specialItemsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Itens Especiais (ES0?)
                </div>
              </div>
              {specialItemsOpen && (
                <div className="p-4">
                  {Array.isArray(data?.meta?.specialItems) && data!.meta!.specialItems.length > 0 ? (
                    <div className="bg-black/20 rounded border border-purple-500/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-purple-900/20 text-purple-200">
                          <tr>
                            <th className="text-left px-3 py-2 border-b border-purple-500/10">ITEM_BASE</th>
                            <th className="text-left px-3 py-2 border-b border-purple-500/10">DESENHO</th>
                            <th className="text-left px-3 py-2 border-b border-purple-500/10">DIMENSÃO LxAxP</th>
                            <th className="text-left px-3 py-2 border-b border-purple-500/10">DESCRIÇÃO</th>
                          </tr>
                        </thead>
                        <tbody className="text-zinc-200 font-mono text-xs">
                          {data!.meta!.specialItems.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-purple-500/5 hover:bg-white/5">
                              <td className="px-3 py-2">{item.itemBase}</td>
                              <td className="px-3 py-2">{item.desenho || <span className="text-zinc-500 italic">vazio</span>}</td>
                              <td className="px-3 py-2 truncate">{item.dimensao}</td>
                              <td className="px-3 py-2 break-words whitespace-normal max-w-[200px]">{item.descricao || <span className="text-zinc-500 italic">vazio</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic">
                      nenhum item especial encontrado
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ITENS MUXARABI (MX008) */}
            <section className="rounded-lg border border-orange-500/20 bg-orange-500/10 overflow-hidden mt-1">
              <div
                className="px-4 py-2 text-orange-300 text-sm font-medium flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-orange-500/10"
                onClick={() => setMuxarabiOpen(!muxarabiOpen)}
              >
                <div className="flex items-center gap-2">
                  {muxarabiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Itens Muxarabi (MX008)
                </div>
              </div>
              {muxarabiOpen && (
                <div className="p-4">
                  {Array.isArray(data?.meta?.muxarabiItems) && data!.meta!.muxarabiItems.length > 0 ? (
                    <div className="bg-black/20 rounded border border-orange-500/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-orange-900/20 text-orange-200">
                          <tr>
                            <th className="text-left px-3 py-2 border-b border-orange-500/10">ITEM_BASE</th>
                            <th className="text-left px-3 py-2 border-b border-orange-500/10">DESENHO</th>
                            <th className="text-left px-3 py-2 border-b border-orange-500/10">DESCRIÇÃO</th>
                          </tr>
                        </thead>
                        <tbody className="text-zinc-200 font-mono text-xs">
                          {data!.meta!.muxarabiItems.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-orange-500/5 hover:bg-white/5">
                              <td className="px-3 py-2">{item.itemBase}</td>
                              <td className="px-3 py-2">{item.desenho || <span className="text-zinc-500 italic">vazio</span>}</td>
                              <td className="px-3 py-2 break-words whitespace-normal max-w-[250px]">{item.descricao || <span className="text-zinc-500 italic">vazio</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic">
                      nenhum item muxarabi encontrado
                    </div>
                  )}
                </div>
              )}
            </section>

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

                {/* Buscar arquivo DXF (Múltiplos desenhos) */}
                <div className="mt-3 pt-3 border-t border-rose-500/20">
                  <div className="bg-[#1a1a1a] border border-[#2C2C2C] rounded-md p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-rose-300">
                        Busca de Desenho DXF
                        {uniqueDrawings.length > 1 && <span className="ml-1 text-xs text-zinc-500">({uniqueDrawings.length} encontrados)</span>}
                      </div>
                      <button
                        onClick={searchAllDrawings}
                        disabled={dxfSearching}
                        className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
                      >
                        {dxfSearching ? "Buscando Todos..." : "Buscar Todos"}
                      </button>
                    </div>

                    {/* Lista de Resultados por Desenho */}
                    <div className="space-y-4">
                      {uniqueDrawings.map((drawing) => {
                        const result = dxfResults[drawing];
                        const isFixing = dxfFixing[drawing];
                        const dxfData = result?.data;

                        return (
                          <div key={drawing} className="border border-[#2C2C2C] rounded bg-[#1F1F1F] overflow-hidden">
                            {/* Cabeçalho do Card */}
                            <div className="px-3 py-2 bg-[#252525] border-b border-[#2C2C2C] flex items-center justify-between">
                              <div className="font-mono text-xs text-zinc-300">{drawing}</div>
                              <div className="text-xs">
                                {!result ? (
                                  <span className="text-zinc-500">Aguardando busca...</span>
                                ) : result.status === 'searching' ? (
                                  <span className="text-yellow-500">🔍 Buscando...</span>
                                ) : result.status === 'found' ? (
                                  <span className="text-green-400 font-bold">✓ Encontrado</span>
                                ) : result.status === 'not_found' ? (
                                  <span className="text-rose-400 font-bold">✗ Não encontrado</span>
                                ) : (
                                  <span className="text-red-400">Erro</span>
                                )}
                              </div>
                            </div>

                            {/* Conteúdo do Resultado */}
                            {result?.status === 'found' && dxfData && (
                              <div className="p-3 text-xs space-y-2">
                                <div>
                                  <span className="text-zinc-500">Caminho:</span>
                                  <div className="font-mono text-[10px] text-zinc-400 break-all select-all">
                                    {dxfData.path}
                                  </div>
                                </div>

                                {dxfData.panelInfo && (
                                  <div className="bg-blue-500/5 p-2 rounded border border-blue-500/10 mb-2">
                                    {(Math.abs(parseFloat(dxfData.panelInfo.dimension)) === 18) ? (
                                      <div className="text-green-400 font-medium flex items-center gap-2 py-1">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Arquivo configurado para 18mm</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="text-blue-400 font-medium mb-1 text-[11px] uppercase">📋 Primeiro PAINEL:</div>
                                        <div className="text-blue-300">
                                          {dxfData.panelInfo.panelCode} <span className="font-mono text-blue-400">({dxfData.panelInfo.dimension})</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                {dxfData.fresaInfo && (
                                  <div className="space-y-3">
                                    {/* SEÇÃO FRESAS */}
                                    {dxfData.fresaInfo.fresa37List && dxfData.fresaInfo.fresa37List.length > 0 && (
                                      <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
                                        <div className="text-purple-400 font-medium mb-1 text-[11px] uppercase flex items-center gap-1">
                                          <span>🔧 FRESAS</span>
                                          <span className="text-[9px] opacity-60">({dxfData.fresaInfo.fresa37List.length} itens)</span>
                                        </div>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                          {dxfData.fresaInfo.fresa37List.map((item: any, idx: number) => (
                                            <div key={`fresa-${idx}`} className="bg-purple-900/20 p-1.5 rounded border border-purple-500/20">
                                              <div className="flex justify-between items-center mb-1">
                                                <span className="font-mono text-[9px] text-purple-300">ITEM #{item.index} (L{item.line})</span>
                                              </div>
                                              <div className="space-y-0.5 ml-1 text-[9px]">
                                                <div className={item.hasNegative37 ? "text-green-300" : "text-zinc-500"}>
                                                  {item.hasNegative37 ? "✓ MM -37" : "• MM -37"}
                                                </div>
                                                <div className={item.hasPositive37 ? "text-green-300" : "text-zinc-500"}>
                                                  {item.hasPositive37 ? "✓ MM 37" : "• MM 37"}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* SEÇÃO USINAGENS */}
                                    {dxfData.fresaInfo.usinagem37List && dxfData.fresaInfo.usinagem37List.length > 0 && (
                                      <div className="bg-blue-500/5 p-2 rounded border border-blue-500/10">
                                        <div className="text-blue-400 font-medium mb-1 text-[11px] uppercase flex items-center gap-1">
                                          <span>🛠️ USINAGENS</span>
                                          <span className="text-[9px] opacity-60">({dxfData.fresaInfo.usinagem37List.length} itens)</span>
                                        </div>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                          {dxfData.fresaInfo.usinagem37List.map((item: any, idx: number) => (
                                            <div key={`usinagem-${idx}`} className="bg-blue-900/20 p-1.5 rounded border border-blue-500/20">
                                              <div className="flex justify-between items-center mb-1">
                                                <span className="font-mono text-[9px] text-blue-300">ITEM #{item.index} (L{item.line})</span>
                                              </div>
                                              <div className="space-y-0.5 ml-1 text-[9px]">
                                                <div className={item.hasNegative37 ? "text-green-300" : "text-zinc-500"}>
                                                  {item.hasNegative37 ? "✓ MM -37" : "• MM -37"}
                                                </div>
                                                <div className={item.hasPositive37 ? "text-green-300" : "text-zinc-500"}>
                                                  {item.hasPositive37 ? "✓ MM 37" : "• MM 37"}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Botão de Correção (Unificado) */}
                                    {(
                                      (dxfData.fresaInfo.count37 > 0 || dxfData.fresaInfo.usinagemCount37 > 0) ||
                                      (dxfData.panelInfo?.dimension === '-37' || dxfData.panelInfo?.dimension === '37')
                                    ) && (
                                        <div className="mt-1">
                                          <button
                                            onClick={() => fixFresa37to18(drawing)}
                                            disabled={isFixing}
                                            className="w-full px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:opacity-50 text-white font-semibold rounded text-xs transition flex items-center justify-center gap-2"
                                          >
                                            {isFixing ? (
                                              <>⏳ Corrigindo...</>
                                            ) : (
                                              <>🔧 Corrigir TUDO (Fresa + Usinagem)</>
                                            )}
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Mensagem de Erro/Não encontrado */}
                            {result?.message && (
                              <div className="p-3 text-xs text-rose-300 border-t border-rose-500/20 bg-rose-500/5">
                                {result.message}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {uniqueDrawings.length === 0 && (
                        <div className="text-center text-zinc-500 text-xs py-4">
                          Nenhum código de desenho encontrado nos metadados.
                        </div>
                      )}
                    </div>

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
                          <div className={`mt-4 pt-4 border-t ${allOk ? 'border-emerald-500/30' : 'border-yellow-500/30'}`}>
                            <div className="flex items-center justify-between">
                              <div className={`${allOk ? 'text-emerald-400' : 'text-yellow-400'} text-sm font-medium`}>
                                {allOk ? (
                                  <>
                                    <Check className="inline-block h-4 w-4 mr-2" />
                                    Todos os desenhos corrigidos!
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="inline-block h-4 w-4 mr-2" />
                                    Alguns desenhos ainda requerem atenção.
                                  </>
                                )}
                              </div>
                              <button
                                onClick={handleMoveToOk}
                                className={`px-3 py-2 ${allOk ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white rounded text-sm font-bold shadow-lg transition-all flex items-center gap-2`}
                              >
                                <span className="uppercase text-[10px]">Mover para OK</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ERP SEARCH PANEL - visible if Coringa detected OR item without code */}
            {((Array.isArray(data?.meta?.coringaMatches) && data.meta.coringaMatches.length > 0) || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO"))) && (
              <section className="rounded-lg border border-blue-500/20 bg-blue-500/10">
                <div className="px-4 py-2 text-blue-300 text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Busca de Produto (ERP)
                </div>
                <div className="px-4 pb-3 space-y-3">
                  <div className="text-[11px] text-zinc-400">
                    Use um dos campos abaixo para buscar diretamente no banco de dados do servidor.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Input para Código */}
                    <div>
                      <label className="text-[10px] text-zinc-400 mb-1 block uppercase font-bold">Código</label>
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
                        className="w-full bg-[#0a0a0a] border border-[#2C2C2C] text-white px-2 py-1.5 rounded text-sm focus:border-blue-500 outline-none disabled:opacity-30 transition-all"
                      />
                    </div>

                    {/* Select para tipo de produto */}
                    <div>
                      <label className="text-[10px] text-zinc-400 mb-1 block uppercase font-bold">Tipo</label>
                      <select
                        value={erpSearchType}
                        onChange={(e) => {
                          setErpSearchType(e.target.value);
                          if (e.target.value) setErpSearchCode('');
                        }}
                        disabled={!!erpSearchCode}
                        className="w-full bg-[#0a0a0a] border border-[#2C2C2C] text-white px-2 py-1.5 rounded text-sm focus:border-blue-500 outline-none disabled:opacity-30 transition-all"
                      >
                        <option value="">TODOS</option>
                        <option value="CHAPAS">CHAPAS</option>
                        <option value="FITAS">FITAS</option>
                        <option value="TAPAFURO">TAPAFURO</option>
                        <option value="PAINEL">PAINEL</option>
                      </select>
                    </div>
                  </div>

                  {/* Input para Descrição */}
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-1 block uppercase font-bold">Descrição (Cor, MM, etc)</label>
                    <input
                      placeholder="Ex: BRANCO SUPREMO"
                      value={erpSearchDesc}
                      onChange={(e) => {
                        setErpSearchDesc(e.target.value);
                        if (e.target.value) setErpSearchCode('');
                      }}
                      disabled={!!erpSearchCode}
                      className="w-full bg-[#0a0a0a] border border-[#2C2C2C] text-white px-2 py-1.5 rounded text-sm focus:border-blue-500 outline-none disabled:opacity-30 transition-all"
                    />
                  </div>

                  {/* Botão de buscar */}
                  <button
                    disabled={erpSearching || (!erpSearchCode && !erpSearchDesc && !erpSearchType)}
                    onClick={handleErpSearch}
                    className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg"
                  >
                    {erpSearching ? 'Buscando...' : 'Buscar no Servidor'}
                  </button>

                  {/* Resultados em Tabela */}
                  {erpSearchResults.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="max-h-[300px] overflow-y-auto rounded border border-zinc-800 bg-[#0a0a0a]">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-[#1a1a1a] text-zinc-400 border-b border-zinc-800">
                            <tr>
                              <th className="text-left px-2 py-1.5 font-bold uppercase">Código</th>
                              <th className="text-left px-2 py-1.5 font-bold uppercase">Descrição</th>
                              <th className="w-10">Preencher</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900">
                            {erpSearchResults.map((prod, idx) => (
                              <tr key={idx} className="hover:bg-blue-500/5 transition-colors group">
                                <td className="px-2 py-2 font-mono text-blue-300">{prod.code}</td>
                                <td className="px-2 py-2 text-zinc-300">{prod.description}</td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => {
                                      // Se tiver coringa matches, preenche o coringaTo
                                      if (Array.isArray(data?.meta?.coringaMatches) && data.meta.coringaMatches.length > 0) {
                                        setCoringaTo(prod.code);
                                      }

                                      // Se o painel de REFERENCIA vazia estiver visível, preenche o refFillValue
                                      const showRefPanel = ((data?.meta?.referenciaEmpty?.length ?? 0) > 0 || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO")));
                                      if (showRefPanel) {
                                        setRefFillValue(prod.code);
                                      }

                                      toast.success(`Código "${prod.code}" selecionado`);
                                    }}
                                    className="p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] uppercase font-bold"
                                  >
                                    Usar Cod
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
                      disabled={!!lastReplace}
                      onChange={(e) => setCoringaFrom(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded focus:ring-amber-500 disabled:opacity-50 outline-none"
                    >
                      {filteredCoringaMatches.map((m, i) => (
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
                      disabled={!!lastReplace}
                      onChange={(e) => setCoringaTo(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded focus:ring-amber-500 disabled:opacity-50 outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!coringaFrom || !coringaTo || isReplacing || !!lastReplace}
                      onClick={() => setConfirmCoringaOpen(true)}
                      className="px-3 py-2 rounded bg-amber-500 text-black font-medium disabled:opacity-50 hover:bg-amber-400 transition-colors"
                    >
                      Trocar
                    </button>
                  </div>

                  {/* CG1 / CG2 bulk replace UI (only show if detected) */}
                  {(hasCG1 || hasCG2) && (
                    <div className="mt-3 border-t border-amber-600/20 pt-3">
                      <div className="text-sm text-zinc-200 mb-2">Troca de Siglas de Cor</div>
                      <div className={`grid gap-2 ${hasCG1 && hasCG2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {hasCG1 && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-zinc-300 mb-1 block">CG1 →</label>
                              <input
                                value={cg1Replace}
                                disabled={cg1Done}
                                onChange={(e) => setCg1Replace(e.target.value)}
                                placeholder="Ex: LA"
                                className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded disabled:opacity-50 outline-none"
                              />
                            </div>
                            <button
                              disabled={!cg1Replace || cg1Done}
                              onClick={async () => {
                                if (!data) return;
                                const id = toast.loading('Trocando CG1...');
                                try {
                                  const res = await (window as any).electron?.analyzer?.replaceCgGroups?.(data.fullpath, { 'CG1': cg1Replace.trim() });
                                  if (res?.ok) {
                                    toast.success('CG1 trocado com sucesso.');
                                    if (onAction && data) {
                                      onAction(data.fullpath, `[Manual] Coringa Grupo: trocada sigla CG1 para "${cg1Replace}"`);
                                    }
                                    setCg1Done(true);
                                    await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                                  } else {
                                    toast.error('Erro ao trocar CG1.');
                                  }
                                } catch (e: any) { toast.error(String(e?.message || e)); }
                                finally { toast.dismiss(id); }
                              }}
                              className="w-full px-3 py-1.5 rounded bg-amber-600 text-white font-medium disabled:opacity-50 text-xs"
                            >
                              Trocar Sigla CG1
                            </button>
                          </div>
                        )}
                        {hasCG2 && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-zinc-300 mb-1 block">CG2 →</label>
                              <input
                                value={cg2Replace}
                                disabled={cg2Done}
                                onChange={(e) => setCg2Replace(e.target.value)}
                                placeholder="Ex: MO"
                                className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded disabled:opacity-50 outline-none"
                              />
                            </div>
                            <button
                              disabled={!cg2Replace || cg2Done}
                              onClick={async () => {
                                if (!data) return;
                                const id = toast.loading('Trocando CG2...');
                                try {
                                  const res = await (window as any).electron?.analyzer?.replaceCgGroups?.(data.fullpath, { 'CG2': cg2Replace.trim() });
                                  if (res?.ok) {
                                    toast.success('CG2 trocado com sucesso.');
                                    if (onAction && data) {
                                      onAction(data.fullpath, `[Manual] Coringa Grupo: trocada sigla CG2 para "${cg2Replace}"`);
                                    }
                                    setCg2Done(true);
                                    await (window as any).electron?.analyzer?.reprocessOne?.(data.fullpath);
                                  } else {
                                    toast.error('Erro ao trocar CG2.');
                                  }
                                } catch (e: any) { toast.error(String(e?.message || e)); }
                                finally { toast.dismiss(id); }
                              }}
                              className="w-full px-3 py-1.5 rounded bg-amber-800 text-white font-medium disabled:opacity-50 text-xs"
                            >
                              Trocar Sigla CG2
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* REFERENCIA empty fill UI */}
            {((data?.meta?.referenciaEmpty?.length ?? 0) > 0 || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO"))) && (
              <section className="rounded-lg border border-rose-500/20 bg-rose-500/10">
                <div className="px-4 py-2 text-rose-300 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Itens com REFERENCIA vazia
                </div>
                <div className="px-4 pb-3 space-y-3">
                  <div className="text-xs text-zinc-300 mb-2">Selecione o ID e digite o código para preencher REFERENCIA:</div>
                  <div className="mb-3">
                    <label className="text-xs text-zinc-300 mb-1 block">Selecionar ID</label>
                    <select
                      value={selectedRefSingle ?? ''}
                      onChange={(e) => setSelectedRefSingle(e.target.value || null)}
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded mb-2 outline-none"
                    >
                      <option value="">-- selecionar --</option>
                      {((data?.meta?.referenciaEmpty || []) as any[]).filter(r => !!r.id).map((r, i) => (
                        <option key={i} value={r.id}>{r.id}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exibir descrição do item selecionado */}
                  {selectedRefSingle && (() => {
                    const item = (data?.meta?.referenciaEmpty as any[])?.find(r => r.id === selectedRefSingle);
                    if (!item?.descricao) return null;
                    return (
                      <div className="mb-3 p-2 bg-rose-500/5 border border-rose-500/10 rounded">
                        <div className="text-[10px] text-rose-300 font-bold uppercase mb-0.5 opacity-70">Descrição do Item</div>
                        <div className="text-xs text-white italic">"{item.descricao}"</div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-xs text-zinc-300 mb-1 block">Código REFERENCIA</label>

                    <input
                      value={refFillValue}
                      onChange={(e) => setRefFillValue(e.target.value)}
                      placeholder="Ex: ABC123"
                      className="w-full bg-[#151515] border border-[#2C2C2C] text-white px-2 py-2 rounded mb-2 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!selectedRefSingle || !refFillValue}
                      onClick={() => setConfirmRefOpen(true)}
                      className="px-3 py-2 rounded bg-rose-500 text-black font-medium disabled:opacity-50 flex-1 hover:bg-rose-400 transition-colors"
                    >
                      Preencher REFERENCIA
                    </button>
                  </div>
                </div>
              </section>
            )}
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
      </AlertDialog>

      {/* CONFIRMAÇÃO - Preencher REFERENCIA */}
      <AlertDialog open={confirmRefOpen} onOpenChange={setConfirmRefOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-rose-500/30">
          <AlertDialogTitle className="text-white">Confirmar preenchimento de REFERENCIA?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-300">
            Você está prestes a preencher REFERENCIA do item <span className="font-mono font-bold text-rose-300">{selectedRefSingle}</span> with <span className="font-mono font-bold text-rose-300">{refFillValue}</span>.
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
