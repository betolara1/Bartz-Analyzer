import React from "react";
import { Send, CheckCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { Row } from "../../types";

interface ImportKeySectionProps {
  data: Row | null;
}

export function ImportKeySection({ data }: ImportKeySectionProps) {
  const key = data?.meta?.importKey;

  const handleCopy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada para a área de transferência!");
  };

  return (
    <section className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-2 px-1">
        <Send className="h-4 w-4 text-zinc-500" />
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chave de Importação ERP</h4>
      </div>
      
      <div className="relative group">
        <div className={`p-4 rounded-xl border font-mono text-xs flex items-center justify-between transition-all ${
          key ? 'bg-[#1B1B1B] border-[#3498DB]/30 text-[#3498DB] shadow-[0_0_15px_rgba(52,152,219,0.05)]' : 'bg-[#1B1B1B] border-[#2C2C2C] text-zinc-600 italic'
        }`}>
          <div className="flex items-center gap-2.5 truncate pr-8">
            {key && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{key || "Chave não disponível para este item"}</span>
          </div>
          
          {key && (
            <button 
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all absolute right-2 opacity-0 group-hover:opacity-100"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
