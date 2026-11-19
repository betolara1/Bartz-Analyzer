import { useState, useCallback } from "react";
import { toast } from "sonner";
import { electronClient } from "../services/electronClient";

export interface UseCommentAttachmentReturn {
  downloadingFile: string | null;
  handleDownloadFile: (filename: string) => Promise<void>;
}

export function useCommentAttachment(): UseCommentAttachmentReturn {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleDownloadFile = useCallback(async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await electronClient.analyzer.downloadCommentFile(filename);
      if (res?.ok && res.destPath) {
        toast.success(`Arquivo ${filename} baixado com sucesso!`, {
          action: {
            label: "Abrir",
            onClick: () => electronClient.analyzer.openFile(res.destPath!),
          },
        });
      } else {
        toast.error(`Falha ao baixar arquivo: ${res?.message || "Erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error("Erro ao baixar anexo.", { description: String(error?.message || error) });
    } finally {
      setDownloadingFile(null);
    }
  }, []);

  return { downloadingFile, handleDownloadFile };
}

