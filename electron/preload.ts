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

export interface DriveInfo {
    id: string
    letter: string
    label: string
    type: 'usb' | 'fixed' | 'network' | 'unknown'
    size: number
    freeSpace: number
    isReady: boolean
}

export interface BackupSchedule {
    id: string
    name: string
    frequency: 'daily' | 'weekly'
    time: string
    days: number[]
    sourceIds: string[]
    destinationId: string
    enabled: boolean
    lastRun: string | null
}

export interface GoogleUserInfo {
    name: string
    email: string
    picture?: string
}

export interface CloudUploadProgress {
    phase: 'scanning' | 'uploading' | 'done' | 'error'
    totalFiles: number
    uploadedFiles: number
    totalBytes: number
    uploadedBytes: number
    currentFile: string
    percent: number
}

export interface CloudSyncResult {
    success: boolean
    filesUploaded: number
    filesSkipped: number
    bytesTransferred: number
    errors: Array<{ file: string; error: string }>
    duration: number
}

export interface BackupInfo {
    id: string
    name: string
    modifiedTime: string
}

export interface RestoreResult {
    success: boolean
    filesDownloaded: number
    errors: string[]
}

export interface RestoreProgress {
    downloaded: number
    total: number
    currentFile: string
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
        selectDestination: () =>
            ipcRenderer.invoke('dialog:selectDestination') as Promise<string | null>,
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

        getAutoBackupIds: () =>
            ipcRenderer.invoke('store:getAutoBackupIds') as Promise<string[]>,

        setAutoBackupIds: (ids: string[]) =>
            ipcRenderer.invoke('store:setAutoBackupIds', ids) as Promise<boolean>,
    },

    // === USB Detection ===
    usb: {
        getDrives: () => ipcRenderer.invoke('usb:getDrives') as Promise<DriveInfo[]>,

        getUsbDrives: () => ipcRenderer.invoke('usb:getUsbDrives') as Promise<DriveInfo[]>,

        startWatching: () => ipcRenderer.send('usb:startWatching'),

        stopWatching: () => ipcRenderer.send('usb:stopWatching'),

        onDriveConnected: (callback: (drive: DriveInfo) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, drive: DriveInfo) =>
                callback(drive)
            ipcRenderer.on('usb:driveConnected', handler)
            return () => ipcRenderer.removeListener('usb:driveConnected', handler)
        },

        onDriveDisconnected: (callback: (drive: DriveInfo) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, drive: DriveInfo) =>
                callback(drive)
            ipcRenderer.on('usb:driveDisconnected', handler)
            return () => ipcRenderer.removeListener('usb:driveDisconnected', handler)
        },
    },

    // === Scheduler ===
    scheduler: {
        getSchedules: () =>
            ipcRenderer.invoke('scheduler:getSchedules') as Promise<BackupSchedule[]>,

        addSchedule: (schedule: BackupSchedule) =>
            ipcRenderer.invoke('scheduler:addSchedule', schedule) as Promise<boolean>,

        updateSchedule: (schedule: BackupSchedule) =>
            ipcRenderer.invoke('scheduler:updateSchedule', schedule) as Promise<boolean>,

        removeSchedule: (id: string) =>
            ipcRenderer.invoke('scheduler:removeSchedule', id) as Promise<boolean>,

        onRun: (callback: (schedule: BackupSchedule) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, schedule: BackupSchedule) =>
                callback(schedule)
            ipcRenderer.on('scheduler:run', handler)
            return () => ipcRenderer.removeListener('scheduler:run', handler)
        },
    },

    // === Cloud (Google Drive) ===
    cloud: {
        hasCredentials: () =>
            ipcRenderer.invoke('cloud:hasCredentials') as Promise<boolean>,

        isConnected: () =>
            ipcRenderer.invoke('cloud:isConnected') as Promise<boolean>,

        connect: () =>
            ipcRenderer.invoke('cloud:connect') as Promise<{
                success: boolean
                user?: GoogleUserInfo
                error?: string
            }>,

        disconnect: () =>
            ipcRenderer.invoke('cloud:disconnect') as Promise<void>,

        getUser: () =>
            ipcRenderer.invoke('cloud:getUser') as Promise<GoogleUserInfo | null>,

        upload: (source: SourceConfig) =>
            ipcRenderer.invoke('cloud:upload', source) as Promise<CloudSyncResult>,

        cancel: () =>
            ipcRenderer.send('cloud:cancel'),

        pause: () =>
            ipcRenderer.send('cloud:pause'),

        resume: () =>
            ipcRenderer.send('cloud:resume'),

        onProgress: (callback: (progress: CloudUploadProgress) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, progress: CloudUploadProgress) =>
                callback(progress)
            ipcRenderer.on('cloud:progress', handler)
            return () => ipcRenderer.removeListener('cloud:progress', handler)
        },

        // Restore
        listBackups: () =>
            ipcRenderer.invoke('cloud:listBackups') as Promise<BackupInfo[]>,

        restore: (backupId: string, destPath: string) =>
            ipcRenderer.invoke('cloud:restore', backupId, destPath) as Promise<RestoreResult>,

        onRestoreProgress: (callback: (progress: RestoreProgress) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, progress: RestoreProgress) =>
                callback(progress)
            ipcRenderer.on('cloud:restoreProgress', handler)
            return () => ipcRenderer.removeListener('cloud:restoreProgress', handler)
        },
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
