import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGroundTextures, proceduralMaterial } from './materials.js';

afterEach(() => vi.unstubAllGlobals());

describe('3D surface materials', () => {
  it('generates repeating JavaScript ground color and relief maps', () => {
    const canvases = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = { width: 0, height: 0, pixels: null };
        const context = {
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: image => { canvas.pixels = image.data; }
        };
        canvas.getContext = () => context;
        canvases.push(canvas);
        return canvas;
      }
    });

    const { colorMap, normalMap } = createGroundTextures(24);

    expect(canvases).toHaveLength(2);
    expect(canvases[0].pixels).toHaveLength(24 * 24 * 4);
    expect(new Set(canvases[0].pixels).size).toBeGreaterThan(8);
    expect(colorMap.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(colorMap.wrapS).toBe(THREE.RepeatWrapping);
    expect(normalMap.wrapT).toBe(THREE.RepeatWrapping);
    expect(canvases[1].pixels).not.toEqual(canvases[0].pixels);
  });

  it('declares procedural surface coordinates before shader use', () => {
    const material = proceduralMaterial('#ffffff', { pattern: 'soil' });
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>',
      fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n}'
    };
    material.onBeforeCompile(shader);

    const declaration = shader.fragmentShader.indexOf('vec3 procP = vProcPosition * uProcScale;');
    const firstUse = shader.fragmentShader.indexOf('float procBroad = procFbm(procP);');
    const reliefUse = shader.fragmentShader.indexOf('float procRelief = procFbm(procP * 2.2);');
    expect(declaration).toBeGreaterThan(-1);
    expect(firstUse).toBeGreaterThan(declaration);
    expect(reliefUse).toBeGreaterThan(firstUse);
    expect(shader.fragmentShader.match(/vec3 procP =/g)).toHaveLength(1);
  });
});
