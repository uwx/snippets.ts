/* eslint-disable unicorn/prevent-abbreviations */

import { CollectionOperator, Multimap } from './multimap';

export class ArrayMultimap<K, V> extends Multimap<K, V, readonly V[]> {
    constructor(iterable?: Iterable<[K, V]>) {
        super(new ArrayOperator(), iterable);
    }

    get [Symbol.toStringTag](): string {
        return 'ArrayMultimap';
    }

    findAndDeleteEntry<T>(key: K, predicate: (this: T | this, value: V, key: K, map: this) => boolean, thisArg?: T): boolean {
        const current = this.map.get(key);
        if (current === undefined) return false;

        const index = current.findIndex(v => predicate.call(thisArg === undefined ? this : thisArg, v, key, this));
        if (index === -1) return false;

        (current as V[]).splice(index, 1);
        return true;
    }
}

class ArrayOperator<V> implements CollectionOperator<V, V[]> {
    static emptyArray: unknown[];

    empty(): V[] {
        return (ArrayOperator.emptyArray ??= []) as V[];
    }

    create(): V[] {
        return [];
    }

    add(value: V, collection: V[]): boolean {
        collection.push(value);
        return true;
    }

    size(collection: V[]): number {
        return collection.length;
    }

    delete(value: V, collection: V[]): boolean {
        const index = collection.indexOf(value);
        if (index > -1) {
            collection.splice(index, 1);
            return true;
        }
        return false;
    }

    has(value: V, collection: V[]): boolean {
        return collection.includes(value);
    }
}
