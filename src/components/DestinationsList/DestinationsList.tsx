import type { Destination } from '../../App'

interface DestinationsListProps {
    destinations: Destination[]
}

/**
 * Liste des destinations de sauvegarde
 * Affiche USB, NAS et Cloud avec indicateur de disponibilité
 */
function DestinationsList({ destinations }: DestinationsListProps) {
    /**
     * Retourne l'icône correspondant au type de destination
     */
    const getIcon = (type: Destination['type']) => {
        switch (type) {
            case 'usb':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                )
            case 'nas':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                )
            case 'cloud':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                )
        }
    }

    /**
     * Retourne le label du type de destination
     */
    const getTypeLabel = (type: Destination['type']) => {
        switch (type) {
            case 'usb': return 'Disque externe'
            case 'nas': return 'NAS / Réseau'
            case 'cloud': return 'Cloud'
        }
    }

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-dark-100">Destinations</h2>
                        <p className="text-sm text-dark-400">
                            {destinations.filter(d => d.available).length}/{destinations.length} disponible{destinations.filter(d => d.available).length > 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Bouton ajouter */}
                <button
                    className="w-9 h-9 rounded-lg bg-dark-800 hover:bg-dark-700 flex items-center justify-center transition-colors"
                    title="Ajouter une destination"
                >
                    <svg className="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Liste des destinations */}
            <div className="space-y-2">
                {destinations.map((dest) => (
                    <div
                        key={dest.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${dest.available
                                ? 'bg-dark-800/50 hover:bg-dark-800'
                                : 'bg-dark-800/20 opacity-60'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dest.available ? 'bg-success-500/20 text-success-400' : 'bg-dark-700 text-dark-500'
                            }`}>
                            {getIcon(dest.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-dark-200 truncate">{dest.name}</p>
                            <p className="text-sm text-dark-500">{getTypeLabel(dest.type)}</p>
                        </div>

                        {/* Indicateur de disponibilité */}
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${dest.available
                                ? 'bg-success-500/20 text-success-400'
                                : 'bg-dark-700 text-dark-500'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dest.available ? 'bg-success-400' : 'bg-dark-500'
                                }`} />
                            {dest.available ? 'Connecté' : 'Déconnecté'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Hint pour USB */}
            <p className="mt-4 text-xs text-dark-500 text-center">
                💡 Branchez votre disque externe pour lancer une sauvegarde automatique
            </p>
        </section>
    )
}

export default DestinationsList
