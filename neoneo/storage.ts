import type { ModalData } from '~/preload';
import type { Options as RuffleOptions } from '~/ruffle/common';
import type { RemovableListener } from '~/types';
import type { BotTimers } from '~/bot/bot';
import { ipcMain, ipcRenderer, webContents, WebContents } from 'electron';
import { ArrayMultimap } from '~/util/multimaps';
import { ProcessType, processType } from './process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Define your storage data here
export interface TemporaryStorage {
    modalData: ModalData;
}

export interface PersistedStorage {
    ruffle: RuffleOptions;
    botTimers: BotTimers;
}

const enum Events {
    GetStorage = 'storage-get',
    GetItem = 'storage-get-value',
    SetStorage = 'storage-set',
    SetItem = 'storage-set-value',
    AddOnItemChanged = 'store-add-onchanged',
    RemoveOnItemChanged = 'store-remove-onchanged',
    ItemChanged = 'storage-item-changed'
}

const enum ZoneEnum {
    Temporary, Persisted
}

type TAnyKey = string | number | symbol;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zones = new Map<ZoneEnum, StorageZone>();

abstract class StorageZone<TStorage extends object = object> {
    constructor(
        public zone: ZoneEnum,
        public name: string
    ) {}

    abstract get(): TStorage | Promise<TStorage>;
    abstract set(data: TStorage): void | Promise<void>;

    abstract getItem<Key extends keyof TStorage>(
        key: Key,
    ): TStorage[Key] | Promise<TStorage[Key]>;

    abstract setItem<Key extends keyof TStorage>(
        key: Key,
        value: NonNullable<TStorage>[Key],
    ): void | Promise<void>;

    abstract onItemChanged<Key extends keyof TStorage>(
        key: Key,
        callback: (newValue: TStorage[Key], oldValue: TStorage[Key]) => void,
    ): RemovableListener | Promise<RemovableListener>;

    initializeWithDefaults(defaults: TStorage): void {
        throw new Error('Not implemented for this side');
    }

    get [Symbol.toStringTag]() {
        return `StorageZone (${this.name})`;
    }
}

class MainStorageZone<TStorage extends object = object> extends StorageZone<TStorage> {
    private readonly mainListenerMap: ArrayMultimap<TAnyKey, [id: number, webContentsIdOrCallback: number | ((newValue: unknown, oldValue: unknown) => void)]> = new ArrayMultimap();

    private idIncrement = 0;
    private getNewId() {
        return this.idIncrement++;
    }

    protected constructor(
        zone: ZoneEnum,
        name: string,
        public storage?: TStorage
    ) {
        super(zone, name);
    }

    get(): TStorage {
        return this.storage!;
    }

    set(data: TStorage): void {
        for (const [k, v] of Object.entries(data)) {
            this.emitItemChanged(k, v, this.storage![k as keyof TStorage]);
        }

        Object.assign(this.storage!, data);
    }

    getItem<Key extends keyof TStorage>(
        key: Key,
    ): TStorage[Key] {
        return this.storage![key];
    }

    setItem<Key extends keyof TStorage>(
        key: Key,
        value: NonNullable<TStorage>[Key],
    ): void {
        this.emitItemChanged(key, value, this.storage![key]);
        this.storage![key] = value;
    }

    onItemChanged<Key extends keyof TStorage>(
        key: Key,
        callback: (newValue: TStorage[Key], oldValue: TStorage[Key]) => void,
    ): RemovableListener {
        const id = this.getNewId();
        this.mainListenerMap.put(key, [id, callback as (newValue: unknown, oldValue: unknown) => void]);
        return {
            remove: () => {
                this.mainListenerMap.findAndDeleteEntry(key, e => e[0] === id);
            }
        };
    }

    initializeWithDefaults(defaults: TStorage): void {
        const newStorageData = Object.assign({}, defaults, this.storage ??= {} as TStorage);
        this.set(newStorageData); // dispatches item changed events if necessary
    }

    private emitItemChanged(key: TAnyKey, newValue?: unknown, oldValue?: unknown) {
        const listeners = this.mainListenerMap.get(key);
        let badListeners: Array<[id: number, webContentsId: number]> | undefined = undefined;

        for (const entry of listeners) {
            const [id, webContentsIdOrCallback] = entry;

            if (typeof webContentsIdOrCallback === 'function') {
                webContentsIdOrCallback(newValue, oldValue);
            } else {
                const theWebContents = webContents.fromId(webContentsIdOrCallback);
                if (theWebContents === undefined) {
                    (badListeners ??= []).push(entry as [number, number]);
                    log.info(`WebContents no longer available: ${webContentsIdOrCallback}`);
                    continue;
                }
                theWebContents.send(Events.ItemChanged, this.zone, id, key, newValue, oldValue);
            }
        }

        if (badListeners !== undefined) {
            for (const entry of badListeners) {
                this.mainListenerMap.deleteEntry(key, entry);
            }
        }
    }

    private _removeOnItemChanged(key: string, listenerId: number) {
        this.mainListenerMap.findAndDeleteEntry(key, e => e[0] === listenerId);
    }

    private _addOnItemChanged(key: string, sender: number): number {
        const id = this.getNewId();
        this.mainListenerMap.put(key, [id, sender]);
        return id;
    }

    /**
     * @internal
     */
    static startHandlingEvents() {
        ipcMain.handle(Events.GetStorage, (_, zone: ZoneEnum) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            return theZone.get();
        });
        ipcMain.handle(Events.GetItem, (_, zone: ZoneEnum, key: string) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            return theZone.getItem(key);
        });
        ipcMain.handle(Events.SetStorage, (_, zone: ZoneEnum, data: unknown) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            theZone.set(data as Record<string, unknown>);
        });
        ipcMain.handle(Events.SetItem, (_, zone: ZoneEnum, key: string, value: unknown) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            theZone.setItem(key, value);
        });
        ipcMain.handle(Events.AddOnItemChanged, (event, zone: ZoneEnum, key: string) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            return theZone._addOnItemChanged(key, event.sender.id);
        });
        ipcMain.handle(Events.RemoveOnItemChanged, (_, zone: ZoneEnum, key: string, id: number) => {
            const theZone = zones.get(zone) as MainStorageZone<Record<string, unknown>>;
            theZone._removeOnItemChanged(key, id);
        });
    }
}

class RendererStorageZone<TStorage extends object = object> extends StorageZone<TStorage> {
    private readonly rendererListenerMap: Map<TAnyKey, ((newValue?: unknown, oldValue?: unknown) => void)> = new Map();

    protected constructor(
        zone: ZoneEnum,
        name: string,
    ) {
        super(zone, name);
    }

    async get(): Promise<TStorage> {
        return await ipcRenderer.invoke(Events.GetStorage, this.zone);
    }

    async set(data: TStorage): Promise<void> {
        return await ipcRenderer.invoke(Events.SetStorage, this.zone, data);
    }

    async getItem<Key extends keyof TStorage>(
        key: Key,
    ): Promise<TStorage[Key]> {
        return await ipcRenderer.invoke(Events.GetItem, this.zone, key);
    }

    async setItem<Key extends keyof TStorage>(
        key: Key,
        value: NonNullable<TStorage>[Key],
    ): Promise<void> {
        await ipcRenderer.invoke(Events.SetItem, this.zone, key, value);
    }

    async onItemChanged<Key extends keyof TStorage>(
        key: Key,
        callback: (newValue: TStorage[Key], oldValue: TStorage[Key]) => void,
    ): Promise<RemovableListener> {
        const listenerId = await ipcRenderer.invoke(Events.AddOnItemChanged, this.zone, key);
        this.rendererListenerMap.set(listenerId, callback as (newValue?: unknown, oldValue?: unknown) => void);

        return {
            remove: () => {
                this.rendererListenerMap.delete(listenerId);
                ipcRenderer.invoke(Events.RemoveOnItemChanged, this.zone, key, listenerId);
            },
        };
    }

    private _triggerItemChanged(newValue: unknown, oldValue: unknown, listenerId: number) {
        this.rendererListenerMap.get(listenerId)?.(newValue, oldValue);
    }

    /**
     * @internal
     */
    static startHandlingEvents() {
        ipcRenderer.on(Events.ItemChanged, (_, zone: ZoneEnum, id: number, key: string, newValue: unknown, oldValue: unknown) => {
            const theZone = zones.get(zone) as RendererStorageZone;
            theZone._triggerItemChanged(newValue, oldValue, id);
        });
    }
}

export const temporaryStorage = new class _TemporaryStorage extends ((processType === ProcessType.Main ? MainStorageZone<TemporaryStorage> : RendererStorageZone<TemporaryStorage>) as typeof MainStorageZone<TemporaryStorage>) {
    constructor() {
        super(ZoneEnum.Temporary, 'Temporary');
    }
} as StorageZone<TemporaryStorage>;

export const persistedStorage = new class _PersistedStorage extends ((processType === ProcessType.Main ? MainStorageZone<PersistedStorage> : RendererStorageZone<PersistedStorage>) as typeof MainStorageZone<PersistedStorage>) {
    private static readonly storageFileName = './persistedStorage.json';

    constructor() {
        super(ZoneEnum.Persisted, 'Persisted', _PersistedStorage.getStoredValues());
    }

    private static getStoredValues(): PersistedStorage | undefined {
        if (processType !== ProcessType.Main) {
            return undefined;
        }

        if (existsSync(_PersistedStorage.storageFileName)) {
            return JSON.parse(readFileSync(_PersistedStorage.storageFileName, 'utf8'));
        }
    }

    persist() {
        writeFileSync(_PersistedStorage.storageFileName, JSON.stringify((this as unknown as MainStorageZone).storage));
    }
} as StorageZone<PersistedStorage> & { persist(): void };

(processType === ProcessType.Main ? MainStorageZone : RendererStorageZone).startHandlingEvents();

zones
    .set(ZoneEnum.Temporary, temporaryStorage)
    .set(ZoneEnum.Persisted, persistedStorage);
