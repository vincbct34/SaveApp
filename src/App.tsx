import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import TitleBar from './components/TitleBar/TitleBar'
import Dashboard from './components/Dashboard/Dashboard'
import SourcesList from './components/SourcesList/SourcesList'
import DestinationsList from './components/DestinationsList/DestinationsList'
import ProgressBar from './components/ProgressBar/ProgressBar'
import ErrorReport from './components/ErrorReport/ErrorReport'
import ScheduleManager from './components/ScheduleManager/ScheduleManager'

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

export interface GoogleUserInfo {
    name: string
    email: string
    picture?: string
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
    const [showScheduleManager, setShowScheduleManager] = useState(false)

    // Sources et destinations

    // Sources et destinations
    const [sources, setSources] = useState<SourceFolder[]>([])
    const [isAddingSource, setIsAddingSource] = useState(false) // Loader pour l'ajout de source
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
    const [destinations, setDestinations] = useState<Destination[]>([
        { id: 'nas', type: 'nas', name: 'NAS Synology', path: '\\\\NAS\\Backups', available: false },
        { id: 'cloud', type: 'cloud', name: 'Google Drive', available: false },
    ])
    const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null)
    const [autoBackupDriveIds, setAutoBackupDriveIds] = useState<Set<string>>(new Set())

    // Cloud state
    const [isCloudConnected, setIsCloudConnected] = useState(false)
    const [isCloudConnecting, setIsCloudConnecting] = useState(false)
    const [cloudUser, setCloudUser] = useState<GoogleUserInfo | null>(null)

    // Ref pour savoir si le chargement initial est fait
    const hasLoadedRef = useRef(false)

    // Refs pour la logique d'auto-backup (accessibles dans les closures)
    const isBackingUpRef = useRef(false)
    const lastAutoBackupDriveIdRef = useRef<string | null>(null)
    const autoBackupDestinationRef = useRef<Destination | null>(null)

    // Synchroniser la ref isBackingUp
    useEffect(() => {
        isBackingUpRef.current = isBackingUp
    }, [isBackingUp])






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

        // Charger les autoBackupDriveIds persistés
        window.electronAPI.store.getAutoBackupIds().then((ids) => {
            if (ids) {
                setAutoBackupDriveIds(new Set(ids))
            }
        })

        // Charger la date de dernière sauvegarde
        window.electronAPI.store.getLastBackupDate().then((dateStr) => {
            if (dateStr) {
                setLastBackupDate(new Date(dateStr))
            }
        })

        // Charger l'état de connexion cloud
        window.electronAPI.cloud.isConnected().then((connected) => {
            setIsCloudConnected(connected)
            if (connected) {
                window.electronAPI.cloud.getUser().then((user) => {
                    setCloudUser(user)
                    // Marquer la destination cloud comme disponible
                    setDestinations((prev) =>
                        prev.map((d) =>
                            d.type === 'cloud' ? { ...d, available: true } : d
                        )
                    )
                })
            }
        })

        // Charger les lecteurs externes disponibles (USB + disques fixes non-C:)
        window.electronAPI.usb.getDrives().then((drives) => {
            // Inclure USB et disques fixes non-système
            const externalDrives = drives.filter((d) =>
                d.isReady && (d.type === 'usb' || (d.type === 'fixed' && d.letter !== 'C:'))
            )
            setDestinations((prev) => {
                // Garder les destinations non-USB + ajouter les lecteurs détectés
                const nonUsbDests = prev.filter((d) => d.type !== 'usb')
                const usbDests: Destination[] = externalDrives.map((d) => ({
                    id: d.id, // Utiliser l'ID unique
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
            // Inclure USB et disques fixes non-système
            const isExternal = drive.isReady && (drive.type === 'usb' || (drive.type === 'fixed' && drive.letter !== 'C:'))
            if (isExternal) {
                console.log(`[SaveApp] Lecteur externe connecté: ${drive.letter} (${drive.label}) ID: ${drive.id}`)
                toast.success(`Disque connecté : ${drive.label} (${drive.letter})`, {
                    id: `usb-connect-${drive.id}`,
                })

                // Mettre à jour la liste des destinations
                setDestinations((prev) => {
                    if (prev.some((d) => d.id === drive.id)) return prev
                    return [
                        {
                            id: drive.id,
                            type: 'usb',
                            name: `${drive.label} (${drive.letter})`,
                            path: drive.letter + '\\SaveApp_Backup',
                            available: true,
                        },
                        ...prev,
                    ]
                })

                // DÉCLENCHEMENT AUTO-BACKUP
                // On utilise le state setter pour avoir la valeur à jour de autoBackupDriveIds
                setAutoBackupDriveIds((currentAutoBackupIds) => {
                    // Check 1: Est-ce que ce drive est configuré pour l'auto-backup ?
                    if (currentAutoBackupIds.has(drive.id)) {

                        // Check 2: Est-ce qu'un backup est déjà en cours ?
                        if (isBackingUpRef.current) {
                            console.log(`[SaveApp] ⚠️ Auto-backup ignoré pour ${drive.label} (Backup déjà en cours)`)
                            return currentAutoBackupIds
                        }

                        // Check 3: Est-ce qu'on vient juste de lancer un backup pour ce drive ?
                        // (Protection anti-rebond si le drive se déco/reco rapidement)
                        if (lastAutoBackupDriveIdRef.current === drive.id) {
                            console.log(`[SaveApp] ⚠️ Auto-backup ignoré pour ${drive.label} (Déjà déclenché récemment)`)
                            return currentAutoBackupIds
                        }

                        console.log(`[SaveApp] ⚡ Auto-backup déclenché pour ${drive.label}`)
                        toast.info(`Auto-backup détecté pour ${drive.label}...`, {
                            id: `auto-backup-${drive.id}`,
                        })

                        lastAutoBackupDriveIdRef.current = drive.id

                        // Préparer la destination pour le backup synchrone
                        autoBackupDestinationRef.current = {
                            id: drive.id,
                            type: 'usb',
                            name: `${drive.label} (${drive.letter})`,
                            path: drive.letter + '\\SaveApp_Backup', // Chemin forcé pour l'auto-backup
                            available: true
                        }

                        // Délai pour s'assurer que le disque est prêt (1.5s)
                        setTimeout(() => {
                            // Sélectionner aussi dans l'UI pour la cohérence visuelle
                            setSelectedDestinationId(drive.id)

                            // Déclencher le backup via click simulé
                            const backupButton = document.getElementById('start-backup-btn')
                            if (backupButton) {
                                backupButton.click()
                            }
                        }, 1500)
                    }
                    return currentAutoBackupIds
                })
            }
        })

        // Écouter les débranchements
        const unsubDisconnected = window.electronAPI.usb.onDriveDisconnected((drive) => {
            console.log(`[SaveApp] USB déconnecté: ${drive.letter}`)
            toast('Disque déconnecté', {
                description: `${drive.label} (${drive.letter})`,
                id: `usb-disconnect-${drive.id}`,
            })

            setDestinations((prev) => prev.filter((d) => d.id !== drive.id)) // Utiliser l'ID

            // Reset du flag anti-rebond si le drive est déconnecté
            if (lastAutoBackupDriveIdRef.current === drive.id) {
                lastAutoBackupDriveIdRef.current = null
            }
        })

        // Écouter les événements de progression
        const unsubProgress = window.electronAPI.backup.onProgress((prog) => {
            setProgress(prog)
        })

        // Écouter les tâches planifiées
        const unsubScheduler = window.electronAPI.scheduler.onRun(async (schedule) => {
            console.log(`[SaveApp] Exécution de la tâche planifiée : ${schedule.name}`)
            toast.info(`Démarrage de la tâche planifiée : ${schedule.name}`, { duration: 5000 })

            // Vérifier si un backup est déjà en cours
            if (isBackingUpRef.current) {
                console.warn('[SaveApp] Tâche ignorée car un backup est déjà en cours')
                toast.warning(`Tâche "${schedule.name}" reportée : backup en cours`)
                return
            }

            // Simuler le déclenchement
            // On le fait via un custom event ou directement en appelant une fonction dédiée
            // Ici on va utiliser le trick du bouton caché ou une ref, mais le mieux est d'appeler handleStartBackup
            // Cependant handleStartBackup dépend de l'état UI sélectionné.
            // Il faut une fonction separated pour lancer un backup programmatique.

            // Pour l'instant, on va set les sources/destinations requises et trigger
            // Note: Cela va changer la sélection UI de l'utilisateur, ce qui est acceptable pour l'instant

            // 1. Set sources
            setSelectedSourceIds(new Set(schedule.sourceIds))

            // 2. Set destination
            setSelectedDestinationId(schedule.destinationId)

            // 3. Attendre que le state se propage puis lancer
            // On utilise un timeout pour laisser React faire son rendu
            setTimeout(() => {
                const startBtn = document.getElementById('start-backup-btn')
                if (startBtn) startBtn.click()
            }, 500)
        })

        return () => {
            unsubConnected()
            unsubDisconnected()
            unsubProgress()
            unsubScheduler()
            if (window.electronAPI) {
                window.electronAPI.usb.stopWatching()
            }
        }
    }, [])

    // Persister les sources quand elles changent (après le chargement initial)
    useEffect(() => {
        if (!window.electronAPI || !hasLoadedRef.current) return
        window.electronAPI.store.setSources(sources)
    }, [sources])

    // Persister les préférences d'auto-backup
    useEffect(() => {
        if (!window.electronAPI || !hasLoadedRef.current) return
        window.electronAPI.store.setAutoBackupIds(Array.from(autoBackupDriveIds))
    }, [autoBackupDriveIds])

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

        setIsAddingSource(true) // Loader ON

        try {
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
            toast.success('Source ajoutée avec succès', { id: 'source-add-success' })
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors de l'ajout de la source", { id: 'source-add-error' })
        } finally {
            setIsAddingSource(false) // Loader OFF
        }
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
     * Toggle l'auto-backup pour une destination
     */
    /**
     * Toggle l'auto-backup pour une destination
     */
    const handleToggleAutoBackup = useCallback((id: string) => {
        const next = new Set(autoBackupDriveIds)
        if (next.has(id)) {
            next.delete(id)
            toast('Auto-backup désactivé pour ce disque', {
                id: `auto-backup-disabled-${id}`,
            })
        } else {
            next.add(id)
            toast.success('Auto-backup activé pour ce disque', {
                id: `auto-backup-enabled-${id}`,
            })
        }
        setAutoBackupDriveIds(next)
    }, [autoBackupDriveIds])

    /**
     * Connecte à Google Drive
     */
    const handleCloudConnect = useCallback(async () => {
        if (!window.electronAPI) return

        setIsCloudConnecting(true)
        try {
            const result = await window.electronAPI.cloud.connect()
            if (result.success && result.user) {
                setIsCloudConnected(true)
                setCloudUser(result.user)
                setDestinations((prev) =>
                    prev.map((d) =>
                        d.type === 'cloud' ? { ...d, available: true } : d
                    )
                )
                toast.success(`Connecté à Google Drive (${result.user.email})`)
            } else {
                toast.error(result.error || 'Erreur de connexion')
            }
        } catch (error) {
            console.error('[SaveApp] Erreur connexion cloud:', error)
            toast.error('Erreur lors de la connexion à Google Drive')
        } finally {
            setIsCloudConnecting(false)
        }
    }, [])

    /**
     * Déconnecte de Google Drive
     */
    const handleCloudDisconnect = useCallback(async () => {
        if (!window.electronAPI) return

        try {
            await window.electronAPI.cloud.disconnect()
            setIsCloudConnected(false)
            setCloudUser(null)
            setDestinations((prev) =>
                prev.map((d) =>
                    d.type === 'cloud' ? { ...d, available: false } : d
                )
            )
            // Désélectionner si c'était sélectionné
            setSelectedDestinationId((prev) => prev === 'cloud' ? null : prev)
            toast('Déconnecté de Google Drive')
        } catch (error) {
            console.error('[SaveApp] Erreur déconnexion cloud:', error)
            toast.error('Erreur lors de la déconnexion')
        }
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

            setIsAddingSource(true)
            try {
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
                toast.success('Source ajoutée', { id: 'source-add-adhoc' })
            } finally {
                setIsAddingSource(false)
            }
        }

        // ÉTAPE 2 : Vérifier la destination sélectionnée
        const selectedDest = destinations.find((d) => d.id === selectedDestinationId && d.available)
        const isCloudBackup = selectedDest?.type === 'cloud'
        let destinationPath: string | null = null

        // Priorité 1 : Destination définie par l'auto-backup (via ref pour contourner l'async state)
        if (autoBackupDestinationRef.current) {
            destinationPath = autoBackupDestinationRef.current.path || null
            console.log(`[SaveApp] Auto-Backup Destination: ${autoBackupDestinationRef.current.name}`)
            // Reset de la ref pour les prochains backups manuels
            autoBackupDestinationRef.current = null
        } else if (isCloudBackup) {
            // Backup vers Google Drive - pas besoin de chemin
            console.log('[SaveApp] Destination cloud sélectionnée')
        } else if (selectedDest && selectedDest.path) {
            // Destination locale sélectionnée dans l'UI
            destinationPath = selectedDest.path
            console.log(`[SaveApp] Destination sélectionnée: ${selectedDest.name}`)
        } else {
            // Demander via dialogue
            destinationPath = await window.electronAPI.dialog.selectDestination()
            if (!destinationPath) {
                console.log('[SaveApp] Sélection de destination annulée')
                return
            }
        }

        if (!isCloudBackup && !destinationPath) {
            console.error('[SaveApp] Destination invalide (null)')
            toast.error('Impossible de démarrer : Destination invalide')
            return
        }

        // ÉTAPE 3 : Lancer la sauvegarde
        setIsBackingUp(true)
        setIsPaused(false)
        setProgress(null)
        setLastResult(null)

        toast.info(isCloudBackup ? 'Upload vers Google Drive...' : 'Démarrage de la sauvegarde...', { id: 'backup-start' })

        try {
            for (const source of sourcesToBackup) {
                console.log(`[SaveApp] Sauvegarde de ${source.name}...`)

                let result
                if (isCloudBackup) {
                    // Upload vers Google Drive
                    result = await window.electronAPI.cloud.upload(source)
                    // Adapter le format de résultat pour l'affichage
                    setLastResult({
                        success: result.success,
                        filesCreated: result.filesUploaded,
                        filesUpdated: 0,
                        filesDeleted: 0,
                        bytesTransferred: result.bytesTransferred,
                        errors: result.errors.map((e: { file: string; error: string }) => ({ ...e, code: 'CLOUD' })),
                        duration: result.duration,
                    })
                } else {
                    result = await window.electronAPI.backup.start(source, destinationPath!)
                    setLastResult(result)
                }

                if (!result.success || result.errors.length > 0) {
                    setShowErrorReport(true)
                    toast.error(`Erreur de sauvegarde pour ${source.name}`, {
                        id: `backup-error-${source.id}`,
                    })
                } else {
                    toast.success(isCloudBackup ? `Upload terminé : ${source.name}` : `Sauvegarde terminée : ${source.name}`, {
                        id: `backup-success-${source.id}`,
                    })
                }
            }

            setLastBackupDate(new Date())
        } catch (error) {
            console.error('[SaveApp] Erreur pendant la sauvegarde:', error)
            toast.error('Erreur critique pendant la sauvegarde', {
                id: 'backup-critical',
            })
        } finally {
            setIsBackingUp(false)
            setProgress(null)
        }
    }, [sources, selectedSourceIds, destinations, selectedDestinationId])

    /**
     * Met en pause / reprend la sauvegarde
     */
    const handlePauseResume = useCallback(() => {
        if (!window.electronAPI) return

        if (isPaused) {
            window.electronAPI.backup.resume()
            setIsPaused(false)
            toast('Sauvegarde reprise', { id: 'backup-resume' })
        } else {
            window.electronAPI.backup.pause()
            setIsPaused(true)
            toast('Sauvegarde en pause', { id: 'backup-pause' })
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
        toast.error('Sauvegarde annulée', { id: 'backup-cancelled' })
    }, [])

    // Calcul de l'état de sauvegarde
    const needsBackup =
        lastBackupDate === null ||
        new Date().getTime() - lastBackupDate.getTime() > 24 * 60 * 60 * 1000

    return (
        <div className="h-full flex flex-col bg-dark-950">
            <Toaster position="top-center" richColors theme="dark" />
            <TitleBar />

            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowScheduleManager(true)}
                            className="text-sm text-gray-400 hover:text-white underline underline-offset-4 decoration-dashed"
                        >
                            Gérer les tâches planifiées
                        </button>
                    </div>

                    <Dashboard
                        needsBackup={needsBackup}
                        lastBackupDate={lastBackupDate}
                        isBackingUp={isBackingUp}
                        onStartBackup={handleStartBackup}
                    />

                    {/* Bouton caché pour déclenchement auto */}
                    <button id="start-backup-btn" className="hidden" onClick={handleStartBackup}>Trigger</button>

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
                            isAddingSource={isAddingSource}
                        // Passer l'état de chargement (si le composant le supporte, sinon on l'ajoutera)
                        />
                        <DestinationsList
                            destinations={destinations}
                            selectedId={selectedDestinationId}
                            onSelectDestination={setSelectedDestinationId}
                            autoBackupIds={autoBackupDriveIds}
                            onToggleAutoBackup={handleToggleAutoBackup}
                            isCloudConnected={isCloudConnected}
                            cloudUser={cloudUser}
                            isCloudConnecting={isCloudConnecting}
                            onCloudConnect={handleCloudConnect}
                            onCloudDisconnect={handleCloudDisconnect}
                        />
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

            <ScheduleManager
                isOpen={showScheduleManager}
                onClose={() => setShowScheduleManager(false)}
                sources={sources}
                destinations={destinations}
            />
        </div>
    )
}

export default App
