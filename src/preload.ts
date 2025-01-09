import { contextBridge } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

declare global {
    interface Window {
        electronAPI: {
            getNodeTypes: () => Promise<any>;
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    getNodeTypes: async () => {
        try {
            const nodeTypesPath = path.join(__dirname, 'data', 'nodeTypes.json');
            const data = await fs.promises.readFile(nodeTypesPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading nodeTypes.json:', error);
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
  