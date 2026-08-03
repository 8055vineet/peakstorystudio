import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom has no real canvas encoder or decoder, so both browser APIs
// resizeImage depends on are stubbed here rather than pretending to encode:
// HTMLCanvasElement.prototype.toBlob/getContext (jsdom's getContext('2d')
// returns null with a "Not implemented" warning) and the global
// createImageBitmap. Local to this file, unlike the IntersectionObserver
// stub in src/test/setup.js, because every test needs a different decoded
// size and jsdom's default (a null 2d context) would otherwise throw inside
// resizeImage before a single test-specific assertion runs.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

// Sizes actually drawn to canvas.width/canvas.height at the moment toBlob is
// called — this is how the "reported dimensions match the blob produced"
// requirement gets asserted: not by trusting resizeImage's return value in
// isolation, but by comparing it against what was actually set on the canvas.
let capturedCanvasSizes;

function stubBitmap(width, height) {
  return { width, height, close: vi.fn() };
}

beforeEach(() => {
  capturedCanvasSizes = [];
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type, quality) {
    capturedCanvasSizes.push({ width: this.width, height: this.height, type, quality });
    callback(new Blob(['stub-bytes'], { type: type || 'image/webp' }));
  };
  vi.stubGlobal('createImageBitmap', vi.fn());
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  vi.unstubAllGlobals();
});

const { fitWithin, resizeImage, ImageError } = await import('../images.js');

function makeImageFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['stub-bytes'], name, { type });
}

describe('fitWithin', () => {
  it('scales a landscape image down to fit the longest edge, preserving aspect ratio', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it('scales a portrait image down using height as the longest edge', () => {
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it('never upscales an image already within the cap', () => {
    expect(fitWithin(1200, 800, 2000)).toEqual({ width: 1200, height: 800 });
  });

  it('never upscales even a tiny image far below the cap', () => {
    expect(fitWithin(100, 50, 2000)).toEqual({ width: 100, height: 50 });
  });

  it('leaves an image exactly at the cap unchanged', () => {
    expect(fitWithin(2000, 1500, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it('never rounds a dimension down to zero for an extreme aspect ratio', () => {
    // scale = 2000/4001 ~= 0.49988; a naive Math.round(1 * scale) is 0.
    expect(fitWithin(4001, 1, 2000)).toEqual({ width: 2000, height: 1 });
  });
});

describe('resizeImage', () => {
  it('rejects a non-image file with a typed error, before ever decoding', async () => {
    const file = new File(['%PDF'], 'contract.pdf', { type: 'application/pdf' });

    const failure = await resizeImage(file).catch((error) => error);

    expect(failure).toBeInstanceOf(ImageError);
    expect(failure.code).toBe('NOT_AN_IMAGE');
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects a file with no type at all', async () => {
    const file = new File(['bytes'], 'mystery', { type: '' });

    const failure = await resizeImage(file).catch((error) => error);

    expect(failure).toBeInstanceOf(ImageError);
    expect(failure.code).toBe('NOT_AN_IMAGE');
  });

  it('scales a 4000x3000 source down to 2000x1500 by default', async () => {
    createImageBitmap.mockResolvedValue(stubBitmap(4000, 3000));

    const result = await resizeImage(makeImageFile());

    expect(result.width).toBe(2000);
    expect(result.height).toBe(1500);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/webp');
  });

  it('leaves a 1200x800 source at 1200x800, but still re-encodes it', async () => {
    createImageBitmap.mockResolvedValue(stubBitmap(1200, 800));

    const result = await resizeImage(makeImageFile());

    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    // Re-encoded, not passed through untouched: toBlob must still have run,
    // so the output format is predictable for every upload regardless of
    // whether the source needed scaling at all.
    expect(capturedCanvasSizes).toHaveLength(1);
  });

  it('reports dimensions that match the canvas actually drawn, not the source', async () => {
    createImageBitmap.mockResolvedValue(stubBitmap(4000, 3000));

    const result = await resizeImage(makeImageFile());

    expect(capturedCanvasSizes).toEqual([
      { width: 2000, height: 1500, type: 'image/webp', quality: 0.82 },
    ]);
    expect(result.width).toBe(capturedCanvasSizes[0].width);
    expect(result.height).toBe(capturedCanvasSizes[0].height);
  });

  it('honours a custom maxEdge, type, and quality', async () => {
    createImageBitmap.mockResolvedValue(stubBitmap(500, 1000));

    const result = await resizeImage(makeImageFile(), { maxEdge: 100, type: 'image/jpeg', quality: 0.5 });

    expect(result.width).toBe(50);
    expect(result.height).toBe(100);
    expect(result.type).toBe('image/jpeg');
    expect(capturedCanvasSizes[0]).toMatchObject({ type: 'image/jpeg', quality: 0.5 });
  });

  it('closes the decoded bitmap after drawing it', async () => {
    const bitmap = stubBitmap(4000, 3000);
    createImageBitmap.mockResolvedValue(bitmap);

    await resizeImage(makeImageFile());

    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('throws DECODE_FAILED when the browser cannot decode a file that claims to be an image', async () => {
    createImageBitmap.mockRejectedValue(new Error('not a real jpeg'));

    const failure = await resizeImage(makeImageFile()).catch((error) => error);

    expect(failure).toBeInstanceOf(ImageError);
    expect(failure.code).toBe('DECODE_FAILED');
  });

  it('throws ENCODE_FAILED when the canvas cannot produce a blob', async () => {
    createImageBitmap.mockResolvedValue(stubBitmap(4000, 3000));
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(null);
    };

    const failure = await resizeImage(makeImageFile()).catch((error) => error);

    expect(failure).toBeInstanceOf(ImageError);
    expect(failure.code).toBe('ENCODE_FAILED');
  });
});
