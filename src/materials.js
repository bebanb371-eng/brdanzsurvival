import * as THREE from 'three';

const patterns = { natural: 0, soil: 1, bark: 2, stone: 3, leaf: 4, metal: 5, brick: 6, cloth: 7, concrete: 8, fur: 9, leather: 10 };

/** Make a seamless ground-color and height texture entirely in JavaScript. */
export function createGroundTextures(size = 256) {
  const colorCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = normalCanvas.width = normalCanvas.height = size;
  const colorContext = colorCanvas.getContext('2d', { alpha: false });
  const normalContext = normalCanvas.getContext('2d', { alpha: false });
  const colorPixels = colorContext.createImageData(size, size);
  const normalPixels = normalContext.createImageData(size, size);
  const fade = value => value * value * (3 - 2 * value);
  const hash = (x, y, period) => {
    x = (x % period + period) % period; y = (y % period + period) % period;
    let value = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + 1442695041) | 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (u, v, period) => {
    const x = u * period, y = v * period, x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = fade(x - x0), ty = fade(y - y0);
    const a = hash(x0, y0, period), b = hash(x0 + 1, y0, period);
    const c = hash(x0, y0 + 1, period), d = hash(x0 + 1, y0 + 1, period);
    const top = a + (b - a) * tx, bottom = c + (d - c) * tx;
    return top + (bottom - top) * ty;
  };
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = y * size + x;
    const broad = noise(u, v, 5), patch = noise(u, v, 13), grain = noise(u, v, 37), fine = noise(u, v, 91);
    const height = broad * .43 + patch * .29 + grain * .2 + fine * .08;
    heights[index] = height;
    const dry = Math.max(0, .48 - patch) * .45;
    const green = Math.max(0, patch - .53) * .5;
    const fleck = (hash(x, y, size) - .5) * 10;
    const brightness = (height - .5) * 58 + fleck, offset = index * 4;
    colorPixels.data[offset] = Math.max(0, Math.min(255, 79 + brightness + dry * 38 - green * 17));
    colorPixels.data[offset + 1] = Math.max(0, Math.min(255, 96 + brightness * .9 - dry * 20 + green * 40));
    colorPixels.data[offset + 2] = Math.max(0, Math.min(255, 56 + brightness * .62 + dry * 7 + green * 7));
    colorPixels.data[offset + 3] = 255;
  }
  const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 210, dy = (at(x, y + 1) - at(x, y - 1)) * 210;
    const nx = -dx, ny = -dy, nz = 1, length = Math.hypot(nx, ny, nz), offset = (y * size + x) * 4;
    normalPixels.data[offset] = (nx / length * .5 + .5) * 255;
    normalPixels.data[offset + 1] = (ny / length * .5 + .5) * 255;
    normalPixels.data[offset + 2] = (nz / length * .5 + .5) * 255;
    normalPixels.data[offset + 3] = 255;
  }
  colorContext.putImageData(colorPixels, 0, 0);
  normalContext.putImageData(normalPixels, 0, 0);
  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  for (const texture of [colorMap, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
  }
  return { colorMap, normalMap };
}

/** World-space noise keeps surface detail volumetric, continuous, and independent of image files or UVs. */
export function proceduralMaterial(color, { pattern = 'natural', scale = 1, roughness = .9, metalness = 0, side = THREE.FrontSide, flatShading = false, transparent = false, opacity = 1, wind = 0 } = {}) {
  const style = patterns[pattern] ?? patterns.natural;
  const material = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, side, flatShading, transparent, opacity });
  material.onBeforeCompile = shader => {
    shader.uniforms.uProcScale = { value: scale };
    shader.uniforms.uProcStyle = { value: style };
    shader.uniforms.uProcWindTime = { value: 0 };
    shader.uniforms.uProcWindStrength = { value: wind };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vProcPosition;\nuniform float uProcWindTime;\nuniform float uProcWindStrength;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 procWindAnchor = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    procWindAnchor = batchingMatrix * procWindAnchor;
  #endif
  #ifdef USE_INSTANCING
    procWindAnchor = instanceMatrix * procWindAnchor;
  #endif
  procWindAnchor = modelMatrix * procWindAnchor;
  float procWindWave = sin(uProcWindTime * 1.35 + procWindAnchor.x * 0.16 + procWindAnchor.z * 0.11);
  transformed.x += procWindWave * position.y * uProcWindStrength;
  transformed.z += cos(uProcWindTime * 1.1 + procWindAnchor.z * 0.13) * position.y * uProcWindStrength * 0.55;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vec4 procWorld = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    procWorld = batchingMatrix * procWorld;
  #endif
  #ifdef USE_INSTANCING
    procWorld = instanceMatrix * procWorld;
  #endif
  procWorld = modelMatrix * procWorld;
  vProcPosition = procWorld.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vProcPosition;
uniform float uProcScale;
uniform float uProcStyle;
float procHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float procNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(procHash(i), procHash(i + vec3(1.0,0.0,0.0)), f.x), mix(procHash(i + vec3(0.0,1.0,0.0)), procHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(procHash(i + vec3(0.0,0.0,1.0)), procHash(i + vec3(1.0,0.0,1.0)), f.x), mix(procHash(i + vec3(0.0,1.0,1.0)), procHash(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}
float procFbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += procNoise(p) * a; p *= 2.03; a *= 0.5; }
  return v;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 procP = vProcPosition * uProcScale;
float procBroad = procFbm(procP);
float procFine = procNoise(procP * 5.7);
float procGrain = 0.5 + 0.5 * sin(procP.y * 28.0 + sin(procP.x * 3.2 + procP.z * 2.7) * 1.8);
float procMask = 1.0;
if (uProcStyle < 0.5) {
  procMask = 0.73 + procBroad * 0.48 + procFine * 0.12;
} else if (uProcStyle < 1.5) {
  procMask = 0.63 + procBroad * 0.55 + procFine * 0.24;
} else if (uProcStyle < 2.5) {
  procMask = 0.66 + procBroad * 0.33 + procGrain * 0.2;
} else if (uProcStyle < 3.5) {
  float pits = smoothstep(0.66, 0.88, procFine);
  procMask = 0.63 + procBroad * 0.48 + procFine * 0.18 - pits * 0.16;
} else if (uProcStyle < 4.5) {
  procMask = 0.58 + procBroad * 0.65 + procFine * 0.15;
} else if (uProcStyle < 5.5) {
  float worn = smoothstep(0.6, 0.92, procFine);
  procMask = 0.77 + procBroad * 0.2 + procGrain * 0.08 - worn * 0.12;
} else if (uProcStyle < 6.5) {
  float seam = smoothstep(0.455, 0.49, abs(fract(procP.y * 1.25) - 0.5));
  float stagger = smoothstep(0.47, 0.5, abs(fract(procP.x * 0.72 + floor(procP.y * 1.25) * 0.5) - 0.5));
  procMask = mix(0.3, 0.82 + procBroad * 0.28, min(seam, stagger));
} else if (uProcStyle < 7.5) {
  float weave = 0.5 + 0.5 * sin(procP.x * 42.0) * sin(procP.y * 42.0);
  procMask = 0.78 + procBroad * 0.26 + weave * 0.045;
} else if (uProcStyle < 8.5) {
  procMask = 0.78 + procBroad * 0.29 + procFine * 0.11;
} else if (uProcStyle < 9.5) {
  float strands = 0.5 + 0.5 * sin(procP.y * 76.0 + procNoise(procP * 3.0) * 5.0);
  procMask = 0.72 + procBroad * 0.31 + procFine * 0.1 + strands * 0.07;
} else {
  procMask = 0.74 + procBroad * 0.25 + procGrain * 0.13;
}
diffuseColor.rgb *= procMask;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (procFine - 0.5) * 0.16, 0.18, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float procRelief = procFbm(procP * 2.2);
normal = normalize(normal + vec3(dFdx(procRelief), dFdy(procRelief), 0.0) * 0.11);`);
    material.userData.procShader = shader;
  };
  material.userData.setProceduralTime = time => {
    if (material.userData.procShader) material.userData.procShader.uniforms.uProcWindTime.value = time;
  };
  material.customProgramCacheKey = () => `brdanz-procedural-${style}`;
  return material;
}
