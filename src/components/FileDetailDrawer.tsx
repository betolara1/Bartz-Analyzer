import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction
} from "./ui/alert-dialog";
import { toast } from "sonner";
import {
  X,
  FileCode,
  Copy,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { ChipStatus } from "./ChipStatus";
import { Row } from "../types";
import { useFileActions } from "../hooks/useFileActions";
import { FileDetailTabs, type TabKey } from "./drawer/FileDetailTabs";

interface FileDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Row | null;
  onAction?: (path: string, action: string) => void;
  onFileMoved?: (oldPath: string, newPath: string) => void;
  currentUser?: any;
}

function FileDetailDrawer({ open, onOpenChange, data, onAction, onFileMoved, currentUser }: FileDetailDrawerProps) {
  const actions = useFileActions(data, open, onAction, onFileMoved);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isMaximized, setIsMaximized] = useState(true);

  const userPerms = React.useMemo(() => {
    if (!currentUser) return [];
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    return perms.map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p)));
  }, [currentUser]);

  const hasAdminPermission = React.useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 37 || userId === 38) return true;
    return userPerms.some((id: number) => id === 37 || id === 38);
  }, [userPerms, currentUser]);

  const isPermission38 = React.useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 38) return true;
    return userPerms.includes(38);
  }, [userPerms, currentUser]);

  const canViewEs08 = React.useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 37 || userId === 38) return true;
    return userPerms.includes(37) || userPerms.includes(38);
  }, [userPerms, currentUser]);

  const canCopyXml = React.useMemo(() => {
    const userId = Number(currentUser?.pk_usuario ?? currentUser?.id ?? 0);
    if (userId === 37) return true;
    return userPerms.includes(37);
  }, [userPerms, currentUser]);

  // Reset UI state when drawer closes
  React.useEffect(() => {
    if (!open) {
      setActiveTab("overview");
    } else {
      setIsMaximized(true);
    }
  }, [open]);

  if (!data && open) return null;

  const isOk = data?.status === 'OK';
  const isErro = data?.status === 'ERRO';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fd-modal-overlay" />

        {/* Modal */}
        <DialogPrimitive.Content
          className={`fd-modal-container ${isMaximized ? "fd-modal-maximized" : ""}`}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="fd-modal-inner">
            {/* ═══ HEADER ═══ */}
            <div className="relative border-b border-border/80 bg-gradient-to-r from-card via-card/95 to-card px-6 py-4 shrink-0 overflow-hidden">
              {/* Subtle ambient status glow at top */}
              <div
                className={`pointer-events-none absolute -top-14 left-6 h-28 w-56 rounded-full blur-3xl opacity-20 ${
                  isOk ? 'bg-emerald-500' : isErro ? 'bg-rose-500' : 'bg-amber-500'
                }`}
              />

              <div className="relative flex items-center justify-between gap-4">
                {/* Left: Icon + File Info + Integrated Badges */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Status-tinted File Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-inner transition-all ${
                      isOk
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isErro
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <FileCode className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Top Row: Filename + Copy button + Integrated Status */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <DialogPrimitive.Title className="text-base sm:text-lg font-bold text-foreground font-mono tracking-tight leading-tight truncate max-w-[650px]">
                        {data?.filename || "Detalhes do Arquivo"}
                      </DialogPrimitive.Title>

                      {data?.filename && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(data.filename);
                            toast.success("Nome do arquivo copiado!");
                          }}
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          title="Copiar nome do arquivo"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Integrated Status Badge with Glow */}
                      <div className="shrink-0">
                        {isOk ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            OK • Conforme
                          </span>
                        ) : isErro ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-500/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                            Inconforme ({data?.errors?.length || 0})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {data?.status || 'FERRAGENS'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtitle / Breadcrumbs metadata */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-semibold text-[10px] tracking-widest uppercase text-muted-foreground/70">
                        Análise Técnica do XML
                      </span>
                      {data?.meta?.clientName && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-300 font-medium truncate max-w-[280px]">
                            {data.meta.clientName}
                          </span>
                        </>
                      )}
                      {data?.fullpath && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[340px]" title={data.fullpath}>
                            {data.fullpath}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Window Controls */}
                <div className="flex items-center gap-1 shrink-0 self-center">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-all cursor-pointer active:scale-95"
                    title={isMaximized ? "Restaurar" : "Maximizar"}
                  >
                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <DialogPrimitive.Close asChild>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/40 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 hover:border-rose-500/30 border border-border/60 transition-all cursor-pointer active:scale-95"
                      title="Fechar (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </DialogPrimitive.Close>
                </div>
              </div>
            </div>

            {/* ═══ TABS + CONTENT ═══ */}
            <FileDetailTabs
              data={data}
              actions={actions}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hasAdminPermission={hasAdminPermission}
              canViewEs08={canViewEs08}
              canCopyXml={canCopyXml}
              isPermission38={isPermission38}
            />

            {/* Resize Grip */}
            {!isMaximized && <div className="fd-resize-grip" />}
          </div>
        </DialogPrimitive.Content>

        {/* ═══ CONFIRMATION MODALS (Portal siblings to main content) ═══ */}
        <AlertDialog open={actions.confirmCoringaOpen} onOpenChange={actions.setConfirmCoringaOpen}>
          <AlertDialogContent className="bg-card border border-amber-500/30">
            <AlertDialogTitle className="text-foreground">Confirmar troca de cor coringa?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a substituir <span className="font-mono font-bold text-amber-300">{actions.coringaFrom}</span> por <span className="font-mono font-bold text-amber-300">{actions.coringaTo}</span>.
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={actions.onApplyCoringa}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                Confirmar
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={actions.confirmRefOpen} onOpenChange={actions.setConfirmRefOpen}>
          <AlertDialogContent className="bg-card border border-rose-500/30">
            <AlertDialogTitle className="text-foreground">Confirmar preenchimento de Referência e Descrição?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {(() => {
                const [selId, ...selDescParts] = (actions.selectedRefSingle || '').split('|');
                const selDesc = selDescParts.join('|');
                const hasCustomDesc = actions.refDescValue && actions.refDescValue !== selDesc;
                return (
                  <>
                    Você está prestes a atualizar o item no XML:
                    <div className="mt-2 p-2.5 bg-muted/50 rounded-lg border border-border space-y-1">
                      <div className="font-bold text-rose-300">ID: {selId}</div>
                      {hasCustomDesc ? (
                        <div className="text-xs text-foreground">
                          Nova descrição: <span className="font-semibold text-rose-400">"{actions.refDescValue}"</span>
                        </div>
                      ) : (
                        selDesc && <div className="text-xs italic text-zinc-400">"{selDesc}"</div>
                      )}
                    </div>
                    <div className="mt-2">Novo código: <span className="font-mono font-bold text-rose-300">{actions.refFillValue}</span></div>
                  </>
                );
              })()}
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={actions.onApplyRef}
                className="bg-rose-500 text-black hover:bg-rose-600 font-bold"
              >
                Confirmar
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={actions.confirmCgOpen} onOpenChange={actions.setConfirmCgOpen}>
          <AlertDialogContent className="bg-card border border-amber-500/30">
            <AlertDialogTitle className="text-foreground">Confirmar troca em lote (CG1/CG2)?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a substituir:
              <ul className="mt-2 ml-4 space-y-1 text-xs">
                {actions.cg1Replace && <li>• <span className="font-mono">CG1</span> → <span className="font-mono font-bold text-amber-300">{actions.cg1Replace}</span></li>}
                {actions.cg2Replace && <li>• <span className="font-mono">CG2</span> → <span className="font-mono font-bold text-amber-300">{actions.cg2Replace}</span></li>}
              </ul>
              <div className="mt-2 text-xs">Será criado um backup do arquivo original.</div>
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={actions.onApplyCgBatch}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                Confirmar
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={actions.confirmMoveOpen} onOpenChange={actions.setConfirmMoveOpen}>
          <AlertDialogContent className="bg-card border border-amber-500/30">
            <AlertDialogTitle className="text-foreground">Ainda há desenhos duplados. Mover mesmo assim?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              Existem pendências de correção DXF identificadas nestes itens duplados (ES08).
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  actions.setConfirmMoveOpen(false);
                  actions.resolveAndMaybeMove('es08');
                }}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                Confirmar e Resolver
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={actions.confirmMoveEmptyOpen} onOpenChange={actions.setConfirmMoveEmptyOpen}>
          <AlertDialogContent className="bg-card border border-emerald-500/30">
            <AlertDialogTitle className="text-foreground">Ignorar erro e marcar como resolvido?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {actions.unresolvedProblems.length <= 1
                ? 'O arquivo será movido para a pasta de processados mesmo contendo itens sem componentes. Deseja continuar?'
                : 'Este problema será marcado como resolvido. O arquivo só será movido quando todos os problemas forem resolvidos.'}
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  actions.setConfirmMoveEmptyOpen(false);
                  actions.resolveAndMaybeMove('sem_filho');
                }}
                className="bg-emerald-500 text-black hover:bg-emerald-600"
              >
                {actions.unresolvedProblems.length <= 1 ? 'Confirmar e Mover' : 'Confirmar'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={actions.confirmMoveOkOpen} onOpenChange={actions.setConfirmMoveOkOpen}>
          <AlertDialogContent className="bg-card border border-emerald-500/30">
            <AlertDialogTitle className="text-foreground">Confirmar resolução?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {actions.unresolvedProblems.length <= 1
                ? 'O arquivo será movido para a pasta de processados. Esta ação não pode ser desfeita facilmente.'
                : 'Este problema será marcado como resolvido. O arquivo só será movido quando todos os problemas forem resolvidos.'}
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  actions.setConfirmMoveOkOpen(false);
                  actions.resolveAndMaybeMove('es08');
                }}
                className="bg-emerald-500 text-black hover:bg-emerald-600"
              >
                {actions.unresolvedProblems.length <= 1 ? 'Confirmar e Mover' : 'Confirmar'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default React.memo(FileDetailDrawer);
