import * as assert from 'node:assert';

const ALL_SCHEMES = {};

const matchScheme = String.raw`(\*|http|https|file|ftp)`;
const matchHost = String.raw`(\*|(?:\*\.)?(?:[^/*]+))?`;
const matchPath = String.raw`(.*)?`;
const regex = new RegExp(`^${matchScheme}://${matchHost}(/)${matchPath}$`);
function getParts(pattern: string) {
    if (pattern === '<all_urls>') {
        return {
            scheme: ALL_SCHEMES,
            host: '*',
            path: '*',
        };
    }

    const result = regex.exec(pattern);
    assert(result, 'Invalid pattern');

    return {
        scheme: result[1],
        host: result[2],
        path: result[4],
    };
}

function createMatcher(pattern: string) {
    const parts = getParts(pattern);
    let str = '^';

    // check scheme
    if (parts.scheme === ALL_SCHEMES) {
        str += '(http|https|ftp|file)';
    } else if (parts.scheme === '*') {
        str += '(http|https)';
    } else {
        str += parts.scheme;
    }

    str += '://';

    // check host
    if (parts.host === '*') {
        str += '.*';
    } else if (parts.host?.startsWith('*.')) {
        str += '.*';
        str += '\\.?';
        str += parts.host.slice(2).replace(/\./g, '\\.');
    } else if (parts.host) {
        str += parts.host;
    }

    // check path
    if (!parts.path) {
        str += '/?';
    } else if (parts.path) {
        str += '/';
        str += parts.path
            .replace(/[$()+.?[\\\]^{|}]/g, String.raw`\$&`)
            .replace(/\*/g, '.*');
    }

    str += '$';

    const regex = new RegExp(str);
    return (url: string) => regex.test(url);
}

export default function match(pattern: string, optionalUrl?: string) {
    const matcher = createMatcher(pattern);

    if (optionalUrl !== undefined) {
        return matcher(optionalUrl);
    }

    return matcher;
}
