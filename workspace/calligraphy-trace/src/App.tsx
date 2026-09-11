import { useState } from 'react';
import { useWorkspace } from './store';
import { StudentPanel } from './components/StudentPanel';
import { TeacherPanel } from './components/TeacherPanel';
import type { Mode } from './types';

export default function App() {
  const [mode, setMode] = useState<Mode>('student');
  const [photoCanvas, setPhotoCanvas] = useState<HTMLCanvasElement | null>(null);
  const {
    state, setCopybook, setGrading, setTransform, setResult, addAnnotation, removeAnnotation,
  } = useWorkspace();

  if (!state.copybook) return <p>未找到字帖，请切换到教学模式上传。</p>;

  return (
    <div className="app">
      <header>
        <h1>临帖对比 · 书法练习助手</h1>
        <div className="mode-switch">
          <button
            className={mode === 'student' ? 'active' : ''}
            onClick={() => setMode('student')}
          >
            🧑‍🎓 练习模式
          </button>
          <button
            className={mode === 'teacher' ? 'active' : ''}
            onClick={() => setMode('teacher')}
          >
            👨‍🏫 教学模式
          </button>
        </div>
      </header>

      {mode === 'student' ? (
        <StudentPanel
          copybook={state.copybook}
          grading={state.grading}
          transform={state.transform}
          onTransformChange={setTransform}
          result={state.result}
          onResult={setResult}
          annotations={state.annotations}
          photoCanvas={photoCanvas}
          onPhotoChange={setPhotoCanvas}
        />
      ) : (
        <TeacherPanel
          copybook={state.copybook}
          grading={state.grading}
          transform={state.transform}
          onTransformChange={setTransform}
          result={state.result}
          annotations={state.annotations}
          onCopybookChange={setCopybook}
          onGradingChange={setGrading}
          onAddAnnotation={addAnnotation}
          onRemoveAnnotation={removeAnnotation}
        />
      )}
    </div>
  );
}
