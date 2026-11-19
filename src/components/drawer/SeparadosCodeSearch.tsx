import React, { useState, useEffect, useRef, useCallback, startTransition } from "react";
import {
  Search,
  Hash,
  FileText,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Input, searchIcon } from "../ui/input";
import { electronClient } from "../../services/electronClient";

interface ProductResult {
  code: string;
  description: string;
  thickness?: string;
}

const MAX_DISPLAY_RESULTS = 80;

export function SeparadosCodeSearch() {
  const [isOpen, setIsOpen] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [searchDesc, setSearchDesc] = useState("");
  const [searchType, setSearchType] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchSeqRef = useRef(0);

  // Executa a busca no ERP de forma não bloqueante e sequencial
  const performSearch = useCallback(
    async (override?: { code?: string; desc?: string; type?: string }) => {
      const code = override?.code !== undefined ? override.code : searchCode;
      const desc = override?.desc !== undefined ? override.desc : searchDesc;
      const type = override?.type !== undefined ? override.type : searchType;

      const trimmedCode = code.trim();
      const trimmedDesc = desc.trim();

      if (!trimmedCode && !trimmedDesc && !type) {
        setResults([]);
        setTotalCount(0);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      const seq = ++searchSeqRef.current;
      setIsSearching(true);

      try {
        const res = await electronClient.analyzer.searchErpProduct({
          code: trimmedCode,
          desc: trimmedDesc,
          type: type || undefined,
        });

        // Se uma busca mais nova já foi disparada, descarta esta resposta antiga
        if (seq !== searchSeqRef.current) {
          return;
        }

        const list: ProductResult[] = res?.results || [];
        const count = res?.count ?? list.length;

        // Usa startTransition para que a renderização da tabela não trave o input
        startTransition(() => {
          setResults(list);
          setTotalCount(count);
          setHasSearched(true);
        });
      } catch (err: any) {
        if (seq === searchSeqRef.current) {
          console.error("[SeparadosCodeSearch] Erro ao buscar:", err);
          toast.error(`Erro ao consultar códigos: ${err?.message || err}`);
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
    },
    [searchCode, searchDesc, searchType]
  );

  // Debounced auto-search ao digitar (500ms para evitar chamadas concorrentes excessivas)
  useEffect(() => {
    const trimmedCode = searchCode.trim();
    const trimmedDesc = searchDesc.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!trimmedCode && !trimmedDesc) {
      if (hasSearched) {
        setResults([]);
        setTotalCount(0);
        setHasSearched(false);
      }
      return;
    }

    // Apenas dispara automaticamente se tiver pelo menos 2 caracteres em algum dos campos
    if (trimmedCode.length >= 2 || trimmedDesc.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch();
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchCode, searchDesc, searchType, performSearch]);

  const handleImmediateSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    performSearch();
  };

  // Copia o código para a área de transferência
  const handleCopyCode = async (codeToCopy: string) => {
    if (!codeToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = codeToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedCode(codeToCopy);
      toast.success(`Código "${codeToCopy}" copiado!`);

      setTimeout(() => {
        setCopiedCode((curr) => (curr === codeToCopy ? null : curr));
      }, 2500);
    } catch (err) {
      toast.error("Falha ao copiar para a área de transferência.");
    }
  };

  const handleClearAll = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    searchSeqRef.current++;
    setSearchCode("");
    setSearchDesc("");
    setSearchType("");
    setResults([]);
    setTotalCount(0);
    setHasSearched(false);
    setIsSearching(false);
  };

  // Limita os resultados renderizados no DOM para evitar travar a interface
  const displayResults = results.slice(0, MAX_DISPLAY_RESULTS);

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 shadow-sm overflow-hidden transition-all duration-300">
      {/* Header com toggle de colapso */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-violet-500/10 transition-colors select-none border-b border-violet-500/15"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Buscador de Códigos
              </h3>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                ERP / Catálogo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Filtre por código e descrição simultaneamente para visualizar e copiar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-[11px] font-bold text-violet-400 bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 rounded-md">
              {totalCount} {totalCount === 1 ? "resultado" : "resultados"}
            </span>
          )}
          <div
            className={`p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="h-4 w-4 text-violet-400" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 space-y-4 bg-background/50">
          {/* Linha com os dois filtros principais: Código + Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Campo 1: Código */}
            <div className="sm:col-span-5 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 pl-0.5">
                <Hash className="h-3 w-3 text-violet-400" />
                <span>Filtro de Código</span>
              </label>
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="Ex: 10.01. ou AA01"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onClear={() => setSearchCode("")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImmediateSearch();
                  }}
                  leftIcon={searchIcon}
                  className="font-mono text-xs focus:border-violet-500 h-9"
                />
              </div>
            </div>

            {/* Campo 2: Descrição */}
            <div className="sm:col-span-5 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 pl-0.5">
                <FileText className="h-3 w-3 text-violet-400" />
                <span>Filtro de Descrição</span>
              </label>
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="Ex: beige, freijo, 18mm..."
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                  onClear={() => setSearchDesc("")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImmediateSearch();
                  }}
                  leftIcon={searchIcon}
                  className="text-xs focus:border-violet-500 h-9"
                />
              </div>
            </div>

            {/* Ações: Buscar / Limpar */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImmediateSearch}
                disabled={isSearching || (!searchCode.trim() && !searchDesc.trim() && !searchType)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm shadow-violet-900/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Executar busca imediata"
              >
                {isSearching ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>Buscar</span>
              </button>

              {(searchCode || searchDesc || searchType || results.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="h-9 px-2.5 inline-flex items-center justify-center rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-all text-xs font-semibold cursor-pointer"
                  title="Limpar filtros e resultados"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dica / Info quando nenhum filtro foi digitado ainda */}
          {!hasSearched && !isSearching && results.length === 0 && (
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-muted-foreground flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <span>
                Digite o código (ex: <strong className="text-foreground font-mono">10.01.</strong>) e/ou a descrição (ex: <strong className="text-foreground">beige</strong>) para listar os itens correspondentes do ERP.
              </span>
            </div>
          )}

          {/* Estado de Carregamento */}
          {isSearching && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-violet-400">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-xs font-medium text-muted-foreground">
                Consultando produtos no banco de dados ERP...
              </span>
            </div>
          )}

          {/* Sem Resultados */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="py-6 text-center text-muted-foreground text-xs rounded-lg border border-border/60 bg-muted/20">
              Nenhum item encontrado com o código{" "}
              {searchCode ? <strong className="text-foreground font-mono">"{searchCode}"</strong> : "informado"}{" "}
              {searchDesc ? (
                <>
                  e descrição <strong className="text-foreground">"{searchDesc}"</strong>
                </>
              ) : null}
              .
            </div>
          )}

          {/* Tabela de Resultados */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-inner max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="text-left px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] w-44">
                        Código
                      </th>
                      <th className="text-left px-3.5 py-2 font-bold uppercase tracking-wider text-[10px]">
                        Descrição
                      </th>
                      <th className="text-right px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] w-28">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayResults.map((item, idx) => {
                      const isCopied = copiedCode === item.code;
                      return (
                        <tr
                          key={`${item.code}-${idx}`}
                          className="hover:bg-violet-500/10 transition-colors group"
                        >
                          {/* Código com click rápido para copiar */}
                          <td className="px-3.5 py-2 font-mono font-bold text-foreground">
                            <span
                              onClick={() => handleCopyCode(item.code)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/30 cursor-pointer transition-colors"
                              title="Clique para copiar este código"
                            >
                              <span>{item.code}</span>
                              <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                            </span>
                          </td>

                          {/* Descrição + Espessura */}
                          <td className="px-3.5 py-2 text-foreground/90 font-medium">
                            <span>{item.description}</span>
                            {item.thickness && (
                              <span className="ml-2 inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                {item.thickness} mm
                              </span>
                            )}
                          </td>

                          {/* Botão de Copiar */}
                          <td className="px-3.5 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.code)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                isCopied
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : "bg-violet-500/15 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30"
                              }`}
                              title="Copiar código para a área de transferência"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>
                  {results.length > MAX_DISPLAY_RESULTS ? (
                    <>
                      Mostrando os primeiros <strong>{MAX_DISPLAY_RESULTS}</strong> de{" "}
                      <strong>{totalCount}</strong> resultados. Refine o código ou descrição para filtrar mais especificamente.
                    </>
                  ) : (
                    <>
                      Mostrando {results.length} {results.length === 1 ? "código" : "códigos"}.
                    </>
                  )}
                </span>
                <span className="italic">
                  Clique em "Copiar" para colar onde desejar.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
