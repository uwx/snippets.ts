// @ts-nocheck

import { VNode, h, render } from 'preact';
import { makeSlot, SlottedComponent } from '.';

class Sample extends SlottedComponent {
    static readonly Slot1 = makeSlot();

    override slottedRender(): VNode {
        return (
            <div>
                The content should go here:
                <Sample.Slot1.Placeholder />
                <Sample.Slot1.Placeholder />

                You can't add children to the placeholder component:
                <Sample.Slot1.Placeholder> </Sample.Slot1.Placeholder>

                This is stupid and won't work:
                <Sample>
                    <Sample.Slot1.Placeholder />
                </Sample>
            </div>
        );
    }
}

render(<Sample>
    <Sample.Slot1>This is the slot content</Sample.Slot1>

    You must add children to the content component:
    <Sample.Slot1 />
</Sample>, document.body);
