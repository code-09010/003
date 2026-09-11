/**
 * 轮廓追踪：Moore 邻域追踪算法提取二值掩码的外轮廓，
 * 再用 Douglas-Peucker 简化成多边形，供渲染与差异分析使用。
 */

export type Point = { x: number; y: number };

// 8 邻域，顺时针
const NEIGHBORS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** Moore 邻域追踪：从起点出发沿边界走一圈，返回边界点序列 */
function traceBoundary(
  mask: Uint8Array, w: number, h: number, sx: number, sy: number, visited: Uint8Array,
): Point[] {
  const contour: Point[] = [];
  let cx = sx, cy = sy;
  // 初始回溯方向：从左边进入起点
  let dir = 6; // 指向 (0,-1) 之前的方向索引，保证顺时针
  const maxSteps = w * h; // 防死循环
  let steps = 0;

  do {
    contour.push({ x: cx, y: cy });
    visited[cy * w + cx] = 1;
    let found = false;
    // 从回溯方向的下一个位置开始顺时针找下一个边界像素
    for (let i = 0; i < 8; i++) {
      const d = (dir + 1 + i) % 8;
      const nx = cx + NEIGHBORS[d][0];
      const ny = cy + NEIGHBORS[d][1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx]) {
        // 回溯方向设为当前方向的反方向
        dir = (d + 4) % 8;
        cx = nx; cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break; // 孤立点
    steps++;
  } while ((cx !== sx || cy !== sy) && steps < maxSteps);

  return contour;
}

/** 提取所有外轮廓，按面积从大到小排序，过滤掉过小噪点 */
export function extractContours(mask: Uint8Array, w: number, h: number, minPoints = 20): Point[][] {
  const visited = new Uint8Array(mask.length);
  const contours: Point[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || visited[i]) continue;
      // 只从"左邻为空"的像素开始，保证是外轮廓起点
      if (x > 0 && mask[i - 1]) { visited[i] = 1; continue; }
      const contour = traceBoundary(mask, w, h, x, y, visited);
      if (contour.length >= minPoints) contours.push(contour);
    }
  }
  // 按包围盒面积降序
  contours.sort((a, b) => bboxArea(b) - bboxArea(a));
  return contours;
}

function bboxArea(c: Point[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of c) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return (maxX - minX) * (maxY - minY);
}

/** Douglas-Peucker 多边形简化 */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0, index = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > epsilon) {
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}
