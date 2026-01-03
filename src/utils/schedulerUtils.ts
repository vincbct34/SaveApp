export interface BackupSchedule {
    id: string
    name: string
    frequency: 'daily' | 'weekly'
    time: string
    days: number[]
    // ... autres champs si besoin
    enabled: boolean
}

/**
 * Calcule la prochaine échéance parmi une liste de tâches
 */
export function getNextRunTime(schedules: BackupSchedule[]): Date | null {
    if (!schedules || schedules.length === 0) return null

    let nextRun: Date | null = null
    const now = new Date()

    schedules.filter(s => s.enabled).forEach(schedule => {
        const [hours, minutes] = schedule.time.split(':').map(Number)

        // Candidat pour "aujourd'hui"
        const candidateToday = new Date(now)
        candidateToday.setHours(hours, minutes, 0, 0)

        if (schedule.frequency === 'daily') {
            if (candidateToday > now) {
                // C'est aujourd'hui plus tard
                updateNextRun(candidateToday)
            } else {
                // C'est demain
                const candidateTomorrow = new Date(candidateToday)
                candidateTomorrow.setDate(candidateTomorrow.getDate() + 1)
                updateNextRun(candidateTomorrow)
            }
        } else if (schedule.frequency === 'weekly') {
            // Trouver le prochain jour valide
            const currentDay = now.getDay()
            const validDays = schedule.days.sort((a, b) => a - b)

            let daysToAdd = -1

            // Chercher dans les jours restants de la semaine (y compris aujourd'hui)
            for (const day of validDays) {
                if (day === currentDay) {
                    if (candidateToday > now) {
                        daysToAdd = 0
                        break
                    }
                } else if (day > currentDay) {
                    daysToAdd = day - currentDay
                    break
                }
            }

            // Si pas trouvé, c'est la semaine prochaine (le premier jour dispo)
            if (daysToAdd === -1) {
                const firstDay = validDays[0]
                daysToAdd = (7 - currentDay) + firstDay
            }

            const candidate = new Date(candidateToday)
            candidate.setDate(candidate.getDate() + daysToAdd)
            updateNextRun(candidate)
        }
    })

    function updateNextRun(date: Date) {
        if (!nextRun || date < nextRun) {
            nextRun = date
        }
    }

    return nextRun
}
