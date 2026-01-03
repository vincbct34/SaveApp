import { EventEmitter } from 'events'
import { storeService, type BackupSchedule } from './StoreService'
import { logger } from './Logger'

export type { BackupSchedule }

class SchedulerService extends EventEmitter {
    private timer: ReturnType<typeof setInterval> | null = null
    private checkIntervalMs = 10000 // Vérifier chaque 10 secondes
    private isRunning: boolean = false // Ajout de la propriété isRunning

    async start() {
        // Changement en async start()
        if (this.isRunning) return
        logger.info('Scheduler', 'Démarrage du planificateur de tâches...') // Remplacement de console.log
        this.isRunning = true

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
            this.isRunning = false // Mettre à jour l'état
            logger.info('Scheduler', 'Arrêt du planificateur de tâches.') // Ajout d'un log pour l'arrêt
        }
    }

    private checkSchedules(): void {
        const schedules = storeService.getSchedules()
        const now = new Date()

        // Mettre à zéro les secondes et millisecondes pour la comparaison HH:mm
        const currentHours = now.getHours()
        const currentMinutes = now.getMinutes()
        const currentDay = now.getDay() // 0 = Dimanche

        logger.info(
            'Scheduler',
            `Tick: ${currentHours}:${currentMinutes} - ${schedules.length} tâches`
        ) // Remplacement de console.log

        for (const schedule of schedules) {
            // Changement de forEach en for...of
            if (!schedule.enabled) {
                // logger.debug('Scheduler', `[${ schedule.name }]Désactivée`) // Remplacement de console.log (commenté)
                continue // Utilisation de continue au lieu de return
            }

            const [schedHour, schedMinute] = schedule.time.split(':').map(Number)

            // logger.debug('Scheduler', `Check "${schedule.name}": Prévu ${ schedHour }:${ schedMinute } vs Actuel ${ currentHours }:${ currentMinutes } `) // Remplacement de console.log (commenté)

            // Vérifier l'heure
            if (schedHour === currentHours && schedMinute === currentMinutes) {
                // Vérifier la fréquence
                let isDue = false

                if (schedule.frequency === 'daily') {
                    isDue = true
                } else if (schedule.frequency === 'weekly') {
                    if (!schedule.days.includes(currentDay)) {
                        // Logique inversée pour le continue
                        logger.debug(
                            'Scheduler',
                            `[${schedule.name}] Mauvais jour(Prévu: ${schedule.days}, Actuel: ${currentDay})`
                        ) // Remplacement de console.log
                        continue
                    }
                    isDue = true // Si le jour correspond
                }

                // Vérifier si déjà exécuté aujourd'hui
                if (isDue) {
                    if (this.shouldRun(schedule)) {
                        logger.info('Scheduler', `🚀 Tâche "${schedule.name}" déclenchée !`)
                        this.executeSchedule(schedule)
                    } else {
                        // logger.warn('Scheduler', `Tâche "${schedule.name}" déjà exécutée/trop tôt (LastRun: ${schedule.lastRun})`)
                    }
                }
            }
        }
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
