import React, { useState } from "react";
import { Cpu, Zap, CheckCircle2, XCircle, Wrench, ChevronDown } from "lucide-react";
import { Row } from "../../types";

interface MachineSectionProps {
  data: Row | null;
}

export function MachineSection({ data }: MachineSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const machines = data?.meta?.machines || [];

  const PLUGIN_NAMES: Record<string, { name: string; type: string }> = { 
    "2530": { name: "Aspan", type: "Furação & Rasgo" }, 
    "2534": { name: "NCB612", type: "Centro de Usinagem" } 
  };

  return (
    <section className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm transition-all">
      <div
        className="flex items-center justify-between p-4 sm:p-5 cursor-pointer group hover:bg-muted/40 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Maquinário / Plugins
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
            CNC / G-Code
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-foreground' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-3.5 border-t border-border/60">
          <div className="grid grid-cols-2 gap-3 pt-2">
            {["2530", "2534"].map(id => {
              const m = machines.find(m => m.id === id);
              const meta = PLUGIN_NAMES[id] || { name: "Plugin " + id, type: "Usinagem" };
              return (
                <div 
                  key={id} 
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                    m 
                      ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/30 text-emerald-400 shadow-sm' 
                      : 'bg-muted/40 border-border/60 text-muted-foreground/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono tracking-wider">{id}</span>
                    {m ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Gerado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50">
                        <XCircle className="h-3 w-3" /> Ausente
                      </span>
                    )}
                  </div>
                  <div>
                    <div className={`text-sm font-bold tracking-tight ${m ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                      {meta.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 font-medium truncate">
                      {meta.type}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {machines.length > 0 && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl flex items-start gap-2.5">
              <Zap className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-[11px] text-blue-300/80 leading-relaxed font-medium">
                Estes programas foram gerados e exportados para o maquinário com sucesso.
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


