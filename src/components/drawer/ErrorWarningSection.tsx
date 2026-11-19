import React, { useState } from "react";
import { AlertTriangle, Info, CheckCircle, Wrench, ArrowRight, FileCheck, CheckCircle2, ShieldCheck, ChevronDown } from "lucide-react";
import { BadgeErro } from "../BadgeErro";
import { AutoFixBadge } from "../AutoFixBadge";
import { Badge } from "../ui/badge";
import { Row } from "../../types";

interface ErrorWarningSectionProps {
  data: Row | null;
  onMoveToOk?: () => void;
}

export function ErrorWarningSection({ data, onMoveToOk }: ErrorWarningSectionProps) {
  const [errorsOpen, setErrorsOpen] = useState(true);
  const [autoFixesOpen, setAutoFixesOpen] = useState(true);
  const [manualFixesOpen, setManualFixesOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(true);

  const errors = data?.errors || [];
  const warnings = data?.warnings || [];
  const autoFixes = data?.autoFixes || [];

  const normalizeFix = (f: string) => f === "Movido para pasta OK" ? "Movido manualmente para a pasta OK" : f;
  const manualFixesFromProp = (data?.manualFixes || []).map(normalizeFix);
  const manualFixesFromHistory = (data?.history || [])
    .filter(h => h.includes("[Manual]") || h.toLowerCase().includes("movido para pasta ok") || h.toLowerCase().includes("movido manualmente"))
    .map(h => normalizeFix(h.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '').replace(/^\[Manual\]\s*/i, '').trim()));
  const manualFixes = Array.from(new Set([...manualFixesFromProp, ...manualFixesFromHistory]));

  const isErpError = (e: string) => String(e).toLowerCase().includes("não encontrado no erp");
  const isMuxarabiError = (e: string) => String(e).toUpperCase().includes("PEÇA MUXARABI");

  const hasSemCodigoErp = data?.tags?.includes("sem código erp") || errors.some(isErpError);
  const hasMuxarabi = data?.tags?.includes("muxarabi") || errors.some(isMuxarabiError);
  const hasBypassableError = hasSemCodigoErp || hasMuxarabi;

  const otherErrors = errors.filter(e => !isErpError(e) && !isMuxarabiError(e));
  const hasOtherErrors = otherErrors.length > 0;

  if (errors.length === 0 && warnings.length === 0 && autoFixes.length === 0 && manualFixes.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3.5 shadow-sm">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-emerald-400">Arquivo Conforme</h4>
          <p className="text-xs text-emerald-400/70 font-medium">Nenhuma inconformidade ou aviso pendente neste componente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* INCONFORMIDADES (ERROS) */}
      {errors.length > 0 && (
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-card overflow-hidden shadow-sm transition-all">
          <div
            className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-rose-500/5 transition-colors"
            onClick={() => setErrorsOpen(!errorsOpen)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest">
                Inconformidades
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {errors.length} {errors.length === 1 ? 'item' : 'itens'}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${errorsOpen ? 'rotate-180 text-foreground' : ''}`}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {errorsOpen && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-3 border-t border-rose-500/10">
              <div className="flex flex-wrap gap-1.5 pt-2">
                {errors.map((e, i) => (
                  <BadgeErro key={i} error={e} />
                ))}
              </div>

              {hasBypassableError && (
                <div className="pt-3 border-t border-rose-500/10 mt-3">
                  <button
                    onClick={onMoveToOk}
                    disabled={hasOtherErrors}
                    className={`
                      w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer
                      ${hasOtherErrors
                        ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 cursor-not-allowed opacity-60"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                      }
                    `}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Enviar para OK</span>
                  </button>
                  {hasOtherErrors && (
                    <p className="text-[10px] text-rose-400/80 font-medium tracking-wide mt-2 text-center leading-normal">
                      * Trate as outras inconformidades primeiro para liberar o envio.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CORREÇÕES AUTOMÁTICAS */}
      {autoFixes.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card overflow-hidden shadow-sm transition-all">
          <div
            className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-emerald-500/5 transition-colors"
            onClick={() => setAutoFixesOpen(!autoFixesOpen)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Correções Automáticas
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {autoFixes.length} {autoFixes.length === 1 ? 'correção' : 'correções'}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${autoFixesOpen ? 'rotate-180 text-foreground' : ''}`}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {autoFixesOpen && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-emerald-500/10">
              <div className="flex flex-wrap gap-1.5 pt-2">
                {autoFixes.map((f, i) => (
                  <AutoFixBadge key={i} fix={f} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CORREÇÕES MANUAIS / AUDITORIA */}
      {manualFixes.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-card overflow-hidden shadow-sm transition-all">
          <div
            className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-blue-500/5 transition-colors"
            onClick={() => setManualFixesOpen(!manualFixesOpen)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Wrench className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                Correções Manuais
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {manualFixes.length} {manualFixes.length === 1 ? 'registro' : 'registros'}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${manualFixesOpen ? 'rotate-180 text-foreground' : ''}`}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {manualFixesOpen && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-blue-500/10">
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1 pt-2">
                {manualFixes.map((m, i) => {
                  // Checa se é uma substituição de coringa
                  const match = m.match(/substitu[ií]do\s+["']?([^"']+)["']?\s+por\s+["']?([^"'\s]+)["']?/i);
                  return (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-card/80 hover:bg-muted/60 border border-border/80 text-xs transition-all flex items-start gap-2 text-zinc-200"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      {match ? (
                        <div className="flex-1 flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-zinc-400 font-medium">Substituído</span>
                          <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-rose-400 border border-rose-500/20 font-mono text-[11px]">
                            {match[1]}
                          </code>
                          <ArrowRight className="h-3 w-3 text-zinc-500 shrink-0" />
                          <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-semibold">
                            {match[2]}
                          </code>
                        </div>
                      ) : (
                        <span className="flex-1 text-zinc-300 leading-relaxed break-all">
                          {m}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AVISOS */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-card overflow-hidden shadow-sm transition-all">
          <div
            className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-amber-500/5 transition-colors"
            onClick={() => setWarningsOpen(!warningsOpen)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Info className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                Avisos
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${warningsOpen ? 'rotate-180 text-foreground' : ''}`}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {warningsOpen && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-amber-500/10">
              <div className="space-y-1.5 pt-2">
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-amber-500/5 text-amber-300/90 border border-amber-500/15 text-xs font-medium leading-relaxed break-all"
                  >
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


