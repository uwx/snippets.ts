import { Component, ComponentChild, createContext, h, RenderableProps, VNode, Fragment, FunctionComponent, ComponentChildren, Context } from 'preact';

const slotSymbol = Symbol('Slot');

export function makeSlot(displayName?: string) {
    const PlaceholderValue = createContext<VNode | undefined>(undefined);

    const Placeholder: SlotPlaceholder = () => <PlaceholderValue.Consumer>{vnode => vnode}</PlaceholderValue.Consumer>;

    const Component: SlotContent = ({children}) =>  <>{children}</>;

    Component[slotSymbol] = true;
    Component.Placeholder = Placeholder;
    Component.Value = PlaceholderValue;

    if (displayName !== undefined) {
        Component.displayName = `${displayName}Content`;
        Placeholder.displayName = `${displayName}Placeholder`;
    }

    return Component;
}

/**
 * The base component for slot contents.
 */
export interface SlotContent extends FunctionComponent<{ children: ComponentChildren }> {
    /** The symbol that identifies this value as a slot type. */
    [slotSymbol]?: boolean;

    /** The placeholder component for this slot. */
    Placeholder: SlotPlaceholder;

    /** The context that consumes the actual contents of the slot. */
    Value: Context<VNode | undefined>;
}

/**
 * The base component for slot placeholders.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SlotPlaceholder extends FunctionComponent<{ children?: undefined }> {
}

/**
 * Roughly guesses if a {@link ComponentChildren} is a {@link VNode}; exact guesses are impossible because `object` is a
 * valid {@link ComponentChildren}.
 * @param value The value
 * @returns true if {@link value} is probably a {@link VNode}, false otherwise
 */
function isProbablyVNode(value: ComponentChildren): value is VNode {
    return typeof value === 'object' && value !== null && 'type' in value && 'props' in value;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export abstract class SlottedComponent<P = {}, S = {}> extends Component<P, S> {
    /**
     * Cached mapping of classes extending SlottedComponent to slotted static properties.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    private static readonly slots = new Map<typeof SlottedComponent, ReadonlySet<SlotContent>>();

    /**
     * Slotted properties for the current type.
     */
    private readonly slots: ReadonlySet<SlotContent>;

    constructor() {
        super();

        let slots = SlottedComponent.slots.get(this.constructor as typeof SlottedComponent<P, S>);
        if (slots === undefined) {
            // Cache slots for this type
            slots = new Set(Object.values(this.constructor as unknown as SlottedComponent)
                .filter(value => typeof value === 'object' && value !== null && slotSymbol in value));

            SlottedComponent.slots.set(this.constructor as typeof SlottedComponent<P, S>, slots);
        }

        this.slots = slots;
    }

    private isSlotContent(child: ComponentChild): child is VNode & { type: SlotContent } {
        return isProbablyVNode(child) && this.slots.has(child.type as SlotContent);
    }

    override render(props?: RenderableProps<P>, state?: Readonly<S>): ComponentChild {
        // Slot contents nodes
        const slotChildren: Array<VNode & {type: SlotContent}> = [];

        // Non-slot nodes to be passed to slottedRender
        let nonSlotChildren: ComponentChildren;

        // Find slot contents as immediate children of the component
        if (Array.isArray(this.props.children)) {
            nonSlotChildren = [];

            for (const child of this.props.children) {
                if (this.isSlotContent(child)) {
                    slotChildren.push(child);
                } else {
                    (nonSlotChildren as ComponentChild[]).push(child);
                }
            }
        } else {
            const child = this.props.children;

            if (this.isSlotContent(child)) {
                slotChildren.push(child);
            } else {
                nonSlotChildren = child;
            }
        }

        // Call the implemented render function
        let node = this.slottedRender(props, state, nonSlotChildren);

        // Compose providers for placeholders
        for (const contents of slotChildren) {
            node = h(contents.type.Value.Provider, {
                value: contents,
                children: node
            });
        }

        return node;
    }

    abstract slottedRender(
        props?: Omit<RenderableProps<P>, 'children'>,
        state?: Readonly<S>,
        children?: ComponentChildren
    ): VNode;
}
