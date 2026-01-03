import type { SourceFolder } from '../../App'

interface SourcesListProps {
    sources: SourceFolder[]
    selectedIds: Set<string>
    onAddSource: () => void
    onRemoveSource: (id: string) => void
    onToggleSource: (id: string) => void
    isAddingSource?: boolean
}

/**
 * Liste des dossiers sources à sauvegarder
 * Permet de sélectionner quels dossiers inclure dans la sauvegarde
 */
function SourcesList({
    sources,
    selectedIds,
    onAddSource,
    onRemoveSource,
    onToggleSource,
    isAddingSource = false,
}: SourcesListProps) {
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
     * Calcule la taille totale des sources sélectionnées
     */
    const selectedSources = sources.filter((s) => selectedIds.has(s.id))
    const totalSize = selectedSources.reduce((acc, s) => acc + s.size, 0)

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold mb-1">Sources</h2>
                    <div className="text-sm text-gray-400">
                        Total sélectionné : <span className="text-white font-medium">{formatSize(totalSize)}</span>
                    </div>
                </div>

                {/* Bouton ajouter */}
                <button
                    onClick={onAddSource}
                    disabled={isAddingSource}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${isAddingSource
                        ? 'bg-dark-800 text-gray-400 cursor-wait'
                        : 'bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/20 active:scale-95'
                        }`}
                >
                    {isAddingSource ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Ajout...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Ajouter</span>
                        </>
                    )}
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
                    sources.map((source) => {
                        const isSelected = selectedIds.has(source.id)
                        return (
                            <div
                                key={source.id}
                                onClick={() => onToggleSource(source.id)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group ${isSelected
                                    ? 'bg-primary-500/10 border-2 border-primary-500/50'
                                    : 'bg-dark-800/50 hover:bg-dark-800 border-2 border-transparent'
                                    }`}
                            >
                                {/* Checkbox visuelle */}
                                <div
                                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-dark-700 border border-dark-600'
                                        }`}
                                >
                                    {isSelected && (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>

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
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRemoveSource(source.id)
                                    }}
                                    className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 flex items-center justify-center transition-all"
                                    title="Supprimer"
                                >
                                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        )
                    })
                )}
            </div>
        </section>
    )
}

export default SourcesList
