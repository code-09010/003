/**
 * 工作区状态：字帖、评分标准、批注、对齐变换、分析结果。
 * 持久化到 localStorage，同一设备上老师/学生模式切换时共享。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  defaultGrading,
  identityTransform,
  type AnalysisResult,
  type Annotation,
  type Copybook,
  type GradingConfig,
  type Transform,
  type WorkspaceState,
} from './types';
import { BUILTIN_COPYBOOKS } from './lib/template';

const STORAGE_KEY = 'calligraphy-trace-workspace-v1';

interface PersistedState {
  copybook: Copybook | null;
  grading: GradingConfig;
  annotations: Annotation[];
  transform: Transform;
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      return {
        copybook: parsed.copybook ?? BUILTIN_COPYBOOKS[0],
        grading: { ...defaultGrading(), ...parsed.grading },
        annotations: parsed.annotations ?? [],
        transform: { ...identityTransform(), ...parsed.transform },
      };
    }
  } catch {
    // 损坏则回退默认
  }
  return {
    copybook: BUILTIN_COPYBOOKS[0],
    grading: defaultGrading(),
    annotations: [],
    transform: identityTransform(),
  };
}

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>(() => ({
    ...loadPersisted(),
    result: null, // 分析结果不持久化（依赖照片，刷新后需重新分析）
  }));

  // 持久化除 result 之外的状态
  useEffect(() => {
    const { copybook, grading, annotations, transform } = state;
    const payload: PersistedState = { copybook, grading, annotations, transform };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state]);

  const setCopybook = useCallback(
    (copybook: Copybook | null) =>
      setState((s) => ({ ...s, copybook, result: null, transform: identityTransform() })),
    [],
  );
  const setGrading = useCallback(
    (grading: GradingConfig) => setState((s) => ({ ...s, grading, result: null })),
    [],
  );
  const setTransform = useCallback(
    (transform: Transform) => setState((s) => ({ ...s, transform })),
    [],
  );
  const setResult = useCallback(
    (result: AnalysisResult | null) => setState((s) => ({ ...s, result })),
    [],
  );
  const addAnnotation = useCallback(
    (a: Omit<Annotation, 'id' | 'createdAt'>) =>
      setState((s) => ({
        ...s,
        annotations: [
          ...s.annotations,
          { ...a, id: `ann-${Date.now()}`, createdAt: Date.now() },
        ],
      })),
    [],
  );
  const removeAnnotation = useCallback(
    (id: string) =>
      setState((s) => ({ ...s, annotations: s.annotations.filter((a) => a.id !== id) })),
    [],
  );

  return {
    state,
    setCopybook,
    setGrading,
    setTransform,
    setResult,
    addAnnotation,
    removeAnnotation,
  };
}
