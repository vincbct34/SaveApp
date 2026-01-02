import type { SyncProgress } from '../../App'

interface ProgressBarProps {
    progress: SyncProgress
    isPaused: boolean
    onPause: () => void
    onCancel: () => void
}

/**
 * Formate une taille en bytes vers une chaîne lisible
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 o'
    const units = ['o', 'Ko', 'Mo', 'Go', 'To']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * Estime le temps restant basé sur la progression
 */
function estimateTimeRemaining(progress: SyncProgress): string {
    if (progress.percent >= 100) return 'Terminé'
    if (progress.percent < 5) return 'Calcul en cours...'

    // Estimation basée sur les fichiers traités
    const remainingFiles = progress.totalFiles - progress.processedFiles
    const avgTimePerFile = 0.1 // Estimation : 100ms par fichier en moyenne
    const secondsRemaining = Math.ceil(remainingFiles * avgTimePerFile)

    if (secondsRemaining < 60) return `${secondsRemaining} secondes restantes`
    const minutes = Math.ceil(secondsRemaining / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} restante${minutes > 1 ? 's' : ''}`
}

/**
 * Retourne le label de la phase actuelle
 */
function getPhaseLabel(phase: SyncProgress['phase']): string {
    switch (phase) {
        case 'scanning':
            return 'Analyse des fichiers...'
        case 'comparing':
            return 'Comparaison source/destination...'
        case 'copying':
            return 'Copie des fichiers...'
        case 'deleting':
            return 'Nettoyage des fichiers obsolètes...'
        case 'done':
            return 'Terminé !'
        case 'error':
            return 'Erreur'
        default:
            return 'En cours...'
    }
}

/**
 * Barre de progression de la sauvegarde avec données réelles
 */
function ProgressBar({ progress, isPaused, onPause, onCancel }: ProgressBarProps) {
    const { phase, percent, currentFile, totalBytes, copiedBytes, processedFiles, totalFiles, errors } = progress

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* En-tête avec infos */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-dark-100">{getPhaseLabel(phase)}</h3>
                    <p className="text-sm text-dark-400">{estimateTimeRemaining(progress)}</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-primary-400">{percent}%</span>
                    {errors.length > 0 && (
                        <p className="text-xs text-warning-400">{errors.length} fichier(s) ignoré(s)</p>
                    )}
                </div>
            </div>

            {/* Barre de progression */}
            <div className="relative h-3 bg-dark-800 rounded-full overflow-hidden mb-4">
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out ${phase === 'error'
                            ? 'bg-red-500'
                            : 'bg-gradient-to-r from-primary-600 to-primary-400'
                        }`}
                    style={{ width: `${percent}%` }}
                />
                {phase === 'copying' && (
                    <div
                        className="absolute inset-y-0 left-0 progress-shimmer rounded-full"
                        style={{ width: `${percent}%` }}
                    />
                )}
            </div>

            {/* Stats détaillées */}
            <div className="flex items-center justify-between text-sm text-dark-400 mb-4">
                <span>{processedFiles} / {totalFiles} fichiers</span>
                <span>{formatBytes(copiedBytes)} / {formatBytes(totalBytes)}</span>
            </div>

            {/* Fichier en cours */}
            {currentFile && phase === 'copying' && (
                <p className="text-sm text-dark-500 truncate mb-4">
                    📄 {currentFile}
                </p>
            )}

            {/* Boutons d'action */}
            <div className="flex gap-3">
                <button
                    onClick={onPause}
                    className="flex-1 py-2.5 rounded-xl font-medium bg-dark-800 hover:bg-dark-700 text-dark-300 transition-colors flex items-center justify-center gap-2"
                >
                    {isPaused ? (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            Reprendre
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pause
                        </>
                    )}
                </button>

                <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Annuler
                </button>
            </div>
        </section>
    )
}

export default ProgressBar
