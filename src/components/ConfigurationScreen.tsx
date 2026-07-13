// src/components/ConfigurationScreen.tsx
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

declare global {
  interface Window {
    api?: {
      testAccess: (form: Paths) => Promise<Record<string, { ok: boolean; exists: boolean; write: boolean }>>;
    };
    electron?: {
      settings?: {
        load: () => Promise<Paths>;
        save: (form: Paths) => Promise<void>;
      };
    };
  }
}

export type Paths = {
  entrada?: string;
  exportacao?: string;
  ok?: string;
  erro?: string;
  drawings?: string;
};

export interface PathConfig {
  key: keyof Paths;
  label: string;
  placeholder: string;
  tooltip: string;
}

export const PATH_CONFIGS: PathConfig[] = [
  {
    key: "entrada",
    label: "Pasta de Entrada",
    placeholder: "\\\\servidor\\orcamentos\\entrada",
    tooltip: "Pasta de entrada onde o sistema irá ler os arquivos XML."
  },
  {
    key: "exportacao",
    label: "Pasta de Relatórios",
    placeholder: "\\\\servidor\\orcamentos\\exportacao",
    tooltip: "Pasta de exportação onde os relatórios gerados serão salvos."
  },
  {
    key: "ok",
    label: "Pasta Arquivos OK",
    placeholder: "\\\\servidor\\orcamentos\\XML_FINAL\\ok",
    tooltip: "Pasta de destino para onde os arquivos XML corretos (sem inconformidades) serão movidos."
  },
  {
    key: "erro",
    label: "Pasta Arquivos Erro",
    placeholder: "\\\\servidor\\orcamentos\\XML_FINAL\\erro",
    tooltip: "Pasta de destino para onde os arquivos XML com erros ou inconformidades serão movidos."
  },
  {
    key: "drawings",
    label: "Pasta de Desenhos",
    placeholder: "\\\\servidor\\desenhos",
    tooltip: "Pasta onde o sistema buscará os desenhos técnicos correspondentes."
  }
];

export default function ConfigurationScreen({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<Paths>({
    entrada: "",
    exportacao: "",
    ok: "",
    erro: "",
    drawings: "",
  });


  useEffect(() => {
    (async () => {
      const cur = await window.electron?.settings?.load();
      if (cur) setForm((prev) => ({ ...prev, ...cur }));
    })();
  }, []);

  function setVal(key: keyof Paths, v: string) {
    setForm((p) => ({ ...p, [key]: v }));
  }

  async function handleSalvar() {
    await window.electron?.settings?.save(form);
    alert("Configurações salvas!");
  }


  const Row = (props: { label: string; field: keyof Paths; placeholder?: string; tooltip: string }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-sm opacity-80">{props.label}</label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-help">
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border border-border p-2 shadow-md max-w-xs">
            <p>{props.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-3">
        <Input
          value={form[props.field] || ""}
          onChange={(e) => setVal(props.field, e.target.value)}
          placeholder={props.placeholder}
          className="bg-[#151515] border-[#2C2C2C] w-[680px]"
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 text-white">
      <div className="mb-4">
        <Button variant="outline" onClick={onBack}>{'← Voltar ao Dashboard'}</Button>
      </div>

      <h2 className="text-2xl font-semibold mb-6">Configurações • Caminhos UNC</h2>

      <div className="space-y-5 bg-[#111] border border-[#2C2C2C] rounded-xl p-6 max-w-[920px]">
        {PATH_CONFIGS.map((config) => (
          <Row
            key={config.key}
            label={config.label}
            field={config.key}
            placeholder={config.placeholder}
            tooltip={config.tooltip}
          />
        ))}

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSalvar} className="bg-yellow-600 hover:bg-yellow-500">Salvar</Button>
        </div>
      </div>
    </div>
  );
}

