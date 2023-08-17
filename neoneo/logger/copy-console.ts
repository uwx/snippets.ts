// @no-inject-logger

export default {
    debug: console.debug.bind(console) as typeof console.debug,
    log: console.log.bind(console) as typeof console.log,
    warn: console.warn.bind(console) as typeof console.warn,
    error: console.error.bind(console) as typeof console.error,
    trace: console.trace.bind(console) as typeof console.trace,
};
