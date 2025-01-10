interface ElectronAPI {
    getNodeTypes: () => Promise<{
        actions: Array<{ name: string; type: string; has_children: boolean; }>;
        conditions: Array<{ name: string; type: string; has_children: boolean; }>;
        controls: Array<{ name: string; type: string; has_children: boolean; }>;
    }>;
    getConfigs: () => Promise<any>;
}

declare global {
    interface Window {
        electronAPI: {
            getNodeTypes: () => Promise<any>;
            getConfigs: () => Promise<any>;
        }
    }
}

export {}; 