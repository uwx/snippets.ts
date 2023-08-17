/*!
MIT License

Copyright (c) 2017 Vincent Driessen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as itertools from 'itertools';
import { Predicate, Primitive } from 'itertools';

type ParametersExceptFirst<F> =
    F extends (arg0: any, ...rest: infer R) => any ? R : never;

type ParametersExceptLast<F> =
    F extends (...rest: [...infer R, any]) => any ? R : never;

type LastParameter<F> =
    F extends (...rest: [...any, infer R]) => any ? R : never;

function toIter<T>(v: T): T | Iter<unknown> {
    if (typeof v === 'object' && v !== null) {
        if (Array.isArray(v)) {
            return v;
        }

        if (Symbol.iterator in v) {
            return new Iter(v as Iterable<unknown>);
        }
    }
    return v;
}

type ConditionalToIter<T>
    = T extends ReadonlyArray<any> ? T : T extends Iterable<infer U>
        ? Iter<U>
        : T;

type RemoveUnknown<T>
    = T extends (...args: infer U) => infer R ? (...args: RemoveUnknown<U>) => RemoveUnknown<R>
    : T extends Array<unknown> ? any // handles tuples properly
    : T extends ReadonlyArray<unknown> ? any // handles tuples properly
    : T extends Iter<infer U> ? Iter<RemoveUnknown<U>>
    : T extends Iterable<infer U> ? Iterable<RemoveUnknown<U>>
    : T extends Iterator<infer U> ? Iterator<RemoveUnknown<U>>
    : T extends ArrayLike<infer U> ? ArrayLike<RemoveUnknown<U>>
    : T extends {} ? T : any;

type ItertoolsMethodToIterMethod<T, I>
    = I extends false
        ? T extends (i: Iterable<any>, ...rest: infer R) => infer U
            ? RemoveUnknown<(...args: R) => ConditionalToIter<U>>
            : never
    : I extends true
        ? T extends (...rest: [...infer R, Iterable<any>]) => infer U
            ? RemoveUnknown<(...args: R) => ConditionalToIter<U>>
            : never
    : never;

function get<V extends (...args: any) => any, I extends boolean>(f: V, instanceLast: I = false as I): ItertoolsMethodToIterMethod<V, I> {
    return instanceLast
        ? function (this: LastParameter<V>, ...args: ParametersExceptLast<V>) {
            return toIter(f(...args, this));
        } as ItertoolsMethodToIterMethod<V, I>
        : function (this: Parameters<V>[0], ...args: ParametersExceptFirst<V>) {
            return toIter(f(this, ...args));
        } as ItertoolsMethodToIterMethod<V, I>;
}

type FlatIter<T> = T extends Iter<Iterator<infer U>>
    ? Iter<U>
    : ConditionalToIter<T>;

export default function iter<T>(iterator: Iterable<T>) {
    return new Iter<T>(iterator);
}

let emptyIterator: Iter<unknown>;

export class Iter<T> implements Iterable<T> {
    constructor(/** @private */ public readonly iterator: Iterable<T>) {}

    [Symbol.iterator]() {
        return this.iterator[Symbol.iterator]();
    }

    mapKeys<K, V, U>(this: Iter<[K, V]>, mapper: (value: K) => U): Iter<[U, V]> {
        return new Iter(this._mapKeys(mapper));
    }

    private *_mapKeys<K, V, U>(this: Iter<[K, V]>, mapper: (value: K) => U): Generator<[U, V]> {
        for (const [k, v] of this) {
            yield [mapper(k), v];
        }
    }

    mapValues<K, V, U>(this: Iter<[K, V]>, mapper: (value: V) => U): Iter<[K, U]> {
        return new Iter(this._mapValues(mapper));
    }

    private *_mapValues<K, V, U>(this: Iter<[K, V]>, mapper: (value: V) => U): Generator<[K, U]> {
        for (const [k, v] of this) {
            yield [k, mapper(v)];
        }
    }

    index(): Iter<[number, T]> {
        return new Iter(this._index());
    }

    private *_index(): Generator<[number, T]> {
        let i = 0;
        for (const v of this) {
            yield [i++, v];
        }
    }

    drop(n: number): Iter<T> {
        if (n === 0) return this;

        return new Iter(this._drop(n));
    }

    private *_drop(n: number): Generator<T> {
        const it = this[Symbol.iterator]() as IterableIterator<T>; // itertools does it, what could go wrong!
        let count = 0;
        for (const _ of it) {
            if (++count >= n) {
                break;
            }
        }

        for (const value of it) {
            yield value;
        }
    }

    forEach(fn: (item: T) => void) {
        for (const item of this) {
            fn(item);
        }
    }

    toArray(): T[] {
        return [...this.iterator];
    }

    toMap<K, V>(this: Iter<[K, V]>): Map<K, V> {
        return new Map(this);
    }

    promiseAll<P, X extends PromiseLike<Awaited<P>>>(this: Iter<P | X>): Promise<Awaited<P>[]> {
        return Promise.all(this);
    }

    promiseAny<P, X extends PromiseLike<Awaited<P>>>(this: Iter<P | X>): Promise<Awaited<P>> {
        return Promise.any(this);
    }

    promiseRace<P, X extends PromiseLike<Awaited<P>>>(this: Iter<P | X>): Promise<Awaited<P>> {
        return Promise.race(this);
    }

    intersect(other: Iter<T>): Iter<T> {
        return new Iter(this._intersect(other));
    }

    // https://github.com/microsoft/referencesource/blob/51cf7850defa8a17d815b4700b67116e3fa283c2/System.Core/System/Linq/Enumerable.cs#L877-L883
    private *_intersect(other: Iter<T>): Generator<T> {
        const set = new Set<T>(other);
        for (const element of this) {
            if (set.delete(element)) {
                yield element;
            }
        }
    }

    /**
     * Returns true when all of the items in iterable are truthy.  An optional key
     * function can be used to define what truthiness means for this specific
     * collection.
     *
     * Examples:
     *
     *     all([])                           // => true
     *     all([0])                          // => false
     *     all([0, 1, 2])                    // => false
     *     all([1, 2, 3])                    // => true
     *
     * Examples with using a key function:
     *
     *     all([2, 4, 6], n => n % 2 === 0)  // => true
     *     all([2, 4, 5], n => n % 2 === 0)  // => false
     *
     */
    declare every: (this: Iter<T>, keyFn?: Predicate<T>) => boolean;
    /**
     * Returns true when some of the items in iterable are truthy.  An optional key
     * function can be used to define what truthiness means for this specific
     * collection.
     *
     * Examples:
     *
     *     some([])                           // => false
     *     some([0])                          // => false
     *     some([0, 1, null, undefined])      // => true
     *
     * Examples with using a key function:
     *
     *     some([1, 4, 5], n => n % 2 === 0)  // => true
     *     some([{name: 'Bob'}, {name: 'Alice'}], person => person.name.startsWith('C'))  // => false
     *
     */
    declare some: (this: Iter<T>, keyFn?: Predicate<T>) => boolean;
    /**
     * Returns true when any of the items in the iterable are equal to the target object.
     *
     * Examples:
     *
     *     contains([], 'whatever')         // => false
     *     contains([3], 42)                // => false
     *     contains([3], 3)                 // => true
     *     contains([0, 1, 2], 2)           // => true
     *
     */
    declare contains: (this: Iter<T>, needle: T) => boolean;
    /**
     * Returns an iterable of enumeration pairs.  Iterable must be a sequence, an
     * iterator, or some other object which supports iteration.  The elements
     * produced by returns a tuple containing a counter value (starting from 0 by
     * default) and the values obtained from iterating over given iterable.
     *
     * Example:
     *
     *     import { enumerate } from 'itertools';
     *
     *     console.log([...enumerate(['hello', 'world'])]);
     *     // [0, 'hello'], [1, 'world']]
     */
    declare enumerate: (this: Iter<T>, start?: number) => Iter<[number, T]>;
    /**
     * Non-lazy version of ifilter().
     */
    declare filterToArray: {
        <T, N extends T>(this: Iter<T>, predicate: (item: T) => item is N): N[];
        (this: Iter<T>, predicate: Predicate<T>): T[];
    }
    /**
     * Returns an iterator object for the given iterable.  This can be used to
     * manually get an iterator for any iterable datastructure.  The purpose and
     * main use case of this function is to get a single iterator (a thing with
     * state, think of it as a "cursor") which can only be consumed once.
     */
    declare iter: (this: Iter<T>) => IterableIterator<T>;
    /**
     * Non-lazy version of map().
     */
    declare mapToArray: <V>(this: Iter<T>, mapper: (item: T) => V) => V[];
    /**
     * Return the largest item in an iterable.  Only works for numbers, as ordering
     * is pretty poorly defined on any other data type in JS.  The optional `keyFn`
     * argument specifies a one-argument ordering function like that used for
     * sorted().
     *
     * If the iterable is empty, `undefined` is returned.
     *
     * If multiple items are maximal, the function returns either one of them, but
     * which one is not defined.
     */
    declare max: (this: Iter<T>, keyFn?: (item: T) => number) => T | undefined;
    /**
     * Return the smallest item in an iterable.  Only works for numbers, as
     * ordering is pretty poorly defined on any other data type in JS.  The
     * optional `keyFn` argument specifies a one-argument ordering function like
     * that used for sorted().
     *
     * If the iterable is empty, `undefined` is returned.
     *
     * If multiple items are minimal, the function returns either one of them, but
     * which one is not defined.
     */
    declare min: (this: Iter<T>, keyFn?: (item: T) => number) => T | undefined;
    /**
     * Apply function of two arguments cumulatively to the items of sequence, from
     * left to right, so as to reduce the sequence to a single value.  For example:
     *
     *     reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0)
     *
     * calculates
     *
     *     (((((0+1)+2)+3)+4)+5)
     *
     * The left argument, `x`, is the accumulated value and the right argument,
     * `y`, is the update value from the sequence.
     *
     * **Difference between `reduce()` and `reduce\_()`**:  `reduce()` requires an
     * explicit initializer, whereas `reduce_()` will automatically use the first
     * item in the given iterable as the initializer.  When using `reduce()`, the
     * initializer value is placed before the items of the sequence in the
     * calculation, and serves as a default when the sequence is empty.  When using
     * `reduce_()`, and the given iterable is empty, then no default value can be
     * derived and `undefined` will be returned.
     */
    declare reduce: {
        (this: Iter<T>, reducer: (agg: T, item: T, index: number) => T): T | undefined;
        <O>(this: Iter<T>, reducer: (agg: O, item: T, index: number) => O, start: O): O;
    };
    /**
     * Return a new sorted list from the items in iterable.
     *
     * Has two optional arguments:
     *
     * * `keyFn` specifies a function of one argument providing a primitive
     *   identity for each element in the iterable.  that will be used to compare.
     *   The default value is to use a default identity function that is only
     *   defined for primitive types.
     *
     * * `reverse` is a boolean value.  If `true`, then the list elements are
     *   sorted as if each comparison were reversed.
     */
    declare sorted: (this: Iter<T>, keyFn?: (item: T) => Primitive, reverse?: boolean) => T[];
    /**
     * Sums the items of an iterable from left to right and returns the total.  The
     * sum will defaults to 0 if the iterable is empty.
     */
    declare sum: (this: Iterable<number>) => number;
    /**
     * See izip.
     */
    declare zipToArray: <T1, T2>(this: Iter<T1>, ys: Iterable<T2>) => Array<[T1, T2]>;
    /**
     * See izip3.
     */
    declare zip3ToArray: <T1, T2, T3>(this: Iter<T1>, ys: Iterable<T2>, zs: Iterable<T3>) => Array<[T1, T2, T3]>;

    /**
     * Returns an iterator that returns elements from the first iterable until it
     * is exhausted, then proceeds to the next iterable, until all of the iterables
     * are exhausted.  Used for treating consecutive sequences as a single
     * sequence.
     */
    declare chain: (this: Iter<T>, ...iterables: Iterable<T>[]) => Iter<T>;
    /**
     * Non-lazy version of icompress().
     */
    declare compressToArray: (data: Iterable<T>, selectors: Iterable<boolean>) => T[];
    /**
     * Returns an iterator producing elements from the iterable and saving a copy
     * of each.  When the iterable is exhausted, return elements from the saved
     * copy.  Repeats indefinitely.
     */
    declare cycle: (this: Iter<T>) => Iter<T>;
    /**
     * Returns an iterator that drops elements from the iterable as long as the
     * predicate is true; afterwards, returns every remaining element.  Note, the
     * iterator does not produce any output until the predicate first becomes
     * false.
     */
    declare dropWhile: (this: Iter<T>, predicate: Predicate<T>) => Iter<T>;
    declare groupby: <K extends Primitive>(this: Iter<T>, keyFn?: (item: T) => K) => Iter<[K, Generator<T, void>]>;
    /**
     * Returns an iterator that filters elements from data returning only those
     * that have a corresponding element in selectors that evaluates to `true`.
     * Stops when either the data or selectors iterables has been exhausted.
     */
    declare compress: (data: Iterable<T>, selectors: Iterable<boolean>) => Iter<T>;
    /**
     * Returns an iterator that filters elements from iterable returning only those
     * for which the predicate is true.
     */
    declare filter: {
        <N extends T>(this: Iter<T>, predicate: (item: T) => item is N): Iter<N>;
        (this: Iter<T>, predicate: Predicate<T>): Iter<T>;
    };
    /**
     * Returns an iterator that computes the given mapper function using arguments
     * from each of the iterables.
     */
    declare map: <V>(this: Iter<T>, mapper: (item: T) => V) => Iter<V>;
    /**
     * Returns an iterator that returns selected elements from the iterable.  If
     * `start` is non-zero, then elements from the iterable are skipped until start
     * is reached.  Then, elements are returned by making steps of `step` (defaults
     * to 1).  If set to higher than 1, items will be skipped.  If `stop` is
     * provided, then iteration continues until the iterator reached that index,
     * otherwise, the iterable will be fully exhausted.  `islice()` does not
     * support negative values for `start`, `stop`, or `step`.
     */
    declare slice: {
        (this: Iter<T>, stop: number): Iter<T>;
        (this: Iter<T>, start: number, stop?: number | null, step?: number): Iter<T>;
    };
    /**
     * Returns an iterator that aggregates elements from each of the iterables.
     * Used for lock-step iteration over several iterables at a time.  When
     * iterating over two iterables, use `izip2`.  When iterating over three
     * iterables, use `izip3`, etc.  `izip` is an alias for `izip2`.
     */
    declare zip: <T1, T2>(this: Iter<T1>, ys: Iterable<T2>) => Iter<[T1, T2]>;
    /**
     * Like izip2, but for three input iterables.
     */
    declare zip3: <T1, T2, T3>(this: Iter<T1>, ys: Iterable<T2>, zs: Iterable<T3>) => Iter<[T1, T2, T3]>;
    /**
     * Returns an iterator that aggregates elements from each of the iterables.  If
     * the iterables are of uneven length, missing values are filled-in with
     * fillvalue.  Iteration continues until the longest iterable is exhausted.
     */
    declare zipLongest: <T1, T2, D>(this: Iter<T1>, ys: Iterable<T2>, filler?: D) => Iter<[T1 | D, T2 | D]>;
    /**
     * Like the other izips (`izip`, `izip3`, etc), but generalized to take an
     * unlimited amount of input iterables.  Think `izip(*iterables)` in Python.
     *
     * **Note:** Due to Flow type system limitations, you can only "generially" zip
     * iterables with homogeneous types, so you cannot mix types like <A, B> like
     * you can with izip2().
     */
    declare zipMany: (this: Iter<T>, ...iters: Iterable<T>[]) => Iter<T[]>;
    /**
     * Return successive `r`-length permutations of elements in the iterable.
     *
     * If `r` is not specified, then `r` defaults to the length of the iterable and
     * all possible full-length permutations are generated.
     *
     * Permutations are emitted in lexicographic sort order.  So, if the input
     * iterable is sorted, the permutation tuples will be produced in sorted order.
     *
     * Elements are treated as unique based on their position, not on their value.
     * So if the input elements are unique, there will be no repeat values in each
     * permutation.
     */
    declare permutations: (this: Iter<T>, r?: number) => Iter<T[]>;
    /**
     * Returns an iterator that produces elements from the iterable as long as the
     * predicate is true.
     */
    declare takeWhile: (this: Iter<T>, predicate: Predicate<T>) => Iter<T>;
    declare zipLongestToArray: <T1, T2, D>(this: Iter<T1>, ys: Iterable<T2>, filler?: D) => Array<[T1 | D, T2 | D]>;
    declare zipManyToArray: (...iters: Iterable<T>[]) => T[][];

    /**
     * Break iterable into lists of length `size`:
     *
     *     [...chunked([1, 2, 3, 4, 5, 6], 3)]
     *     // [[1, 2, 3], [4, 5, 6]]
     *
     * If the length of iterable is not evenly divisible by `size`, the last returned
     * list will be shorter:
     *
     *     [...chunked([1, 2, 3, 4, 5, 6, 7, 8], 3)]
     *     // [[1, 2, 3], [4, 5, 6], [7, 8]]
     */
    declare chunked: (this: Iter<T>, size: number) => Iter<T[]>;
    /**
     * Return an iterator flattening one level of nesting in a list of lists:
     *
     *     [...flatten([[0, 1], [2, 3]])]
     *     // [0, 1, 2, 3]
     *
     */
    declare flatten: <A>(this: A) => FlatIter<A>;
    /**
     * Returns an iterable containing only the first `n` elements of the given
     * iterable.
     */
    declare take: (this: Iter<T>, n: number) => Iter<T>;
    /**
     * Returns an iterator of paired items, overlapping, from the original.  When
     * the input iterable has a finite number of items `n`, the outputted iterable
     * will have `n - 1` items.
     *
     *     >>> pairwise([8, 2, 0, 7])
     *     [(8, 2), (2, 0), (0, 7)]
     *
     */
    declare pairwise: (this: Iter<T>) => Iter<[T, T]>;
    /**
     * Returns a 2-tuple of arrays.  Splits the elements in the input iterable into
     * either of the two arrays.  Will fully exhaust the input iterable.  The first
     * array contains all items that match the predicate, the second the rest:
     *
     *     >>> const isOdd = x => x % 2 !== 0;
     *     >>> const iterable = range(10);
     *     >>> const [odds, evens] = partition(iterable, isOdd);
     *     >>> odds
     *     [1, 3, 5, 7, 9]
     *     >>> evens
     *     [0, 2, 4, 6, 8]
     *
     */
    declare partition: {
        <N extends T>(this: Iter<T>, predicate: (item: T) => item is N): [N[], Exclude<T, N>[]];
        (this: Iter<T>, predicate: Predicate<T>): [T[], T[]];
    };
    /**
     * Yields the next item from each iterable in turn, alternating between them.
     * Continues until all items are exhausted.
     *
     *     >>> [...roundrobin([1, 2, 3], [4], [5, 6, 7, 8])]
     *     [1, 4, 5, 2, 6, 3, 7, 8]
     */
    declare roundrobin: (this: Iter<T>, ...iters: readonly Iterable<T>[]) => Iter<T>;
    /**
     * Yields the heads of all of the given iterables.  This is almost like
     * `roundrobin()`, except that the yielded outputs are grouped in to the
     * "rounds":
     *
     *     >>> [...heads([1, 2, 3], [4], [5, 6, 7, 8])]
     *     [[1, 4, 5], [2, 6], [3, 7], [8]]
     *
     * This is also different from `zipLongest()`, since the number of items in
     * each round can decrease over time, rather than being filled with a filler.
     */
    declare heads: (this: Iter<T>, ...iters: readonly Iterable<T>[]) => Iter<T[]>;
    /**
     * Non-lazy version of itake().
     */
    declare takeToArray: (n: number) => T[];
    /**
     * Yield unique elements, preserving order.
     *
     *     >>> [...uniqueEverseen('AAAABBBCCDAABBB')]
     *     ['A', 'B', 'C', 'D']
     *     >>> [...uniqueEverseen('AbBCcAB', s => s.toLowerCase())]
     *     ['A', 'b', 'C']
     *
     */
    declare uniqueEverSeen: (this: Iter<T>, keyFn?: (item: T) => Primitive) => Iter<T>;
    /**
     * Yields elements in order, ignoring serial duplicates.
     *
     *     >>> [...uniqueJustseen('AAAABBBCCDAABBB')]
     *     ['A', 'B', 'C', 'D', 'A', 'B']
     *     >>> [...uniqueJustseen('AbBCcAB', s => s.toLowerCase())]
     *     ['A', 'b', 'C', 'A', 'B']
     *
     */
    declare uniqueJustSeen: (this: Iter<T>, keyFn?: (item: T) => Primitive) => Iter<T>;

    /**
     * Returns an iterable, filtering out any "nullish" values from the iterable.
     *
     *     >>> compact([1, 2, undefined, 3, null])
     *     [1, 2, 3]
     *
     * For an eager version, @see compact().
     */
    declare compact: (this: Iter<T>) => Iter<Exclude<T, null | undefined>>;
    /**
     * Returns an array, filtering out any "nullish" values from the iterable.
     *
     *     >>> compact([1, 2, undefined, 3, null])
     *     [1, 2, 3]
     *
     * For a lazy version, @see icompact().
     */
    declare compactToArray: (this: Iter<T>) => Exclude<T, null | undefined>[];
    /**
     * Returns the first item in the iterable for which the predicate holds, if
     * any. If no predicate is given, it will return the first value returned by
     * the iterable.
     */
    declare find: (this: Iter<T>, keyFn?: Predicate<T>) => T | undefined;
    /**
     * Almost an alias of find(). There only is a difference if no key fn is
     * provided. In that case, `find()` will return the first item in the iterable,
     * whereas `first()` will return the first non-`undefined` value in the
     * iterable.
     */
    declare first: (this: Iter<T>, keyFn?: Predicate<T>) => T | undefined;
    /**
     * Returns 0 or more values for every value in the given iterable.
     * Technically, it's just calling map(), followed by flatten(), but it's a very
     * useful operation if you want to map over a structure, but not have a 1:1
     * input-output mapping.  Instead, if you want to potentially return 0 or more
     * values per input element, use flatmap():
     *
     * For example, to return all numbers `n` in the input iterable `n` times:
     *
     *     >>> const repeatN = n => repeat(n, n);
     *     >>> [...flatmap([0, 1, 2, 3, 4], repeatN)]
     *     [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]  // note: no 0
     *
     */
    declare flatMap: <S>(this: Iter<T>, mapper: (item: T) => Iterable<S>) => Iter<S>;
}

Iter.prototype.every = get(itertools.every);
Iter.prototype.some = get(itertools.some);
Iter.prototype.contains = get(itertools.contains);
Iter.prototype.enumerate = get(itertools.enumerate);
Iter.prototype.filterToArray = get(itertools.filter);
Iter.prototype.mapToArray = get(itertools.map);
Iter.prototype.max = get(itertools.max);
Iter.prototype.min = get(itertools.min);
export const range: typeof itertools['range'] = (a, b?: number, c?: number) => new Iter(itertools.range(a, b!, c));
Iter.prototype.reduce = get(itertools.reduce);
Iter.prototype.sorted = get(itertools.sorted);
Iter.prototype.sum = get(itertools.sum);
Iter.prototype.zipToArray = get(itertools.zip);
Iter.prototype.zip3ToArray = get(itertools.zip3);
Iter.prototype.chain = get(itertools.chain);
export const count: typeof itertools['count'] = (a, b) => new Iter(itertools.count(a, b));
Iter.prototype.compressToArray = get(itertools.compress);
Iter.prototype.cycle = get(itertools.cycle);
Iter.prototype.dropWhile = get(itertools.dropwhile);
Iter.prototype.groupby = get(itertools.groupby);
Iter.prototype.permutations = get(itertools.permutations);
Iter.prototype.takeWhile = get(itertools.takewhile);
Iter.prototype.zipLongestToArray = get(itertools.zipLongest);
Iter.prototype.zipManyToArray = get(itertools.zipMany);
Iter.prototype.chunked = get(itertools.chunked);
Iter.prototype.flatten = get(itertools.flatten) as (...args: any) => FlatIter<any>;
Iter.prototype.take = get(itertools.itake, true);
Iter.prototype.pairwise = get(itertools.pairwise);
Iter.prototype.partition = get(itertools.partition);
Iter.prototype.roundrobin = get(itertools.roundrobin);
Iter.prototype.heads = get(itertools.heads);
Iter.prototype.takeToArray = get(itertools.take, true);
Iter.prototype.uniqueEverSeen = get(itertools.uniqueEverseen);
Iter.prototype.uniqueJustSeen = get(itertools.uniqueJustseen);
Iter.prototype.compactToArray = get(itertools.compact);
Iter.prototype.find = get(itertools.find);
Iter.prototype.first = get(itertools.first);
Iter.prototype.flatMap = get(itertools.flatmap);

Iter.prototype.compact = get(itertools.icompact);
Iter.prototype.compress = get(itertools.icompress);
Iter.prototype.filter = get(itertools.ifilter);
Iter.prototype.map = get(itertools.imap);
Iter.prototype.slice = get(itertools.islice);
Iter.prototype.zip = get(itertools.izip2);
Iter.prototype.zip3 = get(itertools.izip3);
Iter.prototype.zipLongest = get(itertools.izipLongest);
Iter.prototype.zipMany = get(itertools.izipMany);

emptyIterator = new Iter<unknown>((function*() {
    return;
})());
