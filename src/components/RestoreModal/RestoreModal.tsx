import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface BackupInfo {
    id: string
    name: string
    modifiedTime: string
}

interface RestoreProgress {
    downloaded: number
    total: number
    currentFile: string
}

interface RestoreModalProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * Modal pour restaurer des backups depuis Google Drive
 */
function RestoreModal({ isOpen, onClose }: RestoreModalProps) {
    const [backups, setBackups] = useState<BackupInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    const [progress, setProgress] = useState<RestoreProgress | null>(null)
    const [selectedBackup, setSelectedBackup] = useState<string | null>(null)

    // Charger la liste des backups à l'ouverture
    useEffect(() => {
        if (isOpen && window.electronAPI) {
            setIsLoading(true)
            window.electronAPI.cloud.listBackups()
                .then(setBackups)
                .finally(() => setIsLoading(false))
        }
    }, [isOpen])

    // Écouter les événements de progression
    useEffect(() => {
        if (!window.electronAPI) return

        const unsub = window.electronAPI.cloud.onRestoreProgress((prog) => {
            setProgress(prog)
        })

        return unsub
    }, [])

    /**
     * Lance la restauration
     */
    const handleRestore = useCallback(async () => {
        if (!selectedBackup || !window.electronAPI) return

        // Demander le dossier de destination
        const destPath = await window.electronAPI.dialog.selectDestination()
        if (!destPath) return

        setIsRestoring(true)
        setProgress({ downloaded: 0, total: 0, currentFile: 'Préparation...' })

        try {
            const result = await window.electronAPI.cloud.restore(selectedBackup, destPath)

            if (result.success) {
                toast.success(`Restauration terminée : ${result.filesDownloaded} fichiers`)
                onClose()
            } else {
                toast.error(`Restauration avec ${result.errors.length} erreurs`)
            }
        } catch (error) {
            console.error('[RestoreModal] Erreur:', error)
            toast.error('Erreur lors de la restauration')
        } finally {
            setIsRestoring(false)
            setProgress(null)
        }
    }, [selectedBackup, onClose])

    /**
     * Formate une date ISO en format lisible
     */
    const formatDate = (isoDate: string) => {
        try {
            const date = new Date(isoDate)
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return isoDate
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Restaurer depuis le Cloud</h2>
                            <p className="text-sm text-dark-400">Sélectionnez un backup à restaurer</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isRestoring}
                        className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-dark-400">
                            <svg className="w-8 h-8 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p>Chargement des backups...</p>
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-dark-400">
                            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p>Aucun backup trouvé</p>
                            <p className="text-sm mt-1">Effectuez d'abord une sauvegarde vers Google Drive</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {backups.map((backup) => (
                                <button
                                    key={backup.id}
                                    onClick={() => setSelectedBackup(backup.id)}
                                    disabled={isRestoring}
                                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left ${selectedBackup === backup.id
                                        ? 'bg-blue-500/10 border-2 border-blue-500/50'
                                        : 'bg-dark-800/50 border-2 border-transparent hover:bg-dark-800'
                                        } disabled:opacity-50`}
                                >
                                    {/* Radio */}
                                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${selectedBackup === backup.id
                                        ? 'bg-blue-500'
                                        : 'bg-dark-700 border-2 border-dark-500'
                                        }`}>
                                        {selectedBackup === backup.id && (
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        )}
                                    </div>

                                    {/* Icône dossier */}
                                    <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white truncate">{backup.name}</p>
                                        <p className="text-sm text-dark-400">{formatDate(backup.modifiedTime)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Progress bar */}
                    {isRestoring && progress && (
                        <div className="mt-6 p-4 bg-dark-800 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-dark-300">Restauration en cours...</span>
                                <span className="text-sm text-dark-400">
                                    {progress.downloaded}/{progress.total}
                                </span>
                            </div>
                            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-xs text-dark-500 mt-2 truncate">
                                {progress.currentFile || 'Préparation...'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-700">
                    <button
                        onClick={onClose}
                        disabled={isRestoring}
                        className="px-4 py-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleRestore}
                        disabled={!selectedBackup || isRestoring || isLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRestoring ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Restauration...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Restaurer
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default RestoreModal
