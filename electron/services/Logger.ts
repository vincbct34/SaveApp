import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

class LoggerService {
    private logFile: string | null = null
    private minLevel: number = LEVELS.info

    constructor() {
        if (app) {
            const userDataPath = app.getPath('userData')
            this.logFile = path.join(userDataPath, 'saveapp.log')
        }

        // Configurer le niveau via env ou default
        const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
        this.minLevel = LEVELS[envLevel] || LEVELS.info
    }

    private formatMessage(
        level: LogLevel,
        source: string,
        message: string,
        ...args: any[]
    ): string {
        const timestamp = new Date().toISOString()
        const formattedArgs = args
            .map((arg) =>
                arg instanceof Error
                    ? arg.stack
                    : typeof arg === 'object'
                      ? JSON.stringify(arg)
                      : arg
            )
            .join(' ')

        return `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message} ${formattedArgs}`
    }

    private log(level: LogLevel, source: string, message: string, ...args: any[]) {
        if (LEVELS[level] < this.minLevel) return

        const formattedMessage = this.formatMessage(level, source, message, ...args)

        // Console output
        switch (level) {
            case 'error':
                console.error(formattedMessage)
                break
            case 'warn':
                console.warn(formattedMessage)
                break
            default:
                console.log(formattedMessage)
        }

        // File output
        if (this.logFile) {
            try {
                fs.appendFileSync(this.logFile, formattedMessage + '\n')
            } catch (error) {
                console.error('Failed to write to log file:', error)
            }
        }
    }

    debug(source: string, message: string, ...args: any[]) {
        this.log('debug', source, message, ...args)
    }

    info(source: string, message: string, ...args: any[]) {
        this.log('info', source, message, ...args)
    }

    warn(source: string, message: string, ...args: any[]) {
        this.log('warn', source, message, ...args)
    }

    error(source: string, message: string, ...args: any[]) {
        this.log('error', source, message, ...args)
    }
}

export const logger = new LoggerService()
