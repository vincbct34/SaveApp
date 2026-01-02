import type { SourceFolder } from '../../App'

interface SourcesListProps {
    sources: SourceFolder[]
    onAddSource: () => void
    onRemoveSource: (id: string) => void
}

/**
 * Liste des dossiers sources à sauvegarder
 * Affiche le chemin et la taille de chaque dossier
 */
function SourcesList({ sources, onAddSource, onRemoveSource }: SourcesListProps) {
    /**
     * Formate la taille en format lisible (Ko, Mo, Go)
     */
    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '—'
        const units = ['o', 'Ko', 'Mo', 'Go', 'To']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
    }

    /**
     * Calcule la taille totale de toutes les sources
     */
    const totalSize = sources.reduce((acc, s) => acc + s.size, 0)

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-dark-100">Sources</h2>
                        <p className="text-sm text-dark-400">{sources.length} dossier{sources.length > 1 ? 's' : ''} • {formatSize(totalSize)}</p>
                    </div>
                </div>

                {/* Bouton ajouter */}
                <button
                    onClick={onAddSource}
                    className="w-9 h-9 rounded-lg bg-dark-800 hover:bg-dark-700 flex items-center justify-center transition-colors"
                    title="Ajouter un dossier"
                >
                    <svg className="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Liste des sources */}
            <div className="space-y-2">
                {sources.length === 0 ? (
                    <div className="text-center py-8 text-dark-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <p>Aucun dossier configuré</p>
                        <button
                            onClick={onAddSource}
                            className="mt-3 text-primary-400 hover:text-primary-300 text-sm font-medium"
                        >
                            + Ajouter votre premier dossier
                        </button>
                    </div>
                ) : (
                    sources.map((source) => (
                        <div
                            key={source.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 hover:bg-dark-800 transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-dark-200 truncate">{source.name}</p>
                                <p className="text-sm text-dark-500 truncate">{source.path}</p>
                            </div>

                            <span className="text-sm text-dark-400 flex-shrink-0">
                                {formatSize(source.size)}
                            </span>

                            <button
                                onClick={() => onRemoveSource(source.id)}
                                className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 flex items-center justify-center transition-all"
                                title="Supprimer"
                            >
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </section>
    )
}

export default SourcesList
