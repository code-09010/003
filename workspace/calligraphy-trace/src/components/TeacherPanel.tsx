/**
 * 老师教学模式面板：上传/选择字帖、设定评分标准、在字帖上点击添加批注。
 */
import { useRef, useState } from 'react';
import type { Annotation, AnalysisResult, Copybook, GradingConfig, Transform } from '../types';
import { BUILTIN_COPYBOOKS, parseSvgCopybook } from '../lib/template';
import { OverlayCanvas } from './OverlayCanvas';

interface Props {
  copybook: Copybook;
  grading: GradingConfig;
  transform: Transform;
  onTransformChange: (t: Transform) => void;
  result: AnalysisResult | null;
  annotations: Annotation[];
  onCopybookChange: (c: Copybook) => void;
  onGradingChange: (g: GradingConfig) => void;
  onAddAnnotation: (a: Omit<Annotation, 'id' | 'createdAt'>) => void;
  onRemoveAnnotation: (id: string) => void;
}

export function TeacherPanel(props: Props) {
  const {
    copybook, grading, transform, onTransformChange, result, annotations,
    onCopybookChange, onGradingChange, onAddAnnotation, onRemoveAnnotation,
  } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [annotating, setAnnotating] = useState(false);
  const [error, setError] = useState('');

  const handleSvgUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      onCopybookChange(parseSvgCopybook(text, file.name.replace(/\.svg$/i, '')));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SVG 解析失败');
    }
  };

  const handleCanvasClick = (x: number, y: number) => {
    const text = window.prompt('输入批注内容：');
    if (text?.trim()) onAddAnnotation({ x, y, text: text.trim() });
  };

  const set = <K extends keyof GradingConfig>(key: K, value: number) =>
    onGradingChange({ ...grading, [key]: value });

  return (
    <div className="panel">
      <section className="teacher-section">
        <h3>① 字帖</h3>
        <div className="toolbar">
          {BUILTIN_COPYBOOKS.map((c) => (
            <button
              key={c.id}
              className={c.id === copybook.id ? 'primary' : ''}
              onClick={() => onCopybookChange(c)}
            >
              {c.name}
            </button>
          ))}
          <button onClick={() => fileRef.current?.click()}>📄 上传 SVG 字帖</button>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            hidden
            onChange={(e) => handleSvgUpload(e.target.files?.[0])}
          />
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="teacher-section">
        <h3>② 评分标准</h3>
        <label>
          偏移阈值：{grading.offsetThreshold}px（超过标红）
          <input type="range" min={2} max={20} step={1} value={grading.offsetThreshold}
            onChange={(e) => set('offsetThreshold', Number(e.target.value))} />
        </label>
        <label>
          飞白/连笔焊合强度：{grading.closingRadius}
          <input type="range" min={0} max={8} step={1} value={grading.closingRadius}
            onChange={(e) => set('closingRadius', Number(e.target.value))} />
        </label>
        <label>
          墨迹灵敏度：{Math.round(grading.inkSensitivity * 100)}%
          <input type="range" min={0} max={100} step={5} value={Math.round(grading.inkSensitivity * 100)}
            onChange={(e) => set('inkSensitivity', Number(e.target.value) / 100)} />
        </label>
        <label>
          及格分：{grading.passScore}
          <input type="range" min={0} max={100} step={5} value={grading.passScore}
            onChange={(e) => set('passScore', Number(e.target.value))} />
        </label>
      </section>

      <section className="teacher-section">
        <h3>③ 批注</h3>
        <button
          className={annotating ? 'primary' : ''}
          onClick={() => setAnnotating(!annotating)}
        >
          {annotating ? '✏️ 点击画布添加批注中…（再点退出）' : '✏️ 添加批注'}
        </button>
        {annotations.length > 0 && (
          <ol className="annotation-list">
            {annotations.map((a, i) => (
              <li key={a.id}>
                <strong>{i + 1}.</strong> {a.text}
                <button className="link" onClick={() => onRemoveAnnotation(a.id)}>删除</button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <OverlayCanvas
        copybook={copybook}
        transform={transform}
        onTransformChange={onTransformChange}
        photoCanvas={null}
        alignMode={false}
        result={result}
        offsetThreshold={grading.offsetThreshold}
        annotations={annotations}
        onCanvasClick={annotating ? handleCanvasClick : undefined}
      />
      {result && <p className="hint">当前显示学生最近一次的分析结果，可对照添加批注。</p>}
    </div>
  );
}
