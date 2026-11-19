# Plano Técnico de Refatoração — Single Source of Truth (SSOT)

## Visão Geral e Premissas Inegociáveis
Este documento especifica o plano arquitetural para eliminar duplicações de código, desacoplar chamadas diretas ao IPC do Electron (`window.electron`) dos componentes visuais e consolidar modais, dropdowns e regras auxiliares em uma **Fonte Única de Verdade (Single Source of Truth)**.

### Restrições Estritas Garantidas
1. **Zero Alteração de Regra de Negócio:** Nenhuma validação, fluxo de aprovação, cálculo de KPI ou regra de filtro será modificado.
2. **Fidelidade Visual e de Feedback:** Todos os textos, títulos, subtítulos, cores temáticas por seção (`sky`, `indigo`, `purple`, `rose`, `orange`, `amber`, `violet`, `cyan`) e mensagens de `toast` (incluindo `loading`, `success`, `error`, `info`, `warning` e ações de clique) serão preservados de forma idêntica.
3. **Permissões Intactas:** Todas as travas de segurança (`hasAdminPermission`, `canViewEs08`, `canCopyXml`, `isPerm37`, `isPerm38`, `hasSpecialOrdersPermission`, `hasPlateSeparationPermission`) continuarão operando exatamente com os mesmos critérios.

---

## 1. Diagnóstico de Duplicações (Mapa de Ocorrências)

### 1.1. Manipulação de Desenhos e Pastas (Handlers + IPC + Toast)
Cinco funções assíncronas idênticas (com os mesmos `toast.loading`, `toast.success`, `toast.error` e `toast.dismiss`) estão copiadas literalmente em **5 componentes de seção do Drawer**, além de variações baseadas em caminho completo no `Dashboard`:

| Função / Handler | Canal IPC Acionado | Arquivos onde está duplicada |
| :--- | :--- | :--- |
| `handleOpenDrawing(drawingCode)` | `analyzer.openDrawing(drawingCode)` | `Es08Section.tsx`, `ItemsSection.tsx`, `MuxarabiSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` |
| `handleOpenDrawingFolder(drawingCode)` | `analyzer.openDrawingFolder(drawingCode)` | `Es08Section.tsx`, `ItemsSection.tsx`, `MuxarabiSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` |
| `handleOpenMirrorFolder(drawingCode)` | `analyzer.openMirrorFolder(drawingCode)` | `Es08Section.tsx`, `ItemsSection.tsx`, `MuxarabiSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` (+ `Dashboard.tsx` via `handleOpenMirrorFolderFromSearch`) |
| `handleOpenAspanFolder(drawingCode)` | `analyzer.openAspanFolder(drawingCode)` | `Es08Section.tsx`, `ItemsSection.tsx`, `MuxarabiSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` (+ `Dashboard.tsx` via `handleOpenAspanFolderFromSearch`) |
| `handleCopyToMirror(drawingCode)` | `analyzer.copyDrawingByCodeToMirror(drawingCode)` | `Es08Section.tsx`, `ItemsSection.tsx`, `MuxarabiSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` |

### 1.2. UI de Ações de Desenho nas Tabelas (Botão Abrir + Dropdown Pastas + Botão Enviar DXF)
O bloco JSX contendo o botão **"Abrir"**, o `<DropdownMenu>` **"Pastas"** (`NESTING (SERVIDOR)`, `NESTING (DXF ALESSANDRO)`, `NANXING`) e o botão **"Enviar DXF"** está clonado em **5 arquivos**:
- `src/components/drawer/Es08Section.tsx` (acompanhado do botão "Corrigir")
- `src/components/drawer/ItemsSection.tsx` (acompanhado do botão "Excluir Item")
- `src/components/drawer/MuxarabiSection.tsx` (acompanhado do item extra no dropdown "Abrir Muxarabi" e do botão "Aplicar")
- `src/components/drawer/PoItemsSection.tsx`
- `src/components/drawer/SpecialItemsSection.tsx`

### 1.3. Lógica e Modais de Edição de Itens XML (Descrição, Dimensão, Código/Item Base e Exclusão)
Os estados controladores, parsers de dimensão, chamadas IPC e os pares de modais (**Modal de Edição + Modal de Confirmação com aviso de backup**) estão repetidos em **4 seções**:

| Funcionalidade / Par de Modais | Estados e Handlers Repetidos | Arquivos onde está duplicada | Diferenças Parametrizáveis |
| :--- | :--- | :--- | :--- |
| **Trocar Descrição** (Modal Editar + Modal Confirmar) | `isEditModalOpen`, `isConfirmModalOpen`, `selectedItem`, `newDescription`, `isSaving`, `handleOpenEditModal`, `handleApplyDescriptionChange` (`analyzer.replaceItemDescription`) | `ItemsSection.tsx`, `SeparadosSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` | Cor do tema (`sky` vs `indigo` vs `purple`), subtítulo do modal e passagem de `{ idPromob, uniqueId }` em `options`. |
| **Trocar Dimensão** (Modal Editar LxAxP + Modal Confirmar) | `isEditDimModalOpen`, `isConfirmDimModalOpen`, `selectedDimItem`, `newLargura`, `newAltura`, `newProfundidade`, `propagateToChildren`, `isSavingDim`, `handleOpenEditDimModal` (com parser regex `split(/[xX*]/)`), `handleApplyDimensionChange` (`analyzer.replaceItemDimension`) | `ItemsSection.tsx`, `SeparadosSection.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx` | Cor do tema (`sky` vs `indigo` vs `purple`), subtítulo e suporte a `propagateToChildren` para itens pais (`ItemsSection` e `SeparadosSection`). |
| **Trocar Item Base / Código** (Modal Editar + Modal Confirmar) | `isEditCodeModalOpen`, `isConfirmCodeModalOpen`, `selectedCodeItem`, `newCode`, `isSavingCode`, `handleOpenEditCodeModal`, `handleApplyCodeChange` (`analyzer.replaceItemCode`) | `ItemsSection.tsx`, `SeparadosSection.tsx` | Textos de label/título (`"Trocar Item Base"` vs `"Trocar Código do Item"`). |
| **Excluir Item** (Modal Confirmar Exclusão) | `isDeleteConfirmOpen`, `deleteTargetItem`, `isDeleting`, `handleOpenDeleteConfirm`, `handleApplyDelete` (`analyzer.deleteItem`) | `ItemsSection.tsx` | Componente isolado pronto para reuso com o restante do editor. |

### 1.4. Helpers de Hierarquia, Classificação de Itens e Filtros
| Helper / Lógica | Arquivos onde está duplicada | Descrição da Duplicação |
| :--- | :--- | :--- |
| `isDupladoItem(item, es08Matches)` | `FileDetailTabs.tsx`, `SpecialItemsSection.tsx` | Verifica se `itemBase` inicia com `"ES08"`, se `descricao` contém `"duplado"` ou `"37mm"`, ou se consta em `data?.meta?.es08Matches`. |
| `getItemId(item, index)`, `isParentItem(item)`, `getChildrenCount(item)` | `ItemsSection.tsx`, `SeparadosSection.tsx` | Funções idênticas para navegar na árvore de nós (`nodeId`, `childNodeIds`, `descendantIds`). |
| Filtro textual de itens (`itemMatchesSearch`) | `Es08Section.tsx`, `PoItemsSection.tsx`, `SpecialItemsSection.tsx`, `ItemsSection.tsx`, `SeparadosSection.tsx` | Busca case-insensitive em `itemBase`, `referencia`, `desenho`, `dimensao`, `descricao`, `id`. |
| Status de Lote de Chapas (`isLotCompletedPendingLaunch`, `isLotLancado`) | `Dashboard.tsx` (3 locais), `PlateSeparationModal.tsx` (5 locais) | Checagem repetida de `status.includes("lançado") \|\| status.includes("lancado") \|\| !!item.lancado_erp` e `status.includes("concluido")`. |

### 1.5. Permissões e Identificação de Usuário (`currentUser`)
A extração de IDs de permissão (`pk_permissao`) e nome de exibição de `currentUser` está espalhada e reescrita em **5 arquivos**:
- `src/components/Dashboard.tsx` (`hasSpecialOrdersPermission` [36], `hasPlateSeparationPermission` [39], `hasAdminPermission` [37/38], `isPerm38` [38], `myName`)
- `src/components/FileDetailDrawer.tsx` (`userPerms`, `hasAdminPermission` [37/38], `canViewEs08` [37/38], `isPerm38` [38], `canCopyXml` [37/38])
- `src/components/SpecialOrdersModal.tsx` (`userPerms`, `isPerm37` [37], `isPerm38` [38], `userName`)
- `src/components/ConfigurationScreen.tsx` (`isAdminAnalisador` [37/38], `userPermissionsList`)
- `src/components/PlateSeparationModal.tsx` (`loggedInUserName`)

### 1.6. Comentários de Pedidos, Anexos e Limpeza de HTML
| Lógica / UI | Arquivos onde está duplicada | Descrição da Duplicação |
| :--- | :--- | :--- |
| `cleanCommentText(text)` | `OrderInfoSection.tsx` (`cleanComment`), `SpecialOrdersModal.tsx` (`cleanCommentText`), `Dashboard.tsx` (inline em `checkSpecialOrdersUpdates`) | Regex que remove blocos `<div style="...border-top...">...[Alterado para...]</div>` e tags `[Alterado para...]`. |
| Agrupamento de comentários e mesclagem de `anexos` + `txt_arquivo` | `useFileActions.ts` (`fetchOrderComments`), `OrderInfoSection.tsx` (`displayComments` + render loop), `SpecialOrdersModal.tsx` (`filterValidComments` + render loop) | Deduplicação por `pk_pedido_comentario`, filtragem por `int_situacao` (0 ou 1) e unificação de `c.anexos` e `c.txt_arquivo`. |
| `handleDownloadFile(filename)` + UI de Lista de Anexos | `OrderInfoSection.tsx`, `SpecialOrdersModal.tsx` | Chamada a `analyzer.downloadCommentFile(filename)`, controle de loading por arquivo e toast com botão `"Abrir"` acionando `analyzer.openFile(dest)`. |

### 1.7. Efeitos de Auto-Busca com Debounce e Utilitários de UI
- **Auto-search com `setTimeout`**: Repetido 5 vezes seguidas em `CoringaSection.tsx` (grupos 1 a 5), 2 vezes em `ErpSearchSection.tsx`, 1 vez em `SeparadosCodeSearch.tsx` e 2 vezes em `Dashboard.tsx` (busca XML e busca DXF).
- **Web Audio API (Alerta Sonoro)**: Síntese de áudio com `AudioContext` duplicada em `Dashboard.tsx` e `PlateSeparationModal.tsx` (2 locais).
- **Guarda de Clique Externo do Sonner em Modais Radix**: Handler `onPointerDownOutside` que ignora cliques em `[data-sonner-toaster], [data-sonner-toast]` repetido em `dialog.tsx`, `alert-dialog.tsx`, `FileDetailDrawer.tsx` e `UpdateModal.tsx`.

### 1.8. Acoplamento Direto com IPC (`window.electron`)
Atualmente, **17 arquivos** invocam `window.electron?.analyzer`, `window.electron?.settings`, `window.electron?.auth` ou `window.electron?.updater` diretamente na camada de visão.

---

## 2. Arquitetura Alvo (Novos Módulos / Hooks / Componentes)

### Estrutura de Diretórios Proposta
```text
src/
  services/
    electronClient.ts             # Camada única de acesso IPC (analyzer, settings, auth, updater)
  utils/
    permissions.ts                # Helpers puros de permissões e extração de dados de currentUser
    itemHelpers.ts                # Helpers de árvore XML, isDupladoItem, parser de dimensão e filtros
    commentHelpers.ts             # Limpeza de HTML de comentários e deduplicação/merge de anexos
    plateSeparationHelpers.ts     # Helpers de status de lotes (concluído, lançado, pendente)
    soundAlert.ts                 # Utilitário Web Audio API para sons de notificação e sucesso
    radixHelpers.ts               # Guardas de eventos Radix UI (ex: ignoreSonnerPointerDown)
  hooks/
    useDebouncedEffect.ts         # Hook genérico para buscas automáticas com debounce
    useDrawingActions.ts          # Hook SSOT para abrir/copiar desenhos e abrir pastas via IPC
    useItemEditor.ts              # Hook SSOT controlador de edição de Descrição, Dimensão, Código e Exclusão
    useCommentAttachment.ts       # Hook SSOT para download e abertura de anexos de comentários
    useFileActions.ts             # (Existente - será enxugado usando electronClient e commentHelpers)
  components/
    shared/
      DrawingRowActions.tsx       # Componente de ações da linha (Abrir, Dropdown Pastas, Enviar DXF, slots)
      ItemEditorModals.tsx        # Suite de modais (Editar/Confirmar Descrição, Dimensão, Código e Exclusão)
      CommentAttachmentsList.tsx  # Bloco visual reutilizável de anexos com botão "Baixar Anexo"
```

---

### Especificação Técnica e Assinaturas TypeScript

#### 2.1. `src/services/electronClient.ts`
Centraliza todas as chamadas a `window.electron`, fornecendo fallbacks seguros quando executado fora do container Electron ou quando métodos opcionais não existirem.

```ts
import type { FullConfig } from "../components/ConfigurationScreen";

export const electronClient = {
  get isAvailable(): boolean {
    return !!window.electron?.analyzer;
  },
  analyzer: {
    start: (cfg?: any) => window.electron?.analyzer?.start?.(cfg) ?? Promise.resolve(false),
    stop: () => window.electron?.analyzer?.stop?.() ?? Promise.resolve(false),
    scanOnce: () => window.electron?.analyzer?.scanOnce?.() ?? Promise.resolve(false),
    onEvent: (cb: (msg: any) => void) => window.electron?.analyzer?.onEvent?.(cb),
    openFile: (filePath: string) => window.electron?.analyzer?.openFile?.(filePath),
    openInFolder: (fullOrBasePath: string) => window.electron?.analyzer?.openInFolder?.(fullOrBasePath),
    reprocessOne: (fullOrBasePath: string) => window.electron?.analyzer?.reprocessOne?.(fullOrBasePath),
    moveToOk: (filePath: string) => window.electron?.analyzer?.moveToOk?.(filePath),
    deleteProject: (filePath: string) => window.electron?.analyzer?.deleteProject?.(filePath),
    clearTargetFolders: () => window.electron?.analyzer?.clearTargetFolders?.(),
    loadHistory: () => window.electron?.analyzer?.loadHistory?.(),
    saveHistory: (rows: any[]) => window.electron?.analyzer?.saveHistory?.(rows),
    exportReport: (reportData: any) => window.electron?.analyzer?.exportReport?.(reportData),

    // Substituições e Edições XML
    replaceCoringa: (filePath: string, from: string, to: string) =>
      window.electron?.analyzer?.replaceCoringa?.(filePath, from, to),
    replaceCgGroups: (filePath: string, map: Record<string, string>) =>
      window.electron?.analyzer?.replaceCgGroups?.(filePath, map),
    fillReferenciaByIds: (
      filePath: string,
      replacements: { id: string; value: string; descricao?: string; newDesc?: string }[]
    ) => window.electron?.analyzer?.fillReferenciaByIds?.(filePath, replacements),
    replaceItemDescription: (
      filePath: string,
      ids: string[],
      newDescription: string,
      desenho?: string,
      options?: { idPromob?: string; uniqueId?: string }
    ) => window.electron?.analyzer?.replaceItemDescription?.(filePath, ids, newDescription, desenho, options),
    replaceItemDimension: (
      filePath: string,
      ids: string[],
      newDimension: { largura: string | number; altura: string | number; profundidade: string | number },
      desenho?: string,
      options?: {
        idPromob?: string;
        uniqueId?: string;
        updateChildren?: boolean;
        isParent?: boolean;
        oldDimension?: any;
      }
    ) => window.electron?.analyzer?.replaceItemDimension?.(filePath, ids, newDimension, desenho, options),
    replaceItemCode: (
      filePath: string,
      ids: string[],
      newCode: string,
      desenho?: string,
      options?: {
        oldCode?: string;
        oldItemBase?: string;
        oldReferencia?: string;
        idPromob?: string;
        uniqueId?: string;
      }
    ) => window.electron?.analyzer?.replaceItemCode?.(filePath, ids, newCode, desenho, options),
    deleteItem: (
      filePath: string,
      id: string,
      desenho?: string,
      isParent?: boolean,
      options?: { idPromob?: string; uniqueId?: string }
    ) => window.electron?.analyzer?.deleteItem?.(filePath, id, desenho, isParent, options),
     isDeleteItemSupported: () => Boolean(window.electron?.analyzer?.deleteItem),

    // Desenhos e DXF
    findDrawingFile: (drawingCode: string, xmlFilePath?: string) =>
      window.electron?.analyzer?.findDrawingFile?.(drawingCode, xmlFilePath),
    openDrawing: (drawingCode: string) => window.electron?.analyzer?.openDrawing?.(drawingCode),
    openDrawingFolder: (drawingCode: string) => window.electron?.analyzer?.openDrawingFolder?.(drawingCode),
    openMirrorFolder: (drawingCode?: string) => window.electron?.analyzer?.openMirrorFolder?.(drawingCode),
    openAspanFolder: (arg?: string | { drawingCode?: string }) =>
      window.electron?.analyzer?.openAspanFolder?.(arg),
    copyDrawingByCodeToMirror: (drawingCode: string) =>
      window.electron?.analyzer?.copyDrawingByCodeToMirror?.(drawingCode),
    searchDrawingFiles: (searchTerm: string) =>
      window.electron?.analyzer?.searchDrawingFiles?.(searchTerm),
    resolveDrawingPedido: (drawingName: string) =>
      window.electron?.analyzer?.resolveDrawingPedido?.(drawingName),
    openDrawingByPath: (fullPath: string) => window.electron?.analyzer?.openDrawingByPath?.(fullPath),
    showDrawingInFolder: (fullPath: string) => window.electron?.analyzer?.showDrawingInFolder?.(fullPath),
    copyDrawingToMirror: (fullPath: string) => window.electron?.analyzer?.copyDrawingToMirror?.(fullPath),
    batchProcessDrawings: (params: {
      items: string[];
      open?: boolean;
      copy?: boolean;
      openFolder?: boolean;
      targetFolder?: string;
    }) => window.electron?.analyzer?.batchProcessDrawings?.(params),
    openMuxarabiDrawing: (sizeCode: string) => window.electron?.analyzer?.openMuxarabiDrawing?.(sizeCode),
    injectMuxarabi: (drawingCode: string, sizeCode: string, thickness?: string) =>
      window.electron?.analyzer?.injectMuxarabi?.(drawingCode, sizeCode, thickness),
    fixFresa37to18: (dxfFilePath: string) => window.electron?.analyzer?.fixFresa37to18?.(dxfFilePath),

    // Busca e Cópia de XML / Promob
    searchXmlFiles: (searchTerm: string) => window.electron?.analyzer?.searchXmlFiles?.(searchTerm),
    checkOrdersXmlExistence: (orderNumbers: string[]) =>
      window.electron?.analyzer?.checkOrdersXmlExistence?.(orderNumbers),
    checkXmlDownloaded: (sourceFullPath?: string, fileName?: string) =>
      window.electron?.analyzer?.checkXmlDownloaded?.(sourceFullPath, fileName),
    copyXmlToEntrada: (sourceFullPath: string) =>
      window.electron?.analyzer?.copyXmlToEntrada?.(sourceFullPath),
    copyXmlToBusca: (sourceFullPath: string) =>
      window.electron?.analyzer?.copyXmlToBusca?.(sourceFullPath),
    downloadPromob: (xmlFilename: string) => window.electron?.analyzer?.downloadPromob?.(xmlFilename),

    // ERP, Pedidos Online e Comentários
    searchErpProduct: (params: { code?: string; desc?: string; type?: string }) =>
      window.electron?.analyzer?.searchErpProduct?.(params),
    getOrderComments: (numPedido: string) => window.electron?.analyzer?.getOrderComments?.(numPedido),
    downloadCommentFile: (filename: string) => window.electron?.analyzer?.downloadCommentFile?.(filename),
    getSpecialOrders: () => window.electron?.analyzer?.getSpecialOrders?.(),
    completeEngineeringOrder: (params: { pk_pedido_engenharia: number; pk_usuario_alteracao?: number }) =>
      window.electron?.analyzer?.completeEngineeringOrder?.(params),
    markSpecialOrderOk: (params: {
      pk_pedido_engenharia: number;
      pk_pedido: number;
      pk_usuario?: number;
      nome_usuario?: string;
    }) => window.electron?.analyzer?.markSpecialOrderOk?.(params),

    // Notificações Nativas
    sendNotification: (params: { title: string; body: string; count?: number }) =>
      window.electron?.analyzer?.sendNotification?.(params),
    setTaskbarBadge: (arg: number | { count: number; dataUrl?: string | null }) =>
      window.electron?.analyzer?.setTaskbarBadge?.(arg),

    // Separação de Chapas
    getPlateSeparationData: (customPath?: string) =>
      window.electron?.analyzer?.getPlateSeparationData?.(customPath),
    openPlateSeparationFile: (filePath: string) =>
      window.electron?.analyzer?.openPlateSeparationFile?.(filePath),
    addPlateSeparationComment: (params: { id: string; texto: string; autor?: string }) =>
      window.electron?.analyzer?.addPlateSeparationComment?.(params),
    getPlateSeparationComments: (id: string) =>
      window.electron?.analyzer?.getPlateSeparationComments?.(id),
    getPlateSeparationErpPreview: (loteId?: string) =>
      window.electron?.analyzer?.getPlateSeparationErpPreview?.(loteId),
    postPlateSeparationMovement: (params: {
      id: string;
      items: any[];
      usuario?: string;
      usuarioId?: number;
      deposito?: number;
      centroCusto?: number;
      observacao?: string;
    }) => window.electron?.analyzer?.postPlateSeparationMovement?.(params),
  },
  settings: {
    load: () => window.electron?.settings?.load?.(),
    save: (data: Partial<FullConfig>) => window.electron?.settings?.save?.(data),
    testPaths: (data: Partial<FullConfig>) => window.electron?.settings?.testPaths?.(data),
    pickFolder: (initial?: string) => window.electron?.settings?.pickFolder?.(initial),
  },
  auth: {
    login: (username: string, password: string) => window.electron?.auth?.login?.(username, password),
    getSession: () => window.electron?.auth?.getSession?.(),
    logout: () => window.electron?.auth?.logout?.(),
  },
  updater: {
    onUpdateAvailable: (cb: (info: any) => void) => window.electron?.updater?.onUpdateAvailable?.(cb),
    onUpdateProgress: (cb: (progress: any) => void) => window.electron?.updater?.onUpdateProgress?.(cb),
    onUpdateDownloaded: (cb: (info: any) => void) => window.electron?.updater?.onUpdateDownloaded?.(cb),
    onUpdateNotAvailable: (cb: (info: any) => void) => window.electron?.updater?.onUpdateNotAvailable?.(cb),
    onUpdateError: (cb: (err: any) => void) => window.electron?.updater?.onUpdateError?.(cb),
    checkForUpdates: () => window.electron?.updater?.checkForUpdates?.(),
    startDownload: () => window.electron?.updater?.startDownload?.(),
    installUpdate: () => window.electron?.updater?.installUpdate?.(),
  },
};
```

---

#### 2.2. `src/utils/permissions.ts`
Unifica toda a leitura de permissões e metadados de `currentUser`.

```ts
export interface UserPermissionsSummary {
  userId: number;
  permissionIds: number[];
  displayName: string;
  hasAdminPermission: boolean;          // ID ou Permissão 37 ou 38
  isPerm37: boolean;                    // ID ou Permissão 37
  isPerm38: boolean;                    // ID ou Permissão 38
  canViewEs08: boolean;                 // ID ou Permissão 37 ou 38
  canCopyXml: boolean;                  // ID ou Permissão 37 ou 38
  hasSpecialOrdersPermission: boolean;  // Permissão 36
  hasPlateSeparationPermission: boolean;// ID ou Permissão 39
}

export function extractPermissionIds(currentUser: any): number[];
export function getUserDisplayName(currentUser: any, fallback?: string): string;
export function getUserPermissions(currentUser: any): UserPermissionsSummary;
export function formatUserPermissionsList(currentUser: any): Array<{ id: number; label: string }>;
```

---

#### 2.3. `src/utils/itemHelpers.ts`
Unifica os helpers de hierarquia da árvore XML, detecção de item duplado, parsing de dimensão e filtro textual.

```ts
export function getItemId(item: any, index: number): number | string;
export function isParentItem(item: any): boolean;
export function getChildrenCount(item: any): number;

export function isDupladoItem(item: any, es08Matches?: any[]): boolean;

export function parseItemDimensions(item: any): {
  largura: string;
  altura: string;
  profundidade: string;
};

export function matchesItemFilter(
  item: any,
  searchTerm: string,
  options?: {
    includeId?: boolean;
    includeReferencia?: boolean;
    includeExtraSearch?: boolean;
    defaultItemBase?: string;
  }
): boolean;
```

---

#### 2.4. `src/utils/commentHelpers.ts`, `src/utils/plateSeparationHelpers.ts`, `src/utils/soundAlert.ts` e `src/utils/radixHelpers.ts`

```ts
// src/utils/commentHelpers.ts
export function cleanCommentHtml(text?: string): string;
export function extractCommentAttachments(comment: any): string[];
export function normalizeAndGroupComments<T extends Record<string, any>>(
  comments: T[] | undefined | null,
  options?: {
    filterBySituacao?: boolean;      // true em useFileActions e SpecialOrdersModal
    excludeDesconsiderado?: boolean; // true em SpecialOrdersModal
    preserveWithoutId?: boolean;     // true em OrderInfoSection
  }
): T[];

// src/utils/plateSeparationHelpers.ts
export function isLotLancado(item: any): boolean;
export function isLotConcluidoPendingLaunch(item: any): boolean;
export function isLotVisibleInModal(item: any): boolean;

// src/utils/soundAlert.ts
export function playNotificationPing(): void;
export function playSuccessChord(): void;

// src/utils/radixHelpers.ts
export function preventSonnerOutsideDismiss(e: any, onFallback?: (e: any) => void): void;
```

---

#### 2.5. `src/hooks/useDebouncedEffect.ts`
Substitui os timers manuais de auto-busca espalhados pelo sistema.

```ts
import { DependencyList } from "react";

export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: DependencyList,
  delayMs: number,
  enabled?: boolean
): void;
```

---

#### 2.6. `src/hooks/useDrawingActions.ts`
Hook controlador SSOT para todas as ações de desenhos técnicos e pastas.

```ts
export interface UseDrawingActionsReturn {
  handleOpenDrawing: (drawingCode: string) => Promise<void>;
  handleOpenDrawingFolder: (drawingCode: string) => Promise<void>;
  handleOpenMirrorFolder: (drawingCode: string) => Promise<void>;
  handleOpenAspanFolder: (drawingCode: string) => Promise<void>;
  handleCopyToMirror: (drawingCode: string) => Promise<void>;
  handleInjectMuxarabi: (drawingCode: string, sizeCode: string, thickness: string) => Promise<void>;
  handleOpenMuxarabi: (sizeCode: string) => Promise<void>;
}

export function useDrawingActions(): UseDrawingActionsReturn;
```

---

#### 2.7. `src/components/shared/DrawingRowActions.tsx`
Componente visual reutilizável para a coluna "Ações" nas tabelas de itens/desenhos (`Es08Section`, `ItemsSection`, `MuxarabiSection`, `PoItemsSection`, `SpecialItemsSection`).

```ts
import React from "react";

export interface DrawingRowActionsProps {
  drawingCode?: string | null;
  hasAdminPermission?: boolean;
  openButtonTitle?: string;
  extraDropdownItems?: React.ReactNode; // Usado por MuxarabiSection para "Abrir Muxarabi ({sizeCode})"
  extraActions?: React.ReactNode;       // Usado por Es08Section ("Corrigir"), MuxarabiSection ("Aplicar") e ItemsSection ("Excluir")
}

export const DrawingRowActions: React.FC<DrawingRowActionsProps>;
```

---

#### 2.8. `src/hooks/useItemEditor.ts` e `src/components/shared/ItemEditorModals.tsx`
Consolidam toda a lógica de estado, validação, chamadas IPC e renderização dos 7 modais de edição/confirmação de itens XML.

```ts
// src/hooks/useItemEditor.ts
import { Row } from "../types";

export type ItemEditorTheme = "sky" | "indigo" | "purple";

export interface UseItemEditorOptions {
  data: Row | null;
  theme?: ItemEditorTheme;
  descriptionSubtitle?: string;
  dimensionSubtitle?: string;
  codeModalLabels?: {
    title: string;          // "Trocar Item Base" | "Trocar Código do Item"
    subtitle: string;
    currentLabel: string;   // "Item Base Atual" | "Código Atual"
    newLabel: string;       // "Novo Item Base" | "Novo Código"
    placeholder: string;
    confirmTitle: string;   // "Confirmar Troca de Item Base" | "Confirmar Troca de Código"
    loadingToast: string;   // "Salvando novo item base..." | "Salvando novo código do item..."
    successPrefix: string;  // "Item Base" | "Código"
    errorPrefix: string;    // "item base" | "código"
    primaryAttrName: "ITEM_BASE" | "REFERENCIA";
  };
  includePromobMetadata?: boolean;        // true em ItemsSection e SeparadosSection
  enableDimensionPropagation?: boolean;   // true em ItemsSection e SeparadosSection
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

  // Código / Item Base
  isEditCodeModalOpen: boolean;
  isConfirmCodeModalOpen: boolean;
  selectedCodeItem: any;
  newCode: string;
  setNewCode: (v: string) => void;
  isSavingCode: boolean;
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

  // Config repassada para os Modais
  modalConfig: Required<Omit<UseItemEditorOptions, "data">>;
}

export function useItemEditor(options: UseItemEditorOptions): UseItemEditorReturn;
```

```ts
// src/components/shared/ItemEditorModals.tsx
import React from "react";
import { UseItemEditorReturn } from "../../hooks/useItemEditor";

export interface ItemEditorModalsProps {
  editor: UseItemEditorReturn;
}

export const ItemEditorModals: React.FC<ItemEditorModalsProps>;
```

---

#### 2.9. `src/hooks/useCommentAttachment.ts` e `src/components/shared/CommentAttachmentsList.tsx`
Consolidam o download de arquivos anexos de comentários e sua listagem visual em `OrderInfoSection` e `SpecialOrdersModal`.

```ts
// src/hooks/useCommentAttachment.ts
export interface UseCommentAttachmentReturn {
  downloadingFile: string | null;
  handleDownloadFile: (filename: string) => Promise<void>;
}

export function useCommentAttachment(): UseCommentAttachmentReturn;

// src/components/shared/CommentAttachmentsList.tsx
export interface CommentAttachmentsListProps {
  anexos: string[];
  downloadingFile: string | null;
  onDownload: (filename: string) => void;
  colorScheme?: "indigo" | "purple"; // "indigo" para OrderInfoSection, "purple" para SpecialOrdersModal
}

export const CommentAttachmentsList: React.FC<CommentAttachmentsListProps>;
```

---

## 3. Plano de Execução em Fases Atômicas

Cada fase foi desenhada para ser **100% autocontida e aditiva/substitutiva sem quebras intermediárias**, garantindo que `tsc --noEmit` passe com zero erros ao término de cada etapa.

### Fase 1: Fundação — Camada de Serviço IPC, Utilitários Puros e Hooks Base
- **Objetivo:** Criar toda a infraestrutura da Fonte Única de Verdade sem alterar nenhum componente existente ainda.
- **Arquivos Criados:**
  1. `src/services/electronClient.ts`
  2. `src/utils/permissions.ts`
  3. `src/utils/itemHelpers.ts`
  4. `src/utils/commentHelpers.ts`
  5. `src/utils/plateSeparationHelpers.ts`
  6. `src/utils/soundAlert.ts`
  7. `src/utils/radixHelpers.ts`
  8. `src/hooks/useDebouncedEffect.ts`
  9. `src/hooks/useDrawingActions.ts`
  10. `src/hooks/useItemEditor.ts`
  11. `src/hooks/useCommentAttachment.ts`
  12. `src/components/shared/DrawingRowActions.tsx`
  13. `src/components/shared/ItemEditorModals.tsx`
  14. `src/components/shared/CommentAttachmentsList.tsx`
- **Impacto em Arquivos Existentes:** Nenhum. Risco zero de regressão.

### Fase 2: Migração das Seções de Desenho (`Es08Section` e `MuxarabiSection`)
- **Objetivo:** Substituir os 5 handlers duplicados e o bloco de dropdown/botões de desenho pelo `useDrawingActions` e `<DrawingRowActions />`.
- **Arquivos Refatorados:**
  1. `src/components/drawer/Es08Section.tsx` (usa `<DrawingRowActions />` passando o botão `"Corrigir"` em `extraActions` e `matchesItemFilter` para a busca).
  2. `src/components/drawer/MuxarabiSection.tsx` (usa `<DrawingRowActions />` passando o item `"Abrir Muxarabi"` em `extraDropdownItems` e o botão `"Aplicar"` em `extraActions`).

### Fase 3: Migração das Seções de Edição de Itens (`PoItemsSection`, `SpecialItemsSection`, `ItemsSection`, `SeparadosSection` e `FileDetailTabs`)
- **Objetivo:** Eliminar mais de 1.100 linhas de código duplicado de modais de edição/confirmação, handlers de descrição/dimensão/código/exclusão, helpers de hierarquia e `isDupladoItem`.
- **Arquivos Refatorados:**
  1. `src/components/drawer/PoItemsSection.tsx` (passa a usar `useItemEditor({ data, theme: "indigo", ... })`, `<ItemEditorModals />`, `<DrawingRowActions />` e `matchesItemFilter`).
  2. `src/components/drawer/SpecialItemsSection.tsx` (passa a usar `useItemEditor({ data, theme: "purple", ... })`, `<ItemEditorModals />`, `<DrawingRowActions />`, `isDupladoItem` e `matchesItemFilter`).
  3. `src/components/drawer/ItemsSection.tsx` (passa a usar `useItemEditor({ data, theme: "sky", includePromobMetadata: true, enableDimensionPropagation: true, ... })`, `<ItemEditorModals />`, `<DrawingRowActions />` e helpers de `itemHelpers.ts`).
  4. `src/components/drawer/SeparadosSection.tsx` (passa a usar `useItemEditor({ data, theme: "sky", includePromobMetadata: true, enableDimensionPropagation: true, ... })`, `<ItemEditorModals />` e helpers de `itemHelpers.ts`).
  5. `src/components/drawer/FileDetailTabs.tsx` (substitui `isDupladoItem` local pelo helper de `src/utils/itemHelpers.ts`).

### Fase 4: Migração de Comentários, Buscas com Debounce e `useFileActions`
- **Objetivo:** Unificar a limpeza/agrupamento de comentários, download de anexos, auto-buscas com debounce e desacoplar `window.electron` das demais seções do Drawer.
- **Arquivos Refatorados:**
  1. `src/hooks/useFileActions.ts` (usa `electronClient` e `normalizeAndGroupComments`).
  2. `src/components/drawer/OrderInfoSection.tsx` (usa `cleanCommentHtml`, `normalizeAndGroupComments`, `useCommentAttachment` e `<CommentAttachmentsList colorScheme="indigo" />`).
  3. `src/components/drawer/CoringaSection.tsx` (substitui os 5 `useEffect` de timer por `useDebouncedEffect`).
  4. `src/components/drawer/ErpSearchSection.tsx` (substitui os 2 `useEffect` de timer por `useDebouncedEffect`).
  5. `src/components/drawer/SeparadosCodeSearch.tsx` (usa `electronClient.analyzer.searchErpProduct`).
  6. `src/components/drawer/ImportKeySection.tsx` (usa `electronClient.analyzer.downloadPromob`, `openInFolder`, `openFile`).

### Fase 5: Migração dos Modais Globais e Telas Principais (`Dashboard`, `SpecialOrdersModal`, `PlateSeparationModal`, `ConfigurationScreen`, `BatchDrawingsModal`, `LoginModal`, `FileDetailDrawer`, `App` e UI Dialogs)
- **Objetivo:** Concluir o desacoplamento total de `window.electron` em toda a aplicação e aplicar `permissions.ts`, `plateSeparationHelpers.ts`, `soundAlert.ts` e `radixHelpers.ts`.
- **Arquivos Refatorados:**
  1. `src/components/SpecialOrdersModal.tsx` (usa `electronClient`, `getUserPermissions`, `cleanCommentHtml`, `normalizeAndGroupComments`, `useCommentAttachment` e `<CommentAttachmentsList colorScheme="purple" />`).
  2. `src/components/PlateSeparationModal.tsx` (usa `electronClient`, `getUserDisplayName`, `plateSeparationHelpers`, `playNotificationPing` e `playSuccessChord`).
  3. `src/components/Dashboard.tsx` (usa `electronClient`, `getUserPermissions`, `getUserDisplayName`, `cleanCommentHtml`, `plateSeparationHelpers`, `playNotificationPing` e `useDebouncedEffect`).
  4. `src/components/FileDetailDrawer.tsx` (usa `getUserPermissions` e `preventSonnerOutsideDismiss`).
  5. `src/components/ConfigurationScreen.tsx` (usa `electronClient.settings`, `getUserPermissions` e `formatUserPermissionsList`).
  6. `src/components/BatchDrawingsModal.tsx`, `src/components/LoginModal.tsx`, `src/App.tsx` (usam `electronClient`).
  7. `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/UpdateModal.tsx` (usam `preventSonnerOutsideDismiss`).

---

## 4. Checklist de Regressão por Fase

### Após a Fase 1 (Fundação)
- [ ] Executar `npx tsc --noEmit` e validar que todos os novos módulos em `src/services`, `src/utils`, `src/hooks` e `src/components/shared` compilam sem erros ou warnings de tipagem.
- [ ] Verificar que a aplicação inicia normalmente sem alterações visuais.

### Após a Fase 2 (`Es08Section` e `MuxarabiSection`)
- [ ] Executar `npx tsc --noEmit`.
- [ ] Abrir um arquivo XML contendo itens `ES08` (Duplado 37mm/31mm):
  - [ ] Verificar se a busca automática de desenhos ao expandir a seção continua disparando.
  - [ ] Testar o filtro de busca por texto na tabela `ES08`.
  - [ ] Testar os botões **"Abrir"**, dropdown **"Pastas"** (`NESTING (SERVIDOR)`, `NESTING (DXF ALESSANDRO)`, `NANXING`), **"Enviar DXF"** e **"Corrigir"** (incluindo os toasts correspondentes).
- [ ] Abrir um arquivo XML contendo itens `MX008` (Muxarabi):
  - [ ] Verificar se o dropdown **"Pastas"** exibe o separador e a opção extra **"Abrir Muxarabi ({sizeCode})"** quando `hasAdminPermission && sizeCode` for verdadeiro.
  - [ ] Testar o botão **"Aplicar"** (injeção de usinagem Muxarabi) e validar a mensagem de toast detalhada.

### Após a Fase 3 (`PoItemsSection`, `SpecialItemsSection`, `ItemsSection`, `SeparadosSection` e `FileDetailTabs`)
- [ ] Executar `npx tsc --noEmit`.
- [ ] Testar a visibilidade da aba **"Componentes"** em `FileDetailTabs` para usuários com Permissão 38 quando há apenas itens especiais duplados (`isDupladoItem`).
- [ ] Em **`PoItemsSection`** (tema `indigo`) e **`SpecialItemsSection`** (tema `purple`):
  - [ ] Testar o filtro de busca e ações de desenho da linha.
  - [ ] Clicar no ícone de lápis em **Dimensão** e **Descrição**: verificar se os modais abrem com as bordas/botões nas cores `indigo` e `purple` respectivamente, se o botão "Voltar" no modal de confirmação retorna ao modal de edição, e se a gravação no XML funciona.
- [ ] Em **`ItemsSection`** e **`SeparadosSection`** (tema `sky`):
  - [ ] Testar expansão/recolhimento individual e botões "Expandir Tudo" / "Recolher Tudo" na árvore de itens pais e filhos.
  - [ ] Testar **Trocar Item Base / Código** em `ItemsSection` (título `"Trocar Item Base"`) e em `SeparadosSection` (título `"Trocar Código do Item"`).
  - [ ] Testar **Trocar Dimensão** em um item pai: verificar se o checkbox `"Atualizar sub-itens com tamanho igual ao pai"` e o aviso de escopo no modal de confirmação aparecem e são enviados no payload IPC (`updateChildren`, `isParent`, `oldDimension`).
  - [ ] Testar **Excluir Item** em `ItemsSection` (para item simples e para item pai exibindo a contagem de sub-itens no alerta).

### Após a Fase 4 (Comentários, Debounce e `useFileActions`)
- [ ] Executar `npx tsc --noEmit`.
- [ ] Em **`OrderInfoSection`**:
  - [ ] Verificar se os comentários do pedido são carregados, limpos de tags `[Alterado para...]` e agrupados sem duplicar anexos.
  - [ ] Testar o botão **"Baixar Anexo"** e a ação **"Abrir"** no toast de sucesso.
- [ ] Em **`CoringaSection`**, **`ErpSearchSection`** e **`SeparadosCodeSearch`**:
  - [ ] Digitar nos campos de busca e verificar se o auto-search com debounce (300ms, 350ms e 500ms) funciona sem travar a digitação.
- [ ] Em **`ImportKeySection`**:
  - [ ] Testar a cópia da chave ERP e o botão **"Baixar Arquivo .Promob"**.

### Após a Fase 5 (Telas Principais, Modais Globais e Desacoplamento Final de IPC)
- [ ] Executar `npx tsc --noEmit`.
- [ ] Fazer uma busca global no código (`src/`) por `window.electron`: confirmar que **apenas** `src/services/electronClient.ts` e `src/global.d.ts` referenciam `window.electron`.
- [ ] Testar login/logout (`LoginModal` e `App`), tela de configurações (`ConfigurationScreen`: carregar, testar pastas, selecionar pasta e salvar) e modal de atualização (`UpdateModal`).
- [ ] Testar **`SpecialOrdersModal`**: filtros (`Em Aberto`, `Concluídos`, `Todos`), verificação de existência de XML, botão `"Baixar pedido"`, download de anexos nos comentários, botão `"OK"` (Permissão 37) e botão `"Concluir"` (Permissão 38).
- [ ] Testar **`PlateSeparationModal`**: filtros de lotes, abertura de PDF, chat em tempo real (envio de comentário e alerta sonoro) e lançamento de movimento RM no ERP (com acorde sonoro de sucesso).
- [ ] Verificar no `FileDetailDrawer` e demais modais que clicar em um toast do Sonner (ex: botão "Abrir" ou fechar toast) **não** fecha o modal acidentalmente.