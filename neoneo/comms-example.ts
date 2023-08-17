// @ts-nocheck

// Example

import { listen, dispatch, makeEvent, MessageDirection } from './comms';

const SampleEventImpl = makeEvent({
    type: 'SampleEventImpl',
    waitForResponse: true,
    direction: MessageDirection.ToMainProcess,
}, class {
    payload: {
        foo: string;
    };
    response: {
        bar: string;
    };
});

listen(SampleEventImpl, async (message) => {
    // invalid (no return type)
});

listen(SampleEventImpl, async (message) => {
    return { invalid: 'aaa' }; // invalid (type doesn't match)
});

listen(SampleEventImpl, async (message) => {
    return { bar: 'aaa' };
});

dispatch(new SampleEventImpl({
    foo: ''
}));

// Example 2

const SampleEvent1 = makeEvent({
    type: 'SampleEvent1',
    waitForResponse: true,
    direction: MessageDirection.ToMainProcess,
}, class {
    payload: {
        foo: string
    };
    response: {
        bar: string
    };
});

const SampleEvent2 = makeEvent({
    type: 'SampleEvent2',
    waitForResponse: true,
    direction: MessageDirection.ToMainProcess,
}, class {
    payload: {
        foo: string
    };
});

var a: typeof SampleEvent2.header['direction'];

listen(
    SampleEvent1,
    message => {
        return {
            bar: 'value2' // valid (types match)
        };
    }
);

listen(
    SampleEvent2,
    message => {
        return {
            baz: 'value2' // invalid (there is no response type, should return void)
        };
    }
);

listen(
    SampleEvent2,
    message => {
        // valid (returns void, as there is no response type)
    }
);

// Example 3

export const SampleEvent3 = makeEvent({
    direction: MessageDirection.ToMainProcess,
    type: 'farts'
}, class {
    payload: {
        foo: string
    };
    response: {
        bar: string
    };
});

export const SampleEvent4 = makeEvent({
    direction: MessageDirection.ToMainProcess,
    type: 'farts'
}, class {
    payload: {
        foo: string
    };
});

export const SampleEvent5 = makeEvent({
    direction: MessageDirection.ToWebContents,
    type: 'farts'
}, class {
    payload: {
        foo: string
    };
});

listen(SampleEvent3, args => {
    return { bar: ''};
});
listen(SampleEvent4, args => {
    // empty
});

const a1 = await dispatch(new SampleEvent3({
    foo: ''
}));

const b1 = await dispatch(new SampleEvent4({
    foo: ''
}));

// must fail: MessageDirection is wrong
const a2 = await dispatch(null as Electron.WebContents, new SampleEvent4({
    foo: ''
}));

// must work: MessageDirection is right
const b2 = await dispatch(null as Electron.WebContents, new SampleEvent5({
    foo: ''
}));

