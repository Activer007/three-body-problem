import { ParameterMeta } from '../types';

export type GlobalParams = {
  G: number;
  softening: number;
  timeStep: number;
};

export function getDefaultGlobalParams(): GlobalParams {
  return {
    G: 1.0,
    softening: 0.08,
    timeStep: 0.01
  };
}

export function getGlobalParameterSchema(): ParameterMeta[] {
  return [
    {
      key: 'G',
      label: 'Gravitational Constant (G)',
      type: 'number',
      default: 1.0,
      min: 0.05,
      max: 5.0,
      step: 0.05
    },
    {
      key: 'softening',
      label: 'Softening',
      type: 'number',
      default: 0.08,
      min: 0.0,
      max: 0.5,
      step: 0.01
    },
    {
      key: 'timeStep',
      label: 'Base Time Step (s)',
      type: 'number',
      default: 0.01,
      min: 0.001,
      max: 0.05,
      step: 0.001
    }
  ];
}

/**
 * 如何扩展全局参数：
 * 1) 在 GlobalParams 中添加字段并在 getDefaultGlobalParams 返回默认值。
 * 2) 在 getGlobalParameterSchema 中添加对应的 ParameterMeta（min/max/step/label）。
 * 3) Controls 会自动渲染该参数的控件；App 会在点击 Apply 时带入 PhysicsEngine 配置。
 */

