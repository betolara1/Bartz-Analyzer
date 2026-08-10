import React from "react";
import { AlertTriangle, ChevronDown, Package, CheckCircle } from "lucide-react";
import { Row } from "../../types";
import { Input } from "../ui/input";

interface PendingRefSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  selectedRefSingle: string | null;
  setSelectedRefSingle: (v: string | null) => void;
  refFillValue: string;
  setRefFillValue: (v: string) => void;
  refDescValue: string;
  setRefDescValue: (v: string) => void;
  onConfirm: () => void;
}

export function PendingRefSection({
  isOpen, onToggle, data, selectedRefSingle, setSelectedRefSingle, refFillValue, setRefFillValue, refDescValue, setRefDescValue, onConfirm
}: PendingRefSectionProps) {

  const referenciaEmpty = (data?.meta?.referenciaEmpty || []) as any[];

  if (referenciaEmpty.length === 0) return null;

  return (
    <section className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 overflow-hidden shadow-sm transition-all duration-300">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Referências Pendentes</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              {referenciaEmpty.length} item(ns) sem código de referência ERP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse" />
          <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 space-y-5 border-t border-rose-500/10">
          <div className="p-3 bg-rose-50 dark:bg-[#0a0a0a] border border-rose-100 dark:border-white/5 rounded-lg text-[11px] text-black dark:text-white leading-relaxed font-medium">
            Selecione o item detectado sem código, ajuste a descrição e informe o código de referência obtido no ERP.
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Selecionar Item do XML</label>
              <select
                value={selectedRefSingle ?? ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setSelectedRefSingle(val);
                  if (val) {
                    const item = referenciaEmpty.find(r => `${r.id}|${r.descricao || ''}` === val);
                    setRefDescValue(item?.descricao || '');
                  } else {
                    setRefDescValue('');
                  }
                }}
                className="w-full bg-muted/50 border border-border text-foreground px-3 h-9 rounded-lg text-xs outline-none focus:border-rose-500 transition-all font-bold cursor-pointer"
              >
                <option value="">-- SELECIONE O COMPONENTE --</option>
                {referenciaEmpty.filter(r => !!r.id).map((r, i) => {
                  const key = `${r.id}|${r.descricao || ''}`;
                  return (
                    <option key={i} value={key}>
                      ID: {r.id} {r.descricao ? `| ${r.descricao.slice(0, 35)}...` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedRefSingle && (() => {
              const item = referenciaEmpty.find(r => `${r.id}|${r.descricao || ''}` === selectedRefSingle);
              if (!item) return null;
              return (
                <div className="p-4 rounded-xl bg-black/40 border border-rose-500/10 space-y-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity"><Package className="h-12 w-12 text-rose-500" /></div>
                  
                  {item.caminhoItemCatalog && (
                    <div className="relative z-10">
                      <div className="text-[9px] dark:text-rose-300 text-rose-700 font-bold uppercase mb-1 opacity-60 tracking-tighter">Localização no Catálogo</div>
                      <div className="text-[10px] text-zinc-400 font-mono break-all leading-tight bg-[#0a0a0a] p-2 rounded-lg border border-white/[0.03]">
                        {item.caminhoItemCatalog}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 relative z-10">
                    <label className="text-[9px] dark:text-rose-300 text-rose-700 uppercase font-bold tracking-widest pl-1">
                      Descrição do Item no XML (Editável)
                    </label>
                    <Input
                      value={refDescValue}
                      onChange={(e) => setRefDescValue(e.target.value)}
                      onClear={() => setRefDescValue('')}
                      placeholder="Ex: Chapa PANNA - 25mm cortes especiais"
                      className="w-full bg-background border-border text-foreground px-3 h-9 rounded-lg text-xs outline-none focus:border-rose-500 transition-all font-medium"
                    />
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Novo Código de Referência (ERP)</label>
              <Input
                value={refFillValue}
                onChange={(e) => setRefFillValue(e.target.value)}
                onClear={() => setRefFillValue('')}
                placeholder="Ex: 10.01.2023"
                className="w-full bg-background border-border text-foreground px-3 h-9 rounded-lg text-xs outline-none focus:border-rose-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            disabled={!selectedRefSingle || !refFillValue}
            onClick={onConfirm}
            className="w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle className="h-4 w-4" />
            Confirmar Preenchimento
          </button>
        </div>
      )}
    </section>
  );
}
