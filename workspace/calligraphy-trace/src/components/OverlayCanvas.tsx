/**
 * 主画布：字帖 + 学生照片半透明叠加，支持拖动/旋转/缩放对齐；
 * 分析后切换为差异视图（学生笔画轮廓 + 红色偏差段 + 老师批注）。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Annotation, AnalysisResult, Copybook, Transform } from '../types';
import { renderCopybook } from '../lib/template';

interface Props {
  copybook: Copybook;
  transform: Transform;
  onTransformChange: (t: Transform) => void;
  /** 学生照片画布（未上传则为 null） */
  photoCanvas: HTMLCanvasElement | null;
  /** 对齐模式：显示半透明照片并可交互调整 */
  alignMode: boolean;
  result: AnalysisResult | null;
  offsetThreshold: number;
  annotations: Annotation[];
  /** 教学模式点击画布添加批注；为空则不可点击 */
  onCanvasClick?: (x: number, y: number) => void;
}

const DISPLAY_WIDTH = 640;

export function OverlayCanvas(props: Props) {
  const {
    copybook, transform, onTransformChange, photoCanvas,
    alignMode, result, offsetThreshold, annotations, onCanvasClick,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; base: Transform } | null>(null);

  const viewScale = DISPLAY_WIDTH / copybook.width;
  const displayHeight = Math.round(copybook.height * viewScale);

  /** 画布像素坐标 -> 字帖坐标 */
  const toTemplateCoords = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / viewScale,
        y: (e.clientY - rect.top) / viewScale,
      };
    },
    [viewScale],
  );

  // ---------- 渲染 ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // 米字格纸底
    ctx.fillStyle = '#faf6ec';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(viewScale, viewScale);
    ctx.strokeStyle = 'rgba(180,60,50,0.25)';
    ctx.lineWidth = 1 / viewScale;
    const w = copybook.width, h = copybook.height;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(0, 0); ctx.lineTo(w, h);
    ctx.moveTo(w, 0); ctx.lineTo(0, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, w, h);

    // 字帖层：对齐时半透明灰，结果视图淡墨
    renderCopybook(ctx, copybook, result ? '#999' : '#555', result ? 0.35 : 0.45);

    if (alignMode && photoCanvas) {
      // 学生照片半透明叠加（红色墨迹便于与灰色字帖区分）
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(transform.x, transform.y);
      ctx.rotate(transform.rotate);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(photoCanvas, 0, 0);
      ctx.restore();
    }

    if (result) {
      // 学生笔画轮廓（蓝色描边）
      ctx.strokeStyle = 'rgba(30,100,200,0.8)';
      ctx.lineWidth = 1.5;
      for (const contour of result.studentContours) {
        if (contour.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(contour[0].x, contour[0].y);
        for (let i = 1; i < contour.length; i++) ctx.lineTo(contour[i].x, contour[i].y);
        ctx.closePath();
        ctx.stroke();
      }
      // 逐笔画段偏差：绿=达标，红=超阈值
      for (const dev of result.deviations) {
        const pts = dev.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const bad =
            pts[i].deviation > offsetThreshold || pts[i + 1].deviation > offsetThreshold;
          ctx.strokeStyle = bad ? 'rgba(220,30,30,0.95)' : 'rgba(40,160,60,0.55)';
          ctx.lineWidth = bad ? 5 : 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
          ctx.stroke();
        }
      }
    }

    // 批注标记
    ctx.font = `${14 / viewScale}px sans-serif`;
    annotations.forEach((a, i) => {
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 10 / viewScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), a.x, a.y);
    });

    ctx.restore();
  }, [copybook, transform, photoCanvas, alignMode, result, offsetThreshold, annotations, viewScale]);

  // ---------- 交互：拖动 / 缩放 / 旋转 ----------
  const onPointerDown = (e: React.PointerEvent) => {
    if (onCanvasClick) {
      const p = toTemplateCoords(e);
      onCanvasClick(p.x, p.y);
      return;
    }
    if (!alignMode || !photoCanvas) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, base: { ...transform } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / viewScale;
    const dy = (e.clientY - drag.startY) / viewScale;
    onTransformChange({ ...drag.base, x: drag.base.x + dx, y: drag.base.y + dy });
  };

  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    if (!alignMode || !photoCanvas) return;
    e.preventDefault();
    if (e.shiftKey) {
      // Shift + 滚轮：旋转
      onTransformChange({ ...transform, rotate: transform.rotate + (e.deltaY > 0 ? 0.02 : -0.02) });
    } else {
      // 滚轮：以光标为中心缩放
      const cursor = toTemplateCoords(e);
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const s = Math.min(5, Math.max(0.1, transform.scale * factor));
      // 保持光标下的点不动
      const k = s / transform.scale;
      onTransformChange({
        ...transform,
        scale: s,
        x: cursor.x - (cursor.x - transform.x) * k,
        y: cursor.y - (cursor.y - transform.y) * k,
      });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={DISPLAY_WIDTH}
      height={displayHeight}
      className="overlay-canvas"
      style={{ touchAction: 'none', cursor: onCanvasClick ? 'crosshair' : alignMode ? 'move' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    />
  );
}
