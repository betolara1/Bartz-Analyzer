import React from "react";
import {
  Eye,
  Boxes,
  Wrench,
  Stethoscope,
  FolderOpen,
  Clock,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Row } from "../../types";
import { useFileActions } from "../../hooks/useFileActions";

// Sub-components
import { InfoSection } from "./InfoSection";
import { ErrorWarningSection } from "./ErrorWarningSection";
import { MachineSection } from "./MachineSection";
import { ImportKeySection } from "./ImportKeySection";
import { OrderInfoSection } from "./OrderInfoSection";
import { SpecialItemsSection } from "./SpecialItemsSection";
import { MuxarabiSection } from "./MuxarabiSection";
import { Es08Section } from "./Es08Section";
import { ErpSearchSection } from "./ErpSearchSection";
import { CoringaSection } from "./CoringaSection";
import { PendingRefSection } from "./PendingRefSection";
import { SemFilhoSection } from "./SemFilhoSection";

type TabKey = "overview" | "components" | "actions" | "diagnostics";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

interface FileDetailTabsProps {
  data: Row | null;
  actions: ReturnType<typeof useFileActions>;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function FileDetailTabs({ data, actions, activeTab, onTabChange }: FileDetailTabsProps) {
  const hasCG1 = !!data?.meta?.cg1_detected;
  const hasCG2 = !!data?.meta?.cg2_detected;
  const hasCoringa1 = !!data?.meta?.coringa1_detected;
  const hasCoringa2 = !!data?.meta?.coringa2_detected;
  const hasRefError = (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO"));
  const hasCoringaMatches = (data?.meta?.coringaMatches?.length || 0) > 0;
  const hasReferenciaEmpty = (data?.meta?.referenciaEmpty?.length || 0) > 0;
  
  const hasActions = hasCoringaMatches || 
                    hasRefError || 
                    actions.filteredCoringaMatches.length > 0 || 
                    hasCG1 || hasCG2 || hasCoringa1 || hasCoringa2 ||
                    hasReferenciaEmpty;

  const tabs: TabDef[] = [
    { key: "overview", label: "Visão Geral", icon: <Eye className="h-3.5 w-3.5" /> },
    { key: "components", label: "Componentes", icon: <Boxes className="h-3.5 w-3.5" /> },
    ...(hasActions ? [{ key: "actions", label: "Ações Manuais", icon: <Wrench className="h-3.5 w-3.5" /> } as TabDef] : []),
    { key: "diagnostics", label: "Diagnóstico", icon: <Stethoscope className="h-3.5 w-3.5" /> },
  ];

  // If actions tab is active but no longer available, switch to overview
  React.useEffect(() => {
    if (activeTab === "actions" && !hasActions) {
      onTabChange("overview");
    }
  }, [hasActions, activeTab, onTabChange]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab Bar */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-1 px-6 pt-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`
                  fd-tab relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest
                  transition-all duration-200 rounded-t-lg border border-transparent
                  ${isActive
                    ? "bg-muted text-foreground border-border border-b-transparent -mb-px z-10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }
                `}
              >
                <span className={isActive ? "text-emerald-400" : ""}>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-card">
        <div className="p-6 space-y-6 pb-20 fd-tab-content">
          {activeTab === "overview" && (
            <OverviewTab data={data} actions={actions} />
          )}
          {activeTab === "components" && (
            <ComponentsTab data={data} actions={actions} />
          )}
          {activeTab === "actions" && (
            <ActionsTab data={data} actions={actions} />
          )}
          {activeTab === "diagnostics" && (
            <DiagnosticsTab data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── TAB: Visão Geral ─── */
function OverviewTab({ data, actions }: { data: Row | null; actions: ReturnType<typeof useFileActions> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="lg:col-span-2">
        <InfoSection
          data={data}
          onReprocess={actions.handleReprocess}
          onOpenFolder={actions.handleOpenFolder}
        />
      </div>
      <ErrorWarningSection data={data} />
      <MachineSection data={data} />
      <ImportKeySection data={data} />
      <OrderInfoSection
        isOpen={actions.orderInfoOpen}
        onToggle={() => {
          const next = !actions.orderInfoOpen;
          actions.setOrderInfoOpen(next);
          if (next && actions.orderComments.length === 0) actions.fetchOrderComments();
        }}
        loading={actions.loadingComments}
        comments={actions.orderComments}
        onFetch={actions.fetchOrderComments}
      />
    </div>
  );
}

/* ─── TAB: Componentes ─── */
function ComponentsTab({ data, actions }: { data: Row | null; actions: ReturnType<typeof useFileActions> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="lg:col-span-2">
        <SemFilhoSection
          isOpen={actions.semFilhoOpen}
          onToggle={() => actions.setSemFilhoOpen(!actions.semFilhoOpen)}
          data={data}
          onMoveToOk={() => actions.setConfirmMoveEmptyOpen(true)}
        />
      </div>
      <div className="lg:col-span-2">
        <Es08Section
          isOpen={actions.es08Open}
          onToggle={() => actions.setEs08Open(!actions.es08Open)}
          data={data}
          uniqueDrawings={actions.uniqueDrawings}
          dxfSearching={actions.dxfSearching}
          dxfResults={actions.dxfResults}
          dxfFixing={actions.dxfFixing}
          onSearchAll={actions.searchAllDrawings}
          onFix={actions.fixFresa37to18}
          onMoveToOk={actions.handleMoveToOk}
          onOpenConfirmMove={() => actions.setConfirmMoveOpen(true)}
        />
      </div>
      <SpecialItemsSection
        isOpen={actions.specialItemsOpen}
        onToggle={() => actions.setSpecialItemsOpen(!actions.specialItemsOpen)}
        data={data}
      />
      <MuxarabiSection
        isOpen={actions.muxarabiOpen}
        onToggle={() => actions.setMuxarabiOpen(!actions.muxarabiOpen)}
        data={data}
      />
    </div>
  );
}

/* ─── TAB: Ações Manuais ─── */
function ActionsTab({ data, actions }: { data: Row | null; actions: ReturnType<typeof useFileActions> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="lg:col-span-2">
        <OrderInfoSection
          isOpen={actions.orderInfoOpen}
          onToggle={() => {
            const next = !actions.orderInfoOpen;
            actions.setOrderInfoOpen(next);
            if (next && actions.orderComments.length === 0) actions.fetchOrderComments();
          }}
          loading={actions.loadingComments}
          comments={actions.orderComments}
          onFetch={actions.fetchOrderComments}
        />
      </div>
      <ErpSearchSection
        isOpen={actions.erpSearchOpen}
        onToggle={() => actions.setErpSearchOpen(!actions.erpSearchOpen)}
        data={data}
        erpSearchCode={actions.erpSearchCode}
        setErpSearchCode={actions.setErpSearchCode}
        erpSearchDesc={actions.erpSearchDesc}
        setErpSearchDesc={actions.setErpSearchDesc}
        erpSearchType={actions.erpSearchType}
        setErpSearchType={actions.setErpSearchType}
        erpSearching={actions.erpSearching}
        erpSearchResults={actions.erpSearchResults}
        onSearch={actions.handleErpSearch}
        onSelectCode={(code) => {
          if (actions.filteredCoringaMatches.length > 0) {
            actions.setIndCoringaAcronym(code);
            actions.setCoringaTo(code);
          }
          const showRefPanel = ((data?.meta?.referenciaEmpty?.length ?? 0) > 0 || (data?.errors ?? []).some(er => String(er).toUpperCase().includes("ITEM SEM CÓDIGO")));
          if (showRefPanel) {
            actions.setRefFillValue(code);
          }
          toast.success(`Código "${code}" selecionado`);
        }}
      />
      <CoringaSection
        isOpen={actions.coringaOpen}
        onToggle={() => actions.setCoringaOpen(!actions.coringaOpen)}
        data={data}
        coringaFrom={actions.coringaFrom}
        setCoringaFrom={actions.setCoringaFrom}
        coringaTo={actions.coringaTo}
        setCoringaTo={actions.setCoringaTo}
        indCoringaAcronym={actions.indCoringaAcronym}
        setIndCoringaAcronym={actions.setIndCoringaAcronym}
        indCoringaSearching={actions.indCoringaSearching}
        indCoringaOptions={actions.indCoringaOptions}
        onCoringaSearch={actions.handleCoringaSearch}
        onApplyCoringa={() => actions.setConfirmCoringaOpen(true)}
        isReplacing={actions.isReplacing}
        lastReplace={actions.lastReplace}
        filteredCoringaMatches={actions.filteredCoringaMatches}
        coringa1Acronym={actions.coringa1Acronym}
        setCoringa1Acronym={actions.setCoringa1Acronym}
        coringa1Searching={actions.coringa1Searching}
        coringa1Options={actions.coringa1Options}
        coringa1Selected={actions.coringa1Selected}
        setCoringa1Selected={actions.setCoringa1Selected}
        coringa1Done={actions.coringa1Done}
        onApplyCoringa1={actions.onApplyCoringa1}
        coringa2Acronym={actions.coringa2Acronym}
        setCoringa2Acronym={actions.setCoringa2Acronym}
        coringa2Searching={actions.coringa2Searching}
        coringa2Options={actions.coringa2Options}
        coringa2Selected={actions.coringa2Selected}
        setCoringa2Selected={actions.setCoringa2Selected}
        coringa2Done={actions.coringa2Done}
        onApplyCoringa2={actions.onApplyCoringa2}
        cg1Acronym={actions.cg1Acronym}
        setCg1Acronym={actions.setCg1Acronym}
        cg1Searching={actions.cg1Searching}
        cg1Options={actions.cg1Options}
        cg1Replace={actions.cg1Replace}
        setCg1Replace={actions.setCg1Replace}
        cg1Done={actions.cg1Done}
        onApplyCg1={actions.onApplyCg1}
        cg2Acronym={actions.cg2Acronym}
        setCg2Acronym={actions.setCg2Acronym}
        cg2Searching={actions.cg2Searching}
        cg2Options={actions.cg2Options}
        cg2Replace={actions.cg2Replace}
        setCg2Replace={actions.setCg2Replace}
        cg2Done={actions.cg2Done}
        onApplyCg2={actions.onApplyCg2}
      />
      <div className="lg:col-span-2">
        <PendingRefSection
          isOpen={actions.pendingRefOpen}
          onToggle={() => actions.setPendingRefOpen(!actions.pendingRefOpen)}
          data={data}
          selectedRefSingle={actions.selectedRefSingle}
          setSelectedRefSingle={actions.setSelectedRefSingle}
          refFillValue={actions.refFillValue}
          setRefFillValue={actions.setRefFillValue}
          onConfirm={() => actions.setConfirmRefOpen(true)}
        />
      </div>
    </div>
  );
}

/* ─── TAB: Diagnóstico ─── */
function DiagnosticsTab({ data }: { data: Row | null }) {
  const handleCopyPath = () => {
    if (!data?.fullpath) return;
    navigator.clipboard.writeText(data.fullpath);
    toast.success("Caminho copiado!");
  };

  return (
    <>
      {/* File Path */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Caminho Completo do Arquivo</h4>
        </div>
        <div className="relative group">
          <div className="p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/50 transition-colors">
            <div className="text-[11px] font-mono text-muted-foreground/80 break-all select-all leading-relaxed">
              {data?.fullpath || "Caminho não disponível"}
            </div>
          </div>
          <button
            onClick={handleCopyPath}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* File Metadata */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metadata do Arquivo</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetaCard label="Status" value={data?.status || "—"} />
          <MetaCard label="ID" value={data?.id || "—"} />
          <MetaCard label="Processamento" value={data?.timestamp || "—"} />
          <MetaCard label="Erros" value={String(data?.errors?.length ?? 0)} />
          <MetaCard label="Avisos" value={String(data?.warnings?.length ?? 0)} />
          <MetaCard label="Auto-fixes" value={String(data?.autoFixes?.length ?? 0)} />
          <MetaCard label="Tags" value={(data?.tags || []).join(", ") || "—"} />
          <MetaCard label="Chave ERP" value={data?.meta?.importKey || "—"} />
          <MetaCard label="Máquinas" value={String(data?.meta?.machines?.length ?? 0)} />
        </div>
      </section>

      {/* Action History */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Histórico de Ações</h4>
        </div>
        {(data?.history || []).length > 0 ? (
          <div className="space-y-2">
            {(data?.history || []).map((entry, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground font-medium flex items-start gap-3 hover:border-primary/50 transition-colors">
                <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[8px] font-bold text-primary">{i + 1}</span>
                </div>
                <span className="leading-relaxed">{entry}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border opacity-50">
            <p className="text-xs italic text-muted-foreground/40">Nenhuma ação registrada até o momento.</p>
          </div>
        )}
      </section>

      {/* Raw Meta */}
      {data?.meta && Object.keys(data.meta).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Meta Completo (Debug)</h4>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border overflow-x-auto">
            <pre className="text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all max-h-60 overflow-y-auto custom-scrollbar">
              {JSON.stringify(data.meta, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/50 transition-colors">
      <div className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-widest mb-1">{label}</div>
      <div className="text-xs text-foreground font-medium truncate" title={value}>{value}</div>
    </div>
  );
}

export type { TabKey };
