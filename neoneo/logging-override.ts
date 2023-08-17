import Logger from './logging';

const log = new Logger('node');

function make(style: keyof typeof import('./logger/copy-console').default): (...data: unknown[]) => void {
    switch (style) {
        case 'debug':
            return (...data) => log.debug(...data);
        case 'log':
            return (...data) => log.info(...data);
        case 'warn':
            return (...data) => log.warn(...data);
        case 'error':
            return (...data) => log.error(...data);
        case 'trace':
            return (...data) => log.trace(...data);
    }
}

console.debug = make('debug');
console.log = make('log');
console.warn = make('warn');
console.error = make('error');
console.trace = make('trace');
