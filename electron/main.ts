import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, Notification } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { syncService, SyncProgress, SyncResult } from './services/SyncService'
import { storeService, SourceConfig } from './services/StoreService'
import { calculateFolderSize } from './services/FileUtils'
import { usbService, DriveInfo } from './services/UsbService'
import { schedulerService, BackupSchedule } from './services/SchedulerService'
import { googleDriveService, CloudUploadProgress } from './services/GoogleDriveService'

// Référence à la fenêtre principale pour envoyer les événements
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

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
    ipcMain.on('window:close', () => {
        if (mainWindow) {
            mainWindow.hide()
        }
    })

    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized-changed', true)
    })
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
            return false
        }
        return true
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

                // Notification native
                if (Notification.isSupported()) {
                    new Notification({
                        title: result.success ? 'Sauvegarde terminée' : 'Sauvegarde terminée avec erreurs',
                        body: result.success
                            ? `Sauvegarde de "${source.name}" réussie.`
                            : `Sauvegarde de "${source.name}" terminée avec ${result.errors.length} erreurs.`,
                        silent: false
                    }).show()
                }

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

    // === Scheduler ===

    ipcMain.handle('scheduler:getSchedules', () => {
        return storeService.getSchedules()
    })

    ipcMain.handle('scheduler:addSchedule', (_event, schedule: BackupSchedule) => {
        storeService.addSchedule(schedule)
        return true
    })

    ipcMain.handle('scheduler:updateSchedule', (_event, schedule: BackupSchedule) => {
        storeService.updateSchedule(schedule)
        return true
    })

    ipcMain.handle('scheduler:removeSchedule', (_event, id: string) => {
        storeService.removeSchedule(id)
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

    // === Cloud (Google Drive) ===

    ipcMain.handle('cloud:hasCredentials', () => {
        return googleDriveService.hasCredentials()
    })

    ipcMain.handle('cloud:isConnected', () => {
        return googleDriveService.isAuthenticated()
    })

    ipcMain.handle('cloud:connect', async () => {
        return await googleDriveService.authenticate()
    })

    ipcMain.handle('cloud:disconnect', async () => {
        await googleDriveService.logout()
    })

    ipcMain.handle('cloud:getUser', () => {
        return storeService.getGoogleUserInfo()
    })

    ipcMain.handle('cloud:upload', async (_event, source: SourceConfig) => {
        // Écouter les événements de progression
        const progressHandler = (progress: CloudUploadProgress): void => {
            mainWindow?.webContents.send('cloud:progress', progress)
        }

        googleDriveService.on('progress', progressHandler)

        try {
            const result = await googleDriveService.uploadSource(source)
            console.log('☁️ [SaveApp] Upload cloud terminé:', result)

            // Notification native
            if (Notification.isSupported()) {
                new Notification({
                    title: result.success ? 'Upload terminé' : 'Upload terminé avec erreurs',
                    body: result.success
                        ? `Sauvegarde cloud de "${source.name}" réussie.`
                        : `Upload de "${source.name}" terminé avec ${result.errors.length} erreurs.`,
                    silent: false
                }).show()
            }

            return result
        } finally {
            googleDriveService.off('progress', progressHandler)
        }
    })

    ipcMain.on('cloud:cancel', () => {
        googleDriveService.cancel()
    })

    ipcMain.on('cloud:pause', () => {
        googleDriveService.pause()
    })

    ipcMain.on('cloud:resume', () => {
        googleDriveService.resume()
    })

    ipcMain.handle('cloud:listBackups', async () => {
        return await googleDriveService.listBackups()
    })

    ipcMain.handle('cloud:restore', async (_event, backupId: string, destPath: string) => {
        const progressHandler = (progress: { downloaded: number; total: number; currentFile: string }): void => {
            mainWindow?.webContents.send('cloud:restoreProgress', progress)
        }

        const result = await googleDriveService.downloadBackup(backupId, destPath, progressHandler)

        // Notification native
        if (Notification.isSupported()) {
            new Notification({
                title: result.success ? 'Restauration terminée' : 'Restauration avec erreurs',
                body: result.success
                    ? `${result.filesDownloaded} fichiers restaurés.`
                    : `Restauration terminée avec ${result.errors.length} erreurs.`,
                silent: false
            }).show()
        }

        return result
    })

    // === Application ===

    ipcMain.handle('app:getVersion', () => {
        return app.getVersion()
    })
}

// Initialisation
app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.saveapp')

    // Démarrer le scheduler
    schedulerService.start()
    schedulerService.on('schedule:due', (schedule: BackupSchedule) => {
        console.log(`[Main] Schedule due: ${schedule.name}`)
        mainWindow?.webContents.send('scheduler:run', schedule)
    })

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

    // Création du Tray
    const iconPath = join(__dirname, '../../resources/icon.png') // A adapter selon ton projet
    // Pour l'instant on utilise une icône par défaut si pas présente, ou on génère une empty image
    const icon = nativeImage.createEmpty() // Placeholder

    tray = new Tray(icon)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Ouvrir SaveApp',
            click: () => mainWindow?.show()
        },
        { type: 'separator' },
        {
            label: 'Quitter',
            click: () => {
                isQuitting = true
                app.quit()
            }
        }
    ])
    tray.setToolTip('SaveApp - Sauvegarde Automatique')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
        mainWindow?.show()
    })
})

app.on('window-all-closed', () => {
    // Ne pas quitter l'app si toutes les fenêtres sont fermées (mode tray)
    // Sauf si c'est macOS où c'est le comportement standard
    if (process.platform === 'darwin') {
        // Sur mac on ne quitte pas non plus
    }
})
