import { contextBridge, ipcRenderer } from 'electron'

/**
 * Types pour la synchronisation
 */
export interface SourceConfig {
    id: string
    path: string
    name: string
    size: number
}

export interface SyncProgress {
    phase: 'scanning' | 'comparing' | 'copying' | 'deleting' | 'done' | 'error'
    totalFiles: number
    processedFiles: number
    totalBytes: number
    copiedBytes: number
    currentFile: string
    percent: number
    errors: Array<{ file: string; error: string; code: string }>
}

export interface SyncResult {
    success: boolean
    filesCreated: number
    filesUpdated: number
    filesDeleted: number
    bytesTransferred: number
    errors: Array<{ file: string; error: string; code: string }>
    duration: number
}

export interface UserPreferences {
    autoBackupOnUSB: boolean
    keepDeletedFiles: boolean
    lastOpenedPath?: string
}

/**
 * API exposée au renderer process via le context bridge
 */
const electronAPI = {
    // === Contrôles de fenêtre ===
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
                callback(isMaximized)
            ipcRenderer.on('window:maximized-changed', handler)
            return () => ipcRenderer.removeListener('window:maximized-changed', handler)
        },
    },

    // === Dialogues système ===
    dialog: {
        selectFolder: () =>
            ipcRenderer.invoke('dialog:selectFolder') as Promise<string | null>,
    },

    // === Dossiers ===
    folder: {
        getSize: (folderPath: string) =>
            ipcRenderer.invoke('folder:getSize', folderPath) as Promise<{
                success: boolean
                size?: number
                error?: string
            }>,
    },

    // === Sauvegarde ===
    backup: {
        start: (source: SourceConfig, destinationPath: string) =>
            ipcRenderer.invoke('backup:start', source, destinationPath) as Promise<SyncResult>,

        pause: () => ipcRenderer.send('backup:pause'),

        resume: () => ipcRenderer.send('backup:resume'),

        cancel: () => ipcRenderer.send('backup:cancel'),

        onProgress: (callback: (progress: SyncProgress) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, progress: SyncProgress) =>
                callback(progress)
            ipcRenderer.on('backup:progress', handler)
            return () => ipcRenderer.removeListener('backup:progress', handler)
        },
    },

    // === Persistance (Store) ===
    store: {
        getSources: () =>
            ipcRenderer.invoke('store:getSources') as Promise<SourceConfig[]>,

        setSources: (sources: SourceConfig[]) =>
            ipcRenderer.invoke('store:setSources', sources) as Promise<boolean>,

        getLastBackupDate: () =>
            ipcRenderer.invoke('store:getLastBackupDate') as Promise<string | null>,

        getPreferences: () =>
            ipcRenderer.invoke('store:getPreferences') as Promise<UserPreferences>,

        setPreferences: (prefs: Partial<UserPreferences>) =>
            ipcRenderer.invoke('store:setPreferences', prefs) as Promise<boolean>,
    },

    // === Application ===
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    },
}

// Exposition sécurisée de l'API
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Types pour TypeScript dans le renderer
export type ElectronAPI = typeof electronAPI
