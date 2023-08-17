/* eslint-disable @typescript-eslint/no-var-requires */

// Type import only
import BaseLogger from './logger/base';
import NodeLogger from './logger/main';
import BrowserLogger from './logger/renderer';

declare const ELECTRON_IS_MAIN: boolean;

type Logger = BaseLogger;
const Logger: typeof NodeLogger | typeof BrowserLogger = ELECTRON_IS_MAIN
    ? require('./logger/main').default as typeof NodeLogger
    : require('./logger/renderer').default as typeof BrowserLogger;

export default Logger;
