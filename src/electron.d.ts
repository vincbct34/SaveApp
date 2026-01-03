/**
 * Types pour l'API Electron exposée via le preload script
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

export interface ElectronAPI {
    window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
    }
    dialog: {
        selectFolder: () => Promise<string | null>
        selectDestination: () => Promise<string | null>
    }
    folder: {
        getSize: (folderPath: string) => Promise<{ success: boolean; size?: number; error?: string }>
    }
    backup: {
        start: (source: SourceConfig, destinationPath: string) => Promise<SyncResult>
        pause: () => void
        resume: () => void
        cancel: () => void
        onProgress: (callback: (progress: SyncProgress) => void) => () => void
    }
    store: {
        getSources: () => Promise<SourceConfig[]>
        setSources: (sources: SourceConfig[]) => Promise<boolean>
        getLastBackupDate: () => Promise<string | null>
        getPreferences: () => Promise<UserPreferences>
        setPreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>
        getAutoBackupIds: () => Promise<string[]>
        setAutoBackupIds: (ids: string[]) => Promise<boolean>
    }
    usb: {
        getDrives: () => Promise<DriveInfo[]>
        getUsbDrives: () => Promise<DriveInfo[]>
        startWatching: () => void
        stopWatching: () => void
        onDriveConnected: (callback: (drive: DriveInfo) => void) => () => void
        onDriveDisconnected: (callback: (drive: DriveInfo) => void) => () => void
    }
    scheduler: {
        getSchedules: () => Promise<BackupSchedule[]>
        addSchedule: (schedule: BackupSchedule) => Promise<boolean>
        updateSchedule: (schedule: BackupSchedule) => Promise<boolean>
        removeSchedule: (id: string) => Promise<boolean>
        onRun: (callback: (schedule: BackupSchedule) => void) => () => void
    }
    cloud: {
        hasCredentials: () => Promise<boolean>
        isConnected: () => Promise<boolean>
        connect: () => Promise<{ success: boolean; user?: GoogleUserInfo; error?: string }>
        disconnect: () => Promise<void>
        getUser: () => Promise<GoogleUserInfo | null>
        upload: (source: SourceConfig) => Promise<CloudSyncResult>
        cancel: () => void
        onProgress: (callback: (progress: CloudUploadProgress) => void) => () => void
        listBackups: () => Promise<BackupInfo[]>
        restore: (backupId: string, destPath: string) => Promise<RestoreResult>
        onRestoreProgress: (callback: (progress: RestoreProgress) => void) => () => void
    }
    app: {
        getVersion: () => Promise<string>
    }
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}

export { }
