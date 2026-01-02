import { useState, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import Dashboard from './components/Dashboard/Dashboard'
import SourcesList from './components/SourcesList/SourcesList'
import DestinationsList from './components/DestinationsList/DestinationsList'
import ProgressBar from './components/ProgressBar/ProgressBar'
import ErrorReport from './components/ErrorReport/ErrorReport'

/**
 * Types pour les sources et destinations
 */
export interface SourceFolder {
    id: string
    path: string
    name: string
    size: number
}

export interface Destination {
    id: string
    type: 'usb' | 'nas' | 'cloud'
    name: string
    path?: string
    available: boolean
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

/**
 * Composant principal de l'application SaveApp
 */
function App() {
    // État de la sauvegarde
    const [isBackingUp, setIsBackingUp] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [progress, setProgress] = useState<SyncProgress | null>(null)
    const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null)
    const [lastResult, setLastResult] = useState<SyncResult | null>(null)
    const [showErrorReport, setShowErrorReport] = useState(false)

    // Sources et destinations
    const [sources, setSources] = useState<SourceFolder[]>([])
    const [destinations] = useState<Destination[]>([
        { id: '1', type: 'usb', name: 'Disque Backup (D:)', path: 'D:\\SaveApp_Backup', available: false },
        { id: '2', type: 'nas', name: 'NAS Synology', path: '\\\\NAS\\Backups', available: false },
        { id: '3', type: 'cloud', name: 'Google Drive', available: false },
    ])

    // Charger les données persistées au démarrage
    useEffect(() => {
        if (!window.electronAPI) return

        // Charger les sources sauvegardées
        window.electronAPI.store.getSources().then((savedSources) => {
            if (savedSources && savedSources.length > 0) {
                setSources(savedSources)
            }
        })

        // Charger la date de dernière sauvegarde
        window.electronAPI.store.getLastBackupDate().then((dateStr) => {
            if (dateStr) {
                setLastBackupDate(new Date(dateStr))
            }
        })

        // Écouter les événements de progression
        const unsubscribe = window.electronAPI.backup.onProgress((prog) => {
            setProgress(prog)
        })

        return () => { unsubscribe() }
    }, [])

    // Persister les sources quand elles changent
    useEffect(() => {
        if (!window.electronAPI || sources.length === 0) return
        window.electronAPI.store.setSources(sources)
    }, [sources])

    /**
     * Ajoute une nouvelle source via le dialogue natif
     */
    const handleAddSource = useCallback(async () => {
        if (!window.electronAPI) {
            console.warn('[SaveApp] Mode navigateur - dialogue non disponible')
            return
        }

        const folderPath = await window.electronAPI.dialog.selectFolder()
        if (!folderPath) return

        const folderName = folderPath.split('\\').pop() || folderPath

        // Calculer la taille du dossier
        const sizeResult = await window.electronAPI.folder.getSize(folderPath)
        const size = sizeResult.success ? sizeResult.size || 0 : 0

        setSources((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                path: folderPath,
                name: folderName,
                size,
            },
        ])
    }, [])

    /**
     * Supprime une source de la liste
     */
    const handleRemoveSource = useCallback((id: string) => {
        setSources((prev) => prev.filter((s) => s.id !== id))
    }, [])

    /**
     * Lance la sauvegarde
     */
    const handleStartBackup = useCallback(async () => {
        if (!window.electronAPI) {
            console.log('[SaveApp] Mode navigateur - simulation de sauvegarde')
            return
        }

        if (sources.length === 0) {
            console.warn('[SaveApp] Aucune source configurée')
            return
        }

        // Trouver une destination disponible OU demander à l'utilisateur
        let destinationPath = destinations.find((d) => d.available && d.path)?.path

        if (!destinationPath) {
            // Demander à l'utilisateur de choisir une destination
            const selectedPath = await window.electronAPI.dialog.selectFolder()
            if (!selectedPath) {
                console.log('[SaveApp] Sélection de destination annulée')
                return
            }
            destinationPath = selectedPath
        }

        setIsBackingUp(true)
        setIsPaused(false)
        setProgress(null)
        setLastResult(null)

        try {
            // Lancer la sauvegarde pour chaque source
            for (const source of sources) {
                console.log(`[SaveApp] Sauvegarde de ${source.name}...`)
                const result = await window.electronAPI.backup.start(source, destinationPath)
                setLastResult(result)

                if (!result.success || result.errors.length > 0) {
                    setShowErrorReport(true)
                }
            }

            setLastBackupDate(new Date())
        } catch (error) {
            console.error('[SaveApp] Erreur pendant la sauvegarde:', error)
        } finally {
            setIsBackingUp(false)
            setProgress(null)
        }
    }, [sources, destinations])

    /**
     * Met en pause / reprend la sauvegarde
     */
    const handlePauseResume = useCallback(() => {
        if (!window.electronAPI) return

        if (isPaused) {
            window.electronAPI.backup.resume()
            setIsPaused(false)
        } else {
            window.electronAPI.backup.pause()
            setIsPaused(true)
        }
    }, [isPaused])

    /**
     * Annule la sauvegarde en cours
     */
    const handleCancelBackup = useCallback(() => {
        if (!window.electronAPI) return

        window.electronAPI.backup.cancel()
        setIsBackingUp(false)
        setIsPaused(false)
        setProgress(null)
    }, [])

    // Calcul de l'état de sauvegarde
    const needsBackup =
        lastBackupDate === null ||
        new Date().getTime() - lastBackupDate.getTime() > 24 * 60 * 60 * 1000

    return (
        <div className="h-full flex flex-col bg-dark-950">
            <TitleBar />

            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    <Dashboard
                        needsBackup={needsBackup}
                        lastBackupDate={lastBackupDate}
                        isBackingUp={isBackingUp}
                        onStartBackup={handleStartBackup}
                    />

                    {isBackingUp && progress && (
                        <ProgressBar
                            progress={progress}
                            isPaused={isPaused}
                            onPause={handlePauseResume}
                            onCancel={handleCancelBackup}
                        />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SourcesList
                            sources={sources}
                            onAddSource={handleAddSource}
                            onRemoveSource={handleRemoveSource}
                        />
                        <DestinationsList destinations={destinations} />
                    </div>
                </div>
            </main>

            {/* Modal rapport d'erreurs */}
            {showErrorReport && lastResult && (
                <ErrorReport
                    result={lastResult}
                    onClose={() => setShowErrorReport(false)}
                />
            )}
        </div>
    )
}

export default App
