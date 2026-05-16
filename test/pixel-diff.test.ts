import test from 'node:test';
import assert from 'node:assert/strict';
import { PixelDiff } from '../chrome-extension/lib/pixel-diff';

// Mock ImageData for Node.js environment
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

// Mock OffscreenCanvas and its context
(globalThis as any).OffscreenCanvas = class {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {
      createImageData: (w: number, h: number) => new MockImageData(w, h),
      putImageData: () => {},
      drawImage: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => new MockImageData(w, h)
    };
  }
  convertToBlob() {
    return Promise.resolve(new MockBlob());
  }
};

class MockBlob {}
(globalThis as any).Blob = MockBlob;

(globalThis as any).Image = class {
  onload: () => void = () => {};
  onerror: () => void = () => {};
  _src: string = '';
  set src(val: string) {
    this._src = val;
    setTimeout(() => {
      if (val === 'fail') this.onerror();
      else this.onload();
    }, 0);
  }
  get src() { return this._src; }
  set crossOrigin(_: string) {}
};

(globalThis as any).FileReader = class {
  onload: () => void = () => {};
  result: string = 'data:image/png;base64,mock';
  readAsDataURL() {
    setTimeout(() => this.onload(), 0);
  }
};

test('PixelDiff.compare identifies matches and mismatches', () => {
  const imgA = new MockImageData(2, 2) as unknown as ImageData;
  const imgB = new MockImageData(2, 2) as unknown as ImageData;

  // All pixels match (black)
  const result1 = PixelDiff.compare(imgA, imgB);
  assert.equal(result1.matchPercent, 100);
  assert.equal(result1.diffCount, 0);

  // One pixel mismatch (red)
  imgB.data[0] = 255;
  const result2 = PixelDiff.compare(imgA, imgB);
  assert.equal(result2.matchPercent, 75); // 3 out of 4 match
  assert.equal(result2.diffCount, 1);
});

test('PixelDiff.findBestAlignment finds optimal offset', () => {
  const imgA = new MockImageData(30, 30) as unknown as ImageData;
  const imgB = new MockImageData(30, 30) as unknown as ImageData;

  // Stride is 2, range is 5. Sampling starts at x=5, 7, 9, 11, 13...
  // Place a single white pixel at (11,11) in imgA
  const idxA = (11 * 30 + 11) * 4;
  imgA.data[idxA] = imgA.data[idxA + 1] = imgA.data[idxA + 2] = 255;
  imgA.data[idxA + 3] = 255;

  // Place a single white pixel at (13,13) in imgB (shifted by +2,+2)
  const idxB = (13 * 30 + 13) * 4;
  imgB.data[idxB] = imgB.data[idxB + 1] = imgB.data[idxB + 2] = 255;
  imgB.data[idxB + 3] = 255;

  const result = PixelDiff.findBestAlignment(imgA, imgB, 5);
  assert.equal(result.x, 2);
  assert.equal(result.y, 2);
  assert.ok(result.matchPercent > 99);
});

test('PixelDiff.findBestAlignment handles no match gracefully', () => {
  const imgA = new MockImageData(10, 10) as unknown as ImageData;
  const imgB = new MockImageData(10, 10) as unknown as ImageData;

  // imgA is all black
  // imgB is all white
  for (let i = 0; i < imgB.data.length; i++) {
    imgB.data[i] = 255;
  }

  const result = PixelDiff.findBestAlignment(imgA, imgB, 2);
  // Should still return some result, likely 0,0 if all matchPercents are 0
  assert.equal(typeof result.x, 'number');
  assert.equal(typeof result.y, 'number');
});

test('PixelDiff.loadImageData loads image into ImageData', async () => {
  const data = await PixelDiff.loadImageData('mock-src', 10, 10);
  assert.equal(data.width, 10);
  assert.equal(data.height, 10);
  assert.ok(data.data instanceof Uint8ClampedArray);
});

test('PixelDiff.loadImageData handles errors', async () => {
  await assert.rejects(
    () => PixelDiff.loadImageData('fail', 10, 10),
    /Failed to load image/
  );
});

test('PixelDiff.imageDataToURL converts ImageData to data URL', async () => {
  const img = new MockImageData(10, 10) as unknown as ImageData;
  const url = await PixelDiff.imageDataToURL(img);
  assert.equal(url, 'data:image/png;base64,mock');
});
