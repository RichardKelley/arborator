import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'

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
        // { role: 'undo' },
        // { role: 'redo' },
        // { type: 'separator' },
        // { role: 'cut' },
        // { role: 'copy' },
        // { role: 'paste' },
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