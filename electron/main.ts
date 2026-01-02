import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

/**
 * Crée la fenêtre principale de l'application
 */
function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        frame: false, // Fenêtre sans bordure pour UI personnalisée
        backgroundColor: '#020617', // dark-950
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true,
            contextIsolation: true, // Sécurité : isolation du contexte
            nodeIntegration: false, // Sécurité : pas d'accès Node dans le renderer
        },
    })

    // Affiche la fenêtre quand elle est prête
    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    // Ouvre les liens externes dans le navigateur par défaut
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // Charge l'URL de dev ou le fichier HTML en production
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // Handlers pour les contrôles de fenêtre
    ipcMain.on('window:minimize', () => mainWindow.minimize())
    ipcMain.on('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow.maximize()
        }
    })
    ipcMain.on('window:close', () => mainWindow.close())

    // Handler pour vérifier si la fenêtre est maximisée
    ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())

    // Écoute les changements d'état de la fenêtre
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized-changed', true)
    })
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:maximized-changed', false)
    })
}

/**
 * Handlers IPC pour les fonctionnalités de l'application
 */
function setupIpcHandlers(): void {
    // Sélection d'un dossier source
    ipcMain.handle('dialog:selectFolder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Sélectionner un dossier à sauvegarder',
        })

        if (result.canceled) {
            return null
        }

        return result.filePaths[0]
    })

    // Test de sauvegarde (Phase 1 - juste un log)
    ipcMain.handle('backup:start', async () => {
        console.log('🔄 [SaveApp] Démarrage de la sauvegarde...')
        // TODO: Implémenter la vraie logique de sauvegarde en Phase 2
        return { success: true, message: 'Sauvegarde simulée terminée' }
    })

    // Récupérer la version de l'application
    ipcMain.handle('app:getVersion', () => {
        return app.getVersion()
    })
}

// Initialisation de l'application
app.whenReady().then(() => {
    // Identifiant unique pour l'application Windows
    electronApp.setAppUserModelId('com.saveapp')

    // Hot reload en dev - F12 pour DevTools
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    createWindow()

    // macOS : recréer la fenêtre si on clique sur l'icône du dock
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

// Quitter l'application quand toutes les fenêtres sont fermées (sauf macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
