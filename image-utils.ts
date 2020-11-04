import GM_fetch from './GM_fetch';

const sharedCanvas = document.createElement('canvas');
const sharedContext = sharedCanvas.getContext('2d')!;

// https://stackoverflow.com/a/10755011
export async function toImageData(img: HTMLImageElement): Promise<[data: ImageData, detachedImage: HTMLImageElement]> {
    const blob = await toBlob(img);

    const image = new Image();

    return await new Promise(resolve => {
        image.addEventListener('load', () => {
            sharedCanvas.width = image.naturalWidth || image.width;
            sharedCanvas.height = image.naturalHeight || image.height;
            sharedContext.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
            sharedContext.drawImage(image, 0, 0);
            const imageData = sharedContext.getImageData(0, 0, sharedCanvas.width, sharedCanvas.height);
            resolve([imageData, image]);
        });

        image.src = URL.createObjectURL(blob);
    });
}

export async function toBlob(img: HTMLImageElement): Promise<Blob> {
    return await GM_fetch(img.src, {
        headers: {
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': 'https://gpx.plus/shelter/eggs',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-site',
        }
    }).then(res => res.blob());
}
