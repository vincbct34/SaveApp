import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, X, Power } from 'lucide-react'

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * Modal de paramètres de l'application
 * Permet de configurer le démarrage automatique avec Windows
 */
function Settings({ isOpen, onClose }: SettingsProps) {
    const [launchAtStartup, setLaunchAtStartup] = useState(true)
    const [isLoading, setIsLoading] = useState(true)

    // Charger les préférences au montage
    useEffect(() => {
        if (!window.electronAPI || !isOpen) return

        setIsLoading(true)
        window.electronAPI.store.getPreferences().then((prefs) => {
            setLaunchAtStartup(prefs.launchAtStartup ?? true)
            setIsLoading(false)
        })
    }, [isOpen])

    /**
     * Toggle le démarrage automatique
     */
    const handleToggleLaunchAtStartup = async () => {
        if (!window.electronAPI) return

        const newValue = !launchAtStartup
        setLaunchAtStartup(newValue)

        await window.electronAPI.store.setPreferences({ launchAtStartup: newValue })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-md mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-dark-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <SettingsIcon className="w-5 h-5 text-primary-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Paramètres</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-dark-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-dark-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Option démarrage automatique */}
                            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Power className="w-5 h-5 text-blue-400" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="font-medium text-white">
                                                Démarrer avec Windows
                                            </h3>
                                            {/* Toggle switch */}
                                            <button
                                                onClick={handleToggleLaunchAtStartup}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                                                    launchAtStartup
                                                        ? 'bg-primary-500'
                                                        : 'bg-dark-600'
                                                }`}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                                                        launchAtStartup
                                                            ? 'translate-x-6'
                                                            : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <p className="text-sm text-dark-400 mt-2 leading-relaxed">
                                            SaveApp démarrera automatiquement lorsque vous allumez
                                            votre ordinateur, permettant aux{' '}
                                            <span className="text-blue-400">
                                                sauvegardes programmées
                                            </span>{' '}
                                            et à la{' '}
                                            <span className="text-blue-400">
                                                détection automatique des clés USB
                                            </span>{' '}
                                            de fonctionner même si vous oubliez d&apos;ouvrir
                                            l&apos;application.
                                        </p>

                                        {/* Tip */}
                                        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/10 rounded-lg p-2.5">
                                            <svg
                                                className="w-4 h-4 flex-shrink-0 mt-0.5"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <span>
                                                <strong>Recommandé :</strong> Gardez cette option
                                                activée pour ne jamais manquer une sauvegarde !
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-dark-800">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-white font-medium transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Settings
