// src/components/ConfigurationScreen.tsx
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Paths = {
  entrada?: string;
  working?: string;
  finalOk?: string;
  finalErro?: string;
  logsErrors?: string;
  logsProcessed?: string;
};

export default function ConfigurationScreen({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<Paths>({
    entrada: "",
    working: "",
    finalOk: "",
    finalErro: "",
    logsErrors: "",
    logsProcessed: "",
  });

  const [test, setTest] = useState<Record<string, { ok: boolean; exists: boolean; write: boolean }>>({});

  useEffect(() => {
    (async () => {
      const cur = await window.api.getCfg();
      if (cur) setForm((prev) => ({ ...prev, ...cur }));
    })();
  }, []);

  function setVal(key: keyof Paths, v: string) {
    setForm((p) => ({ ...p, [key]: v }));
  }

  async function handleSalvar() {
    await window.api.saveCfg(form);
    alert("Configurações salvas!");
  }

  async function handleTestar() {
    const r = await window.api.testAccess(form);
    setTest(r || {});
  }

  const Badge = ({ ok, exists, write }: { ok?: boolean; exists?: boolean; write?: boolean }) => (
    <div className="text-xs opacity-80">
      <span className={`px-2 py-0.5 rounded ${ok ? 'bg-emerald-900 text-emerald-200' : 'bg-red-900 text-red-200'}`}>
        {ok ? 'OK' : 'ERRO'}
      </span>{" "}
      <span className="ml-2">exist: {exists ? '✓' : '×'}</span>
      <span className="ml-2">write: {write ? '✓' : '×'}</span>
    </div>
  );

  const Row = (props: { label: string; field: keyof Paths; placeholder?: string }) => (
    <div className="space-y-1">
      <label className="text-sm opacity-80">{props.label}</label>
      <div className="flex items-center gap-3">
        <Input
          value={form[props.field] || ""}
          onChange={(e) => setVal(props.field, e.target.value)}
          placeholder={props.placeholder}
          className="bg-[#151515] border-[#2C2C2C] w-[680px]"
        />
        <Badge {...(test[props.field] || {})} />
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
        <Row label="Pasta de Entrada" field="entrada" placeholder="\\servidor\orcamentos\entrada" />
        <Row label="Pasta Working" field="working" placeholder="\\servidor\orcamentos\working" />
        <Row label="Pasta Final - OK" field="finalOk" placeholder="\\servidor\orcamentos\XML_FINAL\ok" />
        <Row label="Pasta Final - Erro" field="finalErro" placeholder="\\servidor\orcamentos\XML_FINAL\erro" />
        <Row label="Logs - Errors" field="logsErrors" placeholder="\\servidor\orcamentos\LOGS\errors" />
        <Row label="Logs - Processed" field="logsProcessed" placeholder="\\servidor\orcamentos\LOGS\processed" />

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSalvar} className="bg-yellow-600 hover:bg-yellow-500">Salvar</Button>
          <Button variant="outline" onClick={handleTestar}>Testar acesso</Button>
        </div>
      </div>
    </div>
  );
}
