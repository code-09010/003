/**
 * 字帖管理：SVG 文件解析 + 内置字帖。
 * 字帖笔画以 SVG path（中心线）存储，渲染时按毛笔宽度描边。
 */
import type { Copybook } from '../types';

/** 毛笔字渲染宽度（字帖坐标系） */
export const BRUSH_WIDTH = 22;

/** 解析用户上传的 SVG 文件为字帖 */
export function parseSvgCopybook(svgText: string, name: string): Copybook {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('不是有效的 SVG 文件');

  let width = 300, height = 300;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      width = parts[2];
      height = parts[3];
    }
  } else {
    width = parseFloat(svg.getAttribute('width') || '300') || 300;
    height = parseFloat(svg.getAttribute('height') || '300') || 300;
  }

  const strokes: string[] = [];
  doc.querySelectorAll('path').forEach((p) => {
    const d = p.getAttribute('d');
    if (d && d.trim()) strokes.push(d.trim());
  });
  if (strokes.length === 0) throw new Error('SVG 中没有找到 <path> 笔画');

  return {
    id: `cb-${Date.now()}`,
    name,
    strokes,
    width,
    height,
    createdAt: Date.now(),
  };
}

/** 把字帖渲染到画布（描边式，供叠加显示与栅格化） */
export function renderCopybook(
  ctx: CanvasRenderingContext2D,
  copybook: Copybook,
  color: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = BRUSH_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of copybook.strokes) {
    ctx.stroke(new Path2D(d));
  }
  ctx.restore();
}

/**
 * 内置字帖：永字八法（侧、勒、弩、趯、策、掠、啄、磔 八笔）。
 * 300x300 视图框，手工标定的中心线路径。
 */
export const BUILTIN_COPYBOOKS: Copybook[] = [
  {
    id: 'builtin-yong',
    name: '永（永字八法）',
    width: 300,
    height: 300,
    createdAt: 0,
    strokes: [
      'M 150 42 Q 158 62 148 84',                 // 1 点（侧）
      'M 108 96 Q 150 88 196 96',                 // 2 横（勒）
      'M 150 84 Q 148 160 146 218 Q 145 236 132 244', // 3 竖钩（弩+趯）
      'M 150 128 Q 120 132 96 150',               // 4 左上挑（策）
      'M 96 150 Q 118 168 138 190',               // 5 左下撇（掠）
      'M 152 122 Q 178 128 204 142',              // 6 右上短撇（啄）
      'M 152 160 Q 185 195 222 232',              // 7 右下捺（磔）
    ],
  },
  {
    id: 'builtin-zhi',
    name: '之',
    width: 300,
    height: 300,
    createdAt: 0,
    strokes: [
      'M 150 50 Q 158 68 150 88',                 // 点
      'M 96 118 Q 150 108 204 116',               // 横
      'M 150 116 Q 138 160 110 196',              // 撇折
      'M 110 196 Q 160 210 230 246',              // 捺
    ],
  },
];
