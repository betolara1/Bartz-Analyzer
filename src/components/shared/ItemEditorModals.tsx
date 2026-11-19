import React from "react";
import { Edit2, AlertTriangle, Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { UseItemEditorReturn, ItemEditorTheme } from "../../hooks/useItemEditor";
import { isParentItem, getChildrenCount } from "../../utils/itemHelpers";

export interface ItemEditorModalsProps {
  editor: UseItemEditorReturn;
}

interface ThemeClasses {
  borderModal: string;
  borderConfirm: string;
  iconBg: string;
  inputFocus: string;
  button: string;
  resultText: string;
  scopeText: string;
  scopeBox: string;
  propagateBox: string;
  propagateTitle: string;
  checkbox: string;
  itemBaseText: string;
}

const THEME_MAP: Record<ItemEditorTheme, ThemeClasses> = {
  sky: {
    borderModal: "border-sky-500/30",
    borderConfirm: "border-sky-500/40",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-400",
    inputFocus: "focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20",
    button: "bg-sky-600 hover:bg-sky-500 text-white",
    resultText: "text-sky-400",
    scopeText: "text-sky-300",
    scopeBox: "bg-sky-500/10 border-sky-500/25",
    propagateBox: "bg-sky-500/5 hover:bg-sky-500/10 border-sky-500/20",
    propagateTitle: "text-sky-200 group-hover:text-white",
    checkbox: "text-sky-500 focus:ring-sky-500/30",
    itemBaseText: "text-sky-400",
  },
  indigo: {
    borderModal: "border-indigo-500/30",
    borderConfirm: "border-indigo-500/40",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    inputFocus: "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20",
    button: "bg-indigo-600 hover:bg-indigo-500 text-white",
    resultText: "text-indigo-400",
    scopeText: "text-indigo-300",
    scopeBox: "bg-indigo-500/10 border-indigo-500/25",
    propagateBox: "bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20",
    propagateTitle: "text-indigo-200 group-hover:text-white",
    checkbox: "text-indigo-500 focus:ring-indigo-500/30",
    itemBaseText: "text-indigo-400",
  },
  purple: {
    borderModal: "border-purple-500/30",
    borderConfirm: "border-purple-500/40",
    iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    inputFocus: "focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20",
    button: "bg-purple-600 hover:bg-purple-500 text-white",
    resultText: "text-purple-400",
    scopeText: "text-purple-300",
    scopeBox: "bg-purple-500/10 border-purple-500/25",
    propagateBox: "bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/20",
    propagateTitle: "text-purple-200 group-hover:text-white",
    checkbox: "text-purple-500 focus:ring-purple-500/30",
    itemBaseText: "text-purple-400",
  },
};

export const ItemEditorModals: React.FC<ItemEditorModalsProps> = ({ editor }) => {
  const {
    modalConfig,

    // Descrição
    isEditModalOpen,
    isConfirmModalOpen,
    selectedItem,
    newDescription,
    setNewDescription,
    isSaving,
    handleCloseEditModal,
    handleProceedToConfirmDescription,
    handleBackToEditDescription,
    handleApplyDescriptionChange,

    // Dimensão
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
    handleCloseEditDimModal,
    handleProceedToConfirmDimension,
    handleBackToEditDimension,
    handleApplyDimensionChange,

    // Código / Item Base
    isEditCodeModalOpen,
    isConfirmCodeModalOpen,
    selectedCodeItem,
    newCode,
    setNewCode,
    isSavingCode,
    handleCloseEditCodeModal,
    handleProceedToConfirmCode,
    handleBackToEditCode,
    handleApplyCodeChange,

    // Exclusão
    isDeleteConfirmOpen,
    deleteTargetItem,
    isDeleting,
    handleCloseDeleteConfirm,
    handleApplyDelete,
  } = editor;

  const t = THEME_MAP[modalConfig.theme] || THEME_MAP.sky;
  const labels = modalConfig.codeModalLabels;

  return (
    <>
      {/* 1. MODAL: EDITAR DESCRIÇÃO */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg bg-[#151515] border ${t.borderModal} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className={`p-2 rounded-lg ${t.iconBg}`}>
                <Edit2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Trocar Descrição</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                  {modalConfig.descriptionSubtitle}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Descrição Atual</label>
                <div className="px-3 py-2.5 rounded-lg bg-[#0E0E0E] border border-[#232323] text-xs font-mono text-zinc-400 select-all font-medium leading-relaxed">
                  {selectedItem.descricao || <span className="italic text-zinc-600 font-sans">vazio</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Nova Descrição</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onClear={() => setNewDescription("")}
                  placeholder="Digite a nova descrição..."
                  className={`w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2.5 rounded-lg text-xs outline-none ${t.inputFocus} transition-all font-medium`}
                  autoFocus
                />
              </div>

              {/* Informações adicionais do item */}
              <div className="p-3 rounded-lg bg-[#0E0E0E]/60 border border-[#232323] space-y-1 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Item:</span>
                  <span className="font-mono text-zinc-300">{selectedItem.itemBase || selectedItem.id || "—"}</span>
                </div>
                {selectedItem.dimensao && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Dimensão:</span>
                    <span className="font-mono text-zinc-300">{selectedItem.dimensao}</span>
                  </div>
                )}
                {selectedItem.desenho && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Desenho:</span>
                    <span className="font-mono text-zinc-300">{selectedItem.desenho}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                onClick={handleCloseEditModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                disabled={!newDescription.trim() || newDescription.trim() === selectedItem.descricao}
                onClick={handleProceedToConfirmDescription}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL: CONFIRMAR DESCRIÇÃO */}
      {isConfirmModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md bg-[#151515] border ${t.borderConfirm} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Confirmar Troca de Descrição</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Aviso de segurança</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Você tem certeza que deseja alterar a descrição deste produto no arquivo XML? Esta alteração será gravada diretamente nas tags correspondentes.
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-[#0E0E0E] border border-[#232323]">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">De:</div>
                  <div className="text-xs text-rose-400 font-medium line-through leading-relaxed">
                    {selectedItem.descricao || "—"}
                  </div>
                </div>
                <div className="border-t border-[#232323] pt-2">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Para:</div>
                  <div className="text-xs text-emerald-400 font-bold leading-relaxed">
                    {newDescription}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 font-medium italic">
                * Um backup do arquivo original será criado antes de aplicar esta alteração.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                disabled={isSaving}
                onClick={handleBackToEditDescription}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                disabled={isSaving}
                onClick={handleApplyDescriptionChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5`}
              >
                {isSaving ? "Salvando..." : "Confirmar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: EDITAR DIMENSÃO */}
      {isEditDimModalOpen && selectedDimItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg bg-[#151515] border ${t.borderModal} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className={`p-2 rounded-lg ${t.iconBg}`}>
                <Edit2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Trocar Dimensão</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                  {modalConfig.dimensionSubtitle}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Dimensão Atual</label>
                <div className="px-3 py-2.5 rounded-lg bg-[#0E0E0E] border border-[#232323] text-xs font-mono text-zinc-400 select-all font-medium leading-relaxed">
                  {selectedDimItem.dimensao || <span className="italic text-zinc-600 font-sans">vazio</span>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">Nova Dimensão (mm)</label>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium pl-1">Largura (L)</span>
                    <Input
                      type="text"
                      value={newLargura}
                      onChange={(e) => setNewLargura(e.target.value)}
                      placeholder="Ex: 2365"
                      className={`w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-xs font-mono outline-none ${t.inputFocus} transition-all font-medium`}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium pl-1">Altura (A)</span>
                    <Input
                      type="text"
                      value={newAltura}
                      onChange={(e) => setNewAltura(e.target.value)}
                      placeholder="Ex: 19"
                      className={`w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-xs font-mono outline-none ${t.inputFocus} transition-all font-medium`}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium pl-1">Profundidade (P)</span>
                    <Input
                      type="text"
                      value={newProfundidade}
                      onChange={(e) => setNewProfundidade(e.target.value)}
                      placeholder="Ex: 932"
                      className={`w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2 rounded-lg text-xs font-mono outline-none ${t.inputFocus} transition-all font-medium`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0E0E0E]/60 border border-[#232323] text-[11px] text-zinc-400">
                  <span>Resultado:</span>
                  <span className={`font-mono font-bold ${t.resultText}`}>
                    {newLargura.trim() || "?"} x {newAltura.trim() || "?"} x {newProfundidade.trim() || "?"}
                  </span>
                </div>

                {modalConfig.enableDimensionPropagation && isParentItem(selectedDimItem) && (
                  <div className="pt-2 border-t border-[#232323]">
                    <label className={`flex items-start gap-2.5 cursor-pointer select-none group p-2.5 rounded-lg ${t.propagateBox} transition-colors`}>
                      <input
                        type="checkbox"
                        checked={propagateToChildren}
                        onChange={(e) => setPropagateToChildren(e.target.checked)}
                        className={`mt-0.5 rounded border-zinc-700 ${t.checkbox} cursor-pointer`}
                      />
                      <div className="space-y-0.5">
                        <span className={`text-xs font-semibold ${t.propagateTitle} transition-colors`}>
                          Atualizar sub-itens com tamanho igual ao pai
                        </span>
                        <p className="text-[10px] text-zinc-400 leading-snug">
                          Apenas os componentes filhos com dimensão igual ao pai original (ex: chapas, embalagens de mesmo tamanho) serão atualizados. Filhos com medidas próprias (ex: cola, fitas de borda, embalagens bolha) permanecerão intactos.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                onClick={handleCloseEditDimModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                disabled={
                  !newLargura.trim() ||
                  !newAltura.trim() ||
                  !newProfundidade.trim() ||
                  `${newLargura.trim()}x${newAltura.trim()}x${newProfundidade.trim()}` === selectedDimItem.dimensao
                }
                onClick={handleProceedToConfirmDimension}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: CONFIRMAR DIMENSÃO */}
      {isConfirmDimModalOpen && selectedDimItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md bg-[#151515] border ${t.borderConfirm} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Confirmar Troca de Dimensão</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Aviso de segurança</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Você tem certeza que deseja alterar as dimensões deste produto no arquivo XML? Esta alteração será gravada diretamente nas tags de largura, altura e profundidade correspondentes.
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-[#0E0E0E] border border-[#232323]">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">De:</div>
                  <div className="text-xs text-rose-400 font-mono font-medium line-through leading-relaxed">
                    {selectedDimItem.dimensao || "—"}
                  </div>
                </div>
                <div className="border-t border-[#232323] pt-2">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Para:</div>
                  <div className="text-xs text-emerald-400 font-mono font-bold leading-relaxed">
                    {`${newLargura.trim()}x${newAltura.trim()}x${newProfundidade.trim()}`}
                  </div>
                </div>
              </div>

              {modalConfig.enableDimensionPropagation && isParentItem(selectedDimItem) && (
                <div className={`text-[11px] text-zinc-300 ${t.scopeBox} rounded-lg p-2.5`}>
                  <span className={`font-bold ${t.scopeText}`}>Escopo da alteração: </span>
                  {propagateToChildren ? (
                    <span>Apenas este item pai específico e os sub-itens com a mesma dimensão dele. Filhos com medidas próprias e outros itens idênticos abaixo não serão afetados.</span>
                  ) : (
                    <span>Apenas este item pai específico (sem alterar os filhos). Os outros itens idênticos abaixo não serão afetados.</span>
                  )}
                </div>
              )}

              <div className="text-[10px] text-zinc-500 font-medium italic">
                * Um backup do arquivo original será criado antes de aplicar esta alteração.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                disabled={isSavingDim}
                onClick={handleBackToEditDimension}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                disabled={isSavingDim}
                onClick={handleApplyDimensionChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5`}
              >
                {isSavingDim ? "Salvando..." : "Confirmar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: EDITAR ITEM BASE / CÓDIGO */}
      {isEditCodeModalOpen && selectedCodeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg bg-[#151515] border ${t.borderModal} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className={`p-2 rounded-lg ${t.iconBg}`}>
                <Edit2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">{labels.title}</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">{labels.subtitle}</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">{labels.currentLabel}</label>
                <div className="px-3 py-2.5 rounded-lg bg-[#0E0E0E] border border-[#232323] text-xs font-mono text-zinc-400 select-all font-medium leading-relaxed flex items-center justify-between">
                  <span>{selectedCodeItem.itemBase || selectedCodeItem.referencia || <span className="italic text-zinc-600 font-sans">vazio</span>}</span>
                  {selectedCodeItem.referencia && selectedCodeItem.referencia !== selectedCodeItem.itemBase && (
                    <span className="text-[10px] text-muted-foreground font-sans">Ref: {selectedCodeItem.referencia}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest pl-1">{labels.newLabel}</label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  onClear={() => setNewCode("")}
                  placeholder={labels.placeholder}
                  className={`w-full bg-[#0E0E0E] border border-[#2C2C2C] text-white px-3 py-2.5 rounded-lg text-xs font-mono outline-none ${t.inputFocus} transition-all font-medium`}
                  autoFocus
                />
              </div>

              {/* Informações de contexto do item */}
              <div className="p-3 rounded-lg bg-[#0E0E0E]/60 border border-[#232323] space-y-1 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Descrição:</span>
                  <span className="text-zinc-300 truncate">{selectedCodeItem.descricao || "—"}</span>
                </div>
                {selectedCodeItem.dimensao && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Dimensão:</span>
                    <span className="font-mono text-zinc-300">{selectedCodeItem.dimensao}</span>
                  </div>
                )}
                {selectedCodeItem.desenho && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Desenho:</span>
                    <span className="font-mono text-zinc-300">{selectedCodeItem.desenho}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                onClick={handleCloseEditCodeModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                disabled={
                  !newCode.trim() ||
                  (newCode.trim() === selectedCodeItem.itemBase && newCode.trim() === selectedCodeItem.referencia)
                }
                onClick={handleProceedToConfirmCode}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: CONFIRMAR ITEM BASE / CÓDIGO */}
      {isConfirmCodeModalOpen && selectedCodeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md bg-[#151515] border ${t.borderConfirm} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">{labels.confirmTitle}</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Aviso de segurança</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Você tem certeza que deseja alterar o {labels.errorPrefix} deste produto no arquivo XML? Esta alteração será gravada em <span className={`${t.resultText} font-semibold`}>todos os itens</span> com este código no XML, atualizando tanto o atributo <span className={`${t.scopeText} font-mono font-semibold`}>ITEM_BASE</span> quanto o <span className={`${t.scopeText} font-mono font-semibold`}>REFERENCIA</span>.
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-[#0E0E0E] border border-[#232323]">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">De:</div>
                  <div className="text-xs text-rose-400 font-mono font-medium line-through leading-relaxed">
                    {selectedCodeItem.itemBase || selectedCodeItem.referencia || "—"}
                  </div>
                </div>
                <div className="border-t border-[#232323] pt-2">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Para:</div>
                  <div className="text-xs text-emerald-400 font-mono font-bold leading-relaxed">
                    {newCode}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 font-medium italic">
                * Um backup do arquivo original será criado antes de aplicar esta alteração.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                disabled={isSavingCode}
                onClick={handleBackToEditCode}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                disabled={isSavingCode}
                onClick={handleApplyCodeChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${t.button} transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5`}
              >
                {isSavingCode ? "Salvando..." : "Confirmar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: CONFIRMAR EXCLUSÃO */}
      {isDeleteConfirmOpen && deleteTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#151515] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-b border-[#232323] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Confirmar Exclusão de Item</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Ação irreversível</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Você tem certeza que deseja <span className="text-rose-400 font-bold">excluir</span> este item do arquivo XML?
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-[#0E0E0E] border border-[#232323]">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Item</div>
                  <div className={`text-xs ${t.itemBaseText} font-mono font-bold`}>{deleteTargetItem.itemBase || deleteTargetItem.id || "—"}</div>
                </div>
                {deleteTargetItem.descricao && (
                  <div>
                    <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Descrição</div>
                    <div className="text-xs text-zinc-300 font-medium">{deleteTargetItem.descricao}</div>
                  </div>
                )}
                {deleteTargetItem.desenho && (
                  <div>
                    <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Desenho</div>
                    <div className="text-xs text-zinc-400 font-mono">{deleteTargetItem.desenho}</div>
                  </div>
                )}
                {deleteTargetItem.dimensao && (
                  <div>
                    <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Dimensão</div>
                    <div className="text-xs text-zinc-400 font-mono">{deleteTargetItem.dimensao}</div>
                  </div>
                )}
              </div>

              {isParentItem(deleteTargetItem) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300 leading-relaxed font-medium">
                    Este é um <span className="font-bold">item pai</span> com <span className="font-bold text-amber-200">{getChildrenCount(deleteTargetItem)}</span> sub-{getChildrenCount(deleteTargetItem) === 1 ? "item" : "itens"}. Todos os sub-itens serão excluídos junto.
                  </p>
                </div>
              )}

              <div className="text-[10px] text-zinc-500 font-medium italic">
                * Um backup do arquivo original será criado antes da exclusão.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#1B1B1B] border-t border-[#232323] flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={handleCloseDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#222] hover:bg-[#2A2A2A] text-white/80 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={isDeleting}
                onClick={handleApplyDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Excluindo..." : "Excluir Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

