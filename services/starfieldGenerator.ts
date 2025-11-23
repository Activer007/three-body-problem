import { createSeededRandom, pickRandom, randomRange } from '../utils/random';

export interface StarLayerConfig {
  id: string;
  count: number;
  radius: number;
  thickness: number;
  sizeRange: [number, number];
  twinkleSpeedRange: [number, number];
  twinkleAmplitudeRange: [number, number];
  driftStrength: number;
  parallaxFactor: number;
}

export interface StarLayerData {
  id: string;
  count: number;
  parallaxFactor: number;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  twinkleSpeed: Float32Array;
  twinklePhase: Float32Array;
  twinkleAmplitude: Float32Array;
  drift: Float32Array;
}

export interface StarfieldConfig {
  seed: number;
  palette: string[];
  colorJitter: number;
  layers: StarLayerConfig[];
}

export interface StarfieldData {
  layers: StarLayerData[];
}

const DEFAULT_STARFIELD_CONFIG: StarfieldConfig = {
  seed: 1337,
  colorJitter: 0.1,
  palette: ['#f4f8ff', '#dbeafe', '#fff7d6', '#ffd1dc', '#e0ecff'],
  layers: [
    {
      id: 'near',
      count: 210,
      radius: 45,
      thickness: 18,
      sizeRange: [6, 14],
      twinkleSpeedRange: [0.8, 1.6],
      twinkleAmplitudeRange: [0.4, 1.2],
      driftStrength: 0.05,
      parallaxFactor: 0.35
    },
    {
      id: 'mid',
      count: 450,
      radius: 70,
      thickness: 25,
      sizeRange: [4, 10],
      twinkleSpeedRange: [0.4, 1.2],
      twinkleAmplitudeRange: [0.2, 0.7],
      driftStrength: 0.02,
      parallaxFactor: 0.2
    },
    {
      id: 'far',
      count: 700,
      radius: 110,
      thickness: 30,
      sizeRange: [3, 7],
      twinkleSpeedRange: [0.2, 0.6],
      twinkleAmplitudeRange: [0.05, 0.3],
      driftStrength: 0.01,
      parallaxFactor: 0.05
    }
  ]
};

function cloneConfig(source: StarfieldConfig): StarfieldConfig {
  return {
    seed: source.seed,
    palette: [...source.palette],
    colorJitter: source.colorJitter,
    layers: source.layers.map((layer) => ({ ...layer }))
  };
}

export function getDefaultStarfieldConfig(): StarfieldConfig {
  return cloneConfig(DEFAULT_STARFIELD_CONFIG);
}

export function generateStarfield(config?: Partial<StarfieldConfig>): StarfieldData {
  const baseConfig = cloneConfig(DEFAULT_STARFIELD_CONFIG);
  const mergedConfig: StarfieldConfig = {
    ...baseConfig,
    ...config,
    layers: (config?.layers ?? baseConfig.layers).map((layer) => ({ ...layer }))
  };

  const rng = createSeededRandom(mergedConfig.seed);
  const layers = mergedConfig.layers.map((layer) =>
    generateLayer(layer, mergedConfig.palette, mergedConfig.colorJitter, rng)
  );

  return { layers };
}

function generateLayer(
  layerConfig: StarLayerConfig,
  palette: string[],
  colorJitter: number,
  rand: ReturnType<typeof createSeededRandom>
): StarLayerData {
  const { count } = layerConfig;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const twinkleSpeed = new Float32Array(count);
  const twinklePhase = new Float32Array(count);
  const twinkleAmplitude = new Float32Array(count);
  const drift = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const pos = randomPointInShell(rand, layerConfig.radius, layerConfig.thickness);
    positions.set(pos, i * 3);

    const color = jitterColor(hexToRGB(pickRandom(rand, palette)), rand, colorJitter);
    colors.set(color, i * 3);

    sizes[i] = randomRange(rand, layerConfig.sizeRange[0], layerConfig.sizeRange[1]);
    twinkleSpeed[i] = randomRange(rand, layerConfig.twinkleSpeedRange[0], layerConfig.twinkleSpeedRange[1]);
    twinklePhase[i] = rand() * Math.PI * 2;
    twinkleAmplitude[i] = randomRange(
      rand,
      layerConfig.twinkleAmplitudeRange[0],
      layerConfig.twinkleAmplitudeRange[1]
    );

    const driftVec = randomUnitVector(rand, layerConfig.driftStrength);
    drift.set(driftVec, i * 3);
  }

  return {
    id: layerConfig.id,
    count,
    parallaxFactor: layerConfig.parallaxFactor,
    positions,
    colors,
    sizes,
    twinkleSpeed,
    twinklePhase,
    twinkleAmplitude,
    drift
  };
}

function randomPointInShell(rand: ReturnType<typeof createSeededRandom>, radius: number, thickness: number): [number, number, number] {
  const dir = randomUnitVector(rand, 1);
  const offset = randomRange(rand, -thickness / 2, thickness / 2);
  const r = Math.max(1, radius + offset);
  return [dir[0] * r, dir[1] * r, dir[2] * r];
}

function randomUnitVector(rand: ReturnType<typeof createSeededRandom>, scale: number): [number, number, number] {
  const u = rand() * 2 - 1;
  const theta = rand() * Math.PI * 2;
  const factor = Math.sqrt(1 - u * u);
  return [Math.cos(theta) * factor * scale, Math.sin(theta) * factor * scale, u * scale];
}

function hexToRGB(hex: string): [number, number, number] {
  let normalized = hex.trim();
  if (normalized.startsWith('#')) normalized = normalized.slice(1);
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r / 255, g / 255, b / 255];
}

function jitterColor(
  base: [number, number, number],
  rand: ReturnType<typeof createSeededRandom>,
  amount: number
): [number, number, number] {
  return base.map((channel) => clamp(channel + (rand() * 2 - 1) * amount, 0, 1)) as [number, number, number];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
