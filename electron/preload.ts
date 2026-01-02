import { contextBridge, ipcRenderer } from 'electron'

/**
 * API exposée au renderer process via le context bridge
 * Seules ces méthodes sont accessibles depuis React
 */
const electronAPI = {
    // === Contrôles de fenêtre ===
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
            ipcRenderer.on('window:maximized-changed', handler)
            return () => ipcRenderer.removeListener('window:maximized-changed', handler)
        },
    },

    // === Dialogues système ===
    dialog: {
        selectFolder: () => ipcRenderer.invoke('dialog:selectFolder') as Promise<string | null>,
    },

    // === Actions de sauvegarde ===
    backup: {
        start: () => ipcRenderer.invoke('backup:start') as Promise<{ success: boolean; message: string }>,
    },

    // === Informations application ===
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    },
}

// Exposition sécurisée de l'API
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Types pour TypeScript dans le renderer
export type ElectronAPI = typeof electronAPI
