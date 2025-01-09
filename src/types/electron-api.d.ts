interface ElectronAPI {
    getNodeTypes: () => Promise<{
        actions: Array<{ name: string; type: string; has_children: boolean; }>;
        conditions: Array<{ name: string; type: string; has_children: boolean; }>;
        controls: Array<{ name: string; type: string; has_children: boolean; }>;
    }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
} 