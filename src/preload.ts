import { contextBridge, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

declare global {
    interface Window {
        electronAPI: {
            getNodeTypes: () => Promise<any>;
            getConfigs: () => Promise<any>;
            saveTree: (treeData: any) => Promise<string | undefined>;
            openTree: () => Promise<any>;
            showSaveConfirmation: () => Promise<'save' | 'discard' | 'cancel'>;
            onThemeChanged: (callback: (isDark: boolean) => void) => void;
            getThemeState: () => Promise<boolean>;
            setThemeState: (isDark: boolean) => void;
            saveBlackboards: (jsonData: string) => Promise<string | undefined>;
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    getNodeTypes: () => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, 'data', 'nodeTypes.json'), 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(JSON.parse(data));
            });
        });
    },
    getConfigs: () => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, 'data', 'configs.json'), 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(JSON.parse(data));
            });
        });
    },
    saveTree: async (treeData: any) => {
        try {
            // Send tree data to main process and get save path from dialog
            const filePath = await ipcRenderer.invoke('show-save-dialog');
            if (!filePath) return undefined;

            // Write the tree data to the selected file
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(treeData, null, 2),
                'utf8'
            );

            return filePath;
        } catch (error) {
            console.error('Failed to save tree:', error);
            throw error;
        }
    },
    openTree: async () => {
        try {
            // Get file path from dialog
            const filePath = await ipcRenderer.invoke('show-open-dialog');
            if (!filePath) return undefined;

            // Read and parse the file
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            console.error('Failed to open tree:', error);
            throw error;
        }
    },
    showSaveConfirmation: async () => {
        return ipcRenderer.invoke('show-save-confirmation');
    },
    onThemeChanged: (callback: (isDark: boolean) => void) => {
        ipcRenderer.on('theme-changed', (_, isDark) => callback(isDark));
    },
    getThemeState: () => ipcRenderer.invoke('get-theme-state'),
    setThemeState: (isDark: boolean) => ipcRenderer.send('set-theme-state', isDark),
    saveBlackboards: async (jsonData: string) => {
        try {
            // Get save path from dialog
            const filePath = await ipcRenderer.invoke('show-blackboard-export-dialog');
            if (!filePath) return undefined;

            // Write the blackboards data to the selected file
            await fs.promises.writeFile(filePath, jsonData, 'utf8');
            return filePath;
        } catch (error) {
            console.error('Failed to save blackboards:', error);
            throw error;
        }
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector: string, text: string) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }
  
    for (const type of ['chrome', 'node', 'electron'] as const) {
      replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions] ?? '')
    }
});
  