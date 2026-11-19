import React from "react";
import { Paperclip, FileText, Download, RefreshCw } from "lucide-react";

export interface CommentAttachmentsListProps {
  anexos: string[];
  downloadingFile: string | null;
  onDownload: (filename: string) => void;
  colorScheme?: "indigo" | "purple";
}

export const CommentAttachmentsList: React.FC<CommentAttachmentsListProps> = ({
  anexos,
  downloadingFile,
  onDownload,
  colorScheme = "indigo",
}) => {
  if (!anexos || anexos.length === 0) return null;

  const isPurple = colorScheme === "purple";

  const headerClass = isPurple
    ? "text-[11px] font-semibold text-purple-300"
    : "text-[10px] font-bold uppercase tracking-wider text-indigo-400";

  const clipClass = isPurple ? "text-purple-400" : "text-indigo-400";

  const itemBoxClass = isPurple
    ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/15 text-purple-200"
    : "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/15 text-indigo-200";

  const iconClass = isPurple ? "text-purple-400" : "text-indigo-400";

  const buttonClass = isPurple
    ? "bg-purple-600 hover:bg-purple-700 text-white"
    : "bg-indigo-500 hover:bg-indigo-600 text-white";

  return (
    <div className="mt-3 space-y-2 pt-2 border-t border-border/30">
      <div className={`flex items-center gap-1.5 ${headerClass}`}>
        <Paperclip className={`h-3.5 w-3.5 ${clipClass} shrink-0`} />
        <span>
          Arquivo{anexos.length > 1 ? "s" : ""} Anexo{anexos.length > 1 ? "s" : ""} ({anexos.length})
          {isPurple ? ":" : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {anexos.map((file: string, fIdx: number) => {
          const isDownloading = downloadingFile === file;
          return (
            <div
              key={fIdx}
              className={`p-2 px-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${itemBoxClass}`}
            >
              <div className="flex items-center gap-2 overflow-hidden text-xs">
                <FileText className={`h-4 w-4 shrink-0 ${iconClass}`} />
                <span className="truncate font-semibold text-xs" title={file}>
                  {file}
                </span>
              </div>
              <button
                disabled={isDownloading}
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(file);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-sm ${buttonClass}`}
              >
                {isDownloading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span>{isDownloading ? "Baixando..." : "Baixar"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

