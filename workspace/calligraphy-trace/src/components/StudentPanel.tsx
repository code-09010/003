/**
 * 学生练习面板：上传手写照片 -> 叠加对齐 -> 差异分析 -> 查看结果与老师批注。
 */
import { useRef, useState } from 'react';
import type { AnalysisResult, Copybook, GradingConfig, Transform, Annotation } from '../types';
import { analyze } from '../lib/diff';
import { OverlayCanvas } from './OverlayCanvas';

interface Props {
  copybook: Copybook;
  grading: GradingConfig;
  transform: Transform;
  onTransformChange: (t: Transform) => void;
  result: AnalysisResult | null;
  onResult: (r: AnalysisResult | null) => void;
  annotations: Annotation[];
  photoCanvas: HTMLCanvasElement | null;
  onPhotoChange: (c: HTMLCanvasElement | null) => void;
}

/** 加载图片文件并绘制到画布（限制最大边长，避免大图拖慢像素处理） */
function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}

export function StudentPanel(props: Props) {
  const { copybook, grading, transform, onTransformChange, result, onResult, annotations, photoCanvas, onPhotoChange } = props;
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    onPhotoChange(await loadPhoto(file));
    onResult(null);
  };

  const runAnalysis = () => {
    if (!photoCanvas) return;
    setAnalyzing(true);
    // 让出一帧渲染 loading，再做重计算
    requestAnimationFrame(() => {
      const r = analyze(photoCanvas, transform, copybook.strokes, copybook.width, copybook.height, grading);
      onResult(r);
      setAnalyzing(false);
    });
  };

  const nudge = (dx: number, dy: number) =>
    onTransformChange({ ...transform, x: transform.x + dx, y: transform.y + dy });
  const rotate = (deg: number) =>
    onTransformChange({ ...transform, rotate: transform.rotate + (deg * Math.PI) / 180 });
  const zoom = (factor: number) =>
    onTransformChange({ ...transform, scale: Math.min(5, Math.max(0.1, transform.scale * factor)) });

  const passed = result ? result.score >= grading.passScore : false;

  return (
    <div className="panel">
      <div className="toolbar">
        <button onClick={() => fileRef.current?.click()}>📷 上传手写照片</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {photoCanvas && !result && (
          <button className="primary" disabled={analyzing} onClick={runAnalysis}>
            {analyzing ? '分析中…' : '🔍 开始对比分析'}
          </button>
        )}
        {result && (
          <button onClick={() => onResult(null)}>↩ 重新对齐</button>
        )}
      </div>

      {photoCanvas && !result && (
        <div className="align-controls">
          <span>对齐微调：</span>
          <button onClick={() => nudge(-2, 0)}>←</button>
          <button onClick={() => nudge(2, 0)}>→</button>
          <button onClick={() => nudge(0, -2)}>↑</button>
          <button onClick={() => nudge(0, 2)}>↓</button>
          <button onClick={() => rotate(-1)}>↺ 1°</button>
          <button onClick={() => rotate(1)}>↻ 1°</button>
          <button onClick={() => zoom(1.02)}>＋</button>
          <button onClick={() => zoom(0.98)}>－</button>
          <span className="hint">拖动平移 · 滚轮缩放 · Shift+滚轮旋转</span>
        </div>
      )}

      <OverlayCanvas
        copybook={copybook}
        transform={transform}
        onTransformChange={onTransformChange}
        photoCanvas={photoCanvas}
        alignMode={!!photoCanvas && !result}
        result={result}
        offsetThreshold={grading.offsetThreshold}
        annotations={annotations}
      />

      {!photoCanvas && (
        <p className="hint">请上传一张手写「{copybook.name}」的照片，与字帖叠加对齐后开始分析。</p>
      )}

      {result && (
        <div className="result-panel">
          <h3>
            综合得分：<span className={passed ? 'score-pass' : 'score-fail'}>{result.score}</span>
            <small>（{grading.passScore} 分及格 · {passed ? '✅ 通过' : '❌ 未通过'}）</small>
          </h3>
          <table>
            <thead>
              <tr><th>笔画</th><th>平均偏移(px)</th><th>状态</th></tr>
            </thead>
            <tbody>
              {result.deviations.map((d) => (
                <tr key={d.strokeIndex} className={d.exceeded ? 'row-bad' : ''}>
                  <td>第 {d.strokeIndex + 1} 笔</td>
                  <td>{d.meanDeviation.toFixed(1)}</td>
                  <td>{d.exceeded ? `⚠ 超过阈值 ${grading.offsetThreshold}px` : '✓ 达标'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {annotations.length > 0 && (
            <div className="annotations">
              <h4>老师批注</h4>
              <ol>
                {annotations.map((a) => <li key={a.id}>{a.text}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
