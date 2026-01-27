export {};

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
      };
      settings?: {
        load: () => Promise<any>;
        save: (data: any) => Promise<any>;
        testPaths: (data: any) => Promise<any>;
        pickFolder: (initial?: string) => Promise<string | null>;
      };
    };
  }
}
