import fs from 'fs/promises';
import crypto from 'crypto';
import type { ApiClientModule, ApiRequest } from './apiClient';

const hash = (string: string) => crypto.createHash('sha512').update(string, 'utf-8').digest('hex');

await fs.mkdir('./__cache', { recursive: true });

export class CacheModule implements ApiClientModule {
    async preRequest(request: ApiRequest): Promise<unknown> {
        try {
            const cachedFile = await fs.readFile(`./__cache/${hash(request.url.toString())}.json`, 'utf-8')
            console.log('Reusing cached entry for ' + request.url);
            return JSON.parse(cachedFile);
        } catch (err) {
            console.error(err);
        }
    }

    async postRequest(request: ApiRequest, response: unknown): Promise<void> {
        await fs.writeFile(`./__cache/${hash(request.url.toString())}.json`, JSON.stringify(response));
    }
}
