export const enum ProcessType {
    Main, Renderer, Webview
}

export let processType: ProcessType = process.type !== 'renderer' ? ProcessType.Main : ProcessType.Renderer;

export function setIsWebviewProcess() {
    processType = ProcessType.Webview;
}
