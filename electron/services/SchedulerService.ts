import { EventEmitter } from 'events'
import { storeService, BackupSchedule } from './StoreService'

export type { BackupSchedule }


class SchedulerService extends EventEmitter {
    private timer: ReturnType<typeof setInterval> | null = null
    private checkIntervalMs = 10000 // Vérifier chaque 10 secondes

    start(): void {
        if (this.timer) return

        console.log('[Scheduler] Démarrage du planificateur de tâches...')

        // Vérification immédiate au démarrage
        this.checkSchedules()

        this.timer = setInterval(() => {
            this.checkSchedules()
        }, this.checkIntervalMs)
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    private checkSchedules(): void {
        const schedules = storeService.getSchedules()
        const now = new Date()

        // Mettre à zéro les secondes et millisecondes pour la comparaison HH:mm
        const currentHours = now.getHours()
        const currentMinutes = now.getMinutes()
        const currentDay = now.getDay() // 0 = Dimanche

        console.log(`[Scheduler] Tick: ${currentHours}:${currentMinutes} - ${schedules.length} tâches`)

        schedules.forEach((schedule) => {
            if (!schedule.enabled) {
                console.log(`   -> [${schedule.name}] Désactivée`)
                return
            }

            const [schedHour, schedMinute] = schedule.time.split(':').map(Number)

            console.log(`   -> Check "${schedule.name}": Prévu ${schedHour}:${schedMinute} vs Actuel ${currentHours}:${currentMinutes}`)

            // Vérifier l'heure
            if (schedHour === currentHours && schedMinute === currentMinutes) {
                // Vérifier la fréquence
                let isDue = false

                if (schedule.frequency === 'daily') {
                    isDue = true
                } else if (schedule.frequency === 'weekly') {
                    if (schedule.days.includes(currentDay)) {
                        isDue = true
                    } else {
                        console.log(`   -> [${schedule.name}] Mauvais jour (Prévu: ${schedule.days}, Actuel: ${currentDay})`)
                    }
                }

                // Vérifier si déjà exécuté aujourd'hui
                if (isDue) {
                    if (this.shouldRun(schedule)) {
                        console.log(`[Scheduler] 🚀 Tâche "${schedule.name}" déclenchée !`)
                        this.executeSchedule(schedule)
                    } else {
                        console.log(`[Scheduler] Tâche "${schedule.name}" déjà exécutée/trop tôt (LastRun: ${schedule.lastRun})`)
                    }
                }
            } else {
                // console.log(`   -> [${schedule.name}] Pas l'heure`)
            }
        })
    }

    private shouldRun(schedule: BackupSchedule): boolean {
        if (!schedule.lastRun) return true

        const lastRunDate = new Date(schedule.lastRun)
        const now = new Date()

        // Si la dernière exécution était il y a moins de 60 secondes, on ignore
        // (Protection anti-rebond dans la même minute)
        const diffMs = now.getTime() - lastRunDate.getTime()
        if (diffMs < 60000) return false

        // On supprime la vérification du "Même jour" car elle empêche de tester
        // si on déplace l'heure de la tâche plus tard dans la journée.
        // La protection "HH:mm === HH:mm" est suffisante pour garantir une seule exécution
        // par jour pour une heure donnée (avec le debounce ci-dessus).

        return true
    }

    private executeSchedule(schedule: BackupSchedule): void {
        // Mettre à jour lastRun avant d'émettre pour éviter rebond
        schedule.lastRun = new Date().toISOString()
        storeService.updateSchedule(schedule)

        this.emit('schedule:due', schedule)
    }
}

export const schedulerService = new SchedulerService()
