import Store from 'electron-store'

/**
 * Structure d'une source de sauvegarde
 */
export interface SourceConfig {
    id: string
    path: string
    name: string
    size: number
}

/**
 * Structure d'une destination de sauvegarde
 */
export interface DestinationConfig {
    id: string
    type: 'usb' | 'nas' | 'cloud'
    name: string
    path?: string
}

/**
 * Structure d'une planification de sauvegarde
 */
export interface BackupSchedule {
    id: string
    name: string
    frequency: 'daily' | 'weekly'
    time: string // Format "HH:mm"
    days: number[] // 0 (Dimanche) - 6 (Samedi), utilisé si frequency === 'weekly'
    sourceIds: string[]
    destinationId: string
    enabled: boolean
    lastRun: string | null
}

/**
 * Tokens OAuth2 Google
 */
export interface GoogleTokens {
    access_token: string
    refresh_token: string
    expiry_date: number
}

/**
 * Informations utilisateur Google
 */
export interface GoogleUserInfo {
    name: string
    email: string
    picture?: string
}

/**
 * Structure des préférences utilisateur
 */
export interface UserPreferences {
    autoBackupOnUSB: boolean
    keepDeletedFiles: boolean
    launchAtStartup: boolean
    lastOpenedPath?: string
}

/**
 * Structure complète du store
 */
interface StoreSchema {
    sources: SourceConfig[]
    destinations: DestinationConfig[]
    lastBackupDate: string | null
    preferences: UserPreferences
    autoBackupDriveIds: string[]
    schedules: BackupSchedule[]
    googleTokens: GoogleTokens | null
    googleUserInfo: GoogleUserInfo | null
}

/**
 * Valeurs par défaut
 */
const defaults: StoreSchema = {
    sources: [],
    destinations: [],
    lastBackupDate: null,
    preferences: {
        autoBackupOnUSB: true,
        keepDeletedFiles: false,
        launchAtStartup: true,
    },
    autoBackupDriveIds: [],
    schedules: [],
    googleTokens: null,
    googleUserInfo: null,
}

/**
 * Service de persistance avec electron-store
 */
class StoreService {
    private store: Store<StoreSchema>

    constructor() {
        this.store = new Store<StoreSchema>({
            name: 'saveapp-config',
            defaults,
        })
    }

    // === Sources ===

    getSources(): SourceConfig[] {
        return this.store.get('sources', [])
    }

    setSources(sources: SourceConfig[]): void {
        this.store.set('sources', sources)
    }

    addSource(source: SourceConfig): void {
        const sources = this.getSources()
        sources.push(source)
        this.setSources(sources)
    }

    removeSource(id: string): void {
        const sources = this.getSources().filter((s) => s.id !== id)
        this.setSources(sources)
    }

    // === Destinations ===

    getDestinations(): DestinationConfig[] {
        return this.store.get('destinations', [])
    }

    setDestinations(destinations: DestinationConfig[]): void {
        this.store.set('destinations', destinations)
    }

    // === Auto Backup Drives ===

    getAutoBackupDriveIds(): string[] {
        return this.store.get('autoBackupDriveIds', [])
    }

    setAutoBackupDriveIds(ids: string[]): void {
        this.store.set('autoBackupDriveIds', ids)
    }

    // === Schedules ===

    getSchedules(): BackupSchedule[] {
        return this.store.get('schedules', [])
    }

    setSchedules(schedules: BackupSchedule[]): void {
        this.store.set('schedules', schedules)
    }

    addSchedule(schedule: BackupSchedule): void {
        const schedules = this.getSchedules()
        schedules.push(schedule)
        this.setSchedules(schedules)
    }

    updateSchedule(schedule: BackupSchedule): void {
        const schedules = this.getSchedules()
        const index = schedules.findIndex((s) => s.id === schedule.id)
        if (index !== -1) {
            schedules[index] = schedule
            this.setSchedules(schedules)
        }
    }

    removeSchedule(id: string): void {
        const schedules = this.getSchedules().filter((s) => s.id !== id)
        this.setSchedules(schedules)
    }

    // === Dernière sauvegarde ===

    getLastBackupDate(): Date | null {
        const dateStr = this.store.get('lastBackupDate')
        return dateStr ? new Date(dateStr) : null
    }

    setLastBackupDate(date: Date): void {
        this.store.set('lastBackupDate', date.toISOString())
    }

    // === Préférences ===

    getPreferences(): UserPreferences {
        return this.store.get('preferences', defaults.preferences)
    }

    setPreferences(prefs: Partial<UserPreferences>): void {
        const current = this.getPreferences()
        this.store.set('preferences', { ...current, ...prefs })
    }

    getLastOpenedPath(): string | undefined {
        return this.getPreferences().lastOpenedPath
    }

    setLastOpenedPath(path: string): void {
        this.setPreferences({ lastOpenedPath: path })
    }

    // === Reset ===

    reset(): void {
        this.store.clear()
    }

    // === Google Drive ===

    getGoogleTokens(): GoogleTokens | null {
        return this.store.get('googleTokens', null)
    }

    setGoogleTokens(tokens: GoogleTokens): void {
        this.store.set('googleTokens', tokens)
    }

    getGoogleUserInfo(): GoogleUserInfo | null {
        return this.store.get('googleUserInfo', null)
    }

    setGoogleUserInfo(userInfo: GoogleUserInfo): void {
        this.store.set('googleUserInfo', userInfo)
    }

    clearGoogleAuth(): void {
        this.store.set('googleTokens', null)
        this.store.set('googleUserInfo', null)
    }
}

// Export singleton
export const storeService = new StoreService()
