import { exec } from 'child_process'
import { promisify } from 'util'
import { EventEmitter } from 'events'
import * as fs from 'fs'

const execAsync = promisify(exec)

/**
 * Informations sur un lecteur
 */
export interface DriveInfo {
    letter: string        // Ex: "D:"
    label: string         // Ex: "USB_BACKUP"
    type: 'usb' | 'fixed' | 'network' | 'unknown'
    size: number          // Taille totale en bytes
    freeSpace: number     // Espace libre en bytes
    isReady: boolean
}

/**
 * Service de détection USB via WMI (Windows Management Instrumentation)
 */
class UsbService extends EventEmitter {
    private pollingInterval: ReturnType<typeof setInterval> | null = null
    private previousDrives: Map<string, DriveInfo> = new Map()
    private isWatching = false

    /**
     * Liste tous les lecteurs amovibles (USB) connectés
     */
    async listDrives(): Promise<DriveInfo[]> {
        try {
            // Utiliser PowerShell pour lister les lecteurs via WMI
            const { stdout } = await execAsync(`
        powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | 
        Select-Object DeviceID, VolumeName, DriveType, Size, FreeSpace | 
        ConvertTo-Json"
      `)

            const rawDrives = JSON.parse(stdout || '[]')
            const drivesArray = Array.isArray(rawDrives) ? rawDrives : [rawDrives]

            return drivesArray
                .filter((d: { DeviceID: string }) => d.DeviceID) // Filtrer les entrées vides
                .map((d: {
                    DeviceID: string
                    VolumeName: string | null
                    DriveType: number
                    Size: number | null
                    FreeSpace: number | null
                }) => ({
                    letter: d.DeviceID,
                    label: d.VolumeName || 'Sans nom',
                    type: this.getDriveType(d.DriveType),
                    size: d.Size || 0,
                    freeSpace: d.FreeSpace || 0,
                    isReady: d.Size !== null && d.Size > 0,
                }))
        } catch (error) {
            console.error('[UsbService] Erreur lors de la liste des lecteurs:', error)
            return []
        }
    }

    /**
     * Liste uniquement les lecteurs USB (amovibles)
     */
    async listUsbDrives(): Promise<DriveInfo[]> {
        const drives = await this.listDrives()
        return drives.filter((d) => d.type === 'usb')
    }

    /**
     * Démarre la surveillance des lecteurs USB
     */
    startWatching(intervalMs = 2000): void {
        if (this.isWatching) return

        this.isWatching = true
        console.log('[UsbService] Démarrage de la surveillance USB...')

        // Initialiser la liste des lecteurs
        this.listDrives().then((drives) => {
            drives.forEach((d) => this.previousDrives.set(d.letter, d))
        })

        // Polling périodique
        this.pollingInterval = setInterval(async () => {
            const currentDrives = await this.listDrives()
            const currentMap = new Map(currentDrives.map((d) => [d.letter, d]))

            // Détecter les nouveaux lecteurs
            const currentEntries = Array.from(currentMap.entries())
            for (const [letter, drive] of currentEntries) {
                if (!this.previousDrives.has(letter)) {
                    console.log(`[UsbService] Nouveau lecteur détecté: ${letter} (${drive.label})`)
                    this.emit('drive:connected', drive)
                }
            }

            // Détecter les lecteurs déconnectés
            const previousEntries = Array.from(this.previousDrives.entries())
            for (const [letter, drive] of previousEntries) {
                if (!currentMap.has(letter)) {
                    console.log(`[UsbService] Lecteur déconnecté: ${letter} (${drive.label})`)
                    this.emit('drive:disconnected', drive)
                }
            }

            this.previousDrives = currentMap
        }, intervalMs)
    }

    /**
     * Arrête la surveillance
     */
    stopWatching(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }
        this.isWatching = false
        console.log('[UsbService] Surveillance USB arrêtée')
    }

    /**
     * Vérifie si un lecteur existe et est accessible
     */
    async isDriveReady(letter: string): Promise<boolean> {
        try {
            await fs.promises.access(letter + '\\')
            return true
        } catch {
            return false
        }
    }

    /**
     * Convertit le type de lecteur WMI en type lisible
     */
    private getDriveType(driveType: number): DriveInfo['type'] {
        // Types WMI : 0=Unknown, 1=NoRoot, 2=Removable, 3=Fixed, 4=Network, 5=CD, 6=RAM
        switch (driveType) {
            case 2:
                return 'usb'
            case 3:
                return 'fixed'
            case 4:
                return 'network'
            default:
                return 'unknown'
        }
    }
}

// Export singleton
export const usbService = new UsbService()
