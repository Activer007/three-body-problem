import { generateStarfield, getDefaultStarfieldConfig } from '../services/starfieldGenerator';

describe('starfieldGenerator', () => {
  test('returns deterministic layers for same seed', () => {
    const config = getDefaultStarfieldConfig();
    config.seed = 99;

    const first = generateStarfield(config);
    const second = generateStarfield(config);

    expect(first.layers.length).toBeGreaterThan(0);
    first.layers.forEach((layer, idx) => {
      const compareLayer = second.layers[idx];
      expect(Array.from(layer.positions)).toEqual(Array.from(compareLayer.positions));
      expect(Array.from(layer.colors)).toEqual(Array.from(compareLayer.colors));
      expect(Array.from(layer.sizes)).toEqual(Array.from(compareLayer.sizes));
    });
  });

  test('different seeds yield different star distributions', () => {
    const configA = getDefaultStarfieldConfig();
    configA.seed = 1;
    const configB = getDefaultStarfieldConfig();
    configB.seed = 2;

    const fieldA = generateStarfield(configA);
    const fieldB = generateStarfield(configB);

    const layerA = fieldA.layers[0];
    const layerB = fieldB.layers[0];

    expect(Array.from(layerA.positions)).not.toEqual(Array.from(layerB.positions));
  });

  test('respects layer counts', () => {
    const config = getDefaultStarfieldConfig();
    config.layers = config.layers.map((layer) =>
      layer.id === 'mid' ? { ...layer, count: 123 } : layer
    );

    const field = generateStarfield(config);
    const midLayer = field.layers.find((layer) => layer.id === 'mid');
    expect(midLayer?.count).toBe(123);
    expect(midLayer?.positions.length).toBe(123 * 3);
  });
});
