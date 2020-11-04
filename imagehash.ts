// https://github.com/LinusU/blockhash-core
//
// The MIT License (MIT)
//
// Copyright (c) 2019 Linus Unnebäck
// Copyright (c) 2014 Commons Machinery
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const medianSort = (a: number, b: number) => a - b;
function median(data: number[], inPlace = true): number {
    const mdarr = inPlace ? data : data.slice(0);
    mdarr.sort(medianSort);

    if (mdarr.length % 2 === 0) {
        return (mdarr[mdarr.length / 2 - 1] + mdarr[mdarr.length / 2]) / 2;
    }

    return mdarr[Math.floor(mdarr.length / 2)];
}

function translateBlocksToBits(blocks: number[], pixelsPerBlock: number) {
    const halfBlockValue = pixelsPerBlock * 256 * 3 / 2;
    const bandsize = blocks.length / 4;

    // Compare medians across four horizontal bands
    for (let i = 0; i < 4; i++) {
        const m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
        for (let j = i * bandsize; j < (i + 1) * bandsize; j++) {
            const v = blocks[j];

            // Output a 1 if the block is brighter than the median.
            // With images dominated by black or white, the median may
            // end up being 0 or the max value, and thus having a lot
            // of blocks of value equal to the median.  To avoid
            // generating hashes of all zeros or ones, in that case output
            // 0 if the median is in the lower value space, 1 otherwise
            blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > halfBlockValue));
        }
    }
}

function bitsToArray(bits: number[]): Uint32Array {
    const output = new Uint32Array(((bits.length / 32) | 0) + (bits.length % 32 !== 0 ? 1 : 0));

    for (let i = 0; i < bits.length; i++) {
        if (bits[i] !== 0) {
            output[(i / 32) | 0] |= 1 << (i % 32);
        }
    }

    return output;
}

export function bmvbhash(data: ImageData, bits: number): Uint32Array {
    const blocks: number[][] = [];

    const evenX = data.width % bits === 0;
    const evenY = data.height % bits === 0;

    if (evenX && evenY) {
        throw new Error('Use the even variant');
    }

    // initialize blocks array with 0s
    for (let i = 0; i < bits; i++) {
        const segment = new Array(bits);
        blocks.push(segment);
        for (let j = 0; j < bits; j++) {
            segment[j] = 0;
        }
    }

    const blockWidth = data.width / bits;
    const blockHeight = data.height / bits;

    for (let y = 0; y < data.height; y++) {
        let weightTop: number, weightBottom: number;
        let blockTop: number, blockBottom: number;
        if (evenY) {
            // don't bother dividing y, if the size evenly divides by bits
            blockTop = blockBottom = Math.floor(y / blockHeight);
            weightTop = 1;
            weightBottom = 0;
        } else {
            const yMod = (y + 1) % blockHeight;
            const yFrac = yMod - Math.floor(yMod);
            const yInt = yMod - yFrac;

            weightTop = (1 - yFrac);
            weightBottom = (yFrac);

            // yInt will be 0 on bottom/right borders and on block boundaries
            if (yInt > 0 || (y + 1) === data.height) {
                blockTop = blockBottom = Math.floor(y / blockHeight);
            } else {
                blockTop = Math.floor(y / blockHeight);
                blockBottom = Math.ceil(y / blockHeight);
            }
        }

        for (let x = 0; x < data.width; x++) {
            const ii = (y * data.width + x) * 4;

            const alpha = data.data[ii + 3];
            const avgvalue = (alpha === 0) ? 765 : data.data[ii] + data.data[ii + 1] + data.data[ii + 2];

            let weightLeft: number, weightRight: number;
            let blockLeft: number, blockRight: number;

            if (evenX) {
                blockLeft = blockRight = Math.floor(x / blockWidth);
                weightLeft = 1;
                weightRight = 0;
            } else {
                const xMod = (x + 1) % blockWidth;
                const xFrac = xMod - Math.floor(xMod);
                const xInt = xMod - xFrac;

                weightLeft = (1 - xFrac);
                weightRight = xFrac;

                // xInt will be 0 on bottom/right borders and on block boundaries
                if (xInt > 0 || (x + 1) === data.width) {
                    blockLeft = blockRight = Math.floor(x / blockWidth);
                } else {
                    blockLeft = Math.floor(x / blockWidth);
                    blockRight = Math.ceil(x / blockWidth);
                }
            }

            // add weighted pixel value to relevant blocks
            blocks[blockTop][blockLeft] += avgvalue * weightTop * weightLeft;
            blocks[blockTop][blockRight] += avgvalue * weightTop * weightRight;
            blocks[blockBottom][blockLeft] += avgvalue * weightBottom * weightLeft;
            blocks[blockBottom][blockRight] += avgvalue * weightBottom * weightRight;
        }
    }

    const result: number[] = [];

    for (let i = 0; i < bits; i++) {
        for (let j = 0; j < bits; j++) {
            result.push(blocks[i][j]);
        }
    }

    translateBlocksToBits(result, blockWidth * blockHeight);

    return bitsToArray(result);
}
