import { connect as puppeteerConnect, Browser, IsPageTargetCallback } from './puppeteer-web';

export * from './puppeteer-web';

import { getRunningInstance } from '../cdp';

export async function connect(isPageTarget?: IsPageTargetCallback): Promise<Browser> {
    // Detach debugger if present
    // await dispatch(new DetachDebuggerEvent({ webContentsId }));

    process.env.WS_NO_BUFFER_UTIL = 'true';
    process.env.WS_NO_UTF_8_VALIDATE = 'true';

    const json = await getRunningInstance();

    const browser = await puppeteerConnect({
        browserWSEndpoint: json.webSocketDebuggerUrl,
        defaultViewport: null,
        _isPageTarget: isPageTarget
    });

    return browser;
}
