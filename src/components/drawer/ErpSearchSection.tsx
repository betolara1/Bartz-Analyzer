import React from "react";
import { Search, ChevronDown, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Row } from "../../types";
import { Input } from "../ui/input";

interface ErpSearchSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  erpSearchCode: string;
  setErpSearchCode: (v: string) => void;
  erpSearchDesc: string;
  setErpSearchDesc: (v: string) => void;
  erpSearchType: string;
  setErpSearchType: (v: string) => void;
  erpSearching: boolean;
  erpSearchResults: any[];
  onSearch: (override?: { code?: string; desc?: string; type?: string; isAuto?: boolean }) => void;
  onSelectCode: (code: string) => void;
}

export function ErpSearchSection({
  isOpen,
  onToggle,
  data,
  erpSearchCode,
  setErpSearchCode,
  erpSearchDesc,
  setErpSearchDesc,
  erpSearchType,
  setErpSearchType,
  erpSearching,
  erpSearchResults,
  onSearch,
  onSelectCode,
}: ErpSearchSectionProps) {
  
  const showSection = ((data?.meta?.coringaMatches?.length || 0) > 0) || 
                      ((data?.meta?.referenciaEmpty?.length || 0) > 0) ||
                      ((data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO")));

  // Auto-search ERP when typing in description
  React.useEffect(() => {
    const desc = erpSearchDesc.trim();
    if (desc.length >= 2) {
      const timer = setTimeout(() => {
        onSearch({ desc, code: '', type: erpSearchType, isAuto: true });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [erpSearchDesc, erpSearchType]);

  // Auto-search ERP when typing in product code
  React.useEffect(() => {
    const code = erpSearchCode.trim();
    if (code.length >= 3) {
      const timer = setTimeout(() => {
        onSearch({ code, desc: '', type: '', isAuto: true });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [erpSearchCode]);

  if (!showSection) return null;

  return (
    <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl overflow-hidden shadow-sm">
      <div 
        onClick={onToggle}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-500/10 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-blue-300">Consulta ERP / CSV</h3>
            </div>
            <p className="text-xs text-blue-400/80">Buscador de códigos e descrições no banco de dados ERP</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
          <div className={`p-2 rounded-full bg-blue-500/5 border border-blue-500/10 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-blue-400/50" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 space-y-4 border-t border-blue-500/10">
          <div className="p-3 bg-blue-50 dark:bg-[#0a0a0a] border border-blue-100 dark:border-white/5 rounded-lg text-[11px] text-black dark:text-white leading-relaxed font-medium">
            Pesquise códigos originais no servidor para preencher campos coringa ou referências vazias.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Código do Produto</label>
              <div className="relative group">
                <Input
                  placeholder="Ex: 10.01.0001"
                  value={erpSearchCode}
                  onChange={(e) => {
                    setErpSearchCode(e.target.value);
                    if (e.target.value) {
                      setErpSearchDesc('');
                      setErpSearchType('');
                    }
                  }}
                  onClear={() => setErpSearchCode('')}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (erpSearchCode || erpSearchDesc || erpSearchType)) onSearch(); }}
                  disabled={!!erpSearchDesc || !!erpSearchType}
                  className="w-full bg-background border-border text-foreground text-xs focus:border-blue-500 h-9 rounded-lg font-mono transition-all"
                  style={{ paddingLeft: "2.25rem" }}
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Tipo de Item</label>
              <select
                value={erpSearchType}
                onChange={(e) => {
                  const val = e.target.value;
                  setErpSearchType(val);
                  const nextCode = val ? '' : erpSearchCode;
                  if (val) setErpSearchCode('');
                  onSearch({ type: val, code: nextCode });
                }}
                disabled={!!erpSearchCode}
                className="w-full bg-background border border-border text-foreground px-3 h-9 rounded-lg text-xs focus:border-blue-500 outline-none disabled:opacity-30 transition-all font-bold cursor-pointer"
              >
                <option value="">TODOS OS TIPOS</option>
                <option value="CHAPAS">CHAPAS</option>
                <option value="FITAS">FITAS</option>
                <option value="TAPAFURO">TAPAFURO</option>
                <option value="CAPA">CAPA</option>
                <option value="PAINEL">PAINEL</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Descrição (Cor, Acabamento, Espessura)</label>
            <div className="relative group">
              <Input
                placeholder="Ex: BRANCO SUPREMO 18MM"
                value={erpSearchDesc}
                onChange={(e) => {
                  setErpSearchDesc(e.target.value);
                  if (e.target.value) setErpSearchCode('');
                }}
                onClear={() => setErpSearchDesc('')}
                onKeyDown={(e) => { if (e.key === 'Enter' && (erpSearchCode || erpSearchDesc || erpSearchType)) onSearch(); }}
                disabled={!!erpSearchCode}
                className="w-full bg-background border-border text-foreground text-xs focus:border-blue-500 h-9 rounded-lg transition-all"
                style={{ paddingLeft: "2.25rem" }}
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            </div>
          </div>

          <button
            disabled={erpSearching || (!erpSearchCode && !erpSearchDesc && !erpSearchType)}
            onClick={onSearch}
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

          {erpSearchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="rounded-lg border border-[#232323] bg-[#0a0a0a] overflow-hidden shadow-inner overflow-x-auto">
                <table className="w-full text-[10px] min-w-[300px]">
                  <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323]">
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
                        <td className="px-3 py-2 text-foreground/70 font-medium">
                          {prod.description}
                          {prod.thickness && <span className="text-muted-foreground ml-1.5">- {prod.thickness} mm</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => onSelectCode(prod.code)}
                            className="p-1 px-2 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-bold uppercase tracking-tighter"
                          >
                            Copiar
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
      )}
    </div>
  );
}
