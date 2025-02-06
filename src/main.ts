import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

app.name = 'Arborator'

let mainWindow: BrowserWindow | null = null
let isDarkMode = false
let isQuitting = false
let currentFileName: string | null = null  // Track current file name

// Add IPC handler for initial theme state
ipcMain.handle('get-theme-state', () => isDarkMode);
ipcMain.on('set-theme-state', (_, dark) => {
    isDarkMode = dark;
    createMenu(); // Recreate menu to update checkmark
});

// Add IPC handlers for exports
ipcMain.handle('export-canvas-data', async () => {
    if (!mainWindow) return null;
    try {
        const filePath = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Canvas',
            defaultPath: 'canvas.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });

        return filePath.filePath;
    } catch (error) {
        console.error('Error in export-canvas-data:', error);
        return null;
    }
});

ipcMain.handle('export-trees-data', async () => {
    if (!mainWindow) return null;
    try {
        const filePath = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Trees',
            defaultPath: 'trees.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });

        return filePath.filePath;
    } catch (error) {
        console.error('Error in export-trees-data:', error);
        return null;
    }
});

ipcMain.handle('export-blackboards-data', async () => {
    if (!mainWindow) return null;
    try {
        const filePath = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Blackboards',
            defaultPath: 'blackboards.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });

        return filePath.filePath;
    } catch (error) {
        console.error('Error in export-blackboards-data:', error);
        return null;
    }
});

ipcMain.handle('write-export-file', async (_, { filePath, data }) => {
    try {
        await fs.promises.writeFile(filePath, data);
        return true;
    } catch (error) {
        console.error('Error writing export file:', error);
        return false;
    }
});

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
          click: async () => {
            if (!mainWindow) return;
            await mainWindow.webContents.executeJavaScript('window.canvasManager.handleNew()');
            mainWindow.setTitle('Arborator'); // Reset title to default
          }
        },
        {
          label: 'Open',
          accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
          click: async () => {
            if (!mainWindow) return;
            
            // Check for unsaved changes first
            const hasContent = await mainWindow.webContents.executeJavaScript('window.canvasManager.hasContent()');
            if (hasContent) {
              const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Save', "Don't Save", 'Cancel'],
                defaultId: 0,
                cancelId: 2,
                title: 'Save Changes?',
                message: 'Do you want to save the changes to your tree?',
                detail: 'Your changes will be lost if you don\'t save them.'
              });

              if (response === 0) { // Save
                try {
                  // Tell renderer to save and wait for the result
                  const filePath = await mainWindow.webContents.executeJavaScript('window.canvasManager.save()');
                  if (!filePath) return; // User cancelled save
                } catch (error) {
                  console.error('Error during save:', error);
                  return;
                }
              } else if (response === 2) { // Cancel
                return;
              }
            }

            // Proceed with open
            try {
              const success = await mainWindow.webContents.executeJavaScript('window.canvasManager.open()');
              if (success) {
                // Update window title with filename
                const filePath = await mainWindow.webContents.executeJavaScript('window.currentFileName');
                if (filePath) {
                  mainWindow.setTitle(`Arborator - ${path.basename(filePath)}`);
                }
              }
            } catch (error) {
              console.error('Error during open:', error);
            }
          }
        },
        {
          label: 'Save',
          accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
          click: async () => {
            if (!mainWindow) return;
            try {
              const filePath = await mainWindow.webContents.executeJavaScript('window.canvasManager.save()');
              if (filePath) {
                mainWindow.setTitle(`Arborator - ${path.basename(filePath)}`);
              }
            } catch (error) {
              console.error('Error during save:', error);
            }
          }
        },
        {
          label: 'Save As...',
          accelerator: process.platform === 'darwin' ? 'Shift+Cmd+S' : 'Ctrl+Shift+S',
          click: async () => {
            if (!mainWindow) return;
            
            // Force a new save dialog by clearing the current filename
            await mainWindow.webContents.executeJavaScript('window.currentFileName = null');
            
            try {
              const filePath = await mainWindow.webContents.executeJavaScript('window.canvasManager.save()');
              if (filePath) {
                mainWindow.setTitle(`Arborator - ${path.basename(filePath)}`);
              }
            } catch (error) {
              console.error('Error during save as:', error);
            }
          }
        },
        { type: 'separator' },
        { 
          label: 'Export Canvas',
          click: async () => {
            if (!mainWindow) return;
            try {
              await mainWindow.webContents.executeJavaScript(`
                (async () => {
                  try {
                    const filePath = await window.electronAPI.exportCanvasData();
                    if (!filePath) return;

                    const nodesWithConfigs = window.canvasManager.nodes.filter(node => 
                      node.configs && node.configs.length > 0 && node.configValues
                    );

                    // Create configs mapping
                    const configsMap = {};
                    const nodeConfigMap = new Map();

                    nodesWithConfigs.forEach(node => {
                      if (node.configValues) {
                        const configMapping = {};
                        Object.entries(node.configValues).forEach(([configType, configData]) => {
                          const configId = Math.random().toString(36).substr(2, 9);
                          configsMap[configId] = {
                            type: configType,
                            values: configData
                          };
                          configMapping[configType] = configId;
                        });
                        nodeConfigMap.set(node.id, configMapping);
                      }
                    });

                    // Get blackboard nodes
                    const blackboardNodes = window.canvasManager.nodes.filter(node => node.type === 'blackboard');
                    const blackboardsMap = {};
                    blackboardNodes.forEach(node => {
                      const blackboardName = node.customName || 'default';
                      blackboardsMap[blackboardName] = node.blackboardData || {};
                    });

                    // Get root nodes and create tree structure
                    const rootNodes = window.canvasManager.nodes.filter(node => node.type === 'root');
                    const treesMap = {};

                    const createTreeStructure = (node) => {
                      const nodeData = {
                        category: node.type,
                        type: node.name === 'History' ? 'BlackboardHistory' : node.name
                      };

                      if (node.customName) nodeData.custom_name = node.customName;
                      if (node.customType) nodeData.custom_type = node.customType;
                      if ((node.name === 'Repeat' || node.name === 'Retry') && typeof node.n_times === 'number') {
                        nodeData.n_times = node.n_times;
                      }
                      if (node.name === 'Timeout' && node.timelimit !== undefined) {
                        nodeData.timelimit = node.timelimit;
                      }
                      if (node.name === 'History' && node.child_key !== undefined) {
                        nodeData.child_key = node.child_key;
                      }

                      if (node.type === 'root') {
                        nodeData.blackboard = null;
                        const children = window.canvasManager.getNodeChildren(node);
                        const blackboardNode = children.find(child => child.type === 'blackboard');
                        if (blackboardNode) {
                          nodeData.blackboard = blackboardNode.customName || 'default';
                        }
                      }

                      if (nodeConfigMap.has(node.id)) {
                        nodeData.configs = Object.fromEntries(
                          Object.entries(nodeConfigMap.get(node.id))
                        );
                      }

                      const children = window.canvasManager.getNodeChildren(node)
                        .filter(child => child.type !== 'blackboard')
                        .sort((a, b) => a.x - b.x);

                      if (children.length > 0) {
                        nodeData.children = children.map(child => createTreeStructure(child));
                      }

                      return nodeData;
                    };

                    rootNodes.forEach((rootNode, index) => {
                      const treeName = rootNode.customName || \`tree_\${index + 1}\`;
                      treesMap[treeName] = createTreeStructure(rootNode);
                    });

                    // Create final export data
                    const exportData = {
                      configs: configsMap,
                      blackboards: blackboardsMap,
                      trees: treesMap
                    };

                    const success = await window.electronAPI.writeExportFile({
                      filePath,
                      data: JSON.stringify(exportData, null, 2)
                    });

                    if (success) {
                      console.log('Canvas exported successfully');
                    }
                  } catch (error) {
                    console.error('Error during canvas export:', error);
                  }
                })();
              `);
            } catch (error) {
              console.error('Error during canvas export:', error);
            }
          }
        },
        { 
          label: 'Export Trees',
          click: async () => {
            if (!mainWindow) return;
            try {
              await mainWindow.webContents.executeJavaScript(`
                (async () => {
                  try {
                    const filePath = await window.electronAPI.exportTreesData();
                    if (!filePath) return;

                    const nodesWithConfigs = window.canvasManager.nodes.filter(node => 
                      node.configs && node.configs.length > 0 && node.configValues
                    );

                    // Create configs mapping
                    const configsMap = {};
                    const nodeConfigMap = new Map();

                    nodesWithConfigs.forEach(node => {
                      if (node.configValues) {
                        const configMapping = {};
                        Object.entries(node.configValues).forEach(([configType, configData]) => {
                          const configId = Math.random().toString(36).substr(2, 9);
                          configsMap[configId] = {
                            type: configType,
                            values: configData
                          };
                          configMapping[configType] = configId;
                        });
                        nodeConfigMap.set(node.id, configMapping);
                      }
                    });

                    // Get root nodes and create tree structure
                    const rootNodes = window.canvasManager.nodes.filter(node => node.type === 'root');
                    const treesMap = {};

                    const createTreeStructure = (node) => {
                      const nodeData = {
                        category: node.type,
                        type: node.name === 'History' ? 'BlackboardHistory' : node.name
                      };

                      if (node.customName) nodeData.custom_name = node.customName;
                      if (node.customType) nodeData.custom_type = node.customType;
                      if ((node.name === 'Repeat' || node.name === 'Retry') && typeof node.n_times === 'number') {
                        nodeData.n_times = node.n_times;
                      }
                      if (node.name === 'Timeout' && node.timelimit !== undefined) {
                        nodeData.timelimit = node.timelimit;
                      }
                      if (node.name === 'History' && node.child_key !== undefined) {
                        nodeData.child_key = node.child_key;
                      }

                      if (node.type === 'root') {
                        nodeData.blackboard = null;
                        const children = window.canvasManager.getNodeChildren(node);
                        const blackboardNode = children.find(child => child.type === 'blackboard');
                        if (blackboardNode) {
                          nodeData.blackboard = blackboardNode.customName || 'default';
                        }
                      }

                      if (nodeConfigMap.has(node.id)) {
                        nodeData.configs = Object.fromEntries(
                          Object.entries(nodeConfigMap.get(node.id))
                        );
                      }

                      const children = window.canvasManager.getNodeChildren(node)
                        .filter(child => child.type !== 'blackboard')
                        .sort((a, b) => a.x - b.x);

                      if (children.length > 0) {
                        nodeData.children = children.map(child => createTreeStructure(child));
                      }

                      return nodeData;
                    };

                    rootNodes.forEach((rootNode, index) => {
                      const treeName = rootNode.customName || \`tree_\${index + 1}\`;
                      treesMap[treeName] = createTreeStructure(rootNode);
                    });

                    // Create final export data
                    const exportData = {
                      configs: configsMap,
                      trees: treesMap
                    };

                    const success = await window.electronAPI.writeExportFile({
                      filePath,
                      data: JSON.stringify(exportData, null, 2)
                    });

                    if (success) {
                      console.log('Trees exported successfully');
                    }
                  } catch (error) {
                    console.error('Error during trees export:', error);
                  }
                })();
              `);
            } catch (error) {
              console.error('Error during trees export:', error);
            }
          }
        },
        { 
          label: 'Export Blackboards',
          click: async () => {
            if (!mainWindow) return;
            try {
              await mainWindow.webContents.executeJavaScript(`
                (async () => {
                  try {
                    const filePath = await window.electronAPI.exportBlackboardsData();
                    if (!filePath) return;

                    const blackboardNodes = window.canvasManager.nodes.filter(node => node.type === 'blackboard');
                    
                    if (blackboardNodes.length === 0) {
                      console.log('No blackboards found to export');
                      return;
                    }

                    const blackboardsData = blackboardNodes.map(node => ({
                      name: node.customName || 'default',
                      kv: node.blackboardData || {}
                    }));

                    const success = await window.electronAPI.writeExportFile({
                      filePath,
                      data: JSON.stringify(blackboardsData, null, 2)
                    });

                    if (success) {
                      console.log('Blackboards exported successfully');
                    }
                  } catch (error) {
                    console.error('Error during blackboards export:', error);
                  }
                })();
              `);
            } catch (error) {
              console.error('Error during blackboards export:', error);
            }
          }
        },
        { type: 'separator' },
        { 
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            if (mainWindow) {
              mainWindow.close(); // This will trigger our close handler
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { 
          label: 'Undo',
          accelerator: process.platform === 'darwin' ? 'Cmd+Z' : 'Ctrl+Z',
          click: () => {
            mainWindow?.webContents.send('undo');
          }
        },
        { 
          label: 'Redo',
          accelerator: process.platform === 'darwin' ? 'Shift+Cmd+Z' : 'Ctrl+Y',
          click: () => {
            mainWindow?.webContents.send('redo');
          }
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { 
          label: 'Delete',
          accelerator: 'Delete',
          click: () => {
            mainWindow?.webContents.send('delete-selected');
          }
        },
        { type: 'separator' },
        { 
          label: 'Select All',
          accelerator: process.platform === 'darwin' ? 'Cmd+A' : 'Ctrl+A',
          click: () => {
            mainWindow?.webContents.send('select-all-nodes');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Dark Mode',
          type: 'checkbox',
          checked: isDarkMode,
          click: () => {
            isDarkMode = !isDarkMode;
            mainWindow?.webContents.send('theme-changed', isDarkMode);
          }
        }
      ]
    },
    /*{
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' }
      ]
    }*/
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  const { workAreaSize } = require('electron').screen.getPrimaryDisplay()
  
  const width = Math.floor(workAreaSize.width * 0.9)
  const height = Math.floor(workAreaSize.height * 0.9)

  mainWindow = new BrowserWindow({
    width,
    height,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // Handle window close event
  mainWindow.on('close', async (e) => {
    if (isQuitting) {
      return; // Let the window close naturally when quitting
    }

    e.preventDefault(); // Prevent the window from closing immediately
    
    if (!mainWindow) {
      return;
    }
    
    // Send a message to the renderer to check if there are unsaved changes
    const hasContent = await mainWindow.webContents.executeJavaScript('window.canvasManager.hasContent()');
    if (hasContent) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Save Changes?',
        message: 'Do you want to save the changes to your tree?',
        detail: 'Your changes will be lost if you don\'t save them.'
      });

      if (response === 0) { // Save
        try {
          // Tell renderer to save and wait for the result
          const filePath = await mainWindow.webContents.executeJavaScript('window.canvasManager.save()');
          if (filePath) { // Only quit if save was successful (not cancelled)
            isQuitting = true;
            app.quit();
          }
        } catch (error) {
          console.error('Error during save:', error);
        }
      } else if (response === 1) { // Don't Save
        isQuitting = true;
        app.quit();
      }
      // If response is 2 (Cancel), do nothing and keep the window open
    } else {
      isQuitting = true;
      app.quit();
    }
  })

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Handle save dialog
ipcMain.handle('show-save-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Tree',
    defaultPath: currentFileName || 'tree.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (filePath) {
    currentFileName = filePath;  // Update current file name when saving
  }

  return filePath;
});

// Handle blackboard export dialog
ipcMain.handle('show-blackboard-export-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Blackboards',
    defaultPath: 'blackboards.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  return filePath;
});

// Handle trees export dialog
ipcMain.handle('show-trees-export-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Trees',
    defaultPath: 'trees.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  return filePath;
});

// Handle canvas export dialog
ipcMain.handle('show-canvas-export-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Canvas',
    defaultPath: 'canvas.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  return filePath;
});

// Handle save confirmation dialog
ipcMain.handle('show-save-confirmation', async () => {
  if (!mainWindow) return 'cancel';

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Don\'t Save', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save Changes?',
    message: 'Do you want to save the changes to your tree?',
    detail: 'Your changes will be lost if you don\'t save them.'
  });

  // Map response to action
  switch (response) {
    case 0: return 'save';
    case 1: return 'discard';
    default: return 'cancel';
  }
});

// Handle open dialog
ipcMain.handle('show-open-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Tree',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths[0]) {
    currentFileName = filePaths[0];  // Update current file name when opening
  }

  return filePaths[0]; // Return the first selected file
});

// Create window when app is ready
app.whenReady().then(() => {
  createMenu()
  createWindow()
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, it's common to keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// On macOS, recreate window when dock icon is clicked and no windows are open
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// Add before app quit handler
app.on('before-quit', () => {
  isQuitting = true;
});