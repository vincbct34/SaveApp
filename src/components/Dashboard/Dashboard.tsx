import { useState, useEffect } from 'react'
import { getNextRunTime, BackupSchedule } from '../../utils/schedulerUtils'

interface DashboardProps {
    needsBackup: boolean
    lastBackupDate: Date | null
    isBackingUp: boolean
    onStartBackup: () => void
}

/**
 * Dashboard principal affichant l'état de sauvegarde
 * Design rassurant : vert si OK, orange si sauvegarde nécessaire
 */
function Dashboard({ needsBackup, lastBackupDate, isBackingUp, onStartBackup }: DashboardProps) {
    const [nextBackupDate, setNextBackupDate] = useState<Date | null>(null)

    useEffect(() => {
        if (!window.electronAPI) return

        const updateNextBackup = async () => {
            const schedules: BackupSchedule[] = await window.electronAPI.scheduler.getSchedules()
            const next = getNextRunTime(schedules)
            setNextBackupDate(next)
        }

        updateNextBackup()

        // Mettre à jour périodiquement (ex: quand on revient sur la fenêtre ou chaque minute)
        const interval = setInterval(updateNextBackup, 60000)
        return () => clearInterval(interval)
    }, [])

    /**
     * Formate la date de prochaine sauvegarde
     */
    const formatNextBackup = (date: Date | null): string => {
        if (!date) return 'Aucune planification'

        const now = new Date()
        const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()

        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const isTomorrow =
            date.getDate() === tomorrow.getDate() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getFullYear() === tomorrow.getFullYear()

        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        if (isToday) return `Aujourd'hui à ${timeStr}`
        if (isTomorrow) return `Demain à ${timeStr}`

        return `${date.toLocaleDateString([], { weekday: 'long', day: 'numeric' })} à ${timeStr}`
    }

    /**
     * Formate la date de dernière sauvegarde
     */
    const formatLastBackup = (date: Date | null): string => {
        if (!date) return 'Jamais'

        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "À l'instant"
        if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`
        if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
        return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
    }

    return (
        <section className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            {/* Statut avec indicateur */}
            <div className="flex items-center gap-4 mb-6">
                <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        needsBackup
                            ? 'bg-gradient-to-br from-warning-500/20 to-warning-600/20'
                            : 'bg-gradient-to-br from-success-500/20 to-success-600/20'
                    }`}
                >
                    {needsBackup ? (
                        <svg
                            className="w-8 h-8 text-warning-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    ) : (
                        <svg
                            className="w-8 h-8 text-success-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    )}
                </div>

                <div className="flex-1">
                    <h1
                        className={`text-2xl font-bold ${needsBackup ? 'text-warning-400' : 'text-success-400'}`}
                    >
                        {needsBackup ? 'Sauvegarde nécessaire' : 'Tout est sauvegardé'}
                    </h1>
                    <p className="text-dark-400 mt-1 flex flex-col gap-1">
                        <span>
                            Dernière sauvegarde :{' '}
                            <span className="text-dark-200">
                                {formatLastBackup(lastBackupDate)}
                            </span>
                        </span>
                        {nextBackupDate && (
                            <span className="text-xs text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded-full w-fit">
                                Prochaine : {formatNextBackup(nextBackupDate)}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Bouton principal */}
            <button
                onClick={onStartBackup}
                disabled={isBackingUp}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    isBackingUp
                        ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98]'
                }`}
            >
                {isBackingUp ? (
                    <span className="flex items-center justify-center gap-3">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        Sauvegarde en cours...
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-3">
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                        </svg>
                        Sauvegarder maintenant
                    </span>
                )}
            </button>
        </section>
    )
}

export default Dashboard
