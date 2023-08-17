/**
 * TSES - Type Safe Event System
 *
 * A strongly typed event system for Electron (and can be adapted for any kind of event system)
 */
import { ipcMain, IpcRenderer, ipcRenderer, WebContents, webFrame } from 'electron';
import { ProcessType, processType } from './process';

type Webview = Electron.WebviewTag;

/**
 * Represents the direction (which process) an event is being sent to.
 */
export const enum MessageDirection {
    /**
     * A given {@link WebContents} or {@link Webview}.
     */
    ToWebContents,
    /**
     * The main process.
     */
    ToMainProcess,
    /**
     * The host <webview> element of the current webview.
     */
    ToWebViewHost,
}

/**
 * The parameters for a TSTE event.
 */
export interface EventHeader {
    /**
     * The direction this event is being sent to.
     */
    direction: MessageDirection;

    /**
     * The unique event ID.
     */
    type: string;

    /**
     * If `true`, calls to {@link dispatch} will return a {@link Promise} and wait for a response from the other side.
     * If the event has no response type, the return value will be `Promise<void>`
     */
    waitForResponse?: boolean;
}

/** A unique symbol that determines an event was actually created by {@link makeEvent}. */
const eventSymbol = Symbol('this is an event');

/** The type that represents a TSTE event class. */
type EventType<TPayload, TResponse, THeader extends EventHeader = EventHeader> = {
    new(payload: TPayload): BaseEvent<TPayload, TResponse, THeader>;
    readonly header: THeader;
    [eventSymbol]: true;
};

/** The base class for all TSTE event types. */
abstract class BaseEvent<TPayload, TResponse, THeader extends EventHeader = EventHeader> {
    readonly [eventSymbol] = true;

    constructor(public readonly payload: TPayload) {}

    // unused!!! only here so that TypeScript doesn't act like TResponse and THeader don't exist
    private readonly r?: TResponse;
    private readonly h?: THeader;
}

/** A mapping of all registered events for tracking duplicate events. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventMap = new Map<string, EventType<unknown, unknown>>();

/** Thrown when two events are registered with the same `type`. */
export class DuplicateEventRegistrationError<T1 = unknown, T2 = unknown, T3 = unknown, T4 = unknown> extends Error {
    /**
     * @internal
     * @param newEvent The event that is attempting to be registered
     * @param existingEvent The previously registered event
     */
    constructor(
        public newEvent: EventType<T1, T2>,
        public existingEvent: EventType<T3, T4>,
    ) {
        super('Event type conflict: Between events ' + newEvent + ' and ' + existingEvent);
    }
}

/**
 * Registers and returns a new TSES event.
 * @param header The event header.
 * @param type The event. must be a class in the format: `class { payload: TPayload, response: TResponse }`
 */
export function makeEvent<
    THeader extends EventHeader,
    TPayload,
    TResponse
>(header: THeader, type: { new(): { payload?: TPayload, response?: TResponse } }): EventType<TPayload, TResponse, THeader>;
/**
 * Registers and returns a new TSES event.
 * @param header The event header.
 * @param type The event. must be a class in the format: `class { payload: TPayload }`
 */
export function makeEvent<
    THeader extends EventHeader,
    TPayload
>(header: THeader, type: { new(): { payload?: TPayload } }): EventType<TPayload, void, THeader>;
export function makeEvent<
    THeader extends EventHeader,
    TPayload,
    TResponse
>(header: THeader, _: { new(): { payload?: TPayload, response?: TResponse } }): EventType<TPayload, TResponse, THeader> {
    const event = {[header.type]: class extends BaseEvent<TPayload, TResponse, THeader> { // wrap in object to rename class
        static readonly header = header;
        static readonly [eventSymbol] = true;

        constructor(payload: TPayload) {
            super(payload);
        }

        get [Symbol.toStringTag]() {
            return `StorageZone (${header.type})`;
        }
    }}[header.type];

    if (eventMap.get(header.type) !== undefined) {
        throw new DuplicateEventRegistrationError(event, eventMap.get(header.type)!);
    }

    eventMap.set(header.type, event as EventType<unknown, unknown>);
    return event;
}

/** Currently hooked event listeners for this script */
const listeners = new Map<string, {
    header: EventHeader,
    callback: EventCallback<unknown, unknown>,
}>();

/** The type of the callback function for listened events */
type EventCallback<TPayload, TResponse> = (message: TPayload, sender: IpcRenderer | WebContents | Webview) => TResponse | Promise<TResponse>;

/**
 * Listen to an event specified by the event type `ctor`.
 * @param ctor The event type
 * @param listener The listener to be invoked
 */
export function listen<E extends EventType<P, R, H>, P, R, H extends EventHeader>(ctor: E & EventType<P, R, H>, listener: EventCallback<P, R>): void;
/**
 * Listen to a {@link MessageDirection.ToWebViewHost} event specified by the event type `ctor` for the given webview tag
 * `webview`
 * @param webview The webview element
 * @param ctor The event type
 * @param listener The listener to be invoked
 */
export function listen<E extends EventType<P, R, H>, P, R, H extends EventHeader & { direction: MessageDirection.ToWebViewHost }>(webview: Webview, ctor: E & EventType<P, R, H>, listener: EventCallback<P, R>): void;
export function listen<
    TEvent extends EventType<TPayload, TResponse, THeader>,
    TPayload,
    TResponse,
    THeader extends EventHeader,
>(webviewOrCtor: Webview | TEvent, ctorOrListener: TEvent | EventCallback<TPayload, TResponse>, maybeListener?: EventCallback<TPayload, TResponse>): void {
    const ctor = eventSymbol in webviewOrCtor
        ? webviewOrCtor as TEvent
        : ctorOrListener as TEvent;

    const listener = maybeListener !== undefined
        ? maybeListener
        : ctorOrListener as EventCallback<TPayload, TResponse>;

    const webview = !(eventSymbol in webviewOrCtor)
        ? webviewOrCtor as Webview
        : undefined;

    const header = ctor.header;

    if (processType === ProcessType.Main) {
        if (header.direction !== MessageDirection.ToMainProcess) {
            throw new Error(`Listening from incorrect side; expected ${header.direction}`);
        }
    } else {
        if (header.direction !== MessageDirection.ToWebContents && (header.direction !== MessageDirection.ToWebViewHost || processType !== ProcessType.Webview)) {
            throw new Error(`Listening from incorrect side; expected ${header.direction}`);
        }
    }

    if (webview !== undefined) {
        installWebviewListener(webview, header, listener);
        return;
    }

    listeners.set(
        header.type,
        {
            header: ctor.header,
            callback: listener as EventCallback<unknown, unknown>
        }
    );
}

let idIncrement = 0;

/** Gets an ID number that is unique within this  */
function getUniqueId(): number {
    return idIncrement++;
}

/**
 * A mapping from listener ID to a Promise's resolve() function that takes a response value; used for
 * {@link BuiltInEvents.ToMainProcessTwoWayResponse} and {@link BuiltInEvents.ToWebviewTwoWayResponse}.
 *
 * An entry in this map is registered when dispatching {@link BuiltInEvents.ToRendererProcessTwoWay} or
 * {@link BuiltInEvents.ToWebviewHostTwoWay}, and then retrieved in the XXXTwoWayResponse handler.
 */
const twoWayDispatchListeners = new Map<number, (value: unknown) => void>();

/**
 * Dispatches an event to the given {@link Webview}
 * @param webview The target webview
 * @param event The event instance
 * @return A promise that resolves with the response from the listener to this event, or `void` if there is no response type
 */
export function dispatch<TEvent extends EventType<P, R, H>, P, R, H extends EventHeader & { direction: MessageDirection.ToWebContents }>(webview: Webview, event: InstanceType<TEvent> & BaseEvent<P, R, H>): Promise<R>;
/**
 * Dispatches an event to the given {@link WebContents}
 * @param webContents The target webcontents
 * @param event The event instance
 * @return A promise that resolves with the response from the listener to this event, or `void` if there is no response type
 */
export function dispatch<TEvent extends EventType<P, R, H>, P, R, H extends EventHeader & { direction: MessageDirection.ToWebContents }>(webContents: WebContents, event: InstanceType<TEvent> & BaseEvent<P, R, H>): Promise<R>;
/**
 * Dispatches an event to the main process
 * @param event The event instance
 * @return A promise that resolves with the response from the listener to this event, or `void` if there is no response type
 */
export function dispatch<TEvent extends EventType<P, R, H>, P, R, H extends EventHeader & { direction: MessageDirection.ToMainProcess }>(event: InstanceType<TEvent> & BaseEvent<P, R, H>): Promise<R>;
/**
 * Dispatches an event to the host <webview> element of the current
 * @param event The event instance
 * @return A promise that resolves with the response from the listener to this event, or `void` if there is no response type
 */
export function dispatch<TEvent extends EventType<P, R, H>, P, R, H extends EventHeader & { direction: MessageDirection.ToWebViewHost }>(event: InstanceType<TEvent> & BaseEvent<P, R, H>): Promise<R>;
export async function dispatch<
    TEvent extends EventType<TPayload, TResponse, THeader>,
    TPayload,
    TResponse,
    THeader extends EventHeader,
>(eventOrWebContentsOrWebview: InstanceType<TEvent> | WebContents | Webview, maybeEvent?: InstanceType<TEvent>): Promise<TResponse | void> {
    const event = eventSymbol in eventOrWebContentsOrWebview
        ? eventOrWebContentsOrWebview as InstanceType<TEvent>
        : maybeEvent!;

    const { header: { direction, type, waitForResponse: expectsResponse } } = event.constructor as TEvent;

    if (direction === MessageDirection.ToWebContents) {
        const webContentsOrWebview = eventOrWebContentsOrWebview as WebContents | Webview;

        // for webview/webContents, only send() is available. so we send() a message and then await a specific response.
        if (expectsResponse) {
            const id = getUniqueId();

            const { promise, resolve } = makeResolvable<TResponse>(); // TODO add timeout?

            try {
                twoWayDispatchListeners.set(id, resolve as (value: unknown) => void);
                webContentsOrWebview.send(BuiltInEvents.ToRendererProcessTwoWay, id, type, event.payload);
                return await promise;
            } finally {
                twoWayDispatchListeners.delete(id);
            }
        }

        // else {
        webContentsOrWebview.send(BuiltInEvents.ToRendererProcess, type, event.payload);
        return;
    } else if (direction === MessageDirection.ToMainProcess && processType !== ProcessType.Main) {
        if (expectsResponse) {
            return await ipcRenderer.invoke(BuiltInEvents.ToMainProcessHandle, type, event.payload);
        }

        // else {
        ipcRenderer.send(BuiltInEvents.ToMainProcess, type, event.payload);
        return;
    } else if (direction === MessageDirection.ToWebViewHost && processType === ProcessType.Webview) {
        // for webview, only sendToHost() is available. so we sendToHost() a message and then await a specific response.
        if (expectsResponse) {
            const id = getUniqueId();

            const { promise, resolve } = makeResolvable<TResponse>(); // TODO add timeout?

            try {
                twoWayDispatchListeners.set(id, resolve as (value: unknown) => void);
                ipcRenderer.sendToHost(BuiltInEvents.ToWebviewHostTwoWay, type, event.payload);
                return await promise;
            } finally {
                twoWayDispatchListeners.delete(id);
            }
        }

        // else {
        ipcRenderer.sendToHost(BuiltInEvents.ToWebviewHost, type, event.payload);
        return;
    }

    throw new Error(`Dispatching from incorrect side; expected ${direction}`);
}

function makeResolvable<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
    let resolve: (value: T) => void;
    return {
        promise: new Promise<T>(resolve1 => resolve = resolve1),
        resolve: resolve!
    };
}

const enum BuiltInEvents {
    // Renderer -> Main (WebContents or Webview)
    /**
     * send() to ipcMain
     *
     * (type, payload) => void
     */
    ToMainProcess = 'comms',
    /**
     * invoke() to ipcMain
     *
     * (type, payload) => response
     */
    ToMainProcessHandle = 'comms-handle',

    // Main -> Renderer (WebContents or Webview)
    /**
     * send() to ipcRenderer
     *
     * (type, payload) => void
     */
    ToRendererProcess = 'comms',
    /**
     * send() to ipcRenderer, then sends {@link ToMainProcessTwoWayResponse}
     *
     * (id, type, payload) => void
     */
    ToRendererProcessTwoWay = 'comms-two-way',
    /**
     * send() to ipcMain as a response for {@link ToRendererProcessTwoWay}
     *
     * (id, response) => void
     */
    ToMainProcessTwoWayResponse = 'comms-two-way-response',

    // Webview -> Webview Host <webview> Element
    /**
     * send() to <webview> ipc-message event
     *
     * (type, payload) => void
     */
    ToWebviewHost = 'comms',
    /**
     * send() to <webview> ipc-message event, then sends {@link ToWebviewTwoWayResponse}
     *
     * (id, type, payload) => void
     */
    ToWebviewHostTwoWay = 'comms-webview-host-two-way',
    /**
     * send() to webview ipcRenderer as a response for {@link ToWebviewHostTwoWay}
     *
     * (id, response) => void
     */
    ToWebviewTwoWayResponse = 'comms-webview-host-two-way-response',
}

if (processType === ProcessType.Main) {
    ipcMain.on(BuiltInEvents.ToMainProcess, async (event, type: string, payload: unknown) => {
        const listener = listeners.get(type);
        if (listener !== undefined) {
            try {
                await listener.callback(
                    payload,
                    event.sender
                );
            } catch (err) {
                throw new Error('During event listen handling', { cause: err as Error });
            }
        }
    });
    ipcMain.handle(BuiltInEvents.ToMainProcessHandle, async (event, type: string, payload: unknown) => {
        const listener = listeners.get(type);
        if (listener !== undefined) {
            try {
                const response = await listener.callback(
                    payload,
                    event.sender
                );

                if (listener.header.waitForResponse) {
                    return response;
                }
            } catch (err) {
                throw new Error('During event listen handling', { cause: err as Error });
            }
        }
    });
    ipcMain.on(BuiltInEvents.ToMainProcessTwoWayResponse, (event, id, response) => {
        twoWayDispatchListeners.get(id)?.(response);
    });
} else {
    ipcRenderer.on(BuiltInEvents.ToRendererProcess, async (event, type: string, payload: unknown) => {
        const listener = listeners.get(type);
        if (listener !== undefined) {
            try {
                await listener.callback(
                    payload,
                    event.sender
                );
            } catch (err) {
                throw new Error('During event listen handling', { cause: err as Error });
            }
        }
    });
    ipcRenderer.on(BuiltInEvents.ToRendererProcessTwoWay, async (event, id: number, type: string, payload: unknown) => {
        const listener = listeners.get(type);
        if (listener !== undefined) {
            try {
                const response = await listener.callback(
                    payload,
                    event.sender
                );

                if (listener.header.waitForResponse) {
                    event.sender.send(BuiltInEvents.ToMainProcessTwoWayResponse, id, response);
                }
            } catch (err) {
                throw new Error('During event listen handling', { cause: err as Error });
            }
        }
    });
}

if (processType === ProcessType.Webview) {
    ipcRenderer.on(BuiltInEvents.ToWebviewTwoWayResponse, (event, id, response) => {
        twoWayDispatchListeners.get(id)?.(response);
    });
}

function installWebviewListener<TPayload, TResponse, THeader extends EventHeader>(webview: Electron.WebviewTag, header: THeader, listener: EventCallback<TPayload, TResponse>) {
    if (header.waitForResponse) {
        webview.addEventListener('ipc-message', async ({ channel, args }) => {
            if (channel !== BuiltInEvents.ToWebviewHostTwoWay)
                return;

            const [id, type, payload] = args;

            if (type !== header.type)
                return;

            const response = await listener(payload, webview);

            webview.send(BuiltInEvents.ToWebviewTwoWayResponse, id, response);
        });
    } else {
        webview.addEventListener('ipc-message', async ({ channel, args }) => {
            if (channel !== BuiltInEvents.ToWebviewHost)
                return;

            const [type, payload] = args;

            if (type !== header.type)
                return;

            try {
                await listener(
                    payload,
                    webview
                );
            } catch (err) {
                throw new Error('During event listen handling', { cause: err as Error });
            }
        });
    }
}
