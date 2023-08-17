// TODO: find who made this originally and attribute them

import type { ArrayExpression, ArrayPattern, AssignmentPattern, Expression, ObjectExpression, ObjectPattern, PrivateIdentifier, Property, RestElement, SpreadElement } from "estree";

/**
 * Parse expression
 * @param expression
 * @returns {*}
 */
export function parse(expression: Expression | SpreadElement | PrivateIdentifier | ObjectPattern | ArrayPattern | RestElement | AssignmentPattern | null): unknown {
    if (expression === null) return null;

    switch (expression?.type) {
        case 'SpreadElement':
            return parse(expression.argument);
        case "ObjectExpression":
            return parseObjectExpression(expression);
        case "Identifier":
            return expression.name;
        case "Literal":
            return expression.value;
        case "ArrayExpression":
            return parseArrayExpression(expression);
    }

    return undefined;
}

/**
 * Parse object expresion
 * @param expression
 * @returns {object}
 */
function parseObjectExpression(expression: ObjectExpression): object {
    return (expression.properties.filter(e => e.type !== 'SpreadElement') as Property[]).reduce((obj, { key, value }) => ({
        ...obj,
        [parse(key) as string | number | symbol]: parse(value)
    }), {});
}

/**
 * Parse array expression
 * @param expression
 * @returns {*[]}
 */
function parseArrayExpression(expression: ArrayExpression): unknown[] {
    return expression.elements.map((exp) => parse(exp));
}
