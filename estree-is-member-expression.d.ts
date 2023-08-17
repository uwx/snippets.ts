declare module 'estree-is-member-expression' {
    import { MemberExpression, Node } from 'estree';

    export default function isMemberExpression(node: Node, pattern: string | string[]): node is MemberExpression;
}