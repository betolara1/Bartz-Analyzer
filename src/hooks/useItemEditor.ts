import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Row } from "../types";
import { electronClient } from "../services/electronClient";
import {
  familyScopeNote,
  getTargetIds,
  getTargetRefs,
  parseItemDimensions,
  isParentItem,
  resolveDescriptionTargets,
  resolveDimensionTargets,
} from "../utils/itemHelpers";

export type ItemEditorTheme = "sky" | "indigo" | "purple";

export interface ItemEditorCodeLabels {
  title: string;
  subtitle: string;
  currentLabel: string;
  newLabel: string;
  placeholder: string;
  confirmTitle: string;
  loadingToast: string;
  successPrefix: string;
  errorPrefix: string;
  primaryAttrName?: "ITEM_BASE" | "REFERENCIA";
}

export const DEFAULT_CODE_LABELS: ItemEditorCodeLabels = {
  title: "Trocar Item Base",
  subtitle: "Alteração do item base e referência no XML (ITEM_BASE / REFERENCIA)",
  currentLabel: "Item Base Atual",
  newLabel: "Novo Item Base",
  placeholder: "Digite o novo item base / código...",
  confirmTitle: "Confirmar Troca de Item Base",
  loadingToast: "Salvando novo item base...",
  successPrefix: "Item Base",
  errorPrefix: "item base",
  primaryAttrName: "ITEM_BASE",
};

export interface UseItemEditorOptions {
  data: Row | null;
  theme?: ItemEditorTheme;
  descriptionSubtitle?: string;
  dimensionSubtitle?: string;
  codeModalLabels?: ItemEditorCodeLabels;
  includePromobMetadata?: boolean;
  enableDimensionPropagation?: boolean;
  /** Aba Itens: descrição no pai e no filho; dimensão no pai, filho e chapa. */
  syncItensFamily?: boolean;
  allowReplaceAllCodeMatches?: boolean;
  /** All parsed XML items; used only by the Items tab to resolve family scope. */
  allItems?: any[];
}

export interface ResolvedModalConfig {
  theme: ItemEditorTheme;
  descriptionSubtitle: string;
  dimensionSubtitle: string;
  codeModalLabels: ItemEditorCodeLabels;
  includePromobMetadata: boolean;
  enableDimensionPropagation: boolean;
  syncItensFamily: boolean;
  allowReplaceAllCodeMatches: boolean;
}

export interface UseItemEditorReturn {
  // Descrição
  isEditModalOpen: boolean;
  isConfirmModalOpen: boolean;
  selectedItem: any;
  newDescription: string;
  setNewDescription: (v: string) => void;
  isSaving: boolean;
  handleOpenEditModal: (item: any) => void;
  handleCloseEditModal: () => void;
  handleProceedToConfirmDescription: () => void;
  handleBackToEditDescription: () => void;
  handleApplyDescriptionChange: () => Promise<void>;
  descriptionScopeNote: string | null;

  // Dimensão
  isEditDimModalOpen: boolean;
  isConfirmDimModalOpen: boolean;
  selectedDimItem: any;
  newLargura: string;
  setNewLargura: (v: string) => void;
  newAltura: string;
  setNewAltura: (v: string) => void;
  newProfundidade: string;
  setNewProfundidade: (v: string) => void;
  propagateToChildren: boolean;
  setPropagateToChildren: (v: boolean) => void;
  isSavingDim: boolean;
  handleOpenEditDimModal: (item: any) => void;
  handleCloseEditDimModal: () => void;
  handleProceedToConfirmDimension: () => void;
  handleBackToEditDimension: () => void;
  handleApplyDimensionChange: () => Promise<void>;
  dimensionScopeNote: string | null;

  // Código / Item Base
  isEditCodeModalOpen: boolean;
  isConfirmCodeModalOpen: boolean;
  selectedCodeItem: any;
  newCode: string;
  setNewCode: (v: string) => void;
  isSavingCode: boolean;
  replaceAllSameCode: boolean;
  setReplaceAllSameCode: (value: boolean) => void;
  handleOpenEditCodeModal: (item: any) => void;
  handleCloseEditCodeModal: () => void;
  handleProceedToConfirmCode: () => void;
  handleBackToEditCode: () => void;
  handleApplyCodeChange: () => Promise<void>;

  // Exclusão
  isDeleteConfirmOpen: boolean;
  deleteTargetItem: any;
  isDeleting: boolean;
  handleOpenDeleteConfirm: (item: any) => void;
  handleCloseDeleteConfirm: () => void;
  handleApplyDelete: () => Promise<void>;

  // Config resolvida repassada aos Modais
  modalConfig: ResolvedModalConfig;
}

export function useItemEditor(options: UseItemEditorOptions): UseItemEditorReturn {
  const {
    data,
    theme = "sky",
    descriptionSubtitle = "Alteração textual da descrição do produto no XML",
    dimensionSubtitle = "Alteração de dimensões (Largura x Altura x Profundidade)",
    codeModalLabels = DEFAULT_CODE_LABELS,
    includePromobMetadata = false,
    enableDimensionPropagation = false,
    syncItensFamily = false,
    allowReplaceAllCodeMatches = false,
    allItems = [],
  } = options;

  const modalConfig: ResolvedModalConfig = {
    theme,
    descriptionSubtitle,
    dimensionSubtitle,
    codeModalLabels,
    includePromobMetadata,
    enableDimensionPropagation,
    syncItensFamily,
    allowReplaceAllCodeMatches,
  };

  // --- Description State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newDescription, setNewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- Dimension State ---
  const [isEditDimModalOpen, setIsEditDimModalOpen] = useState(false);
  const [isConfirmDimModalOpen, setIsConfirmDimModalOpen] = useState(false);
  const [selectedDimItem, setSelectedDimItem] = useState<any>(null);
  const [newLargura, setNewLargura] = useState("");
  const [newAltura, setNewAltura] = useState("");
  const [newProfundidade, setNewProfundidade] = useState("");
  const [propagateToChildren, setPropagateToChildren] = useState(true);
  const [isSavingDim, setIsSavingDim] = useState(false);

  // --- Code State ---
  const [isEditCodeModalOpen, setIsEditCodeModalOpen] = useState(false);
  const [isConfirmCodeModalOpen, setIsConfirmCodeModalOpen] = useState(false);
  const [selectedCodeItem, setSelectedCodeItem] = useState<any>(null);
  const [newCode, setNewCode] = useState("");
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [replaceAllSameCode, setReplaceAllSameCode] = useState(false);

  // --- Delete State ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetItem, setDeleteTargetItem] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Description Handlers ---
  const handleOpenEditModal = useCallback((item: any) => {
    const targets = syncItensFamily ? resolveDescriptionTargets(item, allItems) : [{ item }];
    setSelectedItem({ ...item, editTargetIds: getTargetIds(targets), editTargetRefs: getTargetRefs(targets, allItems), editScopeNote: syncItensFamily ? familyScopeNote(targets, "descricao") : null });
    setNewDescription(item?.descricao || "");
    setIsEditModalOpen(true);
  }, [allItems, syncItensFamily]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedItem(null);
  }, []);

  const handleProceedToConfirmDescription = useCallback(() => {
    setIsEditModalOpen(false);
    setIsConfirmModalOpen(true);
  }, []);

  const handleBackToEditDescription = useCallback(() => {
    setIsConfirmModalOpen(false);
    setIsEditModalOpen(true);
  }, []);

  const handleApplyDescriptionChange = useCallback(async () => {
    if (!data || !selectedItem || !newDescription.trim()) return;

    setIsSaving(true);
    const id = toast.loading("Salvando nova descrição...");
    try {
      const ids = selectedItem.editTargetIds || selectedItem.ids || [selectedItem.id];
      const targetByIds = (selectedItem.editTargetIds || []).length > 0;
      const targetOptions = targetByIds ? { exactIds: true, targetRefs: selectedItem.editTargetRefs } : {};
      const opt = includePromobMetadata
        ? { idPromob: targetByIds ? undefined : selectedItem.idPromob, uniqueId: targetByIds ? undefined : selectedItem.uniqueId, ...targetOptions }
        : undefined;

      const res = await electronClient.analyzer.replaceItemDescription(
        data.fullpath,
        ids,
        newDescription.trim(),
        selectedItem.desenho,
        opt
      );

      if (res?.ok) {
        toast.success("Descrição alterada com sucesso!");
        setIsConfirmModalOpen(false);
        setSelectedItem(null);
      } else {
        toast.error(`Falha ao alterar descrição: ${res?.message || "erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error("Erro ao alterar.", { description: String(error?.message || error) });
    } finally {
      setIsSaving(false);
      toast.dismiss(id);
    }
  }, [data, selectedItem, newDescription, includePromobMetadata]);

  // --- Dimension Handlers ---
  const handleOpenEditDimModal = useCallback((item: any) => {
    const targets = syncItensFamily ? resolveDimensionTargets(item, allItems) : [{ item }];
    setSelectedDimItem({ ...item, editTargetIds: getTargetIds(targets), editTargetRefs: getTargetRefs(targets, allItems), editScopeNote: syncItensFamily ? familyScopeNote(targets, "dimensao") : null });
    setPropagateToChildren(true);
    const dims = parseItemDimensions(item);
    setNewLargura(dims.largura);
    setNewAltura(dims.altura);
    setNewProfundidade(dims.profundidade);
    setIsEditDimModalOpen(true);
  }, [allItems, syncItensFamily]);

  const handleCloseEditDimModal = useCallback(() => {
    setIsEditDimModalOpen(false);
    setSelectedDimItem(null);
  }, []);

  const handleProceedToConfirmDimension = useCallback(() => {
    setIsEditDimModalOpen(false);
    setIsConfirmDimModalOpen(true);
  }, []);

  const handleBackToEditDimension = useCallback(() => {
    setIsConfirmDimModalOpen(false);
    setIsEditDimModalOpen(true);
  }, []);

  const handleApplyDimensionChange = useCallback(async () => {
    if (!data || !selectedDimItem || !newLargura.trim() || !newAltura.trim() || !newProfundidade.trim()) return;

    setIsSavingDim(true);
    const id = toast.loading("Salvando nova dimensão...");
    try {
      const isParent = isParentItem(selectedDimItem);
      const ids = selectedDimItem.editTargetIds || selectedDimItem.ids || [selectedDimItem.id];
      // Aba Itens: pai + filho + chapa recebem o mesmo valor, localizados por id + uniqueId (sem varrer IDs repetidos).
      const targetByIds = syncItensFamily && (selectedDimItem.editTargetIds || []).length > 0;
      const opt = {
        ...(targetByIds ? { exactIds: true, targetRefs: selectedDimItem.editTargetRefs } : {}),
        idPromob: includePromobMetadata && !syncItensFamily ? selectedDimItem.idPromob : undefined,
        uniqueId: includePromobMetadata && !syncItensFamily ? selectedDimItem.uniqueId : undefined,
        updateChildren: !syncItensFamily && enableDimensionPropagation && isParent ? propagateToChildren : false,
        isParent,
        oldDimension: {
          largura: selectedDimItem.largura,
          altura: selectedDimItem.altura,
          profundidade: selectedDimItem.profundidade,
          dimensao: selectedDimItem.dimensao,
        },
      };

      const res = await electronClient.analyzer.replaceItemDimension(
        data.fullpath,
        ids,
        {
          largura: newLargura.trim(),
          altura: newAltura.trim(),
          profundidade: newProfundidade.trim(),
        },
        selectedDimItem.desenho,
        opt
      );

      if (res?.ok) {
        toast.success("Dimensão alterada com sucesso!");
        setIsConfirmDimModalOpen(false);
        setSelectedDimItem(null);
      } else {
        toast.error(`Falha ao alterar dimensão: ${res?.message || "erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error("Erro ao alterar dimensão.", { description: String(error?.message || error) });
    } finally {
      setIsSavingDim(false);
      toast.dismiss(id);
    }
  }, [
    data,
    selectedDimItem,
    newLargura,
    newAltura,
    newProfundidade,
    propagateToChildren,
    includePromobMetadata,
    enableDimensionPropagation,
    syncItensFamily,
  ]);

  // --- Code Handlers ---
  const handleOpenEditCodeModal = useCallback((item: any) => {
    setReplaceAllSameCode(false);
    setSelectedItem(null);
    setSelectedDimItem(null);
    setSelectedCodeItem(item);
    setNewCode(item?.itemBase || item?.referencia || "");
    setIsEditCodeModalOpen(true);
  }, []);

  const handleCloseEditCodeModal = useCallback(() => {
    setIsEditCodeModalOpen(false);
    setSelectedCodeItem(null);
  }, []);

  const handleProceedToConfirmCode = useCallback(() => {
    setIsEditCodeModalOpen(false);
    setIsConfirmCodeModalOpen(true);
  }, []);

  const handleBackToEditCode = useCallback(() => {
    setIsConfirmCodeModalOpen(false);
    setIsEditCodeModalOpen(true);
  }, []);

  const handleApplyCodeChange = useCallback(async () => {
    if (!data || !selectedCodeItem || !newCode.trim()) return;

    setIsSavingCode(true);
    const toastId = toast.loading(codeModalLabels.loadingToast);
    try {
      const replaceAllMatches = allowReplaceAllCodeMatches && replaceAllSameCode;
      const ids = replaceAllMatches ? [] : (selectedCodeItem.id != null ? [selectedCodeItem.id] : []);
      if (ids.length === 0) {
        if (!replaceAllMatches) {
          toast.error("Não foi possível identificar o ID deste item no XML.");
          return;
        }
      }
      // Aba Itens: troca somente o nó selecionado, mesmo que existam outros com o mesmo código/ID.
      const exactOpts = (syncItensFamily || allowReplaceAllCodeMatches) && !replaceAllMatches
        ? {
            exactIds: true,
            targetRefs: getTargetRefs([{ item: selectedCodeItem, role: "item" }], allItems),
          }
        : {};
      const opt = {
        ...exactOpts,
        replaceAllMatches,
        oldCode: replaceAllMatches ? (selectedCodeItem.itemBase || selectedCodeItem.referencia) : undefined,
        oldItemBase: replaceAllMatches ? selectedCodeItem.itemBase : undefined,
        oldReferencia: replaceAllMatches ? selectedCodeItem.referencia : undefined,
        idPromob: includePromobMetadata ? selectedCodeItem.idPromob : undefined,
        uniqueId: includePromobMetadata ? selectedCodeItem.uniqueId : undefined,
      };

      const res = await electronClient.analyzer.replaceItemCode(
        data.fullpath,
        ids,
        newCode.trim(),
        selectedCodeItem.desenho,
        opt
      );

      if (res?.ok) {
        const count = (res as any).count || (res as any).counts?.total;
        const countMsg = count ? ` em ${count} item(ns)` : "";
        toast.success(`${codeModalLabels.successPrefix} alterado com sucesso${countMsg}!`);
        setIsConfirmCodeModalOpen(false);
        setSelectedCodeItem(null);
      } else {
        toast.error(`Falha ao alterar ${codeModalLabels.errorPrefix}: ${res?.message || "erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error(`Erro ao alterar ${codeModalLabels.errorPrefix}.`, {
        description: String(error?.message || error),
      });
    } finally {
      setIsSavingCode(false);
      toast.dismiss(toastId);
    }
  }, [data, selectedCodeItem, newCode, codeModalLabels, includePromobMetadata, syncItensFamily, allowReplaceAllCodeMatches, replaceAllSameCode, allItems]);

  // --- Delete Handlers ---
  const handleOpenDeleteConfirm = useCallback((item: any) => {
    setDeleteTargetItem(item);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeleteTargetItem(null);
  }, []);

  const handleApplyDelete = useCallback(async () => {
    if (!data || !deleteTargetItem) return;

    setIsDeleting(true);
    const id = toast.loading("Excluindo item do XML...");
    try {
      const itemIsParent = isParentItem(deleteTargetItem);

      if (!electronClient.analyzer.isDeleteItemSupported()) {
        toast.error("Função de exclusão não disponível. Reinicie o aplicativo.");
        return;
      }

      const opt = includePromobMetadata
        ? { idPromob: deleteTargetItem.idPromob, uniqueId: deleteTargetItem.uniqueId }
        : undefined;

      const res = await electronClient.analyzer.deleteItem(
        data.fullpath,
        deleteTargetItem.id,
        deleteTargetItem.desenho,
        itemIsParent,
        opt
      );

      if (res?.ok) {
        toast.success(`Item excluído com sucesso!${itemIsParent ? " (incluindo sub-itens)" : ""}`);
        setIsDeleteConfirmOpen(false);
        setDeleteTargetItem(null);
      } else {
        toast.error(`Falha ao excluir item: ${res?.message || "erro desconhecido"}`);
      }
    } catch (error: any) {
      toast.error("Erro ao excluir item.", { description: String(error?.message || error) });
    } finally {
      setIsDeleting(false);
      toast.dismiss(id);
    }
  }, [data, deleteTargetItem, includePromobMetadata]);

  return {
    isEditModalOpen,
    isConfirmModalOpen,
    selectedItem,
    newDescription,
    setNewDescription,
    isSaving,
    handleOpenEditModal,
    handleCloseEditModal,
    handleProceedToConfirmDescription,
    handleBackToEditDescription,
    handleApplyDescriptionChange,

    isEditDimModalOpen,
    isConfirmDimModalOpen,
    selectedDimItem,
    newLargura,
    setNewLargura,
    newAltura,
    setNewAltura,
    newProfundidade,
    setNewProfundidade,
    propagateToChildren,
    setPropagateToChildren,
    isSavingDim,
    handleOpenEditDimModal,
    handleCloseEditDimModal,
    handleProceedToConfirmDimension,
    handleBackToEditDimension,
    handleApplyDimensionChange,

    isEditCodeModalOpen,
    isConfirmCodeModalOpen,
    selectedCodeItem,
    newCode,
    setNewCode,
    isSavingCode,
    replaceAllSameCode,
    setReplaceAllSameCode,
    handleOpenEditCodeModal,
    handleCloseEditCodeModal,
    handleProceedToConfirmCode,
    handleBackToEditCode,
    handleApplyCodeChange,

    isDeleteConfirmOpen,
    deleteTargetItem,
    isDeleting,
    handleOpenDeleteConfirm,
    handleCloseDeleteConfirm,
    handleApplyDelete,

    modalConfig,
  };
}
