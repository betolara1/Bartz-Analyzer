import React from "react";
import { Trash2, CheckCircle2, ChevronDown, AlertTriangle, Check } from "lucide-react";
import { Row } from "../../types";

interface SemFilhoSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  data: Row | null;
  isResolved: boolean;
  otherPendingCount: number;
  onResolve: () => void;
}

export function SemFilhoSection({ isOpen, onToggle, data, isResolved, otherPendingCount, onResolve }: SemFilhoSectionProps) {
  const hasError = data?.tags?.includes('sem_filho');

  if (!hasError) return null;

  const isLastProblem = otherPendingCount === 0;

  return (
    <section className={`rounded-xl border overflow-hidden shadow-sm transition-all duration-300 ${
      isResolved 
        ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5' 
        : 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5'
    }`}>
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${
            isResolved 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {isResolved ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">Itens sem Componentes</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Verificação de itens vazios</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isResolved ? (
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse" />
          )}
          <div className={`p-2 rounded-full bg-[#111] border border-[#232323] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 space-y-4">
          <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/10 text-xs dark:text-white-200 text-rose-900 leading-relaxed font-medium">
            Este arquivo contém itens que não possuem componentes internos (filhos). 
            Isso geralmente ocorre em componentes lineares ou acessórios que não foram gerados corretamente.
          </div>

          {(data?.meta?.semFilhoItems || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest px-1">Itens Identificados:</p>
              <div className="rounded-lg border border-[#232323] bg-[#111] overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#1B1B1B] text-muted-foreground border-b border-[#232323]">
                    <tr>
                      <th className="text-left px-3 py-2 uppercase font-bold tracking-widest text-[8px]">Referência</th>
                      <th className="text-left px-3 py-2 uppercase font-bold tracking-widest text-[8px]">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232323]">
                    {(data?.meta?.semFilhoItems as any[]).map((item, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2 text-rose-400 font-mono">{item.referencia}</td>
                        <td className="px-3 py-2 text-white/60 font-mono text-[10px]">{item.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </section>
  );
}
