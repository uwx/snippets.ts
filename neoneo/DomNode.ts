import { Component, VNode, h } from 'preact';

const falsefn = () => false;

// https://github.com/preactjs/preact/issues/3278#issuecomment-941543846
export function DomNode(this: Component, { element }: { element: Element }): VNode<null> {
    this.shouldComponentUpdate = falsefn;
    return Object.defineProperty(h(element.localName, null), '__e', { get: () => element, set: Object });
}
