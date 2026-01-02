import * as fs from 'fs'
import * as path from 'path'

/**
 * Informations sur un fichier pour la synchronisation
 */
export interface FileInfo {
    path: string
    relativePath: string
    size: number
    mtime: number // timestamp de modification
    isDirectory: boolean
}

/**
 * Calcule la taille totale d'un dossier (récursif)
 */
export async function calculateFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0

    async function scanDir(dirPath: string): Promise<void> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name)

                if (entry.isDirectory()) {
                    await scanDir(fullPath)
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.promises.stat(fullPath)
                        totalSize += stats.size
                    } catch {
                        // Fichier inaccessible, on l'ignore
                    }
                }
            }
        } catch {
            // Dossier inaccessible
        }
    }

    await scanDir(folderPath)
    return totalSize
}

/**
 * Liste tous les fichiers d'un dossier avec leurs métadonnées
 */
export async function scanDirectory(folderPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    async function scanDir(dirPath: string): Promise<void> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name)
                const relativePath = path.relative(folderPath, fullPath)

                if (entry.isDirectory()) {
                    files.push({
                        path: fullPath,
                        relativePath,
                        size: 0,
                        mtime: 0,
                        isDirectory: true,
                    })
                    await scanDir(fullPath)
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.promises.stat(fullPath)
                        files.push({
                            path: fullPath,
                            relativePath,
                            size: stats.size,
                            mtime: stats.mtimeMs,
                            isDirectory: false,
                        })
                    } catch {
                        // Fichier inaccessible
                    }
                }
            }
        } catch {
            // Dossier inaccessible
        }
    }

    await scanDir(folderPath)
    return files
}

/**
 * Vérifie si un fichier est verrouillé (en cours d'utilisation)
 */
export async function isFileLocked(filePath: string): Promise<boolean> {
    try {
        // Tente d'ouvrir le fichier en mode exclusif
        const fd = await fs.promises.open(filePath, 'r+')
        await fd.close()
        return false
    } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException
        // EBUSY = fichier verrouillé, EACCES = accès refusé
        return err.code === 'EBUSY' || err.code === 'EACCES'
    }
}

/**
 * Copie un fichier avec streams (économe en mémoire)
 */
export function copyFileWithStream(
    source: string,
    destination: string,
    onProgress?: (copied: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Créer le dossier parent si nécessaire
        const destDir = path.dirname(destination)
        fs.mkdirSync(destDir, { recursive: true })

        const readStream = fs.createReadStream(source)
        const writeStream = fs.createWriteStream(destination)

        let copied = 0

        readStream.on('data', (chunk: Buffer) => {
            copied += chunk.length
            onProgress?.(copied)
        })

        readStream.on('error', (err) => {
            writeStream.destroy()
            reject(err)
        })

        writeStream.on('error', (err) => {
            readStream.destroy()
            reject(err)
        })

        writeStream.on('finish', () => {
            resolve()
        })

        readStream.pipe(writeStream)
    })
}

/**
 * Formate une taille en bytes vers une chaîne lisible
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 o'
    const units = ['o', 'Ko', 'Mo', 'Go', 'To']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * Normalise un chemin (remplace les backslashes)
 */
export function normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/')
}
