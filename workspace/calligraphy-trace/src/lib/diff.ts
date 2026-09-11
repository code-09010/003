/**
 * 差异分析：
 * 1. 把字帖 SVG 路径栅格化并按弧长采样，得到每个笔画的采样点列；
 * 2. 对学生照片（已按学生对齐变换映射到字帖坐标系）的二值掩码做距离变换；
 * 3. 逐采样点查询"离最近的学生墨迹有多远"，得到逐笔画段的偏移量；
 * 4. 连续超阈值的采样点段标记为红色偏差段。
 */
import type { AnalysisResult, GradingConfig, StrokeDeviation, Transform } from '../types';
import { photoToMask } from './imageProcessing';
import { extractContours, simplify, type Point } from './contour';

/** 沿 SVG 路径按弧长均匀采样（用浏览器原生 getPointAtLength，纯前端） */
export function samplePath(d: string, step = 4): Point[] {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const len = path.getTotalLength();
  const pts: Point[] = [];
  for (let l = 0; l <= len; l += step) {
    const p = path.getPointAtLength(l);
    pts.push({ x: p.x, y: p.y });
  }
  return pts;
}

/** 两遍 Chamfer 距离变换：输出每个像素到最近墨迹像素的距离 */
export function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < mask.length; i++) dist[i] = mask[i] ? 0 : INF;
  // 前向
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let m = dist[i];
      if (x > 0) m = Math.min(m, dist[i - 1] + 1);
      if (y > 0) {
        m = Math.min(m, dist[i - w] + 1);
        if (x > 0) m = Math.min(m, dist[i - w - 1] + 1.414);
        if (x < w - 1) m = Math.min(m, dist[i - w + 1] + 1.414);
      }
      dist[i] = m;
    }
  }
  // 后向
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let m = dist[i];
      if (x < w - 1) m = Math.min(m, dist[i + 1] + 1);
      if (y < h - 1) {
        m = Math.min(m, dist[i + w] + 1);
        if (x < w - 1) m = Math.min(m, dist[i + w + 1] + 1.414);
        if (x > 0) m = Math.min(m, dist[i + w - 1] + 1.414);
      }
      dist[i] = m;
    }
  }
  return dist;
}

/**
 * 主分析入口。
 * @param photoCanvas 学生照片画布（原始像素）
 * @param transform   学生已调好的对齐变换（照片 -> 字帖坐标系）
 * @param strokes     字帖 SVG 路径
 * @param tplW/tplH   字帖视图框尺寸
 * @param grading     评分标准
 */
export function analyze(
  photoCanvas: HTMLCanvasElement,
  transform: Transform,
  strokes: string[],
  tplW: number,
  tplH: number,
  grading: GradingConfig,
): AnalysisResult {
  // 1. 把学生照片按对齐变换画到字帖坐标系的画布上
  const warped = document.createElement('canvas');
  warped.width = tplW;
  warped.height = tplH;
  const wctx = warped.getContext('2d')!;
  wctx.translate(transform.x, transform.y);
  wctx.rotate(transform.rotate);
  wctx.scale(transform.scale, transform.scale);
  wctx.drawImage(photoCanvas, 0, 0);

  // 2. 像素级处理：二值化 + 闭运算（处理飞白/连笔）
  const imageData = wctx.getImageData(0, 0, tplW, tplH);
  const mask = photoToMask(imageData, grading.inkSensitivity, grading.closingRadius);

  // 3. 距离变换
  const dist = distanceTransform(mask, tplW, tplH);

  // 4. 逐笔画采样评估
  const deviations: StrokeDeviation[] = strokes.map((d, strokeIndex) => {
    const samples = samplePath(d, 4);
    const points = samples.map((p) => {
      const px = Math.round(p.x), py = Math.round(p.y);
      const deviation =
        px >= 0 && px < tplW && py >= 0 && py < tplH ? dist[py * tplW + px] : 50;
      return { x: p.x, y: p.y, deviation };
    });
    const mean =
      points.length > 0
        ? points.reduce((s, p) => s + p.deviation, 0) / points.length
        : 0;
    return {
      strokeIndex,
      points,
      meanDeviation: mean,
      exceeded: points.some((p) => p.deviation > grading.offsetThreshold),
    };
  });

  // 5. 综合得分：平均偏移越大分越低，超阈值笔画比例额外扣分
  const allMeans = deviations.map((d) => d.meanDeviation);
  const overallMean = allMeans.length
    ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length
    : 0;
  const exceededRatio = deviations.length
    ? deviations.filter((d) => d.exceeded).length / deviations.length
    : 0;
  const score = Math.max(
    0,
    Math.round(100 - overallMean * 4 - exceededRatio * 30),
  );

  // 6. 提取学生笔画轮廓（简化后用于渲染叠加）
  const rawContours = extractContours(mask, tplW, tplH);
  const studentContours = rawContours.slice(0, 50).map((c) => simplify(c, 1.5));

  return { deviations, score, studentContours, computedAt: Date.now() };
}
