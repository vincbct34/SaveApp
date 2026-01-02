import { useState, useEffect } from 'react'

/**
 * Barre de titre personnalisée avec contrôles de fenêtre
 * Utilise -webkit-app-region: drag pour permettre le déplacement
 */
function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)

    // Vérifie si on est dans Electron
    const isElectron = typeof window !== 'undefined' && window.electronAPI

    useEffect(() => {
        if (!isElectron) return

        // Vérifier l'état initial
        window.electronAPI.window.isMaximized().then(setIsMaximized)

        // Écouter les changements d'état
        const unsubscribe = window.electronAPI.window.onMaximizedChange(setIsMaximized)
        return () => { unsubscribe() }
    }, [isElectron])

    // Handlers pour les contrôles de fenêtre (avec vérification Electron)
    const handleMinimize = () => isElectron && window.electronAPI.window.minimize()
    const handleMaximize = () => isElectron && window.electronAPI.window.maximize()
    const handleClose = () => isElectron && window.electronAPI.window.close()

    return (
        <header className="titlebar h-10 bg-dark-900 flex items-center justify-between px-4 border-b border-dark-800">
            {/* Logo et titre */}
            <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                </div>
                <span className="text-sm font-semibold text-dark-200">SaveApp</span>
            </div>

            {/* Contrôles de fenêtre */}
            <div className="flex items-center gap-1">
                {/* Minimiser */}
                <button
                    onClick={handleMinimize}
                    className="w-10 h-8 flex items-center justify-center rounded hover:bg-dark-700 transition-colors"
                    title="Minimiser"
                >
                    <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                </button>

                {/* Maximiser / Restaurer */}
                <button
                    onClick={handleMaximize}
                    className="w-10 h-8 flex items-center justify-center rounded hover:bg-dark-700 transition-colors"
                    title={isMaximized ? 'Restaurer' : 'Agrandir'}
                >
                    {isMaximized ? (
                        <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M8 4v12a2 2 0 002 2h12M8 4h12a2 2 0 012 2v10" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                        </svg>
                    )}
                </button>

                {/* Fermer */}
                <button
                    onClick={handleClose}
                    className="w-10 h-8 flex items-center justify-center rounded hover:bg-red-600 transition-colors group"
                    title="Fermer"
                >
                    <svg className="w-4 h-4 text-dark-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </header>
    )
}

export default TitleBar
