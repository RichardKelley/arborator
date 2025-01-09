interface ElectronAPI {
    getNodeTypes: () => Promise<{
        actions: Array<{ name: string; type: string; }>;
        conditions: Array<{ name: string; type: string; }>;
        controls: Array<{ name: string; type: string; }>;
    }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
} 