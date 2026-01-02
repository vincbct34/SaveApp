import { useState } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import Dashboard from './components/Dashboard/Dashboard'
import SourcesList from './components/SourcesList/SourcesList'
import DestinationsList from './components/DestinationsList/DestinationsList'
import ProgressBar from './components/ProgressBar/ProgressBar'

/**
 * Types pour les sources et destinations
 */
export interface SourceFolder {
    id: string
    path: string
    name: string
    size: number // en bytes
}

export interface Destination {
    id: string
    type: 'usb' | 'nas' | 'cloud'
    name: string
    path?: string
    available: boolean
}

/**
 * Composant principal de l'application SaveApp
 */
function App() {
    // État de la sauvegarde
    const [isBackingUp, setIsBackingUp] = useState(false)
    const [backupProgress, setBackupProgress] = useState(0)
    const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null)

    // Sources à sauvegarder (données de démo pour Phase 1)
    const [sources, setSources] = useState<SourceFolder[]>([
        { id: '1', path: 'C:\\Users\\Papa\\Travail', name: 'Travail', size: 2.5 * 1024 * 1024 * 1024 },
        { id: '2', path: 'C:\\Users\\Papa\\Documents\\Factures', name: 'Factures', size: 150 * 1024 * 1024 },
    ])

    // Destinations configurées (données de démo pour Phase 1)
    const [destinations] = useState<Destination[]>([
        { id: '1', type: 'usb', name: 'Disque Backup (D:)', path: 'D:\\', available: true },
        { id: '2', type: 'nas', name: 'NAS Synology', path: '\\\\NAS\\Backups', available: false },
        { id: '3', type: 'cloud', name: 'Google Drive', available: false },
    ])

    /**
     * Ajoute une nouvelle source via le dialogue natif
     */
    const handleAddSource = async () => {
        if (!window.electronAPI) {
            console.warn('[SaveApp] Mode navigateur - dialogue non disponible')
            return
        }
        const folderPath = await window.electronAPI.dialog.selectFolder()
        if (folderPath) {
            const folderName = folderPath.split('\\').pop() || folderPath
            setSources((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    path: folderPath,
                    name: folderName,
                    size: 0, // TODO: calculer la taille réelle en Phase 2
                },
            ])
        }
    }

    /**
     * Supprime une source de la liste
     */
    const handleRemoveSource = (id: string) => {
        setSources((prev) => prev.filter((s) => s.id !== id))
    }

    /**
     * Lance la sauvegarde
     */
    const handleStartBackup = async () => {
        setIsBackingUp(true)
        setBackupProgress(0)

        // Simulation de progression pour Phase 1
        const interval = setInterval(() => {
            setBackupProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    return 100
                }
                return prev + 10
            })
        }, 300)

        // Appel IPC (juste un log pour Phase 1)
        if (window.electronAPI) {
            const result = await window.electronAPI.backup.start()
            console.log('[SaveApp] Résultat:', result)
        } else {
            console.log('[SaveApp] Mode navigateur - simulation de sauvegarde')
        }

        // Fin de la simulation
        setTimeout(() => {
            clearInterval(interval)
            setIsBackingUp(false)
            setBackupProgress(100)
            setLastBackupDate(new Date())
        }, 3500)
    }

    /**
     * Annule la sauvegarde en cours
     */
    const handleCancelBackup = () => {
        setIsBackingUp(false)
        setBackupProgress(0)
    }

    // Calcul de l'état de sauvegarde
    const needsBackup = lastBackupDate === null ||
        (new Date().getTime() - lastBackupDate.getTime()) > 24 * 60 * 60 * 1000 // Plus de 24h

    return (
        <div className="h-full flex flex-col bg-dark-950">
            {/* Barre de titre personnalisée */}
            <TitleBar />

            {/* Contenu principal */}
            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Dashboard - État de la sauvegarde */}
                    <Dashboard
                        needsBackup={needsBackup}
                        lastBackupDate={lastBackupDate}
                        isBackingUp={isBackingUp}
                        onStartBackup={handleStartBackup}
                    />

                    {/* Barre de progression (visible pendant la sauvegarde) */}
                    {isBackingUp && (
                        <ProgressBar
                            progress={backupProgress}
                            onCancel={handleCancelBackup}
                        />
                    )}

                    {/* Section Sources et Destinations */}
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
        </div>
    )
}

export default App
