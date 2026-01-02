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
 * Structure des préférences utilisateur
 */
export interface UserPreferences {
    autoBackupOnUSB: boolean
    keepDeletedFiles: boolean
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
    },
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
}

// Export singleton
export const storeService = new StoreService()
