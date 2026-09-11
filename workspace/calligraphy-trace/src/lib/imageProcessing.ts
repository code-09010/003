/**
 * 像素级图像处理：灰度化、自适应二值化、形态学闭运算。
 * 关键需求：毛笔的飞白（笔画内部枯笔断口）和连笔（笔画间细丝相连）
 * 不能像硬笔字那样简单按连通域切分，这里通过闭运算把断口"焊"回去，
 * 让一段毛笔笔画保持为一个整体轮廓。
 */

/** 从 ImageData 提取墨迹强度图（0=纸，255=墨）。考虑宣纸偏黄，用亮度+饱和度综合判断。 */
export function extractInk(image: ImageData, sensitivity: number): Uint8Array {
  const { data, width, height } = image;
  const ink = new Uint8Array(width * height);
  // 先估算纸色：取四角小块的平均色作为背景基准
  let pr = 0, pg = 0, pb = 0, n = 0;
  const corners: [number, number][] = [
    [4, 4], [width - 5, 4], [4, height - 5], [width - 5, height - 5],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < 6; dy++) {
      for (let dx = 0; dx < 6; dx++) {
        const i = ((cy + dy) * width + (cx + dx)) * 4;
        pr += data[i]; pg += data[i + 1]; pb += data[i + 2];
        n++;
      }
    }
  }
  pr /= n; pg /= n; pb /= n;

  // 灵敏度映射到距离阈值：灵敏度高 -> 阈值低 -> 浅墨也算笔画
  const threshold = 30 + (1 - sensitivity) * 90;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
    ink[i] = d > threshold ? Math.min(255, (d - threshold) * 3) : 0;
  }
  return ink;
}

/** Otsu 自适应阈值，把墨迹强度图转成二值图 */
export function binarize(ink: Uint8Array): Uint8Array {
  const hist = new Array(256).fill(0);
  for (const v of ink) hist[v]++;
  const total = ink.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > maxVar) { maxVar = between; threshold = t; }
  }
  const binary = new Uint8Array(ink.length);
  for (let i = 0; i < ink.length; i++) binary[i] = ink[i] > threshold ? 1 : 0;
  return binary;
}

/** 3x3 膨胀 */
function dilate(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1 && !m; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (src[(y + dy) * w + (x + dx)]) { m = 1; break; }
      dst[y * w + x] = m;
    }
  }
  return dst;
}

/** 3x3 腐蚀 */
function erode(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let m = 1;
      for (let dy = -1; dy <= 1 && m; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!src[(y + dy) * w + (x + dx)]) { m = 0; break; }
      dst[y * w + x] = m;
    }
  }
  return dst;
}

/**
 * 形态学闭运算（先膨胀后腐蚀），重复 radius 轮。
 * 作用：把飞白造成的笔画内部小断口、连笔的细弱连接焊合，
 * 同时保留笔画整体形状，避免硬笔式"逐连通域切分"把一笔拆成碎片。
 */
export function closing(binary: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  let cur = binary;
  for (let i = 0; i < radius; i++) cur = dilate(cur, w, h);
  for (let i = 0; i < radius; i++) cur = erode(cur, w, h);
  return cur;
}

/** 完整流水线：照片 -> 二值笔画掩码 */
export function photoToMask(image: ImageData, sensitivity: number, closingRadius: number): Uint8Array {
  const ink = extractInk(image, sensitivity);
  const binary = binarize(ink);
  return closing(binary, image.width, image.height, closingRadius);
}
