import { Mode, ModeId, BodyState, SimulationConfig, ParameterMeta, ModeParams } from '../types';
import { PRESETS, generateRandomScenario } from '../constants';
import { makeRosetteController } from '../services/controllers/rosetteController';

function deepCopyBodies(bodies: BodyState[]): BodyState[] {
  return bodies.map(b => ({
    ...b,
    position: { ...b.position },
    velocity: { ...b.velocity }
  }));
}

// Build base modes from presets
const modes: Mode[] = PRESETS.map((preset) => {
  const base: Mode = {
    id: preset.name as ModeId,
    label: preset.label,
    createInitialBodies: (_seed?: number, _params?: ModeParams) => {
      if (preset.name === 'Random') {
        return generateRandomScenario();
      }
      return deepCopyBodies(preset.bodies);
    }
  };

  if (preset.name === 'Rosette') {
    // Expose tunable gains as mode parameters
    const params: ParameterMeta[] = [
      { key: 'k_r', label: 'Radial stiffness (k_r)', type: 'number', default: 0.08, min: 0, max: 0.5, step: 0.01 },
      { key: 'k_dr', label: 'Radial damping (k_dr)', type: 'number', default: 0.18, min: 0, max: 1.0, step: 0.01 },
      { key: 'k_t', label: 'Tangential stiffness (k_t)', type: 'number', default: 0.12, min: 0, max: 0.5, step: 0.01 },
      { key: 'k_dt', label: 'Tangential damping (k_dt)', type: 'number', default: 0.08, min: 0, max: 0.5, step: 0.01 },
      { key: 'k_c', label: 'Drag (k_c)', type: 'number', default: 0.02, min: 0, max: 0.2, step: 0.005 },
      { key: 'a_max', label: 'Accel cap (a_max)', type: 'number', default: 0.04, min: 0.005, max: 0.2, step: 0.005 }
    ];
    base.parameters = params;
    base.createController = (initialBodies, p?: ModeParams) => makeRosetteController(initialBodies, p || {}) as SimulationConfig['controller'];
  }

  return base;
});

export function getAllModes(): Mode[] {
  return modes;
}

export function getModeById(id: ModeId): Mode {
  const m = modes.find(m => m.id === id);
  if (!m) throw new Error(`Mode not found: ${id}`);
  return m;
}

export function getModeOptions(): Array<{ id: ModeId; label: string }> {
  return modes.map(m => ({ id: m.id, label: m.label }));
}

