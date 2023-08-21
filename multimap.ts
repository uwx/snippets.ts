// https://github.com/github/multimap/blob/master/LICENSE
/*!
Copyright (c) 2020 GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
export class Multimap<K, V> implements Map<K, ReadonlySet<V>> {
    private map: Map<K, Set<V>> = new Map();

    constructor(iterable?: Iterable<[K, V]>) {
        if (iterable) {
            for (const [k, v] of iterable) {
                this.add(k, v);
            }
        }
    }

    get [Symbol.toStringTag]() {
        return '[Multimap multimap]';
    }

    static fromMap<K, V>(map: Iterable<[K, ReadonlySet<V>]>) {
        const mm = new Multimap<K, V>();
        for (const [k, values] of map) {
            for (const v of values) {
                mm.add(k, v);
            }
        }
        return mm;
    }

    get(key: K): ReadonlySet<V> {
        const values = this.map.get(key);
        return values ?? new Set();
    }

    set(key: K, value: ReadonlySet<V>): this {
        this.map.set(key, new Set(value));
        return this;
    }

    add(key: K, value: V): this {
        let values = this.map.get(key);
        if (values === undefined) {
            values = new Set();
            this.map.set(key, values);
        }
        values.add(value);
        return this;
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    delete(key: K, value?: V): boolean {
        const values = this.map.get(key);
        if (!values) return false;
        if (!value) return this.map.delete(key);

        const deleted = values.delete(value);
        if (!values.size) this.map.delete(key);
        return deleted;
    }

    *drain(value: V): Generator<K> {
        for (const key of this.keys()) {
            if (this.delete(key, value) && !this.has(key)) {
                yield key;
            }
        }
    }

    keys(): IterableIterator<K> {
        return this.map.keys();
    }

    values(): IterableIterator<ReadonlySet<V>> {
        return this.map.values();
    }

    entries(): IterableIterator<[K, ReadonlySet<V>]> {
        return this.map.entries();
    }

    *pairs(): Generator<[K, V]> {
        for (const [k, values] of this.entries()) {
            for (const v of values) {
                yield [k, v];
            }
        }
    }

    [Symbol.iterator](): IterableIterator<[K, ReadonlySet<V>]> {
        return this.entries();
    }

    forEach<T = undefined>(callbackfn: (this: T, value: ReadonlySet<V>, key: K, map: Map<K, ReadonlySet<V>>) => void, thisArg?: T): void {
        this.map.forEach(callbackfn, thisArg);
    }

    forEachPair<T = undefined>(callbackfn: (this: T, value: V, key: K, map: this) => void, thisArg?: T): void {
        if (thisArg !== undefined) callbackfn = callbackfn.bind(thisArg);

        for (const [k, v] of this.pairs()) {
            (callbackfn as any)(v, k, this); // FIXME remove use of any
        }
    }

    clear(): void {
        this.map.clear();
    }

    get size(): number {
        return this.map.size;
    }
}
