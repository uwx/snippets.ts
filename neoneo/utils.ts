/**
 * Creates an object whose properties are equivalent to the indexing operation `object[property][anyProperty]`. Only
 * property names available in the initial value of `object[property]` are considered.
 *
 * @param object The object that has a property to be dynamically accessed.
 * @param property The name of the property in {@link object}
 * @returns A new coalesced object
 */
export function dynamicUnwrap<T, K extends keyof T>(object: T, property: K): T[K] {
    const outObject: PropertyDescriptorMap = {};
    for (const k in object[property]) {
        outObject[k] = {
            get() {
                return object[property][k];
            },
            set(value: T[K][Extract<keyof T[K], string>]) {
                object[property][k] = value;
            },
        };
    }

    return Object.defineProperties({}, outObject) as T[K];
}

export function promiseEvent(target: EventTarget, type: string): Promise<Event> & { cancel: () => void } {
    let resolve: (value: Event) => void;
    let reject: (error?: unknown) => void;
    const promise: Promise<Event> & { cancel?: () => void } = new Promise<Event>((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });

    target.addEventListener(type, resolve!, {once: true});

    promise.cancel = () => {
        target.removeEventListener(type, resolve);
        reject(new Error('Canceled'));
    };

    return promise as Promise<Event> & { cancel: () => void };
}

declare const ELECTRON_IS_MAIN: boolean;

export const $ = ELECTRON_IS_MAIN
    ? () => null
    : document.querySelector.bind(document) as typeof document.querySelector;

export const $$ = ELECTRON_IS_MAIN
    ? () => []
    : document.querySelectorAll.bind(document) as typeof document.querySelectorAll;

/**
 * Returns a promise that completes after a specified duration.
 * @param ms The duration, in milliseconds
 * @returns A promise that completes after a specified duration
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const functionProps = new Set(['length', 'name', 'arguments', 'caller', 'prototype']);

function copyConstructor(target: object, source: object) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const prop in descriptors) {
        if (Object.hasOwn(source, prop) && (typeof prop !== 'string' || !functionProps.has(prop)))
            Object.defineProperty(target, prop, descriptors[prop]);
    }
}

function copyPrototype(target: object, source: object) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const prop in descriptors) {
        if (prop !== 'constructor')
            Object.defineProperty(target, prop, descriptors[prop]);
    }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// https://stackoverflow.com/a/50375286
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// Create a compound type of all TBase and TMixins, exclude its constructor, and create a new constructor with the same parameters as TBase that constructs the compound type
type MixinType<
    TBase extends (abstract new (...args: any[]) => any),
    TMixins extends (abstract new () => any)[]
> = TBase extends (abstract new (...args: infer U) => unknown)
    ? Omit<UnionToIntersection<TBase | TMixins[number]>, 'constructor'> & (abstract new (...args: U) => UnionToIntersection<InstanceType<TBase | TMixins[number]>>)
    : never;

// https://stackoverflow.com/a/45332959
export function many<
    TBase extends (abstract new (...args: any[]) => any),
    TMixins extends (abstract new () => any)[]
>(baseClass: TBase, ...mixins: TMixins): MixinType<TBase, TMixins> {
    if (mixins.length === 0) return baseClass as unknown as MixinType<TBase, TMixins>;

    abstract class base extends baseClass {
        constructor(...args: any[]) {
            super(...args);
            for (const mixin of mixins) {
                copyPrototype(this, new (mixin as (new () => any)));
            }
        }
    }

    for (const mixin of mixins) { // outside contructor() to allow aggregation(A,B,C).staticFunction() to be called etc.
        copyPrototype(base.prototype, mixin.prototype);
        copyConstructor(base, mixin);
    }

    return base as unknown as MixinType<TBase, TMixins>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function escapeHtml(unsafe?: string) {
    return unsafe
        ?.replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
    ;
}

export function unescapeHtml(unsafe?: string) {
    return unsafe
        ?.replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#039;', "'")
    ;
}
