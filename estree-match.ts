import type {
    Node,
    Program,
    BlockStatement,
    ClassBody
} from 'estree';

import isMemberExpression from 'estree-is-member-expression';
import type { BuiltIns } from 'type-fest/source/internal.js';

// credit type-fest
type MatchArgs<T>
    = T extends BuiltIns ? T
    : T extends Node ? { [K in keyof T]?: MatchArgs<T[K]> } & (
        T extends Program | BlockStatement | ClassBody
        ? {
            /**
             * If defined and non-empty, guarantees that the AST node contains matching nodes for every entry in the array as direct children.
             */
            readonly has?: MatchArgs<T['body'][0]>[];

            /**
             * If defined and non-empty, guarantees that the AST node contains at least one matching node for at least one entry in the array as direct children.
             */
            readonly hasAnyOf?: MatchArgs<T['body'][0]>[];

            /**
             * If defined, guarantees that the direct children of the AST node match the entries in the array, including the order in which they are defined, and with no duplicate, missing or extraneous entries.
             */
            readonly hasOnly?: MatchArgs<T['body'][0]>[];

            /**
             * If defined, executes a predicate on the AST node that runs after all other checks have completed
             * @param node The AST node being queried
             * @returns True if matches, false otherwise
             */
            readonly predicate?: (node: T) => boolean;
        }
        : {
            /**
             * If defined, executes a predicate on the AST node that runs after all other checks have completed
             * @param node The AST node being queried
             * @returns True if matches, false otherwise
             */
            readonly predicate?: (node: T) => boolean;
        }
    )
    : T extends object ? { [K in keyof T]?: MatchArgs<T[K]> }
    : T | undefined;

// TODO: unspecialize this from Node to remove the fucky type casts
export function createMatcher<T extends Node>(matcher: MatchArgs<T>): ((node: Node) => boolean) {
    const set = new Set<string>(Object.keys(matcher));
    set.delete('has');
    set.delete('hasAnyOf');
    set.delete('hasOnly');
    set.delete('predicate');
    const allOfInnerMatchers = 'has' in matcher && matcher.has !== undefined && matcher.has.length > 0
        ? matcher.has.map(createMatcher<any>) // figure out the right typing here sometime
        : undefined;

    const anyOfInnerMatchers = 'hasAnyOf' in matcher && matcher.hasAnyOf !== undefined && matcher.hasAnyOf.length > 0
        ? matcher.hasAnyOf.map(createMatcher<any>) // figure out the right typing here sometime
        : undefined;

    const onlyInnerMatchers = 'hasOnly' in matcher && matcher.hasOnly !== undefined //&& matcher.hasOnly.length > 0
        ? matcher.hasOnly.map(createMatcher<any>) // figure out the right typing here sometime
        : undefined;

    let deepStructureMatchers: Map<keyof typeof matcher, ((node: Node) => boolean)> | undefined = new Map();
    let deepStructureArrayMatchers: Map<keyof typeof matcher, ((node: Node) => boolean)[]> | undefined = new Map();

    for (const k of [...set.values()] as Array<keyof typeof matcher>) {
        const v = matcher[k];
        if (typeof v === 'object') {
            if (Array.isArray(v)) {
                deepStructureArrayMatchers.set(k, v.map(createMatcher<any>));
            } else {
                deepStructureMatchers.set(k, createMatcher<any>(v as MatchArgs<Node>)); // this isn't really safe but matchArgs has no required keys so we can mostly get away with it
            }
            set.delete(k as string);
        }
    }

    const matcherKeys = set.size > 0 ? [...set.values()] as Array<keyof typeof matcher> : undefined;

    if (deepStructureMatchers.size === 0) deepStructureMatchers = undefined;
    if (deepStructureArrayMatchers.size === 0) deepStructureArrayMatchers = undefined;

    return node => {
        // matcherKeys enforces this now
        // if ('type' in matcher && node.type !== matcher.type) return false;

        if (matcherKeys !== undefined) {
            for (const k of matcherKeys) {
                if ((node as unknown as typeof matcher)[k] !== matcher[k]) {
                    return false;
                }
            }
        }

        if (deepStructureMatchers !== undefined) {
            for (const [k, innerMatcher] of deepStructureMatchers.entries()) {
                const nodev = (node as unknown as typeof matcher)[k];
                if (typeof nodev !== 'object') {
                    return false;
                }

                if (!innerMatcher(nodev as Node)) {
                    return false;
                }
            }
        }

        if (deepStructureArrayMatchers !== undefined) {
            for (const [k, innerMatchers] of deepStructureArrayMatchers.entries()) {
                const nodev = (node as unknown as typeof matcher)[k];

                if (typeof nodev !== 'object' || !Array.isArray(nodev) || nodev.length !== innerMatchers.length) {
                    return false;
                }

                for (let i = 0; i < innerMatchers.length; i++) {
                    if (!innerMatchers[i]!(nodev[i])) {
                        return false;
                    }
                }
            }
        }

        if (allOfInnerMatchers !== undefined) {
            if ((node as { body: Node[] }).body.length < allOfInnerMatchers.length) return false;

            if (allOfInnerMatchers.length === 1) {
                if (!allOfInnerMatchers[0]!((node as { body: Node[] }).body[0]!)) {
                    return false;
                }
            } else {
                const pool = new Set(allOfInnerMatchers);

                for (const entry of (node as { body: Node[] }).body) { // typing is weird here too
                    //let remove: ((node: Node) => boolean) | undefined;
                    let matched = false;

                    for (const innerMatcher of pool) {
                        if (innerMatcher(entry)) {
                            pool.delete(innerMatcher);
                            matched = true;
                            //remove = innerMatcher;
                            break;
                        }
                    }

                    if (!matched) {
                        return false;
                    }

                    //if (remove !== undefined) {
                    //    pool.delete(remove);
                    //}
                }
            }
        }

        if (anyOfInnerMatchers !== undefined) {
            if ((node as { body: Node[] }).body.length === 0) return false;

            let matched = false;
            for (const innerMatcher of anyOfInnerMatchers) {
                for (const entry of (node as { body: Node[] }).body) {
                    if (innerMatcher(entry)) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched === false) {
                return false;
            }
        }

        if (onlyInnerMatchers !== undefined) {
            if ((node as { body: Node[] }).body.length !== onlyInnerMatchers.length) return false;

            for (let i = 0; i < onlyInnerMatchers.length; i++) {
                if (!onlyInnerMatchers[i]!((node as { body: Node[] }).body[i]!)) {
                    return false;
                }
            }
        }

        return true;
    };
}

export function createIsMemberExpression<T extends Node>(pattern: string | string[]): ((node: T) => boolean) {
    return node => isMemberExpression(node, pattern);
}
