export {};

/** Resposta padrão de quase todo handler IPC do processo principal: { ok, message?, ...extras }. */
interface IpcResult {
  ok: boolean;
  message?: string;
  [extra: string]: unknown;
}

declare global {
  interface Window {
    electron?: {
      analyzer?: {
        start: (cfg?: any) => Promise<boolean>;
        stop: () => Promise<boolean>;
        scanOnce: () => Promise<boolean>;
        onEvent: (cb: (msg: any) => void) => void;
        openInFolder: (fullOrBasePath: string) => Promise<boolean>;
        reprocessOne: (fullOrBasePath: string) => Promise<boolean>;
        replaceCoringa?: (filePath: string, from: string, to: string) => Promise<IpcResult & { replaced?: number; backupPath?: string }>;
        undoReplace?: (filePath: string) => Promise<IpcResult & { restored?: boolean; entry?: any }>;
        replaceCgGroups?: (filePath: string, map: Record<string, string>) => Promise<IpcResult & { counts?: Record<string, number>; backupPath?: string }>;
        fillReferencia?: (filePath: string, value: string) => Promise<IpcResult & { replaced?: number; backupPath?: string }>;
        fillReferenciaByIds?: (filePath: string, replacements: { id: string; value: string; descricao?: string }[]) => Promise<IpcResult & { counts?: Record<string, number>; backupPath?: string; arquivo?: string }>;
        replaceItemDescription?: (filePath: string, ids: string[], newDescription: string, desenho?: string) => Promise<IpcResult & { counts?: Record<string, number>; backupPath?: string; arquivo?: string }>;
        findDrawingFile?: (drawingCode: string, xmlFilePath?: string) => Promise<{ found: boolean; path: string | null; name?: string; panelInfo?: any; fresaInfo?: any; message?: string }>;
        openDrawing?: (drawingCode: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        openDrawingFolder?: (drawingCode: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        openMirrorFolder?: (drawingCode: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        openAspanFolder?: (arg?: string | { drawingCode?: string }) => Promise<{ ok: boolean; path?: string; message?: string }>;
        searchXmlFiles?: (searchTerm: string) => Promise<{ ok: boolean; results?: { name: string; fullPath: string }[]; message?: string }>;
        copyXmlToEntrada?: (sourceFullPath: string) => Promise<{ ok: boolean; destPath?: string; message?: string }>;
        searchDrawingFiles?: (searchTerm: string) => Promise<{ ok: boolean; results?: { name: string; fullPath: string }[]; message?: string }>;
        resolveDrawingPedido?: (drawingName: string) => Promise<{ ok: boolean; pedido?: string; pedidoFilename?: string; pedidoSource?: 'historico' | 'erp' | 'busca'; message?: string }>;
        openDrawingByPath?: (fullPath: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        showDrawingInFolder?: (fullPath: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        copyDrawingToMirror?: (fullPath: string) => Promise<{ ok: boolean; destPath?: string; message?: string }>;
        copyDrawingByCodeToMirror?: (drawingCode: string) => Promise<{ ok: boolean; destPath?: string; message?: string }>;
        batchProcessDrawings?: (params: { items: string[]; open?: boolean; copy?: boolean; openFolder?: boolean; targetFolder?: string }) => Promise<{ ok: boolean; processed?: number; openedCount?: number; copiedCount?: number; folderOpenedCount?: number; notFound?: string[]; errors?: { item: string; message: string }[]; message?: string }>;
        openMuxarabiDrawing?: (sizeCode: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
        injectMuxarabi?: (drawingCode: string, sizeCode: string, thickness?: string) => Promise<{ ok: boolean; path?: string; message?: string; injectedCount?: number; totalInTemplate?: number; pieceDimensions?: string; thickness?: string; layer?: string }>;
        fixFresa37to18?: (dxfFilePath: string) => Promise<IpcResult & { changes?: any }>;
        exportReport?: (reportData: any) => Promise<IpcResult & { csvPath?: string; filesCount?: number }>;
        searchCsvProduct?: (colorName: string, productType: string) => Promise<IpcResult & { results?: any[]; count?: number }>;
        searchErpProduct?: (params: { code?: string; desc?: string; type?: string }) => Promise<IpcResult & { results?: any[]; count?: number }>;
        getOrderComments?: (numPedido: string) => Promise<IpcResult & { data?: any[] }>;
        getSpecialOrders?: () => Promise<IpcResult & { data?: any[] }>;
        completeEngineeringOrder?: (params: { pk_pedido_engenharia: number; pk_usuario_alteracao?: number }) => Promise<IpcResult>;
        sendNotification?: (params: { title: string; body: string; count?: number }) => Promise<IpcResult>;
        setTaskbarBadge?: (arg: number | { count: number; dataUrl?: string | null }) => Promise<IpcResult>;
        downloadCommentFile?: (filename: string) => Promise<IpcResult & { destPath?: string }>;
        openFile?: (filePath: string) => Promise<IpcResult>;
        moveToOk?: (filePath: string) => Promise<IpcResult & { destPath?: string }>;
        deleteProject?: (filePath: string) => Promise<IpcResult>;
        clearTargetFolders?: () => Promise<IpcResult & { clearedCount?: number }>;
        loadHistory?: () => Promise<any[]>;
        saveHistory?: (rows: any[]) => Promise<{ ok: boolean; count?: number; message?: string }>;
        downloadPromob?: (xmlFilename: string) => Promise<{ ok: boolean; filename?: string; destPath?: string; count?: number; files?: { filename: string; destPath: string }[]; message?: string }>;
      };
      settings?: {
        load: () => Promise<any>;
        save: (data: any) => Promise<any>;
        testPaths: (data: any) => Promise<any>;
        pickFolder: (initial?: string) => Promise<string | null>;
      };
      updater?: {
        onUpdateAvailable: (cb: (info: any) => void) => void;
        onUpdateProgress: (cb: (progress: any) => void) => void;
        onUpdateDownloaded: (cb: (info: any) => void) => void;
        onUpdateNotAvailable: (cb: (info: any) => void) => void;
        onUpdateError: (cb: (err: any) => void) => void;
        checkForUpdates: () => Promise<void>;
        startDownload: () => Promise<void>;
        installUpdate: () => Promise<void>;
      };
      auth?: {
        login: (username: string, password: string) => Promise<IpcResult & { user?: any }>;
        getSession: () => Promise<IpcResult & { user?: any }>;
        logout: () => Promise<IpcResult>;
      };
    };
  }
}
