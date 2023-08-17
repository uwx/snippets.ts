import { app } from 'electron';

export const remoteDebuggingPort = 32323;
export const remoteDebuggingAddress = '127.0.0.1';

export interface DevtoolsManifest {
    description:          string;
    devtoolsFrontendUrl:  string;
    id:                   string;
    thumbnailUrl:         string;
    title:                string;
    type:                 string;
    url:                  string;
    webSocketDebuggerUrl: string;
}

export function initialize() {
    app.commandLine.appendSwitch(
        'remote-debugging-port',
        `${remoteDebuggingPort}`
    );
    app.commandLine.appendSwitch(
        'remote-debugging-address',
        remoteDebuggingAddress
    );
    // app.commandLine.appendSwitch(
    //     'enable-features',
    //     'NetworkService'
    // );
}

export async function getRunningInstance(): Promise<DevtoolsManifest> {
    return await fetch(`http://${remoteDebuggingAddress}:${remoteDebuggingPort}/json/version`).then(e => e.json());
}
