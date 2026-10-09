/**
 * Image preparation before Tesseract. The helpers at the top are pure (plain arrays, no DOM)
 * so they can be unit-tested in Node; `preprocessForOcr` is the only browser-bound part.
 */

/** Screenshots narrower than this are upscaled: Tesseract reads small text poorly. */
export const UPSCALE_BELOW_WIDTH = 1400
export const UPSCALE_FACTOR = 2

/** Pixel buffer in RGBA order (a canvas `ImageData.data` or a plain array in tests). */
export type RgbaBuffer = Uint8ClampedArray | number[]

/** Scale applied before OCR for an image of this width. */
export function ocrScaleFor(width: number): number {
  return width < UPSCALE_BELOW_WIDTH ? UPSCALE_FACTOR : 1
}

/** Maps a coordinate from the upscaled OCR image back to original image pixels. */
export function toOriginal(value: number, scale: number): number {
  return Math.round(value / scale)
}

/** Rec. 601 luma of one pixel, integer 0–255. */
export function luma(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

/** 256-bin luma histogram over RGBA data (alpha ignored). */
export function lumaHistogram(rgba: RgbaBuffer): number[] {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    hist[luma(rgba[i], rgba[i + 1], rgba[i + 2])]++
  }
  return hist
}

/** Median luminance in 0–1 from a 256-bin histogram. Empty histogram gives 0.5. */
export function medianLuminance(hist: readonly number[]): number {
  const total = hist.reduce((sum, n) => sum + n, 0)
  if (total === 0) return 0.5
  // Smallest bin whose cumulative count reaches the middle pixel.
  const middle = (total + 1) / 2
  let cumulative = 0
  for (let bin = 0; bin < hist.length; bin++) {
    cumulative += hist[bin]
    if (cumulative >= middle) return bin / 255
  }
  return 1
}

/** Dark-mode screenshots (light text on dark background) are inverted so Tesseract sees dark text on light. */
export function shouldInvert(hist: readonly number[]): boolean {
  return medianLuminance(hist) < 0.5
}

/** Writes grayscale luma into R, G, B in place, inverting when asked. Alpha is set to opaque. */
export function toGrayscaleInPlace(rgba: RgbaBuffer, invert: boolean): void {
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const gray = luma(rgba[i], rgba[i + 1], rgba[i + 2])
    const value = invert ? 255 - gray : gray
    rgba[i] = value
    rgba[i + 1] = value
    rgba[i + 2] = value
    rgba[i + 3] = 255
  }
}

export interface PreparedImage {
  /** Canvas handed to Tesseract. Coordinates it reports are `scale` times the original image. */
  canvas: HTMLCanvasElement
  /** Upscale factor applied (1 or UPSCALE_FACTOR). */
  scale: number
  /** Size of the original image in pixels. */
  width: number
  height: number
}

/**
 * Decodes the screenshot, inverts dark-mode images, converts to grayscale and upscales small ones.
 * Analysis runs at original size to keep memory low; only the final canvas is enlarged.
 */
export async function preprocessForOcr(image: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(image)
  try {
    const { width, height } = bitmap
    const base = document.createElement('canvas')
    base.width = width
    base.height = height
    const baseCtx = base.getContext('2d', { willReadFrequently: true })
    if (!baseCtx) throw new Error('Canvas desteklenmiyor')
    baseCtx.drawImage(bitmap, 0, 0)

    const pixels = baseCtx.getImageData(0, 0, width, height)
    toGrayscaleInPlace(pixels.data, shouldInvert(lumaHistogram(pixels.data)))
    baseCtx.putImageData(pixels, 0, 0)

    const scale = ocrScaleFor(width)
    if (scale === 1) return { canvas: base, scale, width, height }

    const big = document.createElement('canvas')
    big.width = width * scale
    big.height = height * scale
    const bigCtx = big.getContext('2d')
    if (!bigCtx) throw new Error('Canvas desteklenmiyor')
    bigCtx.imageSmoothingEnabled = true
    bigCtx.imageSmoothingQuality = 'high'
    bigCtx.drawImage(base, 0, 0, big.width, big.height)
    return { canvas: big, scale, width, height }
  } finally {
    bitmap.close()
  }
}
