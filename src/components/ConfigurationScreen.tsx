// src/components/ConfigurationScreen.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  CircleHelp,
  FolderOpen,
  Clock,
  Trash2,
  Settings,
  Save,
  ArrowLeft,
  User,
  LogOut,
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Layers,
  Bot,
  Calendar,
  Sparkles,
  HardDrive,
  FileSpreadsheet,
  Download,
  Search,
  FolderInput,
  FolderSync,
  Cpu,
  RefreshCw,
  FolderCheck,
  FolderX,
  Server,
  FileCode,
  Sliders,
  CheckSquare,
  Square,
  Activity,
  Zap,
  Network,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

export type FullConfig = {
  entrada: string;
  exportacao: string;
  ok: string;
  erro: string;
  drawings: string;
  drawingsCopy: string;
  drawingsAspan: string;
  simplificado: string;
  busca: string;
  downloadPromob: string;
  enableAutoFix: boolean;

  // Scheduler Options
  schedulerEnabled: boolean;
  schedulerTimes: string;
  schedulerDays: string;

  // Cleanup Options
  cleanupEnabled: boolean;
  cleanupTime: string;
  cleanupRetentionDays: number;
  cleanupCleanOk: boolean;
  cleanupCleanErro: boolean;

  // Database MySQL
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword?: string;
  dbName: string;
};

export interface ConfigurationScreenProps {
  onBack: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

export type PathConfigKey =
  | "entrada"
  | "exportacao"
  | "ok"
  | "erro"
  | "drawings"
  | "drawingsCopy"
  | "drawingsAspan"
  | "simplificado"
  | "busca"
  | "downloadPromob";

export interface PathConfig {
  key: PathConfigKey;
  label: string;
  placeholder: string;
  tooltip: string;
  category?: "process" | "drawings" | "export";
  badge?: string;
  icon?: any;
}

export const PATH_CONFIGS: PathConfig[] = [
  {
    key: "entrada",
    label: "Pasta de Entrada",
    placeholder: "\\\\servidor\\orcamentos\\entrada",
    tooltip: "Pasta de entrada onde o sistema irá monitorar e ler os arquivos XML para análise.",
    category: "process",
    badge: "Entrada XML",
    icon: FolderInput,
  },
  {
    key: "ok",
    label: "Pasta Arquivos OK (Aprovados)",
    placeholder: "\\\\servidor\\orcamentos\\XML_FINAL\\ok",
    tooltip: "Pasta de destino para onde os arquivos XML corretos (sem inconformidades) serão movidos.",
    category: "process",
    badge: "Sucesso",
    icon: FolderCheck,
  },
  {
    key: "erro",
    label: "Pasta Arquivos Erro (Inconformidades)",
    placeholder: "\\\\servidor\\orcamentos\\XML_FINAL\\erro",
    tooltip: "Pasta de destino para onde os arquivos XML com erros ou inconformidades serão movidos.",
    category: "process",
    badge: "Inconformidades",
    icon: FolderX,
  },
  {
    key: "simplificado",
    label: "Pasta XML Simplificado",
    placeholder: "\\\\servidor\\orcamentos\\simplificado",
    tooltip: "Pasta onde será salvo o XML simplificado (somente itens pais de ITENS_PEDIDO, sem filhos) gerado automaticamente.",
    category: "process",
    badge: "Itens Pai",
    icon: FileCode,
  },
  {
    key: "drawings",
    label: "NESTING (SERVIDOR)",
    placeholder: "\\\\servidor\\desenhos",
    tooltip: "Pasta onde o sistema buscará os desenhos técnicos NESTING (SERVIDOR) correspondentes.",
    category: "drawings",
    badge: "Principal",
    icon: Server,
  },
  {
    key: "drawingsCopy",
    label: "NESTING (DXF ALESSANDRO)",
    placeholder: "\\\\Pc-alessandro\\dxf",
    tooltip: "Pasta espelho para os desenhos NESTING(DXF ALESSANDRO). Deixe em branco para desativar.",
    category: "drawings",
    badge: "Espelho DXF",
    icon: Copy,
  },
  {
    key: "drawingsAspan",
    label: "NANXING / ASPAN",
    placeholder: "\\\\servidor\\aspan",
    tooltip: "Pasta de desenhos no formato NANXING / ASPAN. Deixe em branco para desativar.",
    category: "drawings",
    badge: "Nanxing",
    icon: Cpu,
  },
  {
    key: "exportacao",
    label: "Pasta de Relatórios & Histórico",
    placeholder: "\\\\servidor\\orcamentos\\exportacao",
    tooltip: "Pasta de exportação onde as planilhas e relatórios gerados automaticamente serão salvos.",
    category: "export",
    badge: "Relatórios CSV",
    icon: FileSpreadsheet,
  },
  {
    key: "busca",
    label: "Pasta de Busca XML",
    placeholder: "\\\\servidor\\orcamentos\\busca_xmls",
    tooltip: "Pasta de rede contendo os arquivos XML a serem pesquisados no Dashboard para cópia e processamento rápido.",
    category: "export",
    badge: "Repositório Busca",
    icon: Search,
  },
  {
    key: "downloadPromob",
    label: "Pasta de Download Promob",
    placeholder: "C:\\Downloads\\Promob",
    tooltip: "Pasta onde os arquivos .promob baixados do Pedidos Online serão salvos no computador local.",
    category: "export",
    badge: "Projetos Promob",
    icon: Download,
  },
];

export default function ConfigurationScreen({ onBack, currentUser, onLogout }: ConfigurationScreenProps) {
  const [activeTab, setActiveTab] = useState<"paths" | "automations" | "account">("paths");
  const [initialForm, setInitialForm] = useState<FullConfig | null>(null);
  const [form, setForm] = useState<FullConfig>({
    entrada: "",
    exportacao: "",
    ok: "",
    erro: "",
    drawings: "",
    drawingsCopy: "",
    drawingsAspan: "",
    simplificado: "",
    busca: "",
    downloadPromob: "",
    enableAutoFix: true,
    schedulerEnabled: true,
    schedulerTimes: "11:30, 17:30",
    schedulerDays: "seg-sex",
    cleanupEnabled: false,
    cleanupTime: "17:30",
    cleanupRetentionDays: 0,
    cleanupCleanOk: true,
    cleanupCleanErro: true,
    dbHost: "mysql55-farm2.uni5.net",
    dbPort: 3306,
    dbUser: "bartzpedidosph",
    dbPassword: "mangaROSA2006",
    dbName: "bartzpedidosph",
  });

  const [testResults, setTestResults] = useState<Record<string, { exist: boolean; write: boolean; error?: string }> | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Permissão 37 ou 38 - Admin Analisador
  const isAdminAnalisador = useMemo(() => {
    if (!currentUser) return false;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms
      .map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p)))
      .some((id: number) => id === 37 || id === 38);
  }, [currentUser]);

  // Lista de permissões do usuário para exibição formatada
  const userPermissionsList = useMemo(() => {
    if (!currentUser) return [];
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => {
      const id = typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p);
      const name = typeof p === "object" && p !== null ? p.txt_permissao || p.nome : null;
      let label = name || `Permissão #${id}`;
      if (id === 37 || id === 38) label = `Admin Analisador (${id})`;
      if (id === 39) label = `Pedidos Especiais (${id})`;
      if (id === 40) label = `Separação de Chapas (${id})`;
      return { id, label };
    });
  }, [currentUser]);

  // Verifica se há alterações não salvas
  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  useEffect(() => {
    (async () => {
      try {
        const cur = await window.electron?.settings?.load();
        if (cur) {
          const loaded: FullConfig = {
            ...form,
            ...cur,
            enableAutoFix: isAdminAnalisador ? (cur.enableAutoFix !== undefined ? cur.enableAutoFix : true) : false,
          };
          setForm(loaded);
          setInitialForm(loaded);
        }
      } catch (e) {
        console.error("Erro ao carregar configurações:", e);
      }
    })();
  }, [isAdminAnalisador]);

  function setVal(key: keyof FullConfig, v: any) {
    setForm((p) => ({ ...p, [key]: v }));
  }

  async function handlePickFolder(key: keyof FullConfig) {
    try {
      const current = form[key] || "";
      const chosen = await window.electron?.settings?.pickFolder(String(current));
      if (chosen) {
        setVal(key, chosen);
        toast.info(`Pasta selecionada para ${key}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao abrir seletor de pasta.");
    }
  }

  function handleCopyPath(key: string, value: string) {
    if (!value) {
      toast.warning("Caminho vazio.");
      return;
    }
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    toast.success("Caminho copiado para a área de transferência!");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleTestPaths() {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await window.electron?.settings?.testPaths(form);
      if (res) {
        setTestResults(res);
        const total = Object.keys(res).length;
        const successCount = Object.values(res).filter((r: any) => r.write).length;
        if (successCount === total) {
          toast.success(`Todos os ${total} caminhos testados estão 100% operacionais!`);
        } else {
          toast.warning(`${successCount} de ${total} pastas acessíveis. Verifique os avisos destacados.`);
        }
      }
    } catch (e: any) {
      toast.error("Erro ao testar caminhos.", { description: String(e?.message || e) });
    } finally {
      setTesting(false);
    }
  }

  const handleSalvar = useCallback(async () => {
    // Validação de horários do agendador
    if (form.schedulerEnabled) {
      const times = form.schedulerTimes.split(",").map((t) => t.trim()).filter(Boolean);
      if (times.length === 0) {
        toast.error("Informe ao menos um horário para o agendamento (ex: 11:30).");
        return;
      }
      for (const t of times) {
        if (!/^\d{1,2}:\d{2}$/.test(t)) {
          toast.error(`Horário inválido: "${t}". Use o formato HH:MM (ex: 11:30).`);
          return;
        }
      }
    }

    // Validação de horário da limpeza
    if (form.cleanupEnabled) {
      if (!/^\d{1,2}:\d{2}$/.test(form.cleanupTime.trim())) {
        toast.error(`Horário de limpeza inválido: "${form.cleanupTime}". Use o formato HH:MM (ex: 17:30).`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        enableAutoFix: isAdminAnalisador ? form.enableAutoFix : false,
      };

      await window.electron?.settings?.save(payload);
      setInitialForm(payload);
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar configurações.", { description: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }, [form, isAdminAnalisador]);

  // Atalho Ctrl+S / Cmd+S para salvar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSalvar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSalvar]);

  // Agrupamento de caminhos por categoria
  const processPaths = useMemo(() => PATH_CONFIGS.filter((p) => p.category === "process"), []);
  const drawingPaths = useMemo(() => PATH_CONFIGS.filter((p) => p.category === "drawings"), []);
  const exportPaths = useMemo(() => PATH_CONFIGS.filter((p) => p.category === "export"), []);

  const PathInputCard = ({ config }: { config: PathConfig }) => {
    const Icon = config.icon || FolderOpen;
    const value = String(form[config.key] || "");
    const test = testResults ? testResults[config.key] : null;
    const isCopied = copiedKey === config.key;

    return (
      <div className="group rounded-xl border border-border/70 bg-card/60 hover:bg-card/90 p-3.5 transition-all shadow-xs hover:shadow-md hover:border-purple-500/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground tracking-tight truncate">{config.label}</span>
                {config.badge && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-muted/60 text-muted-foreground border border-border/50">
                    {config.badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground/60 hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover text-popover-foreground border border-border p-2.5 shadow-xl max-w-xs text-xs">
              <p>{config.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Input
              value={value}
              onChange={(e) => setVal(config.key, e.target.value)}
              onClear={() => setVal(config.key, "")}
              placeholder={config.placeholder}
              className="h-9 text-xs font-mono bg-background/80 border-border/80 focus:border-purple-500 focus:ring-purple-500/20 pr-8"
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopyPath(config.key, value)}
                disabled={!value}
                className="h-9 px-2.5 border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Copiar caminho</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePickFolder(config.key)}
                className="h-9 px-3 gap-1.5 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-purple-300 font-semibold shrink-0 cursor-pointer transition-all"
              >
                <FolderOpen className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs hidden sm:inline">Procurar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Selecionar pasta no explorador</TooltipContent>
          </Tooltip>
        </div>

        {/* Test Result Indicator */}
        {test && (
          <div className="mt-2 text-[11px] flex items-center gap-1.5 font-medium">
            {test.write ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Pasta acessível com permissão de gravação
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {test.exist ? "Sem permissão de gravação" : "Diretório não encontrado / inacessível"}
                {test.error && test.error !== "vazio" && <span className="opacity-80">({test.error})</span>}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPaths = () => (
    <div className="space-y-6 max-w-5xl">
      {/* Overview Top Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/30 via-background to-indigo-950/20 shadow-sm backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Estrutura de Pastas & Caminhos de Rede (UNC)</h3>
            <p className="text-xs text-muted-foreground">
              Configure as pastas locais e mapeamentos de rede compartilhados utilizados pelo analisador.
            </p>
          </div>
        </div>

        <Button
          onClick={handleTestPaths}
          disabled={testing}
          variant="outline"
          className="h-9 px-4 gap-2 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin text-purple-400" : "text-purple-400"}`} />
          <span>{testing ? "Testando Permissões..." : "Testar Acesso a Todas as Pastas"}</span>
        </Button>
      </div>

      {/* Categoria 1: Fluxo Principal de Processamento */}
      <div className="rounded-2xl border border-border/80 bg-card/40 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FolderSync className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Fluxo de Processamento de XMLs</h4>
              <p className="text-xs text-muted-foreground">Pastas principais de entrada, aprovação (OK), erros e simplificados.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
            4 Diretórios
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {processPaths.map((config) => (
            <PathInputCard key={config.key} config={config} />
          ))}
        </div>
      </div>

      {/* Categoria 2: Desenhos Técnicos & Nesting */}
      <div className="rounded-2xl border border-border/80 bg-card/40 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Desenhos Técnicos, DXF & Nesting</h4>
              <p className="text-xs text-muted-foreground">Repositórios de desenhos técnicos de corte, furação e usinagem CNC.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold border-cyan-500/30 text-cyan-400 bg-cyan-500/5">
            3 Diretórios
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {drawingPaths.map((config) => (
            <PathInputCard key={config.key} config={config} />
          ))}
        </div>
      </div>

      {/* Categoria 3: Exportação, Busca & Integrações */}
      <div className="rounded-2xl border border-border/80 bg-card/40 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Relatórios, Busca & Downloads Promob</h4>
              <p className="text-xs text-muted-foreground">Destinos de exportação automática, repositório de busca e integração online.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/30 text-amber-400 bg-amber-500/5">
            3 Diretórios
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {exportPaths.map((config) => (
            <PathInputCard key={config.key} config={config} />
          ))}
        </div>
      </div>
    </div>
  );

  const renderAutomations = () => (
    <div className="space-y-6 max-w-5xl">
      {/* Bloco 1: Robô Auto-Fix Geral */}
      {isAdminAnalisador ? (
        <div className={`rounded-2xl border transition-all p-5 shadow-sm ${
          form.enableAutoFix
            ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-card/60 to-background shadow-emerald-500/5"
            : "border-border/80 bg-card/40"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shadow-xs transition-colors ${
                form.enableAutoFix
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-muted/50 border-border text-muted-foreground"
              }`}>
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground tracking-tight">Robô Auto-Fix (Correção Automática)</h3>
                  <Badge className="bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                    Admin Analisador
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regula a atuação autônoma do robô na correção de inconformidades durante a validação dos XMLs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold ${form.enableAutoFix ? "text-emerald-400" : "text-muted-foreground"}`}>
                {form.enableAutoFix ? "Ativado" : "Desativado"}
              </span>
              <Switch
                checked={form.enableAutoFix}
                onCheckedChange={(val) => setVal("enableAutoFix", val)}
              />
            </div>
          </div>

          <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                Cores Coringas
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Detecta códigos de acabamentos coringas e realiza a substituição automática com base no histórico e regras.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                Itens sem Cadastro
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Identifica e corrige referências vazias ou códigos ausentes no catálogo de engenharia.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                Dimensões de Chapas
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Adequa as medidas máximas de corte e regras de bordas antes do envio para usinagem.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center gap-3 text-muted-foreground text-xs">
          <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0" />
          <span>As opções do Robô Auto-Fix estão disponíveis apenas para usuários com perfil de Admin Analisador.</span>
        </div>
      )}

      {/* Bloco 2: Agendador de Relatórios */}
      <div className={`rounded-2xl border transition-all p-5 shadow-sm ${
        form.schedulerEnabled
          ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-card/60 to-background shadow-amber-500/5"
          : "border-border/80 bg-card/40"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shadow-xs transition-colors ${
              form.schedulerEnabled
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Agendamento Automático de Relatórios</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exporta relatórios consolidados em formato CSV para a pasta de exportação nos horários configurados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${form.schedulerEnabled ? "text-amber-400" : "text-muted-foreground"}`}>
              {form.schedulerEnabled ? "Ativado" : "Desativado"}
            </span>
            <Switch
              checked={form.schedulerEnabled}
              onCheckedChange={(val) => setVal("schedulerEnabled", val)}
            />
          </div>
        </div>

        {form.schedulerEnabled && (
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Horários de Exportação</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        Separe múltiplos horários por vírgula no padrão HH:MM de 24 horas (ex: 11:30, 17:30).
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">Formato HH:MM</span>
                </div>

                <Input
                  value={form.schedulerTimes}
                  onChange={(e) => setVal("schedulerTimes", e.target.value)}
                  placeholder="11:30, 17:30"
                  className="bg-background/80 border-border/80 text-sm font-mono h-10"
                />

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-muted-foreground font-semibold mr-1">Atalhos:</span>
                  {["11:30", "17:30", "08:00", "12:00", "18:00"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        const current = form.schedulerTimes.split(",").map((t) => t.trim()).filter(Boolean);
                        if (!current.includes(time)) {
                          setVal("schedulerTimes", [...current, time].join(", "));
                        }
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 hover:bg-amber-500/20 hover:text-amber-300 border border-border/60 transition-colors cursor-pointer"
                    >
                      + {time}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setVal("schedulerTimes", "11:30, 17:30")}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                  >
                    Padrão
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Dias de Funcionamento</label>
                <select
                  value={form.schedulerDays}
                  onChange={(e) => setVal("schedulerDays", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none transition-colors [color-scheme:dark]"
                >
                  <option value="seg-sex" className="bg-[#18181b] text-zinc-100">Segunda a Sexta-feira (Dias Úteis)</option>
                  <option value="seg-sab" className="bg-[#18181b] text-zinc-100">Segunda a Sábado</option>
                  <option value="todos" className="bg-[#18181b] text-zinc-100">Todos os dias (Segunda a Domingo)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Define em quais dias da semana as exportações serão disparadas automaticamente.
                </p>
              </div>
            </div>

            {/* Summary preview */}
            <div className="p-3 rounded-xl bg-background/40 border border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Exportando relatórios nos horários:{" "}
                <strong className="text-amber-300 font-mono">[{form.schedulerTimes || "Nenhum"}]</strong> com frequência{" "}
                <strong className="text-foreground">
                  {form.schedulerDays === "seg-sex"
                    ? "Segunda a Sexta"
                    : form.schedulerDays === "seg-sab"
                    ? "Segunda a Sábado"
                    : "Todos os dias"}
                </strong>
                .
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bloco 3: Rotina de Limpeza Automática */}
      <div className={`rounded-2xl border transition-all p-5 shadow-sm ${
        form.cleanupEnabled
          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-card/60 to-background shadow-rose-500/5"
          : "border-border/80 bg-card/40"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shadow-xs transition-colors ${
              form.cleanupEnabled
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}>
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Rotina de Limpeza Automática</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exclui arquivos antigos das pastas de destino para liberar espaço no armazenamento e manter o servidor organizado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${form.cleanupEnabled ? "text-rose-400" : "text-muted-foreground"}`}>
              {form.cleanupEnabled ? "Ativado" : "Desativado"}
            </span>
            <Switch
              checked={form.cleanupEnabled}
              onCheckedChange={(val) => setVal("cleanupEnabled", val)}
            />
          </div>
        </div>

        {form.cleanupEnabled && (
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Horário da Limpeza */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Horário da Limpeza</label>
                <Input
                  value={form.cleanupTime}
                  onChange={(e) => setVal("cleanupTime", e.target.value)}
                  placeholder="17:30"
                  className="bg-background/80 border-border/80 text-sm font-mono h-10"
                />
                <p className="text-[11px] text-muted-foreground">Horário diário de execução (HH:MM).</p>
              </div>

              {/* Dias de Retenção */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Retenção (Dias)</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        0 = Exclui arquivos gerados hoje. Número &gt; 0 = Mantém os arquivos pelo número de dias configurado.
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <span className="text-[10px] text-rose-300 font-bold">
                    {form.cleanupRetentionDays === 0 ? "Mesmo dia (0 dias)" : `${form.cleanupRetentionDays} dias`}
                  </span>
                </div>

                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.cleanupRetentionDays}
                  onChange={(e) => setVal("cleanupRetentionDays", parseInt(e.target.value) || 0)}
                  className="bg-background/80 border-border/80 text-sm font-mono h-10"
                />

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[0, 3, 7, 15, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setVal("cleanupRetentionDays", days)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        form.cleanupRetentionDays === days
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground border-border/60"
                      }`}
                    >
                      {days === 0 ? "0d (Hoje)" : `${days}d`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pastas Alvo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Pastas para Limpeza</label>
                <div className="flex flex-col gap-2 pt-0.5">
                  <label
                    onClick={() => setVal("cleanupCleanOk", !form.cleanupCleanOk)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-semibold ${
                      form.cleanupCleanOk
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-background/40 border-border/60 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {form.cleanupCleanOk ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span>Limpar Pasta OK (Sucessos)</span>
                  </label>

                  <label
                    onClick={() => setVal("cleanupCleanErro", !form.cleanupCleanErro)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-semibold ${
                      form.cleanupCleanErro
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-background/40 border-border/60 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {form.cleanupCleanErro ? (
                      <CheckSquare className="h-4 w-4 text-rose-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span>Limpar Pasta Erro (Inconformidades)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="space-y-6 max-w-5xl">
      {/* Perfil do Usuário */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-card/70 to-background p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 border border-purple-400/40 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-900/30 shrink-0">
              {currentUser?.txt_nome?.charAt(0)?.toUpperCase() || currentUser?.txt_login?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {currentUser?.txt_nome || currentUser?.txt_login || "Usuário Conectado"}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sessão Ativa
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Login:</span>
                <code className="text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 font-bold">
                  {currentUser?.txt_login || "--"}
                </code>
              </p>
            </div>
          </div>

          {onLogout && (
            <Button
              variant="destructive"
              onClick={onLogout}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 px-4 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" /> Desconectar Sessão
            </Button>
          )}
        </div>

        {/* Permissões Ativas */}
        <div className="pt-5 space-y-2.5">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            Permissões do Perfil
          </span>
          <div className="flex flex-wrap gap-2">
            {userPermissionsList.length > 0 ? (
              userPermissionsList.map((p: { id: number; label: string }) => (
                <Badge
                  key={p.id}
                  className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs py-1 px-2.5 font-semibold"
                >
                  {p.label}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">Nenhuma permissão específica mapeada.</span>
            )}
          </div>
        </div>
      </div>

      {/* Conexão MySQL (Admin Analisador) */}
      {isAdminAnalisador ? (
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-card/70 to-background p-6 space-y-5 shadow-md">
          <div className="border-b border-border/60 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Conexão com Banco de Dados MySQL (Pedidos Online)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Parâmetros de conexão direta para validação de logins na tabela <code className="text-blue-300 font-mono font-bold">tab_usuario</code>.
                </p>
              </div>
            </div>

            <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
              Porta Padrão 3306
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Host / Servidor MySQL</label>
              <Input
                value={form.dbHost || ""}
                onChange={(e) => setVal("dbHost", e.target.value)}
                placeholder="mysql55-farm2.uni5.net"
                className="bg-background/80 border-border/80 font-mono text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Porta</label>
              <Input
                type="number"
                value={form.dbPort || 3306}
                onChange={(e) => setVal("dbPort", parseInt(e.target.value) || 3306)}
                placeholder="3306"
                className="bg-background/80 border-border/80 font-mono text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Usuário do Banco</label>
              <Input
                value={form.dbUser || ""}
                onChange={(e) => setVal("dbUser", e.target.value)}
                placeholder="bartzpedidosph"
                className="bg-background/80 border-border/80 font-mono text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Senha do Banco</label>
              <div className="relative">
                <Input
                  type={showDbPassword ? "text" : "password"}
                  value={form.dbPassword || ""}
                  onChange={(e) => setVal("dbPassword", e.target.value)}
                  placeholder="••••••••"
                  className="bg-background/80 border-border/80 font-mono text-xs h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDbPassword(!showDbPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                >
                  {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-foreground">Nome do Banco de Dados (Schema)</label>
              <Input
                value={form.dbName || ""}
                onChange={(e) => setVal("dbName", e.target.value)}
                placeholder="bartzpedidosph"
                className="bg-background/80 border-border/80 font-mono text-xs h-10"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Glass Header */}
      <header className="border-b border-border/80 bg-gradient-to-r from-card via-card/95 to-card px-6 py-4 sticky top-0 z-30 shadow-sm backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-9 px-3 gap-2 text-xs font-bold border-border/80 hover:bg-muted text-foreground rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-purple-400" />
              <span>Voltar</span>
            </Button>

            <div className="h-6 w-px bg-border/80 hidden sm:block" />

            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-900/30 border border-purple-400/30 shrink-0">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-foreground tracking-tight">Configurações Gerais</h1>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/15 border-purple-500/30">
                    Bartz v6.1.0
                  </Badge>
                  {isDirty && (
                    <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold animate-pulse">
                      Alterações não salvas
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Gerencie caminhos UNC de rede, rotinas de automação e conexão de banco de dados.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleSalvar}
              disabled={saving}
              className="h-9 px-4 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold gap-2 rounded-xl shadow-md shadow-purple-900/20 active:scale-95 transition-all cursor-pointer border border-purple-400/30"
            >
              <Save className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
              <span>{saving ? "Salvando..." : "Salvar Configurações"}</span>
              <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.2 text-[9px] font-mono bg-purple-800/40 rounded border border-purple-400/30 text-purple-200">
                Ctrl+S
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/80 shadow-inner max-w-2xl">
          <button
            type="button"
            onClick={() => setActiveTab("paths")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "paths"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Caminhos de Rede (UNC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("automations")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "automations"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Automações & Robô</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "account"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <User className="h-4 w-4" />
            <span>{isAdminAnalisador ? "Conta & Banco MySQL" : "Conta do Usuário"}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="transition-opacity duration-200">
          {activeTab === "paths" ? renderPaths() : activeTab === "automations" ? renderAutomations() : renderAccount()}
        </div>
      </main>

      {/* Bottom Sticky Status/Action Bar */}
      <div className="sticky bottom-0 z-20 border-t border-border/80 bg-card/90 backdrop-blur-md px-6 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-4 w-4 text-purple-400" />
            <span>
              {isDirty ? (
                <span className="text-amber-400 font-semibold">Existem alterações pendentes não salvas.</span>
              ) : (
                <span>Todas as configurações estão sincronizadas e salvas.</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "paths" && (
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={handleTestPaths}
                className="h-9 px-4 text-xs font-bold border-border hover:bg-muted text-foreground rounded-xl cursor-pointer"
              >
                {testing ? "Testando..." : "Testar Acesso a Pastas"}
              </Button>
            )}

            <Button
              onClick={handleSalvar}
              disabled={saving}
              className="h-9 px-5 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold gap-2 rounded-xl shadow-md shadow-purple-900/20 active:scale-95 transition-all cursor-pointer border border-purple-400/30"
            >
              <Save className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
              <span>{saving ? "Salvando..." : "Salvar Configurações"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
