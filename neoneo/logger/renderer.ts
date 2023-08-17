// @no-inject-logger

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import BaseLogger, { LogLevelName, logLevels, makeTimestamp, specialColors } from './base';
import console from './copy-console';

export default class BrowserLogger extends BaseLogger {
    private log(logLevel: LogLevelName, message?: any, ...rest: any[]): this {
        if (!this.check()) return this;

        const messageFormatted = `%c${makeTimestamp()}%c %c${this.prefix}%c %c${logLevel.toUpperCase()}%c`;

        let logFunc: typeof console.log;

        switch (logLevel) {
            case LogLevelName.trace:
                logFunc = console.trace;
                break;
            case LogLevelName.debug:
                logFunc = console.debug;
                break;
            case LogLevelName.warn:
                logFunc = console.warn;
                break;
            case LogLevelName.error:
            case LogLevelName.fatal:
                logFunc = console.error;
                break;
            default:
                logFunc = console.log;
                break;
        }

        logFunc(
            messageFormatted,
            `color: ${specialColors.timestamp.cssColor}`,
            `color: inherit`,
            `color: ${specialColors.prefix.cssColor}`,
            `color: inherit`,
            `color: ${logLevels[logLevel].cssColor}`,
            `color: inherit`,
            message,
            ...rest,
        );

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
