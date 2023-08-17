/**
 * Copyright 2020 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Puppeteer } from 'puppeteer-core/common/Puppeteer';

export * from 'puppeteer-core/common/Accessibility';
export * from 'puppeteer-core/common/AriaQueryHandler';
export * from 'puppeteer-core/common/Browser';
export * from 'puppeteer-core/common/BrowserConnector';
export * from 'puppeteer-core/common/BrowserWebSocketTransport';
export * from 'puppeteer-core/common/Connection';
export * from 'puppeteer-core/common/ConnectionTransport';
export * from 'puppeteer-core/common/ConsoleMessage';
export * from 'puppeteer-core/common/Coverage';
export * from 'puppeteer-core/common/DOMWorld';
export * from 'puppeteer-core/common/Debug';
export * from 'puppeteer-core/common/DeviceDescriptors';
export * from 'puppeteer-core/common/Dialog';
export * from 'puppeteer-core/common/ElementHandle';
export * from 'puppeteer-core/common/EmulationManager';
export * from 'puppeteer-core/common/Errors';
export * from 'puppeteer-core/common/EventEmitter';
export * from 'puppeteer-core/common/ExecutionContext';
export * from 'puppeteer-core/common/FileChooser';
export * from 'puppeteer-core/common/FrameManager';
export * from 'puppeteer-core/common/HTTPRequest';
export * from 'puppeteer-core/common/HTTPResponse';
export * from 'puppeteer-core/common/Input';
export * from 'puppeteer-core/common/JSHandle';
export * from 'puppeteer-core/common/LifecycleWatcher';
export * from 'puppeteer-core/common/NetworkConditions';
export * from 'puppeteer-core/common/NetworkEventManager';
export * from 'puppeteer-core/common/NetworkManager';
export * from 'puppeteer-core/common/PDFOptions';
export * from 'puppeteer-core/common/Page';
export * from 'puppeteer-core/common/Product';
export * from 'puppeteer-core/common/Puppeteer';
export * from 'puppeteer-core/common/PuppeteerViewport';
export * from 'puppeteer-core/common/QueryHandler';
export * from 'puppeteer-core/common/SecurityDetails';
export * from 'puppeteer-core/common/Target';
export * from 'puppeteer-core/common/TaskQueue';
export * from 'puppeteer-core/common/TimeoutSettings';
export * from 'puppeteer-core/common/Tracing';
export * from 'puppeteer-core/common/USKeyboardLayout';
export * from 'puppeteer-core/common/WebWorker';
export * from 'puppeteer-core/common/types';

const initializePuppeteer = (): Puppeteer => {
    return new Puppeteer({
        isPuppeteerCore: true,
    });
};

const puppeteer = initializePuppeteer();

export const {
    connect
} = puppeteer;

export default puppeteer;
