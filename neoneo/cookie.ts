export function cookie(): Record<string, string> {
    return Object.fromEntries(document.cookie.split('; ').map(x => x.split(/=(.*)$/,2).map(decodeURIComponent)));
}
