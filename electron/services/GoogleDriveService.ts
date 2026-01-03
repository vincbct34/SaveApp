/**
 * @fileoverview Service d'intégration Google Drive pour SaveApp
 * Gère l'authentification OAuth2, la gestion des tokens et l'upload de fichiers
 */

import { google, drive_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { storeService } from './StoreService'
import type { SourceConfig } from './StoreService'
import { scanDirectory } from './FileUtils'
import { logger } from './Logger'

/**
 * Configuration OAuth2 pour Google Drive
 * Les credentials sont chargés depuis un fichier externe
 */
interface GoogleCredentials {
    client_id: string
    client_secret: string
    redirect_uri: string
}

/**
 * Tokens OAuth2 stockés
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
 * Progression de l'upload
 */
export interface CloudUploadProgress {
    phase: 'scanning' | 'uploading' | 'done' | 'error'
    totalFiles: number
    uploadedFiles: number
    totalBytes: number
    uploadedBytes: number
    currentFile: string
    percent: number
}

/**
 * Résultat de l'upload
 */
export interface CloudSyncResult {
    success: boolean
    filesUploaded: number
    filesSkipped: number
    bytesTransferred: number
    errors: Array<{ file: string; error: string }>
    duration: number
}

// Scopes requis pour l'accès à Google Drive
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file', // Accès aux fichiers créés par l'app
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
]

const BACKUP_FOLDER_NAME = 'SaveApp_Backup'

/**
 * Service Google Drive
 * Gère l'authentification OAuth2 et les opérations sur le Drive
 */
class GoogleDriveService extends EventEmitter {
    private oauth2Client: OAuth2Client | null = null
    private drive: drive_v3.Drive | null = null
    private credentials: GoogleCredentials | null = null
    private backupFolderId: string | null = null
    private isCancelled = false
    private isPaused = false
    private pausePromiseResolve: (() => void) | null = null

    /**
     * Charge les credentials depuis le fichier de configuration
     */
    private loadCredentials(): GoogleCredentials | null {
        try {
            // Chercher le fichier de credentials à plusieurs endroits
            const possiblePaths = [
                path.join(process.cwd(), 'google-credentials.json'),
                path.join(process.resourcesPath, 'google-credentials.json'),
                path.join(__dirname, '../../google-credentials.json'),
                path.join(__dirname, '../../../google-credentials.json'),
            ]

            for (const credPath of possiblePaths) {
                if (fs.existsSync(credPath)) {
                    const content = fs.readFileSync(credPath, 'utf-8')
                    const parsed = JSON.parse(content)

                    // Support du format téléchargé depuis Google Cloud Console
                    if (parsed.installed) {
                        return {
                            client_id: parsed.installed.client_id,
                            client_secret: parsed.installed.client_secret,
                            redirect_uri: parsed.installed.redirect_uris?.[0] || 'http://localhost',
                        }
                    }

                    // Support du format simplifié
                    return {
                        client_id: parsed.client_id,
                        client_secret: parsed.client_secret,
                        redirect_uri: parsed.redirect_uri || 'http://localhost',
                    }
                }
            }

            console.error('[GoogleDrive] Fichier google-credentials.json non trouvé')
            return null
        } catch (error) {
            console.error('[GoogleDrive] Erreur chargement credentials:', error)
            return null
        }
    }

    /**
     * Initialise le client OAuth2
     */
    private initOAuth2Client(): boolean {
        if (!this.credentials) {
            this.credentials = this.loadCredentials()
        }

        if (!this.credentials) {
            return false
        }

        this.oauth2Client = new google.auth.OAuth2(
            this.credentials.client_id,
            this.credentials.client_secret,
            this.credentials.redirect_uri
        )

        // Charger les tokens existants si disponibles
        const tokens = storeService.getGoogleTokens()
        if (tokens) {
            this.oauth2Client.setCredentials({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date,
            })
            this.initDriveClient()
        }

        return true
    }

    /**
     * Initialise le client Drive API
     */
    private initDriveClient(): void {
        if (!this.oauth2Client) return

        this.drive = google.drive({
            version: 'v3',
            auth: this.oauth2Client,
        })
    }

    /**
     * Vérifie si les credentials sont configurées
     */
    hasCredentials(): boolean {
        if (!this.credentials) {
            this.credentials = this.loadCredentials()
        }
        return this.credentials !== null
    }

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    isAuthenticated(): boolean {
        const tokens = storeService.getGoogleTokens()
        if (!tokens) return false

        // Vérifier si le token n'est pas expiré (avec 5 min de marge)
        const now = Date.now()
        const isExpired = tokens.expiry_date < now + 5 * 60 * 1000

        // Si expiré mais on a un refresh_token, on considère comme "authentifié"
        // car on pourra le rafraîchir
        return !isExpired || !!tokens.refresh_token
    }

    /**
     * Lance le flow d'authentification OAuth2
     * Ouvre une popup pour la connexion Google
     */
    async authenticate(): Promise<{ success: boolean; user?: GoogleUserInfo; error?: string }> {
        if (!this.initOAuth2Client() || !this.oauth2Client) {
            return {
                success: false,
                error: 'Fichier google-credentials.json non trouvé ou invalide',
            }
        }

        try {
            // Générer l'URL d'authentification
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                prompt: 'consent', // Force le refresh token
            })

            // Ouvrir une fenêtre pour l'authentification
            const code = await this.openAuthWindow(authUrl)
            if (!code) {
                return { success: false, error: 'Authentification annulée' }
            }

            // Échanger le code contre des tokens
            const { tokens } = await this.oauth2Client.getToken(code)
            this.oauth2Client.setCredentials(tokens)

            // Sauvegarder les tokens de façon sécurisée
            if (tokens.access_token && tokens.refresh_token && tokens.expiry_date) {
                storeService.setGoogleTokens({
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expiry_date: tokens.expiry_date,
                })
            }

            // Initialiser le client Drive
            this.initDriveClient()

            // Récupérer les infos utilisateur
            const userInfo = await this.getUserInfo()
            if (userInfo) {
                storeService.setGoogleUserInfo(userInfo)
            }

            logger.info('GoogleDrive', 'Authentification réussie')
            return { success: true, user: userInfo || undefined }
        } catch (error) {
            logger.error('GoogleDrive', 'Erreur authentification:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            }
        }
    }

    /**
     * Ouvre une fenêtre de navigateur pour l'authentification OAuth2
     */
    private openAuthWindow(authUrl: string): Promise<string | null> {
        return new Promise((resolve) => {
            const authWindow = new BrowserWindow({
                width: 500,
                height: 700,
                show: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            })

            authWindow.loadURL(authUrl)

            // Intercepter la redirection pour récupérer le code
            authWindow.webContents.on('will-redirect', (_event, url) => {
                const urlObj = new URL(url)
                const code = urlObj.searchParams.get('code')
                const error = urlObj.searchParams.get('error')

                if (code) {
                    resolve(code)
                    authWindow.close()
                } else if (error) {
                    resolve(null)
                    authWindow.close()
                }
            })

            // Intercepter aussi les changements d'URL (pour localhost)
            authWindow.webContents.on('did-navigate', (_event, url) => {
                if (url.startsWith('http://localhost')) {
                    const urlObj = new URL(url)
                    const code = urlObj.searchParams.get('code')
                    if (code) {
                        resolve(code)
                        authWindow.close()
                    }
                }
            })

            authWindow.on('closed', () => {
                resolve(null)
            })
        })
    }

    /**
     * Récupère les informations de l'utilisateur connecté
     */
    async getUserInfo(): Promise<GoogleUserInfo | null> {
        if (!this.oauth2Client) {
            if (!this.initOAuth2Client()) return null
        }

        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client! })
            const { data } = await oauth2.userinfo.get()

            return {
                name: data.name || 'Utilisateur',
                email: data.email || '',
                picture: data.picture || undefined,
            }
        } catch (error) {
            logger.error('GoogleDrive', 'Erreur getUserInfo:', error)
            return null
        }
    }

    /**
     * Déconnecte l'utilisateur (supprime les tokens)
     */
    async logout(): Promise<void> {
        try {
            if (this.oauth2Client) {
                await this.oauth2Client.revokeCredentials()
            }
            this.oauth2Client = null
            this.drive = null
            this.backupFolderId = null
            storeService.clearGoogleAuth()
            logger.info('GoogleDrive', 'Déconnexion effectuée')
        } catch (error) {
            logger.error('GoogleDrive', 'Erreur lors de la déconnexion:', error)
        }
    }

    /**
     * Trouve ou crée le dossier SaveApp_Backup sur le Drive
     */
    private async ensureBackupFolder(): Promise<string | null> {
        if (this.backupFolderId) return this.backupFolderId

        if (!this.drive) {
            if (!this.initOAuth2Client()) return null
            this.initDriveClient()
            if (!this.drive) return null
        }

        try {
            // Chercher le dossier existant
            const response = await this.drive.files.list({
                q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            })

            const folders = response.data.files
            if (folders && folders.length > 0) {
                this.backupFolderId = folders[0].id || null
                logger.info('GoogleDrive', `Dossier backup trouvé: ${this.backupFolderId}`)
                return this.backupFolderId
            }

            // Créer le dossier
            const folder = await this.drive.files.create({
                requestBody: {
                    name: BACKUP_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            })

            this.backupFolderId = folder.data.id || null
            logger.info('GoogleDrive', `Dossier backup créé: ${this.backupFolderId}`)
            return this.backupFolderId
        } catch (error) {
            logger.error('GoogleDrive', 'Erreur ensureBackupFolder:', error)
            return null
        }
    }

    /**
     * Trouve ou crée un sous-dossier dans le dossier parent
     */
    private async ensureSubFolder(name: string, parentId: string): Promise<string | null> {
        if (!this.drive) return null

        try {
            // Chercher le dossier existant
            const response = await this.drive.files.list({
                q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)',
                spaces: 'drive',
            })

            if (response.data.files && response.data.files.length > 0) {
                return response.data.files[0].id!
            }

            // Créer le dossier
            const folder = await this.drive.files.create({
                requestBody: {
                    name,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId],
                },
                fields: 'id',
            })

            return folder.data.id!
        } catch (error) {
            logger.error('GoogleDrive', `Erreur création sous-dossier ${name}:`, error)
            return null
        }
    }

    /**
     * Upload un fichier vers Google Drive avec tracking de progression
     */
    private async uploadFile(
        localPath: string,
        fileName: string,
        parentId: string,
        onProgress?: (bytes: number) => void,
        existingFileId?: string,
        remoteHash?: string
    ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
        if (!this.drive) {
            return { success: false, error: 'Client Drive non initialisé' }
        }

        try {
            // Si on a un hash distant, comparer avec le hash local (sync incrémentale)
            if (remoteHash) {
                const localHash = await this.computeFileMD5(localPath)
                if (localHash === remoteHash) {
                    return { success: true, skipped: true }
                }
            }

            // Créer le stream pour l'upload
            const fileStream = fs.createReadStream(localPath)

            // Configuration avec callback de progression
            const config = {
                onUploadProgress: (evt: { bytesRead: number }) => {
                    onProgress?.(evt.bytesRead)
                },
            }

            if (existingFileId) {
                // Mettre à jour le fichier existant
                await this.drive.files.update(
                    {
                        fileId: existingFileId,
                        media: {
                            body: fileStream,
                        },
                    },
                    config
                )
            } else {
                // Créer un nouveau fichier
                await this.drive.files.create(
                    {
                        requestBody: {
                            name: fileName,
                            parents: [parentId],
                        },
                        media: {
                            body: fileStream,
                        },
                    },
                    config
                )
            }

            return { success: true }
        } catch (error) {
            logger.error('GoogleDrive', `Erreur upload ${fileName}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur upload',
            }
        }
    }

    /**
     * Calcule le hash MD5 d'un fichier local
     */
    private async computeFileMD5(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5')
            const stream = fs.createReadStream(filePath)
            stream.on('data', (data: Buffer) => hash.update(data))
            stream.on('end', () => resolve(hash.digest('hex')))
            stream.on('error', reject)
        })
    }

    /**
     * Récupère la map des fichiers distants avec leurs hashs MD5
     */
    private async getRemoteFilesMap(
        folderId: string,
        basePath: string = ''
    ): Promise<Map<string, { id: string; md5: string }>> {
        const map = new Map<string, { id: string; md5: string }>()
        if (!this.drive) return map

        try {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, md5Checksum, mimeType)',
                pageSize: 1000,
            })

            for (const file of response.data.files || []) {
                const relativePath = basePath ? `${basePath}/${file.name}` : file.name!

                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // Récursion pour les sous-dossiers
                    const subMap = await this.getRemoteFilesMap(file.id!, relativePath)
                    subMap.forEach((value, key) => map.set(key, value))
                } else if (file.md5Checksum) {
                    map.set(relativePath, { id: file.id!, md5: file.md5Checksum })
                }
            }
        } catch (error) {
            logger.error('GoogleDrive', 'Erreur getRemoteFilesMap:', error)
        }

        return map
    }

    /**
     * Annule l'upload en cours
     */
    cancel(): void {
        this.isCancelled = true
        // Si on est en pause, on débloque pour permettre l'annulation
        if (this.pausePromiseResolve) {
            this.pausePromiseResolve()
        }
    }

    /**
     * Met en pause l'upload
     */
    pause(): void {
        this.isPaused = true
    }

    /**
     * Reprend l'upload
     */
    resume(): void {
        this.isPaused = false
        if (this.pausePromiseResolve) {
            this.pausePromiseResolve()
            this.pausePromiseResolve = null
        }
    }

    /**
     * Vérifie si en pause et attend si nécessaire
     */
    private async waitIfPaused(): Promise<void> {
        if (!this.isPaused) return

        return new Promise((resolve) => {
            this.pausePromiseResolve = resolve
        })
    }

    /**
     * Upload un dossier source complet vers Google Drive
     */
    async uploadSource(source: SourceConfig): Promise<CloudSyncResult> {
        this.isCancelled = false
        this.isPaused = false
        const startTime = Date.now()
        const errors: Array<{ file: string; error: string }> = []
        let filesUploaded = 0
        let filesSkipped = 0
        let bytesTransferred = 0

        try {
            // Phase 1: Vérifier l'authentification
            if (!this.isAuthenticated()) {
                return {
                    success: false,
                    filesUploaded: 0,
                    filesSkipped: 0,
                    bytesTransferred: 0,
                    errors: [{ file: '', error: 'Non authentifié' }],
                    duration: Date.now() - startTime,
                }
            }

            // S'assurer que le client Drive est initialisé
            if (!this.drive) {
                if (!this.initOAuth2Client()) {
                    return {
                        success: false,
                        filesUploaded: 0,
                        filesSkipped: 0,
                        bytesTransferred: 0,
                        errors: [{ file: '', error: "Impossible d'initialiser le client" }],
                        duration: Date.now() - startTime,
                    }
                }
                this.initDriveClient()
            }

            // Phase 2: Créer le dossier de backup
            const backupFolderId = await this.ensureBackupFolder()
            if (!backupFolderId) {
                return {
                    success: false,
                    filesUploaded: 0,
                    filesSkipped: 0,
                    bytesTransferred: 0,
                    errors: [{ file: '', error: 'Impossible de créer le dossier de backup' }],
                    duration: Date.now() - startTime,
                }
            }

            // Créer le sous-dossier pour cette source
            const sourceFolderId = await this.ensureSubFolder(source.name, backupFolderId)
            if (!sourceFolderId) {
                return {
                    success: false,
                    filesUploaded: 0,
                    filesSkipped: 0,
                    bytesTransferred: 0,
                    errors: [{ file: '', error: 'Impossible de créer le dossier source' }],
                    duration: Date.now() - startTime,
                }
            }

            // Phase 3: Scanner les fichiers
            this.emitProgress({
                phase: 'scanning',
                totalFiles: 0,
                uploadedFiles: 0,
                totalBytes: 0,
                uploadedBytes: 0,
                currentFile: source.path,
                percent: 0,
            })

            const files = await scanDirectory(source.path)
            const filesToUpload = files.filter((f) => !f.isDirectory)
            const totalBytes = filesToUpload.reduce((acc, f) => acc + f.size, 0)

            // Phase 4: Upload des fichiers
            this.emitProgress({
                phase: 'uploading',
                totalFiles: filesToUpload.length,
                uploadedFiles: 0,
                totalBytes,
                uploadedBytes: 0,
                currentFile: '',
                percent: 0,
            })

            // Map pour stocker les IDs des dossiers créés
            const folderIdCache = new Map<string, string>()
            folderIdCache.set('', sourceFolderId)

            // Phase 3.5: Charger la map des fichiers distants pour sync incrémentale
            logger.info('GoogleDrive', 'Chargement des fichiers distants pour sync incrémentale...')
            const remoteFilesMap = await this.getRemoteFilesMap(sourceFolderId)
            logger.info('GoogleDrive', `${remoteFilesMap.size} fichiers distants trouvés`)

            for (const file of filesToUpload) {
                if (this.isCancelled) break

                // Attendre si en pause
                await this.waitIfPaused()
                if (this.isCancelled) break

                // Déterminer le dossier parent
                const relativeDirPath = path.dirname(file.relativePath)
                let parentFolderId = sourceFolderId

                if (relativeDirPath && relativeDirPath !== '.') {
                    // Créer les dossiers intermédiaires si nécessaire
                    const pathParts = relativeDirPath.split(path.sep)
                    let currentPath = ''

                    for (const part of pathParts) {
                        const parentPath = currentPath
                        currentPath = currentPath ? `${currentPath}${path.sep}${part}` : part

                        if (!folderIdCache.has(currentPath)) {
                            const parentId = folderIdCache.get(parentPath) || sourceFolderId
                            const folderId = await this.ensureSubFolder(part, parentId)
                            if (folderId) {
                                folderIdCache.set(currentPath, folderId)
                            }
                        }
                    }

                    parentFolderId = folderIdCache.get(relativeDirPath) || sourceFolderId
                }

                // Upload le fichier
                this.emitProgress({
                    phase: 'uploading',
                    totalFiles: filesToUpload.length,
                    uploadedFiles: filesUploaded,
                    totalBytes,
                    uploadedBytes: bytesTransferred,
                    currentFile: file.relativePath,
                    percent: Math.round((filesUploaded / filesToUpload.length) * 100),
                })

                // Chercher le fichier distant pour sync incrémentale
                const remoteKey = file.relativePath.replace(/\\/g, '/')
                const remoteFile = remoteFilesMap.get(remoteKey)

                const result = await this.uploadFile(
                    file.path,
                    path.basename(file.path),
                    parentFolderId,
                    (bytes) => {
                        this.emitProgress({
                            phase: 'uploading',
                            totalFiles: filesToUpload.length,
                            uploadedFiles: filesUploaded,
                            totalBytes,
                            uploadedBytes: bytesTransferred + bytes,
                            currentFile: file.relativePath,
                            percent: Math.round(((bytesTransferred + bytes) / totalBytes) * 100),
                        })
                    },
                    remoteFile?.id,
                    remoteFile?.md5
                )

                if (result.success) {
                    if (result.skipped) {
                        filesSkipped++
                    } else {
                        filesUploaded++
                    }
                    bytesTransferred += file.size
                } else {
                    errors.push({
                        file: file.relativePath,
                        error: result.error || 'Erreur inconnue',
                    })
                }
            }

            // Terminé
            this.emitProgress({
                phase: 'done',
                totalFiles: filesToUpload.length,
                uploadedFiles: filesUploaded,
                totalBytes,
                uploadedBytes: bytesTransferred,
                currentFile: '',
                percent: 100,
            })

            return {
                success: errors.length === 0,
                filesUploaded,
                filesSkipped,
                bytesTransferred,
                errors,
                duration: Date.now() - startTime,
            }
        } catch (error) {
            console.error('[GoogleDrive] Erreur uploadSource:', error)
            this.emitProgress({
                phase: 'error',
                totalFiles: 0,
                uploadedFiles: filesUploaded,
                totalBytes: 0,
                uploadedBytes: bytesTransferred,
                currentFile: '',
                percent: 0,
            })

            return {
                success: false,
                filesUploaded,
                filesSkipped,
                bytesTransferred,
                errors: [
                    { file: '', error: error instanceof Error ? error.message : 'Erreur inconnue' },
                ],
                duration: Date.now() - startTime,
            }
        }
    }

    /**
     * Émet un événement de progression
     */
    private emitProgress(progress: CloudUploadProgress): void {
        this.emit('progress', progress)
    }

    // ========== RESTORE FUNCTIONALITY ==========

    /**
     * Liste les backups disponibles sur le Drive
     */
    async listBackups(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
        if (!this.drive) {
            if (!this.initOAuth2Client()) return []
            this.initDriveClient()
            if (!this.drive) return []
        }

        try {
            const backupFolderId = await this.ensureBackupFolder()
            if (!backupFolderId) return []

            const response = await this.drive.files.list({
                q: `'${backupFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'modifiedTime desc',
            })

            return (response.data.files || []).map((f) => ({
                id: f.id!,
                name: f.name!,
                modifiedTime: f.modifiedTime!,
            }))
        } catch (error) {
            console.error('[GoogleDrive] Erreur listBackups:', error)
            return []
        }
    }

    /**
     * Télécharge un backup complet vers un dossier local
     */
    async downloadBackup(
        backupId: string,
        destPath: string,
        onProgress?: (progress: { downloaded: number; total: number; currentFile: string }) => void
    ): Promise<{ success: boolean; filesDownloaded: number; errors: string[] }> {
        if (!this.drive) {
            return { success: false, filesDownloaded: 0, errors: ['Client non initialisé'] }
        }

        const errors: string[] = []
        let filesDownloaded = 0

        try {
            // Lister tous les fichiers dans le backup
            const files = await this.listAllFilesInFolder(backupId)
            const totalFiles = files.length

            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                onProgress?.({
                    downloaded: i,
                    total: totalFiles,
                    currentFile: file.path,
                })

                try {
                    const localPath = path.join(destPath, file.path)

                    // Créer les dossiers parents
                    await fs.promises.mkdir(path.dirname(localPath), { recursive: true })

                    // Télécharger le fichier
                    await this.downloadFile(file.id, localPath)
                    filesDownloaded++
                } catch (err) {
                    errors.push(`${file.path}: ${err instanceof Error ? err.message : 'Erreur'}`)
                }
            }

            onProgress?.({
                downloaded: totalFiles,
                total: totalFiles,
                currentFile: '',
            })

            return {
                success: errors.length === 0,
                filesDownloaded,
                errors,
            }
        } catch (error) {
            console.error('[GoogleDrive] Erreur downloadBackup:', error)
            return {
                success: false,
                filesDownloaded,
                errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
            }
        }
    }

    /**
     * Liste récursivement tous les fichiers dans un dossier
     */
    private async listAllFilesInFolder(
        folderId: string,
        basePath: string = ''
    ): Promise<Array<{ id: string; path: string }>> {
        if (!this.drive) return []

        const files: Array<{ id: string; path: string }> = []

        try {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType)',
                pageSize: 1000,
            })

            for (const file of response.data.files || []) {
                const filePath = basePath ? `${basePath}/${file.name}` : file.name!

                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // Récursion pour les sous-dossiers
                    const subFiles = await this.listAllFilesInFolder(file.id!, filePath)
                    files.push(...subFiles)
                } else {
                    files.push({ id: file.id!, path: filePath })
                }
            }
        } catch (error) {
            console.error('[GoogleDrive] Erreur listAllFilesInFolder:', error)
        }

        return files
    }

    /**
     * Télécharge un fichier depuis Google Drive
     */
    private async downloadFile(fileId: string, destPath: string): Promise<void> {
        if (!this.drive) throw new Error('Client non initialisé')

        const response = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        )

        return new Promise((resolve, reject) => {
            const dest = fs.createWriteStream(destPath)
                ; (response.data as NodeJS.ReadableStream)
                    .pipe(dest)
                    .on('finish', resolve)
                    .on('error', reject)
        })
    }
}

// Export singleton
export const googleDriveService = new GoogleDriveService()
