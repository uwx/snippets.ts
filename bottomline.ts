// https://github.com/Maggi64/moderndash
// https://github.com/kutyel/linq.ts

export type Comparer<T> = (a: T, b: T) => number;
export type Iteratee<T, TReturn = unknown> = ((value: T) => TReturn) | keyof T;

/**
 * Sorts an array without mutating.
 * @param array The array.
 * @param compareFn The function to use as an element comparer.
 * @returns The newly sorted array.
 */
export function sort<T>(array: T[], compareFn?: Comparer<T>): T[] {
    return array.concat().sort(compareFn);
}

export function maxBy<T>(array: T[], by: Iteratee<T>) {
    let maxIndex = -1;
    let maxValue = Number.MIN_VALUE;
    for (let i = 0; i < array.length; i++) {
        const value = Number(getPropertyScavenger(by)(array[i]));
        if (value > maxValue) {
            maxIndex = i;
            maxValue = value;
        }
    }
    return maxIndex !== -1 ? array[maxIndex] : undefined;
}

export function minBy<T>(array: T[], by: Iteratee<T>) {
    let maxIndex = -1;
    let maxValue = Number.MAX_VALUE;
    for (let i = 0; i < array.length; i++) {
        const value = Number(getPropertyScavenger(by)(array[i]));
        if (value < maxValue) {
            maxIndex = i;
            maxValue = value;
        }
    }
    return maxIndex !== -1 ? array[maxIndex] : undefined;
}

export function meanBy<T>(array: T[], by: Iteratee<T>) {
    const iteratee1 = getPropertyScavenger(by);

    return array.reduce((a, b) => a + Number(iteratee1(b)), 0) / array.length;
}

function getPropertyScavenger<T, F extends (value: T) => unknown>(iteratee: F): F;
function getPropertyScavenger<T, TResult = unknown>(iteratee: Iteratee<T, TResult>): (value: T) => TResult;
function getPropertyScavenger<T>(iteratee: Iteratee<T>): (value: T) => unknown {
    if (typeof iteratee === 'function') {
        return iteratee;
    }
    return (value: T) => (value as Record<keyof T, unknown>)[iteratee];
}

function identity<T>(e: T) {
    return e;
}

function compareAscending<T>(a: T, b: T): 0 | 1 | -1 {
    return a > b ? 1 : a === b ? 0 : -1;
}

const emptyArrCache = Object.freeze([] as const);
export function createOrderBy<T>(iteratees?: readonly Iteratee<T>[], orders?: ReadonlyArray<'asc' | 'desc'>): Comparer<T> {
    const criteria = !iteratees?.length ? [identity] : iteratees.map(getPropertyScavenger);

    orders ??= emptyArrCache;

    const criteriaLen = criteria.length;
    const ordersLen = orders.length;

    return (a, b) => {
        for (let index = 0; index < criteriaLen; index++) {
            const criterion = criteria[index];

            const result = compareAscending(criterion(a), criterion(b));
            if (result !== 0) {
                if (index >= ordersLen) {
                    return result;
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return orders![index] === 'desc' ? -result : result;
            }
        }

        return 0;
    };
}

export function group<T, K extends keyof T>(array: readonly T[], byKey: K): Record<K, T[]>;
export function group<T, F extends ((value: T) => PropertyKey)>(array: readonly T[], by: F): Record<ReturnType<F>, T[]>;
export function group<T>(array: readonly T[], by: Iteratee<T>): Record<PropertyKey, T[]> {
    by = getPropertyScavenger(by);

    const result = {} as Record<PropertyKey, T[]>;
    for (const e of array) {
        const key = by(e);
        (result[key as PropertyKey] ??= []).push(e);
    }
    return result;
}

export function groupJoin<T, U, R>(a: readonly T[], b: readonly U[], by1: Iteratee<T>, by2: Iteratee<U>, mapResult: (a: T, b: readonly U[]) => R) {
    const aby1 = getPropertyScavenger(by1);
    const aby2 = getPropertyScavenger(by2);

    return a.map(e => mapResult(e, b.filter(e1 => aby1(e) === aby2(e1))));
}


export function zip<T, U, R>(a: readonly T[], b: readonly U[], mapResult: (a: T, b: U) => R) {
    return b.length < a.length
        ? b.map((e, i) => mapResult(a[i], e))
        : a.map((e, i) => mapResult(e, b[i]))
}

/**
 * Creates an array of elements split into groups the length of size. If array can't be split evenly, the final chunk will be the remaining elements.
 *
 * @example
 * chunk(['a', 'b', 'c', 'd'], 2)
 * // => [['a', 'b'], ['c', 'd']]
 *
 * chunk(['a', 'b', 'c', 'd'], 3)
 * // => [['a', 'b', 'c'], ['d']]
 * @param chunkSize The length of each chunk
 * @param array The array to chunk
 * @template T The type of the array elements
 * @returns Returns the new array of chunks
 */
export function chunk<T>(array: readonly T[], chunkSize: number): T[][] {
    if (array.length === 0 || chunkSize < 1)
        return [];

    const intSize = Math.trunc(chunkSize);

    let index = 0;
    let resultIndex = 0;
    const result: T[][] = new Array(Math.ceil(array.length / intSize));

    while (index < array.length) {
        result[resultIndex++] = array.slice(index, (index += intSize));
    }

    return result;
}

export function debounce<T extends (...args: TArgs) => void, TArgs extends unknown[]>(func: T, timeout = 300) {
    let timer: NodeJS.Timeout;
    return (...args: TArgs): void => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), timeout);
    };
}

// Debounce that waits for the promise to complete if the debounced function returns a promise
export function debouncePromisey<T extends () => void | Promise<void>>(func: T, timeout = 300) {
    let timer: NodeJS.Timeout;
    let busy = false;
    let scheduled = false;
    let promise: Promise<void> | undefined;

    function debounced(): void {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (busy && !scheduled) {
                scheduled = true;
                promise!.then(() => {
                    scheduled = false;
                    debounced();
                }, err => {
                    scheduled = false;
                    throw err;
                })
            }
            const result = func();
            if (result !== undefined) {
                promise = result;
                busy = true;
                result.then(() => {
                    busy = false;
                }, err => {
                    busy = false;
                    throw err;
                });
            }
        }, timeout);
    }

    return debounced;
}

export function* iter<T extends object>(obj: T): Generator<[key: keyof T, value: T[keyof T]]> {
    for (const k in obj) {
        if (Object.hasOwn(obj, k)) {
            yield [k, obj[k]];
        }
    }
}

export function wait(durationMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs));
}
