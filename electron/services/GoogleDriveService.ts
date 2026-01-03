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
import { storeService } from './StoreService'
import type { SourceConfig } from './StoreService'
import { scanDirectory } from './FileUtils'

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

    /**
     * Charge les credentials depuis le fichier de configuration
     */
    private loadCredentials(): GoogleCredentials | null {
        try {
            // Chercher le fichier de credentials à plusieurs endroits
            const possiblePaths = [
                path.join(process.cwd(), 'google-credentials.json'),
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

            console.log('[GoogleDrive] Authentification réussie')
            return { success: true, user: userInfo || undefined }
        } catch (error) {
            console.error('[GoogleDrive] Erreur authentification:', error)
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
            console.error('[GoogleDrive] Erreur getUserInfo:', error)
            return null
        }
    }

    /**
     * Déconnecte l'utilisateur (supprime les tokens)
     */
    async logout(): Promise<void> {
        try {
            // Révoquer le token si possible
            if (this.oauth2Client) {
                const tokens = storeService.getGoogleTokens()
                if (tokens?.access_token) {
                    try {
                        await this.oauth2Client.revokeToken(tokens.access_token)
                    } catch {
                        // Ignorer les erreurs de révocation
                    }
                }
            }
        } finally {
            // Supprimer les tokens locaux
            storeService.clearGoogleAuth()
            this.oauth2Client = null
            this.drive = null
            this.backupFolderId = null
            console.log('[GoogleDrive] Déconnexion effectuée')
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

            if (response.data.files && response.data.files.length > 0) {
                this.backupFolderId = response.data.files[0].id!
                console.log(`[GoogleDrive] Dossier backup trouvé: ${this.backupFolderId}`)
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

            this.backupFolderId = folder.data.id!
            console.log(`[GoogleDrive] Dossier backup créé: ${this.backupFolderId}`)
            return this.backupFolderId
        } catch (error) {
            console.error('[GoogleDrive] Erreur ensureBackupFolder:', error)
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
            console.error(`[GoogleDrive] Erreur création sous-dossier ${name}:`, error)
            return null
        }
    }

    /**
     * Upload un fichier vers Google Drive
     * Note: Le tracking de progression par fichier est désactivé pour éviter les erreurs de stream
     */
    private async uploadFile(
        localPath: string,
        fileName: string,
        parentId: string,
        _onProgress?: (bytes: number) => void
    ): Promise<{ success: boolean; error?: string }> {
        if (!this.drive) {
            return { success: false, error: 'Client Drive non initialisé' }
        }

        try {

            // Vérifier si le fichier existe déjà AVANT de créer le stream
            const existingFiles = await this.drive.files.list({
                q: `name='${fileName}' and '${parentId}' in parents and trashed=false`,
                fields: 'files(id)',
            })

            // Créer le stream APRÈS la vérification
            const fileStream = fs.createReadStream(localPath)

            if (existingFiles.data.files && existingFiles.data.files.length > 0) {
                // Mettre à jour le fichier existant
                await this.drive.files.update({
                    fileId: existingFiles.data.files[0].id!,
                    media: {
                        body: fileStream,
                    },
                })
            } else {
                // Créer un nouveau fichier
                await this.drive.files.create({
                    requestBody: {
                        name: fileName,
                        parents: [parentId],
                    },
                    media: {
                        body: fileStream,
                    },
                })
            }

            return { success: true }
        } catch (error) {
            console.error(`[GoogleDrive] Erreur upload ${fileName}:`, error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur upload',
            }
        }
    }

    /**
     * Annule l'upload en cours
     */
    cancel(): void {
        this.isCancelled = true
    }

    /**
     * Upload un dossier source complet vers Google Drive
     */
    async uploadSource(source: SourceConfig): Promise<CloudSyncResult> {
        this.isCancelled = false
        const startTime = Date.now()
        const errors: Array<{ file: string; error: string }> = []
        let filesUploaded = 0
        let bytesTransferred = 0

        try {
            // Phase 1: Vérifier l'authentification
            if (!this.isAuthenticated()) {
                return {
                    success: false,
                    filesUploaded: 0,
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
                        bytesTransferred: 0,
                        errors: [{ file: '', error: 'Impossible d\'initialiser le client' }],
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

            for (const file of filesToUpload) {
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
                    }
                )

                if (result.success) {
                    filesUploaded++
                    bytesTransferred += file.size
                } else {
                    errors.push({ file: file.relativePath, error: result.error || 'Erreur inconnue' })
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
                bytesTransferred,
                errors: [{ file: '', error: error instanceof Error ? error.message : 'Erreur inconnue' }],
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
}

// Export singleton
export const googleDriveService = new GoogleDriveService()
