import { CollectionOperator, Multimap } from './multimap';

export class SetMultimap<K, V> extends Multimap<K, V, ReadonlySet<V>> {
    constructor(iterable?: Iterable<[K, V]>) {
        super(new SetOperator(), iterable);
    }
    get [Symbol.toStringTag](): string {
        return 'SetMultimap';
    }
}

class SetOperator<V> implements CollectionOperator<V, Set<V>> {
    static emptySet: Set<unknown>;

    empty(): Set<V> {
        return (SetOperator.emptySet ??= new Set()) as Set<V>;
    }
    create(): Set<V> {
        return new Set();
    }
    add(value: V, collection: Set<V>): boolean {
        const previous = collection.size;
        collection.add(value);
        return previous !== collection.size;
    }
    size(collection: Set<V>): number {
        return collection.size;
    }
    delete(value: V, collection: Set<V>): boolean {
        return collection.delete(value);
    }
    has(value: V, collection: Set<V>): boolean {
        return collection.has(value);
    }
}
