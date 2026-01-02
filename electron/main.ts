import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { syncService, SyncProgress, SyncResult } from './services/SyncService'
import { storeService, SourceConfig } from './services/StoreService'
import { calculateFolderSize } from './services/FileUtils'
import { usbService, DriveInfo } from './services/UsbService'

// Référence à la fenêtre principale pour envoyer les événements
let mainWindow: BrowserWindow | null = null

/**
 * Crée la fenêtre principale de l'application
 */
function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#020617',
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // Handlers pour les contrôles de fenêtre
    ipcMain.on('window:minimize', () => mainWindow?.minimize())
    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow?.maximize()
        }
    })
    ipcMain.on('window:close', () => mainWindow?.close())

    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized-changed', true)
    })
    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized-changed', false)
    })
}

/**
 * Handlers IPC pour les fonctionnalités de l'application
 */
function setupIpcHandlers(): void {
    // === Dialogues ===

    // Sélection d'un dossier source
    ipcMain.handle('dialog:selectFolder', async () => {
        const lastPath = storeService.getLastOpenedPath()
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Sélectionner un dossier à sauvegarder',
            defaultPath: lastPath,
        })

        if (result.canceled || !result.filePaths[0]) {
            return null
        }

        storeService.setLastOpenedPath(dirname(result.filePaths[0]))
        return result.filePaths[0]
    })

    // Sélection d'un dossier destination
    ipcMain.handle('dialog:selectDestination', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Choisir où sauvegarder vos fichiers',
        })

        if (result.canceled || !result.filePaths[0]) {
            return null
        }

        return result.filePaths[0]
    })

    // === Calcul de taille ===

    ipcMain.handle('folder:getSize', async (_event, folderPath: string) => {
        try {
            const size = await calculateFolderSize(folderPath)
            return { success: true, size }
        } catch (error: unknown) {
            const err = error as Error
            return { success: false, error: err.message }
        }
    })

    // === Sauvegarde ===

    ipcMain.handle(
        'backup:start',
        async (_event, source: SourceConfig, destinationPath: string) => {
            console.log('🔄 [SaveApp] Démarrage de la sauvegarde...')
            console.log(`   Source: ${source.path}`)
            console.log(`   Destination: ${destinationPath}`)

            // Écouter les événements de progression
            const progressHandler = (progress: SyncProgress): void => {
                mainWindow?.webContents.send('backup:progress', progress)
            }

            syncService.on('progress', progressHandler)

            try {
                const result: SyncResult = await syncService.sync(source, destinationPath)
                console.log('✅ [SaveApp] Sauvegarde terminée:', result)
                return result
            } finally {
                syncService.off('progress', progressHandler)
            }
        }
    )

    ipcMain.on('backup:pause', () => {
        console.log('⏸️ [SaveApp] Pause de la sauvegarde')
        syncService.pause()
    })

    ipcMain.on('backup:resume', () => {
        console.log('▶️ [SaveApp] Reprise de la sauvegarde')
        syncService.resume()
    })

    ipcMain.on('backup:cancel', () => {
        console.log('❌ [SaveApp] Annulation de la sauvegarde')
        syncService.cancel()
    })

    // === Store (Persistance) ===

    ipcMain.handle('store:getSources', () => {
        return storeService.getSources()
    })

    ipcMain.handle('store:setSources', (_event, sources: SourceConfig[]) => {
        storeService.setSources(sources)
        return true
    })

    ipcMain.handle('store:getLastBackupDate', () => {
        const date = storeService.getLastBackupDate()
        return date ? date.toISOString() : null
    })

    ipcMain.handle('store:getPreferences', () => {
        return storeService.getPreferences()
    })

    ipcMain.handle(
        'store:setPreferences',
        (_event, prefs: Parameters<typeof storeService.setPreferences>[0]) => {
            storeService.setPreferences(prefs)
            return true
        }
    )

    ipcMain.handle('store:getAutoBackupIds', () => {
        return storeService.getAutoBackupDriveIds()
    })

    ipcMain.handle('store:setAutoBackupIds', (_event, ids: string[]) => {
        storeService.setAutoBackupDriveIds(ids)
        return true
    })

    // === USB Detection ===

    ipcMain.handle('usb:getDrives', async () => {
        return await usbService.listDrives()
    })

    ipcMain.handle('usb:getUsbDrives', async () => {
        return await usbService.listUsbDrives()
    })

    ipcMain.on('usb:startWatching', () => {
        usbService.startWatching()

        // Envoyer les événements au renderer
        usbService.on('drive:connected', (drive: DriveInfo) => {
            mainWindow?.webContents.send('usb:driveConnected', drive)
        })

        usbService.on('drive:disconnected', (drive: DriveInfo) => {
            mainWindow?.webContents.send('usb:driveDisconnected', drive)
        })
    })

    ipcMain.on('usb:stopWatching', () => {
        usbService.stopWatching()
    })

    // === Application ===

    ipcMain.handle('app:getVersion', () => {
        return app.getVersion()
    })
}

// Initialisation
app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.saveapp')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
