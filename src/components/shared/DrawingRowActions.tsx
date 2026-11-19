import React from "react";
import { FileText, FolderOpen, FolderCheck, ChevronDown, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useDrawingActions } from "../../hooks/useDrawingActions";

export interface DrawingRowActionsProps {
  drawingCode?: string | null;
  hasAdminPermission?: boolean;
  openButtonTitle?: string;
  extraDropdownItems?: React.ReactNode;
  extraActions?: React.ReactNode;
  onOpenDrawing?: (code: string) => void;
  onOpenDrawingFolder?: (code: string) => void;
  onOpenMirrorFolder?: (code: string) => void;
  onOpenAspanFolder?: (code: string) => void;
  onCopyToMirror?: (code: string) => void;
}

export const DrawingRowActions: React.FC<DrawingRowActionsProps> = ({
  drawingCode,
  hasAdminPermission = true,
  openButtonTitle,
  extraDropdownItems,
  extraActions,
  onOpenDrawing,
  onOpenDrawingFolder,
  onOpenMirrorFolder,
  onOpenAspanFolder,
  onCopyToMirror,
}) => {
  const defaultActions = useDrawingActions();

  const handleOpen = onOpenDrawing || defaultActions.handleOpenDrawing;
  const handleFolder = onOpenDrawingFolder || defaultActions.handleOpenDrawingFolder;
  const handleMirror = onOpenMirrorFolder || defaultActions.handleOpenMirrorFolder;
  const handleAspan = onOpenAspanFolder || defaultActions.handleOpenAspanFolder;
  const handleCopy = onCopyToMirror || defaultActions.handleCopyToMirror;

  const validCode = drawingCode?.trim() || "";

  return (
    <div className="flex items-center justify-end gap-1.5 flex-nowrap">
      {/* Botão Primário: Abrir Desenho */}
      {hasAdminPermission && (
        <button
          disabled={!validCode}
          onClick={() => handleOpen(validCode)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          title={openButtonTitle || (validCode ? "Abrir arquivo do desenho" : "Sem desenho")}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Abrir</span>
        </button>
      )}

      {/* Dropdown de Pastas */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!validCode}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Abrir pastas do desenho"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline font-semibold">Pastas</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800 text-zinc-200 shadow-2xl z-[9999]">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1.5">
            Pastas do Desenho ({validCode || "—"})
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => handleFolder(validCode)}
            className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-amber-300"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>NESTING (SERVIDOR)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleMirror(validCode)}
            className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-purple-300"
          >
            <FolderCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span>NESTING (DXF ALESSANDRO)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleAspan(validCode)}
            className="flex items-center gap-2 text-xs py-2 px-2.5 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-emerald-300"
          >
            <FolderOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>NANXING</span>
          </DropdownMenuItem>

          {extraDropdownItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Botão Enviar DXF */}
      {hasAdminPermission && (
        <button
          disabled={!validCode}
          onClick={() => handleCopy(validCode)}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          title={validCode ? "Enviar desenho para a pasta espelho DXF" : "Sem desenho"}
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Enviar DXF</span>
        </button>
      )}

      {extraActions}
    </div>
  );
};

