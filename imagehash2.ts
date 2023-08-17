import type { Canvas, Image } from 'canvas';

function RGBToHSB(r: number, g: number, b: number): [h: number, s: number, b: number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const v = Math.max(r, g, b),
        n = v - Math.min(r, g, b);
    const h =
        n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
    return [60 * (h < 0 ? h + 6 : h), v && (n / v) * 100, v * 100];
}

import { buf as crcBuffer } from 'crc-32';

// Theoretically works on both node.js (with 'canvas' module) and the browser
export function getHashAndIdentity(img: HTMLImageElement | Image, canvas: HTMLCanvasElement | Canvas, context: CanvasRenderingContext2D, prefix?: string): [hash: number, ident: Uint8Array] {
    canvas.width = 8;
    canvas.height = 8;
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const ident = getIdentity(imageData);

    canvas.width = img.width;
    canvas.height = img.height;
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const hash = getHash(imageData);

    return [hash, ident];
}

export function getHash(data: ImageData): number {
    const newArray = new Uint8Array((data.data.length / 4) * 3);

    // remove alpha bits
    for (let i = 0; i < data.data.length / 4; i++) {
        let r = data.data[i * 4];
        let g = data.data[(i * 4) + 1];
        let b = data.data[(i * 4) + 2];

        // https://gist.github.com/wirepair/b831cf168882c7013b68c1703bda5250#file-16to24-html-L47-L49
        r = Math.round((r / 255) * 63) | 0;
        g = Math.round((g / 255) * 63) | 0;
        b = Math.round((b / 255) * 63) | 0;

        newArray[i * 3]       = r;
        newArray[(i * 3) + 1] = g;
        newArray[(i * 3) + 2] = b;
    }

    return crcBuffer(newArray);
}

export function getIdentity(data: ImageData): Uint8Array {
    const array: number[] = [];

    let i = 0;
    for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
            // normalize alpha to white
            if (data.data[i + 3] < 25) {
                data.data[i] = 255;
                data.data[i + 1] = 255;
                data.data[i + 2] = 255;
            }

            let [h, s, b] = RGBToHSB(data.data[i], data.data[i + 1], data.data[i + 2]);
            h /= 360;
            s /= 100;
            b /= 100;

            // first 4 bits: hue
            const bit03 = (15 * h) | 0;
            const bit56 = (3 * s) | 0;
            const bit78 = (3 * b) | 0;

            array[x + (y * data.width)] = bit03 | (bit56 << 4) | (bit78 << 6);

            i += 4;
        }
    }

    return new Uint8Array(array);
}

