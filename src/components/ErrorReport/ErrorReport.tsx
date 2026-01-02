import type { SyncResult } from '../../App'

interface ErrorReportProps {
    result: SyncResult
    onClose: () => void
}

/**
 * Formate une durée en millisecondes vers une chaîne lisible
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds} seconde${seconds > 1 ? 's' : ''}`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes} min ${remainingSeconds}s`
}

/**
 * Formate une taille en bytes
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 o'
    const units = ['o', 'Ko', 'Mo', 'Go', 'To']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * Modal affichant le rapport de sauvegarde avec erreurs éventuelles
 */
function ErrorReport({ result, onClose }: ErrorReportProps) {
    const hasErrors = result.errors.length > 0

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-dark-900 rounded-2xl border border-dark-800 max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                {/* En-tête */}
                <div className={`p-6 border-b border-dark-800 ${hasErrors ? 'bg-warning-500/10' : 'bg-success-500/10'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasErrors ? 'bg-warning-500/20' : 'bg-success-500/20'
                            }`}>
                            {hasErrors ? (
                                <svg className="w-6 h-6 text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${hasErrors ? 'text-warning-400' : 'text-success-400'}`}>
                                {hasErrors ? 'Sauvegarde terminée avec avertissements' : 'Sauvegarde réussie !'}
                            </h2>
                            <p className="text-dark-400 text-sm">Durée : {formatDuration(result.duration)}</p>
                        </div>
                    </div>
                </div>

                {/* Statistiques */}
                <div className="p-6 border-b border-dark-800">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-primary-400">{result.filesCreated}</p>
                            <p className="text-sm text-dark-400">Créés</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-primary-400">{result.filesUpdated}</p>
                            <p className="text-sm text-dark-400">Mis à jour</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-dark-400">{result.filesDeleted}</p>
                            <p className="text-sm text-dark-400">Supprimés</p>
                        </div>
                    </div>
                    <p className="text-center text-sm text-dark-500 mt-3">
                        {formatBytes(result.bytesTransferred)} transférés
                    </p>
                </div>

                {/* Liste des erreurs */}
                {hasErrors && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-sm font-semibold text-warning-400 mb-3">
                            {result.errors.length} fichier(s) ignoré(s)
                        </h3>
                        <div className="space-y-2">
                            {result.errors.map((error, index) => (
                                <div
                                    key={index}
                                    className="p-3 rounded-lg bg-dark-800/50 border border-dark-700"
                                >
                                    <p className="text-sm text-dark-200 truncate">{error.file}</p>
                                    <p className="text-xs text-dark-500 mt-1">
                                        <span className="text-warning-400">[{error.code}]</span> {error.error}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bouton fermer */}
                <div className="p-6 border-t border-dark-800">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ErrorReport
