// @no-inject-logger

import { styles as colorCodes } from 'ansi-colors';
import * as path from 'node:path';

const startTimeUnix = Date.now();

export const enum LogLevelName {
    trace = 'trace',
    debug = 'debug',
    info = 'info',
    warn = 'warn',
    error = 'error',
    fatal = 'fatal',
}

export interface LogLevel {
    ansiColor: { open: string, close: string};
    cssColor: string;
}

export const logLevels: Record<LogLevelName, LogLevel> = {
    [LogLevelName.trace]: { ansiColor: colorCodes.blackBright, cssColor: '#696969' },
    [LogLevelName.debug]: { ansiColor: colorCodes.greenBright, cssColor: '#8dd006' },
    [LogLevelName.info]: { ansiColor: colorCodes.cyanBright, cssColor: '#42baff' },
    [LogLevelName.warn]: { ansiColor: colorCodes.yellowBright, cssColor: '#f5e85d' },
    [LogLevelName.error]: { ansiColor: colorCodes.redBright, cssColor: '#fc4242' },
    [LogLevelName.fatal]: { ansiColor: colorCodes.red, cssColor: '#b00000' },
};

export const specialColors = {
    prefix: { ansiColor: colorCodes.magenta, cssColor: '#e300f7' } as LogLevel,
    timestamp: { ansiColor: colorCodes.black, cssColor: '#525252' } as LogLevel
};

export default abstract class BaseLogger {
    protected prefix: string;
    private static disabledCategories?: Set<string>;

    /**
     * Creates a new logger.
     * @param filename The name of the current file
     */
    constructor(filename: string);
    /** @internal For webpack prepend-loader use only */
    constructor(filename: undefined, prefixOverride: string);
    constructor(filename?: string, prefixOverride?: string) {
        if (prefixOverride !== undefined) {
            this.prefix = prefixOverride;
            return;
        }

        this.prefix = path.basename(filename!, '.js');

        if (this.prefix === 'index' || this.prefix === 'main') {
            this.prefix = `${path.basename(path.dirname(filename!))}/${this.prefix}`;
        }
    }

    abstract trace(message: string): BaseLogger;
    abstract trace(format: string, ...args: unknown[]): BaseLogger;
    abstract trace(...objects: unknown[]): BaseLogger;

    abstract debug(message: string): BaseLogger;
    abstract debug(format: string, ...args: unknown[]): BaseLogger;
    abstract debug(...objects: unknown[]): BaseLogger;

    abstract info(message: string): BaseLogger;
    abstract info(format: string, ...args: unknown[]): BaseLogger;
    abstract info(...objects: unknown[]): BaseLogger;

    abstract warn(message: string): BaseLogger;
    abstract warn(format: string, ...args: unknown[]): BaseLogger;
    abstract warn(...objects: unknown[]): BaseLogger;

    abstract error(message: string): BaseLogger;
    abstract error(format: string, ...args: unknown[]): BaseLogger;
    abstract error(...objects: unknown[]): BaseLogger;

    abstract fatal(message: string): BaseLogger;
    abstract fatal(format: string, ...args: unknown[]): BaseLogger;
    abstract fatal(...objects: unknown[]): BaseLogger;

    /**
     * @returns Whether or not logging is enabled for this prefix.
     */
    check(): boolean {
        const disabledCategories = BaseLogger.disabledCategories;
        return disabledCategories === undefined || !disabledCategories.has(this.prefix);
    }

    /**
     * Disables a logging category.
     * @param category The category name
     * @returns The current logger
     */
    disable(category: string): BaseLogger {
        (BaseLogger.disabledCategories ??= new Set<string>()).add(category);
        return this;
    }

    /**
     * Enables a logging category.
     * @param category The category name
     * @returns The current logger
     */
    enable(category: string): BaseLogger {
        BaseLogger.disabledCategories?.delete(category);
        return this;
    }
}

export function makeTimestamp(): string {
    let elapsedTime = Date.now() - startTimeUnix;

    const milliseconds = elapsedTime % 1000;
    elapsedTime /= 1000;
    elapsedTime |= 0;

    if (elapsedTime === 0) {
        return `+0.${milliseconds.toString().padStart(3, '0')}`;
    }

    const seconds = elapsedTime % 60;
    elapsedTime /= 60;
    elapsedTime |= 0;

    if (elapsedTime === 0) {
        return `+${seconds}.${milliseconds.toString().padStart(3, '0')}`;
    }

    const minutes = elapsedTime % 60;
    elapsedTime /= 60;
    elapsedTime |= 0;

    if (elapsedTime === 0) {
        return `+${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }

    const hours = elapsedTime; // % 24 if want to add days

    return `+${hours}h${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}
