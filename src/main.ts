import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'

app.name = 'Arborator'

let mainWindow: BrowserWindow | null = null

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' }
      ]
    }
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
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Handle save dialog
ipcMain.handle('show-save-dialog', async () => {
  if (!mainWindow) return undefined;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Tree',
    defaultPath: 'tree.json',
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