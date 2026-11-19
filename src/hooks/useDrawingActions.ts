import { useCallback } from "react";
import { toast } from "sonner";
import { electronClient } from "../services/electronClient";

export interface UseDrawingActionsReturn {
  handleOpenDrawing: (drawingCode: string) => Promise<void>;
  handleOpenDrawingFolder: (drawingCode: string) => Promise<void>;
  handleOpenMirrorFolder: (drawingCode: string) => Promise<void>;
  handleOpenAspanFolder: (drawingCode: string) => Promise<void>;
  handleCopyToMirror: (drawingCode: string) => Promise<void>;
  handleInjectMuxarabi: (drawingCode: string, sizeCode: string, thickness: string) => Promise<void>;
  handleOpenMuxarabi: (sizeCode: string) => Promise<void>;
}

export function useDrawingActions(): UseDrawingActionsReturn {
  const handleOpenDrawing = useCallback(async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando e abrindo desenho ${drawingCode}...`);
    try {
      const res = await electronClient.analyzer.openDrawing(drawingCode);
      if (res?.ok) {
        toast.success(`Desenho ${drawingCode} aberto com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir o desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir desenho.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleOpenDrawingFolder = useCallback(async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando e localizando pasta do desenho ${drawingCode}...`);
    try {
      const res = await electronClient.analyzer.openDrawingFolder(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta do desenho ${drawingCode} aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta do desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleOpenMirrorFolder = useCallback(async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando pasta NESTING(DXF ALESSANDRO) ${drawingCode}...`);
    try {
      const res = await electronClient.analyzer.openMirrorFolder(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta NESTING(DXF ALESSANDRO) aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta NESTING(DXF ALESSANDRO): ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NESTING(DXF ALESSANDRO).", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleOpenAspanFolder = useCallback(async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Buscando pasta NANXING ${drawingCode}...`);
    try {
      const res = await electronClient.analyzer.openAspanFolder(drawingCode);
      if (res?.ok) {
        toast.success(`Pasta NANXING aberta com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir a pasta NANXING: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir pasta NANXING.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleCopyToMirror = useCallback(async (drawingCode: string) => {
    if (!drawingCode) {
      toast.error("Código de desenho inválido.");
      return;
    }
    const id = toast.loading(`Copiando desenho ${drawingCode} para a pasta espelho...`);
    try {
      const res = await electronClient.analyzer.copyDrawingByCodeToMirror(drawingCode);
      if (res?.ok) {
        toast.success(`Desenho ${drawingCode} copiado para a pasta espelho!`);
      } else {
        toast.error(`Falha ao copiar desenho: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao copiar desenho.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleInjectMuxarabi = useCallback(async (drawingCode: string, sizeCode: string, thickness: string) => {
    if (!drawingCode || !sizeCode) {
      toast.error("Desenho ou tamanho do muxarabi não identificado.");
      return;
    }
    const id = toast.loading(`Aplicando muxarabi ${sizeCode} (${thickness}mm) no desenho ${drawingCode}...`);
    try {
      const res = await electronClient.analyzer.injectMuxarabi(drawingCode, sizeCode, thickness);
      if (res?.ok) {
        toast.success(
          `Muxarabi ${sizeCode} aplicado em ${drawingCode}: ${res.injectedCount} usinagens na layer ${res.layer} (peça ${res.pieceDimensions}).`
        );
      } else {
        toast.error(`Não foi possível aplicar o muxarabi: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao aplicar muxarabi.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  const handleOpenMuxarabi = useCallback(async (sizeCode: string) => {
    if (!sizeCode) {
      toast.error("Não foi possível identificar o tamanho do muxarabi.");
      return;
    }
    const id = toast.loading(`Buscando e abrindo desenho do Muxarabi ${sizeCode}...`);
    try {
      const res = await electronClient.analyzer.openMuxarabiDrawing(sizeCode);
      if (res?.ok) {
        toast.success(`Desenho Muxarabi ${sizeCode} aberto com sucesso!`);
      } else {
        toast.error(`Não foi possível abrir o Muxarabi: ${res?.message || "Erro desconhecido."}`);
      }
    } catch (error: any) {
      toast.error("Erro ao abrir Muxarabi.", { description: String(error?.message || error) });
    } finally {
      toast.dismiss(id);
    }
  }, []);

  return {
    handleOpenDrawing,
    handleOpenDrawingFolder,
    handleOpenMirrorFolder,
    handleOpenAspanFolder,
    handleCopyToMirror,
    handleInjectMuxarabi,
    handleOpenMuxarabi,
  };
}

