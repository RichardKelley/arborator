import { contextBridge } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

declare global {
    interface Window {
        electronAPI: {
            getNodeTypes: () => Promise<any>;
            getConfigs: () => Promise<any>;
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
  