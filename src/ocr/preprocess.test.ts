import { describe, expect, it } from 'vitest'
import {
  luma,
  lumaHistogram,
  medianLuminance,
  ocrScaleFor,
  shouldInvert,
  toGrayscaleInPlace,
  toOriginal,
} from './preprocess'

describe('ocrScaleFor', () => {
  it('upscales images narrower than 1400 px by 2', () => {
    expect(ocrScaleFor(1080)).toBe(2)
    expect(ocrScaleFor(1399)).toBe(2)
    expect(ocrScaleFor(1170)).toBe(2)
  })
  it('leaves wide images at 1', () => {
    expect(ocrScaleFor(1400)).toBe(1)
    expect(ocrScaleFor(2000)).toBe(1)
  })
})

describe('toOriginal', () => {
  it('maps upscaled coordinates back to original pixels', () => {
    expect(toOriginal(200, 2)).toBe(100)
    expect(toOriginal(101, 2)).toBe(51)
    expect(toOriginal(77, 1)).toBe(77)
  })
})

describe('luma', () => {
  it('uses Rec. 601 weights', () => {
    expect(luma(255, 255, 255)).toBe(255)
    expect(luma(0, 0, 0)).toBe(0)
    expect(luma(255, 0, 0)).toBe(76)
    expect(luma(0, 255, 0)).toBe(150)
  })
})

describe('medianLuminance', () => {
  it('returns the median bin scaled to 0–1', () => {
    // Three pixels: black, mid-gray (128), white.
    const hist = new Array<number>(256).fill(0)
    hist[0] = 1
    hist[128] = 1
    hist[255] = 1
    expect(medianLuminance(hist)).toBeCloseTo(128 / 255)
  })
  it('follows the bulk of the pixels, not the extremes', () => {
    const hist = new Array<number>(256).fill(0)
    hist[10] = 900
    hist[250] = 100
    expect(medianLuminance(hist)).toBeCloseTo(10 / 255)
  })
  it('returns 0.5 for an empty histogram', () => {
    expect(medianLuminance(new Array<number>(256).fill(0))).toBe(0.5)
  })
})

describe('shouldInvert', () => {
  it('inverts dark screenshots and keeps light ones', () => {
    const dark = lumaHistogram([20, 20, 20, 255, 30, 30, 30, 255, 240, 240, 240, 255])
    const light = lumaHistogram([240, 240, 240, 255, 250, 250, 250, 255, 20, 20, 20, 255])
    expect(shouldInvert(dark)).toBe(true)
    expect(shouldInvert(light)).toBe(false)
  })
})

describe('toGrayscaleInPlace', () => {
  it('converts to opaque gray without inverting', () => {
    const px = [255, 0, 0, 0]
    toGrayscaleInPlace(px, false)
    expect(px).toEqual([76, 76, 76, 255])
  })
  it('inverts when asked', () => {
    const px = [255, 255, 255, 255, 0, 0, 0, 0]
    toGrayscaleInPlace(px, true)
    expect(px).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })
})
