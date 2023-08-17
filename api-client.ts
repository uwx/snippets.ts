/*
Usage:

@apiClient({
    baseUrl: 'https://www.mysite.com/',
    modules: browser ? [
    ] : [
        new (await import('./caching')).CacheModule(),
    ]
})
export class ApiImpl {
    @apiGet('something_else', 'param1', 'limit')
    @precondition(limitParameter('limit', 50), 'Cannot get more than 50 comments')
    getIllustrationComments(param1: string, limit: number): Promise<Something<{ something: number }>> { return null!; }
}

*/
/* eslint-disable @typescript-eslint/ban-types */

import { setRaw, type MakeNonSpecificCtor } from './utils';

type PathPart = string | { parameterName: string };

type Thenable<T> = Promise<T> | T;

export interface ApiClientModule {
    preRequest(request: ApiRequest): Thenable<unknown | undefined>;
    postRequest(request: ApiRequest, response: unknown): Thenable<unknown | undefined>;
}

// public @apiClient options
export interface ApiClientOptions {
    baseUrl: string;
    modules: ApiClientModule[];
}

export class ApiRequest {
    constructor(
        public url: URL,
        public options: RequestInit,
        public routeKey: string,
        public originalArgs: unknown[],
    ) {
    }

    addHeader(key: string, value: string, allowMultiple = true) {
        if (!(this.options.headers instanceof Headers)) {
            this.options.headers = new Headers(this.options.headers);
        }

        if (allowMultiple) {
            this.options.headers.append(key, value);
        } else {
            this.options.headers.set(key, value);
        }
    }
}

class ApiClientInstance {
    constructor(private options: ApiClientOptions, private initSettings: ApiClientInitSettings) {
    }

    async request(clientType: ApiClientType, routeKey: string, method: string, path: string, searchParams: URLSearchParams, originalArgs: unknown[]) {
        const url = new URL(path, this.options.baseUrl);
        searchParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });

        const requestInit: RequestInit = {
            method
        };

        const apiRequest = new ApiRequest(url, requestInit, routeKey, originalArgs);
        if (clientType.modifyRequest !== undefined) {
            clientType.modifyRequest(apiRequest);
        }

        for (const module of this.options.modules) {
            const result = await module.preRequest(apiRequest);
            if (result !== undefined) {
                return result;
            }
        }

        const preconditions = this.initSettings.routeSettings[routeKey]?.preconditions;
        if (preconditions) {
            for (const [cond, failMsg] of preconditions) {
                if (!cond(apiRequest)) {
                    throw new Error('Precondition failed: ' + (failMsg ?? 'No message'));
                }
            }
        }

        let response = await fetch(apiRequest.url, apiRequest.options).then(e => e.json());

        if (clientType.modifyResponse !== undefined) {
            response = await clientType.modifyResponse(response);
        }

        for (const module of this.options.modules) {
            const result = await module.postRequest(apiRequest, response);
            if (result !== undefined) {
                return result;
            }
        }

        return response;
    }
}

const apiClientInitSettings = Symbol('apiClientInitSettings');
const apiClientInstance = Symbol('apiClientInstance');
declare class ApiClientType {
    declare ['constructor']: typeof ApiClientType;
    static [apiClientInitSettings]?: ApiClientInitSettings;
    static [apiClientInstance]?: ApiClientInstance;
    modifyRequest?(request: ApiRequest): void;
    modifyResponse?(response: object): Promise<object> | object;
}
type ApiClientStatic = MakeNonSpecificCtor<typeof ApiClientType>;

function getClientSettings(type: ApiClientStatic) {
    if (type[apiClientInitSettings] !== undefined) {
        return type[apiClientInitSettings];
    }

    const value = new ApiClientInitSettings();
    setRaw(type, apiClientInitSettings, value);
    return value;
}

function getClientInstance(type: ApiClientType) {
    return type.constructor[apiClientInstance];
}

// private apiclient config
class ApiClientInitSettings {
    readonly routeSettings: Record<string, RouteSettings> = {};

    getRouteSettings(propertyKey: string) {
        return this.routeSettings[propertyKey] ??= new RouteSettings();
    }
}

export type RequestPredicate = (request: Readonly<ApiRequest>) => boolean;

class RouteSettings {
    preconditions: Array<[cond: RequestPredicate, failMsg?: string]> = [];
}

export function apiClient(options: ApiClientOptions) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return <T extends ApiClientStatic>(target: T) => {
        // console.log(target);

        setRaw(target, apiClientInstance, new ApiClientInstance(options, getClientSettings(target)));
    };
}

function splitPath(path: string): PathPart[] {
    return path.match(/[^{]+|{(?:\w+)}/g)?.map(e => e[0] === '{' ? { parameterName: e.slice(1, -1) } : e) ?? [];
}

export function apiGet(path: string, ...queryParams: string[]) {
    const processedPath = splitPath(path);

    return <T extends ApiClientStatic, TK extends keyof T & string, TV extends T[TK] & ((this: T, ...args: any) => Promise<unknown>)>(target: T, propertyKey: TK, descriptor: PropertyDescriptor) => {
        // console.log(target.constructor);

        descriptor.value = function makeRequest(this: ApiClientType, ...args: unknown[]) {
            const apiClient = getClientInstance(this);

            if (apiClient === undefined) {
                throw new Error('No @apiClient annotation on type containing @apiGet method');
            }

            const requestPath = new Array<string>(processedPath.length);
            let argCount = 0;
            for (let i = 0; i < processedPath.length; i++) {
                const p = processedPath[i];
                requestPath[i] = typeof p === 'string' ? p : encodeURIComponent(String(args[argCount++]));
            }

            const searchParams = new URLSearchParams();
            for (let i = 0; i < queryParams.length; i++) {
                const key = queryParams[i];
                const value = args[argCount + i];
                if (value !== undefined) {
                    const isArray = key.endsWith('[]');

                    if (isArray) {
                        // key = key.slice(0, -2);

                        for (const entry of value as unknown[]) {
                            searchParams.append(key, String(entry));
                        }
                    } else {
                        searchParams.set(key, String(value));
                    }
                }
            }

            return apiClient.request(this, propertyKey, 'GET', requestPath.join(''), searchParams, args);
        };
    }
}

export function precondition(cond: RequestPredicate, failMsg: string) {
    return <T extends ApiClientStatic, TK extends keyof T & string, TV extends T[TK] & ((this: T, ...args: any) => Promise<unknown>)>(target: T, propertyKey: TK, descriptor: PropertyDescriptor) => {
        getClientSettings(target).getRouteSettings(propertyKey).preconditions.push([cond, failMsg]);
    };
}
