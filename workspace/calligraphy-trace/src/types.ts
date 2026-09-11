/** 全局类型定义 */

/** 仿射变换：学生照片相对字帖的对齐状态 */
export interface Transform {
  x: number;      // 平移（画布像素）
  y: number;
  scale: number;  // 缩放
  rotate: number; // 旋转（弧度）
}

export const identityTransform = (): Transform => ({ x: 0, y: 0, scale: 1, rotate: 0 });

/** 字帖：SVG 路径存储 */
export interface Copybook {
  id: string;
  name: string;
  /** SVG path d 字符串数组，每条路径对应字帖中的一个笔画 */
  strokes: string[];
  /** 字帖视图框（SVG viewBox 尺寸） */
  width: number;
  height: number;
  createdAt: number;
}

/** 评分标准 */
export interface GradingConfig {
  /** 笔画偏移阈值（像素，按字帖坐标系）：超过则标红 */
  offsetThreshold: number;
  /** 飞白/连笔的形态学闭运算核大小（奇数），用于把毛笔枯笔断口连起来 */
  closingRadius: number;
  /** 二值化灵敏度 0~1，越大越容易把浅墨判为笔画 */
  inkSensitivity: number;
  /** 及格分 */
  passScore: number;
}

export const defaultGrading = (): GradingConfig => ({
  offsetThreshold: 6,
  closingRadius: 3,
  inkSensitivity: 0.5,
  passScore: 60,
});

/** 老师批注 */
export interface Annotation {
  id: string;
  /** 字帖坐标系下的位置 */
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

/** 差异分析结果：逐笔画段的偏移 */
export interface StrokeDeviation {
  /** 所属字帖笔画下标 */
  strokeIndex: number;
  /** 采样点（字帖坐标系） */
  points: { x: number; y: number; deviation: number }[];
  /** 该笔画平均偏移 */
  meanDeviation: number;
  /** 是否超阈值 */
  exceeded: boolean;
}

export interface AnalysisResult {
  deviations: StrokeDeviation[];
  /** 综合得分 0~100 */
  score: number;
  /** 学生笔画的提取轮廓（字帖坐标系，用于渲染） */
  studentContours: { x: number; y: number }[][];
  computedAt: number;
}

export type Mode = 'student' | 'teacher';

/** 持久化到 localStorage 的工作区状态 */
export interface WorkspaceState {
  copybook: Copybook | null;
  grading: GradingConfig;
  annotations: Annotation[];
  transform: Transform;
  result: AnalysisResult | null;
}
