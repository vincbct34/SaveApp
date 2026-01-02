import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import {
    FileInfo,
    scanDirectory,
    copyFileWithStream,
    isFileLocked,
} from './FileUtils'
import { storeService, SourceConfig } from './StoreService'

/**
 * Événements émis par le SyncService
 */
export interface SyncProgress {
    phase: 'scanning' | 'comparing' | 'copying' | 'deleting' | 'done' | 'error'
    totalFiles: number
    processedFiles: number
    totalBytes: number
    copiedBytes: number
    currentFile: string
    percent: number
    errors: SyncError[]
}

export interface SyncError {
    file: string
    error: string
    code: string
}

export interface SyncResult {
    success: boolean
    filesCreated: number
    filesUpdated: number
    filesDeleted: number
    bytesTransferred: number
    errors: SyncError[]
    duration: number
}

/**
 * Options de synchronisation
 */
export interface SyncOptions {
    deleteOrphans: boolean // Supprimer les fichiers orphelins à destination
}

/**
 * Service de synchronisation de dossiers
 */
class SyncService extends EventEmitter {
    private isRunning = false
    private isPaused = false
    private isCancelled = false
    private currentProgress: SyncProgress = {
        phase: 'scanning',
        totalFiles: 0,
        processedFiles: 0,
        totalBytes: 0,
        copiedBytes: 0,
        currentFile: '',
        percent: 0,
        errors: [],
    }

    /**
     * Lance la synchronisation d'une source vers une destination
     */
    async sync(
        source: SourceConfig,
        destinationPath: string,
        options: SyncOptions = { deleteOrphans: true }
    ): Promise<SyncResult> {
        if (this.isRunning) {
            throw new Error('Une synchronisation est déjà en cours')
        }

        this.isRunning = true
        this.isPaused = false
        this.isCancelled = false
        this.currentProgress = {
            phase: 'scanning',
            totalFiles: 0,
            processedFiles: 0,
            totalBytes: 0,
            copiedBytes: 0,
            currentFile: '',
            percent: 0,
            errors: [],
        }

        const startTime = Date.now()
        let filesCreated = 0
        let filesUpdated = 0
        let filesDeleted = 0
        let bytesTransferred = 0

        try {
            // Phase 1 : Scanner la source
            this.updateProgress({ phase: 'scanning', currentFile: source.path })
            const sourceFiles = await scanDirectory(source.path)
            const sourceFilesOnly = sourceFiles.filter((f) => !f.isDirectory)

            // Calculer les totaux
            const totalBytes = sourceFilesOnly.reduce((acc, f) => acc + f.size, 0)
            this.updateProgress({
                totalFiles: sourceFilesOnly.length,
                totalBytes,
            })

            // Phase 2 : Scanner la destination (si elle existe)
            this.updateProgress({ phase: 'comparing' })
            const destFolder = path.join(destinationPath, source.name)
            let destFiles: FileInfo[] = []

            if (fs.existsSync(destFolder)) {
                destFiles = await scanDirectory(destFolder)
            } else {
                fs.mkdirSync(destFolder, { recursive: true })
            }

            // Créer un map des fichiers destination par chemin relatif
            const destFileMap = new Map<string, FileInfo>()
            for (const file of destFiles) {
                destFileMap.set(file.relativePath, file)
            }

            // Phase 3 : Copier les fichiers nouveaux ou modifiés
            this.updateProgress({ phase: 'copying' })

            for (const sourceFile of sourceFiles) {
                // Vérifier annulation
                if (this.isCancelled) {
                    break
                }

                // Attendre si en pause
                while (this.isPaused && !this.isCancelled) {
                    await this.sleep(100)
                }

                const destPath = path.join(destFolder, sourceFile.relativePath)

                if (sourceFile.isDirectory) {
                    // Créer le dossier s'il n'existe pas
                    if (!fs.existsSync(destPath)) {
                        fs.mkdirSync(destPath, { recursive: true })
                    }
                    continue
                }

                this.updateProgress({ currentFile: sourceFile.relativePath })

                const destFile = destFileMap.get(sourceFile.relativePath)
                const needsCopy =
                    !destFile || // Nouveau fichier
                    sourceFile.mtime > destFile.mtime || // Fichier modifié
                    sourceFile.size !== destFile.size // Taille différente

                if (needsCopy) {
                    try {
                        // Vérifier si le fichier est verrouillé
                        if (await isFileLocked(sourceFile.path)) {
                            this.addError(sourceFile.path, 'Fichier verrouillé', 'EBUSY')
                            // Ajouter la taille du fichier aux bytes "traités" même s'il est ignoré
                            bytesTransferred += sourceFile.size
                            this.updateProgress({
                                copiedBytes: bytesTransferred,
                            })
                            continue
                        }

                        // Copier le fichier - on suit l'avancement de CE fichier
                        const bytesBeforeThisFile = bytesTransferred
                        await copyFileWithStream(sourceFile.path, destPath, (copiedInFile) => {
                            // copiedInFile = bytes copiés dans CE fichier (cumulatif)
                            this.updateProgress({
                                copiedBytes: bytesBeforeThisFile + copiedInFile,
                            })
                        })

                        bytesTransferred += sourceFile.size

                        if (destFile) {
                            filesUpdated++
                        } else {
                            filesCreated++
                        }
                    } catch (error: unknown) {
                        const err = error as NodeJS.ErrnoException
                        this.addError(sourceFile.path, err.message, err.code || 'UNKNOWN')
                        // On ajoute quand même la taille pour ne pas bloquer le %
                        bytesTransferred += sourceFile.size
                        this.updateProgress({
                            copiedBytes: bytesTransferred,
                        })
                    }
                } else {
                    // Fichier identique - on l'ajoute aux bytes traités
                    bytesTransferred += sourceFile.size
                    this.updateProgress({
                        copiedBytes: bytesTransferred,
                    })
                }

                // Marquer comme traité
                destFileMap.delete(sourceFile.relativePath)
                this.updateProgress({
                    processedFiles: this.currentProgress.processedFiles + 1,
                    percent: this.calculatePercent(),
                })
            }

            // Phase 4 : Supprimer les fichiers orphelins (si activé)
            if (options.deleteOrphans && !this.isCancelled) {
                this.updateProgress({ phase: 'deleting' })

                const orphanEntries = Array.from(destFileMap.entries())
                for (const [relativePath, destFile] of orphanEntries) {
                    if (destFile.isDirectory) continue

                    try {
                        const fullPath = path.join(destFolder, relativePath)
                        await fs.promises.unlink(fullPath)
                        filesDeleted++
                    } catch (error: unknown) {
                        const err = error as NodeJS.ErrnoException
                        this.addError(destFile.path, err.message, err.code || 'UNKNOWN')
                    }
                }
            }

            // Terminé
            this.updateProgress({ phase: 'done', percent: 100 })
            storeService.setLastBackupDate(new Date())

            return {
                success: this.currentProgress.errors.length === 0,
                filesCreated,
                filesUpdated,
                filesDeleted,
                bytesTransferred,
                errors: this.currentProgress.errors,
                duration: Date.now() - startTime,
            }
        } catch (error: unknown) {
            const err = error as Error
            this.updateProgress({ phase: 'error' })
            return {
                success: false,
                filesCreated,
                filesUpdated,
                filesDeleted,
                bytesTransferred,
                errors: [{ file: '', error: err.message, code: 'FATAL' }],
                duration: Date.now() - startTime,
            }
        } finally {
            this.isRunning = false
        }
    }

    /**
     * Met en pause la synchronisation
     */
    pause(): void {
        this.isPaused = true
    }

    /**
     * Reprend la synchronisation
     */
    resume(): void {
        this.isPaused = false
    }

    /**
     * Annule la synchronisation
     */
    cancel(): void {
        this.isCancelled = true
        this.isPaused = false
    }

    /**
     * Retourne si une synchronisation est en cours
     */
    isActive(): boolean {
        return this.isRunning
    }

    private updateProgress(partial: Partial<SyncProgress>): void {
        this.currentProgress = { ...this.currentProgress, ...partial }
        this.emit('progress', this.currentProgress)
    }

    private addError(file: string, error: string, code: string): void {
        this.currentProgress.errors.push({ file, error, code })
        this.emit('progress', this.currentProgress)
    }

    private calculatePercent(): number {
        if (this.currentProgress.totalFiles === 0) return 0
        return Math.round(
            (this.currentProgress.processedFiles / this.currentProgress.totalFiles) *
            100
        )
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

// Export singleton
export const syncService = new SyncService()
