// src/pages/Dashboard.tsx (exemplo)
import React from "react";
import { FiltersBar, FilterKey } from "@/components/FiltersBar";

type Row = {
  arquivo: string;
  status: "ok"|"erro";
  erros: { descricao: string; referencia?: string }[];
  tags: string[]; // ["ferragens","muxarabi","cor_coringa",...]
  date: number;
};

export default function Dashboard(){
  const [rows, setRows] = React.useState<Row[]>([]);
  const [filter, setFilter] = React.useState<FilterKey>("all");

  React.useEffect(()=>{
    window.electron.analyzer?.onEvent((msg)=>{
      if(msg.evt === "file-validated"){
        const {arquivo, erros} = msg.payload as {arquivo:string; erros:any[]};
        const tags:string[] = [];
        if (erros.some(e=>e.descricao==="CADASTRO DE COR CORINGA")) tags.push("cor_coringa");
        // heurísticas simples (ajuste como quiser):
        if (arquivo.toLowerCase().includes("ferragem")) tags.push("ferragens");
        if (arquivo.toLowerCase().includes("muxarabi")) tags.push("muxarabi");

        setRows(prev => {
          const rest = prev.filter(r=>r.arquivo!==arquivo);
          return [
            ...rest,
            { arquivo, status: erros.length? "erro":"ok", erros, tags, date: Date.now() }
          ];
        });
      }
    });
  },[]);

  // contadores
  const counts = {
    all: rows.length,
    ok: rows.filter(r=>r.status==="ok").length,
    errors: rows.filter(r=>r.status==="erro").length,
    ferragens: rows.filter(r=>r.tags.includes("ferragens")).length,
    muxarabi: rows.filter(r=>r.tags.includes("muxarabi")).length,
    cor_coringa: rows.filter(r=>r.tags.includes("cor_coringa")).length,
    auto_fixed: rows.filter(r=>r.tags.includes("auto_fixed")).length,
  };

  // filtro aplicado
  const filtered = rows.filter(r=>{
    if (filter==="all") return true;
    if (filter==="ok") return r.status==="ok";
    if (filter==="errors") return r.status==="erro";
    return r.tags.includes(filter);
  });

  return (
    <div className="p-6 space-y-4">
      <FiltersBar active={filter} counts={counts} onChange={setFilter} />
      {/* tabela simples */}
      <div className="mt-4 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1.5fr_.7fr_2fr_1fr] bg-zinc-900 text-zinc-200 px-4 py-2">
          <div>Arquivo</div><div>Status</div><div>Erros</div><div>Data/Hora</div>
        </div>
        {filtered.map(r=>(
          <div key={r.arquivo} className="grid grid-cols-[1.5fr_.7fr_2fr_1fr] px-4 py-2 border-t border-zinc-800">
            <div className="truncate">{r.arquivo}</div>
            <div className={r.status==="ok"?"text-green-400":"text-red-400"}>{r.status}</div>
            <div className="text-sm">
              {r.erros.length? r.erros.map(e=>e.descricao).join("; ") : "—"}
            </div>
            <div>{new Date(r.date).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
