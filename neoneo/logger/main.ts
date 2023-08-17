// @no-inject-logger

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as util from 'node:util';
import BaseLogger, { LogLevelName, logLevels, makeTimestamp, specialColors } from './base';
import console from './copy-console';

declare global {
    // eslint-disable-next-line no-var
    var disableConsoleFormat: boolean;
}

global.disableConsoleFormat = false;

const tsOpen = specialColors.timestamp.ansiColor.open;
const tsClose = specialColors.timestamp.ansiColor.close;
const preOpen = specialColors.prefix.ansiColor.open;
const preClose = specialColors.prefix.ansiColor.close;

const inspectOptions: util.InspectOptions = {
    colors: true,
    showProxy: true,
};

const logFunctions: Record<LogLevelName, (...data: unknown[]) => void> = {
    [LogLevelName.trace]: console.trace,
    [LogLevelName.debug]: console.debug,
    [LogLevelName.info]: console.log,
    [LogLevelName.warn]: console.warn,
    [LogLevelName.error]: console.error,
    [LogLevelName.fatal]: console.error,
};

export default class NodeLogger extends BaseLogger {
    private log(logLevel: LogLevelName, message?: unknown, ...rest: unknown[]): this {
        if (!this.check()) return this;

        if (global.disableConsoleFormat) {
            logFunctions[logLevel](logLevel, message, ...rest);
            return this;
        }
        const { open, close } = logLevels[logLevel].ansiColor;

        logFunctions[logLevel](`${tsOpen}${makeTimestamp()}${tsClose} ${preOpen}${this.prefix}${preClose} ${open}${logLevel.toUpperCase()}${close} ${util.formatWithOptions(inspectOptions, message, ...rest)}`);
        return this;
    }

    trace(message: string): this;
    trace(format: string, ...args: unknown[]): this;
    trace(...objects: unknown[]): this;
    trace(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.trace, message, ...rest);
    }
    debug(message: string): this;
    debug(format: string, ...args: unknown[]): this;
    debug(...objects: unknown[]): this;
    debug(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.debug, message, ...rest);
    }
    info(message: string): this;
    info(format: string, ...args: unknown[]): this;
    info(...objects: unknown[]): this;
    info(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.info, message, ...rest);
    }
    warn(message: string): this;
    warn(format: string, ...args: unknown[]): this;
    warn(...objects: unknown[]): this;
    warn(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.warn, message, ...rest);
    }
    error(message: string): this;
    error(format: string, ...args: unknown[]): this;
    error(...objects: unknown[]): this;
    error(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.error, message, ...rest);
    }
    fatal(message: string): this;
    fatal(format: string, ...args: unknown[]): this;
    fatal(...objects: unknown[]): this;
    fatal(message?: any, ...rest: any[]): this {
        return this.log(LogLevelName.fatal, message, ...rest);
    }
}
