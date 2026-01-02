import { useState, useEffect, useCallback, useRef } from 'react'
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
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
    const [destinations, setDestinations] = useState<Destination[]>([
        { id: 'nas', type: 'nas', name: 'NAS Synology', path: '\\\\NAS\\Backups', available: false },
        { id: 'cloud', type: 'cloud', name: 'Google Drive', available: false },
    ])

    // Ref pour savoir si le chargement initial est fait
    const hasLoadedRef = useRef(false)

    // Charger les données persistées au démarrage + USB
    useEffect(() => {
        if (!window.electronAPI) return

        // Charger les sources sauvegardées
        window.electronAPI.store.getSources().then((savedSources) => {
            if (savedSources) {
                setSources(savedSources)
            }
            hasLoadedRef.current = true
        })

        // Charger la date de dernière sauvegarde
        window.electronAPI.store.getLastBackupDate().then((dateStr) => {
            if (dateStr) {
                setLastBackupDate(new Date(dateStr))
            }
        })

        // Charger les lecteurs USB disponibles
        window.electronAPI.usb.getDrives().then((drives) => {
            const usbDrives = drives.filter((d) => d.type === 'usb' && d.isReady)
            setDestinations((prev) => {
                // Garder les destinations non-USB + ajouter les USB détectés
                const nonUsbDests = prev.filter((d) => d.type !== 'usb')
                const usbDests: Destination[] = usbDrives.map((d) => ({
                    id: `usb-${d.letter}`,
                    type: 'usb',
                    name: `${d.label} (${d.letter})`,
                    path: d.letter + '\\SaveApp_Backup',
                    available: true,
                }))
                return [...usbDests, ...nonUsbDests]
            })
        })

        // Démarrer la surveillance USB
        window.electronAPI.usb.startWatching()

        // Écouter les branchements
        const unsubConnected = window.electronAPI.usb.onDriveConnected((drive) => {
            if (drive.type === 'usb' && drive.isReady) {
                console.log(`[SaveApp] USB connecté: ${drive.letter} (${drive.label})`)
                setDestinations((prev) => {
                    // Vérifier si déjà présent
                    if (prev.some((d) => d.id === `usb-${drive.letter}`)) return prev
                    return [
                        {
                            id: `usb-${drive.letter}`,
                            type: 'usb',
                            name: `${drive.label} (${drive.letter})`,
                            path: drive.letter + '\\SaveApp_Backup',
                            available: true,
                        },
                        ...prev,
                    ]
                })
            }
        })

        // Écouter les débranchements
        const unsubDisconnected = window.electronAPI.usb.onDriveDisconnected((drive) => {
            console.log(`[SaveApp] USB déconnecté: ${drive.letter}`)
            setDestinations((prev) => prev.filter((d) => d.id !== `usb-${drive.letter}`))
        })

        // Écouter les événements de progression
        const unsubProgress = window.electronAPI.backup.onProgress((prog) => {
            setProgress(prog)
        })

        return () => {
            unsubConnected()
            unsubDisconnected()
            unsubProgress()
            window.electronAPI?.usb.stopWatching()
        }
    }, [])

    // Persister les sources quand elles changent (après le chargement initial)
    useEffect(() => {
        if (!window.electronAPI) return
        if (!hasLoadedRef.current) {
            // Premier rendu - ne pas persister, on attend le chargement
            return
        }
        // Persister même si la liste est vide (pour permettre la suppression)
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

        const newId = Date.now().toString()
        setSources((prev) => [
            ...prev,
            {
                id: newId,
                path: folderPath,
                name: folderName,
                size,
            },
        ])
        // Auto-sélectionner la nouvelle source
        setSelectedSourceIds((prev) => new Set([...prev, newId]))
    }, [])

    /**
     * Supprime une source de la liste
     */
    const handleRemoveSource = useCallback((id: string) => {
        setSources((prev) => prev.filter((s) => s.id !== id))
        // Retirer de la sélection aussi
        setSelectedSourceIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }, [])

    /**
     * Toggle la sélection d'une source
     */
    const handleToggleSource = useCallback((id: string) => {
        setSelectedSourceIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    /**
     * Lance la sauvegarde (avec flux guidé)
     */
    const handleStartBackup = useCallback(async () => {
        if (!window.electronAPI) {
            console.log('[SaveApp] Mode navigateur - simulation de sauvegarde')
            return
        }

        // Récupérer les sources sélectionnées
        let sourcesToBackup = sources.filter((s) => selectedSourceIds.has(s.id))

        // ÉTAPE 1 : Si aucune source sélectionnée, demander d'en ajouter une
        if (sourcesToBackup.length === 0) {
            const folderPath = await window.electronAPI.dialog.selectFolder()
            if (!folderPath) {
                console.log('[SaveApp] Sélection de source annulée')
                return
            }

            const folderName = folderPath.split('\\').pop() || folderPath
            const sizeResult = await window.electronAPI.folder.getSize(folderPath)
            const size = sizeResult.success ? sizeResult.size || 0 : 0

            const newId = Date.now().toString()
            const newSource = {
                id: newId,
                path: folderPath,
                name: folderName,
                size,
            }

            // Ajouter à la liste, sélectionner, et utiliser pour cette sauvegarde
            setSources((prev) => [...prev, newSource])
            setSelectedSourceIds((prev) => new Set([...prev, newId]))
            sourcesToBackup = [newSource]
        }

        // ÉTAPE 2 : Sélectionner une destination
        // (pour l'instant on demande toujours, la Phase 3 ajoutera la détection USB)
        const destinationPath = await window.electronAPI.dialog.selectDestination()
        if (!destinationPath) {
            console.log('[SaveApp] Sélection de destination annulée')
            return
        }

        // ÉTAPE 3 : Lancer la sauvegarde
        setIsBackingUp(true)
        setIsPaused(false)
        setProgress(null)
        setLastResult(null)

        try {
            for (const source of sourcesToBackup) {
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
    }, [sources, selectedSourceIds])

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
                            selectedIds={selectedSourceIds}
                            onAddSource={handleAddSource}
                            onRemoveSource={handleRemoveSource}
                            onToggleSource={handleToggleSource}
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
