interface ProgressBarProps {
    progress: number // 0-100
    onCancel: () => void
    onPause?: () => void
    isPaused?: boolean
}

/**
 * Barre de progression de la sauvegarde
 * Affiche le pourcentage et l'estimation du temps restant
 */
function ProgressBar({ progress, onCancel, onPause, isPaused = false }: ProgressBarProps) {
    /**
     * Estime le temps restant (simulation pour Phase 1)
     */
    const estimatedTime = (): string => {
        if (progress >= 100) return 'Terminé'
        if (progress < 5) return 'Calcul en cours...'

        // Simulation : on suppose 3s pour 100%
        const remainingPercent = 100 - progress
        const secondsRemaining = Math.ceil((remainingPercent / 100) * 30)

        if (secondsRemaining < 60) return `${secondsRemaining} secondes restantes`
        const minutes = Math.ceil(secondsRemaining / 60)
        return `${minutes} minute${minutes > 1 ? 's' : ''} restante${minutes > 1 ? 's' : ''}`
    }

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* En-tête avec infos */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-dark-100">Sauvegarde en cours</h3>
                    <p className="text-sm text-dark-400">{estimatedTime()}</p>
                </div>
                <span className="text-2xl font-bold text-primary-400">{progress}%</span>
            </div>

            {/* Barre de progression */}
            <div className="relative h-3 bg-dark-800 rounded-full overflow-hidden mb-4">
                {/* Progression */}
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />

                {/* Effet shimmer */}
                <div
                    className="absolute inset-y-0 left-0 progress-shimmer rounded-full"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Fichier en cours (simulation) */}
            <p className="text-sm text-dark-500 truncate mb-4">
                📄 Copie : Documents/Factures/facture_2024_janvier.pdf
            </p>

            {/* Boutons d'action */}
            <div className="flex gap-3">
                {onPause && (
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
                )}

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
