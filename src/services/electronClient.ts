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
    clearTargetFolders: () =>
      window.electron?.analyzer?.clearTargetFolders
        ? window.electron.analyzer.clearTargetFolders()
        : Promise.resolve({ ok: false, message: "", clearedCount: 0, count: 0 }),
    loadHistory: () =>
      window.electron?.analyzer?.loadHistory
        ? window.electron.analyzer.loadHistory()
        : Promise.resolve([]),
    saveHistory: (rows: any[]) =>
      window.electron?.analyzer?.saveHistory
        ? window.electron.analyzer.saveHistory(rows)
        : Promise.resolve(),
    exportReport: (reportData: any) => window.electron?.analyzer?.exportReport?.(reportData),

    // Substituições e Edições XML
    replaceCoringa: (filePath: string, from: string, to: string) =>
      window.electron?.analyzer?.replaceCoringa?.(filePath, from, to),
    undoReplace: (filePath: string) =>
      window.electron?.analyzer?.undoReplace?.(filePath),
    replaceCgGroups: (filePath: string, map: Record<string, string>) =>
      window.electron?.analyzer?.replaceCgGroups?.(filePath, map),
    fillReferencia: (filePath: string, value: string) =>
      window.electron?.analyzer?.fillReferencia?.(filePath, value),
    fillReferenciaByIds: (
      filePath: string,
      replacements: { id: string; value: string; descricao?: string }[]
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
      newDimension: string | { largura: string | number; altura: string | number; profundidade: string | number },
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
    openMirrorFolder: (drawingCode?: string) => window.electron?.analyzer?.openMirrorFolder?.(drawingCode || ""),
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
    searchCsvProduct: (colorName: string, productType: string) =>
      window.electron?.analyzer?.searchCsvProduct?.(colorName, productType),
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
    openPlateSeparationFolder: (folderPath?: string) =>
      window.electron?.analyzer?.openPlateSeparationFolder?.(folderPath),
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
    load: () =>
      window.electron?.settings?.load
        ? window.electron.settings.load()
        : Promise.resolve(null),
    save: (data: any) =>
      window.electron?.settings?.save
        ? window.electron.settings.save(data)
        : Promise.resolve(false),
    testPaths: (data: any) =>
      window.electron?.settings?.testPaths
        ? window.electron.settings.testPaths(data)
        : Promise.resolve(null),
    pickFolder: (initial?: string) =>
      window.electron?.settings?.pickFolder
        ? window.electron.settings.pickFolder(initial)
        : Promise.resolve(null),
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

