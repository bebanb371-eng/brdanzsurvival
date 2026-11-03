import * as THREE from 'three';
import { createGroundTextures, proceduralMaterial } from './materials.js';
import { createSurvivor, createWolf, createMob, makeWeaponModel } from './actors.js';

const MAP_HALF = 176;
const seeded = (seed = 7919) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function makeGrass(renderer, scene, heightAt, random, bladeCount = 7600) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [], uvs = [], indices = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade * Math.PI * 2 / 7, dx = Math.cos(angle), dz = Math.sin(angle), width = .075 + random() * .035, height = .5 + random() * .32, baseX = dx * .055, baseZ = dz * .055, start = vertices.length / 3;
    for (let segment = 0; segment <= 4; segment++) {
      const t = segment / 4, bend = t * t * (.12 + (blade % 3) * .025), cx = baseX + dx * bend, cz = baseZ + dz * bend, w = width * (1 - t) * (1 - t * .35);
      vertices.push(cx - dz * w, height * t, cz + dx * w, cx + dz * w, height * t, cz - dx * w);
      uvs.push(0, t, 1, t);
      if (segment < 4) { const a = start + segment * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const grassMat = proceduralMaterial('#ffffff', { pattern: 'leaf', scale: 1.4, roughness: 1, side: THREE.DoubleSide, wind: .24 });
  const blades = new THREE.InstancedMesh(geometry, grassMat, bladeCount);
  blades.receiveShadow = true;
  const clearings = [[0, -20, 8, 7], [19, -40, 12, 10], [-29, -37, 9, 8], [37, -7, 11, 8], [-37, 18, 8, 7], [14, 26, 7, 6], [52, -40, 9, 8], [-53, 47, 12, 9], [68, 50, 11, 9], [-20, -31, 5, 5], [-69, -27, 27, 24]];
  const dummy = new THREE.Object3D();
  const green = new THREE.Color();
  for (let i = 0; i < bladeCount; i++) {
    const x = (random() - .5) * MAP_HALF * 1.9, z = (random() - .5) * MAP_HALF * 1.9;
    const riverX = 24 + Math.sin(z * .027) * 14 + Math.sin(z * .063) * 3;
    const roadX = Math.sin((MAP_HALF - z) / 2.2 * .08) * 5.5;
    const inClearing = clearings.some(([cx, cz, w, d]) => Math.abs(x - cx) < w / 2 + .5 && Math.abs(z - cz) < d / 2 + .5);
    if (Math.hypot(x, z) < 8 || inClearing || Math.abs(x - riverX) < 5.8 || (z < MAP_HALF && z > -MAP_HALF && Math.abs(x - roadX) < 3)) { dummy.position.set(0, -500, 0); }
    else dummy.position.set(x, heightAt(x, z) + .035, z);
    dummy.rotation.set((random() - .5) * .18, random() * Math.PI, (random() - .5) * .16);
    const scale = .78 + random() * .52;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
    green.setHSL(.26 + random() * .045, .12 + random() * .13, .56 + random() * .16);
    blades.setColorAt(i, green);
  }
  blades.instanceMatrix.needsUpdate = true;
  if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
  scene.add(blades);
  return blades;
}

// A leaf cluster is made from individually tapered, curved blades arranged in 3D.
// This keeps canopy silhouettes leafy and irregular instead of round polygon balls.
function makeLeafClusterGeometry({ leaves = 11, segments = 6, length = .9, spread = .62, width = .2 } = {}) {
  const vertices = [], uvs = [], indices = [];
  for (let leaf = 0; leaf < leaves; leaf++) {
    const angle = leaf * 2.399963 + (leaf % 3) * .13;
    const elevation = -.18 + ((leaf * 7) % 9) * .075;
    const dx = Math.cos(angle) * Math.cos(elevation), dy = Math.sin(elevation) + .32, dz = Math.sin(angle) * Math.cos(elevation);
    const direction = new THREE.Vector3(dx, dy, dz).normalize();
    const across = new THREE.Vector3(-Math.sin(angle), .08 * Math.cos(angle), Math.cos(angle)).normalize();
    const origin = new THREE.Vector3(Math.cos(angle) * spread * .15, (leaf % 4) * .045, Math.sin(angle) * spread * .15);
    const bladeLength = length * (.72 + ((leaf * 5) % 7) * .055), base = vertices.length / 3;
    for (let segment = 0; segment <= segments; segment++) {
      const t = segment / segments, center = origin.clone().addScaledVector(direction, bladeLength * t);
      center.y += Math.sin(t * Math.PI) * bladeLength * .15;
      const half = width * Math.pow(Math.sin(Math.PI * t), .72) * (.78 + ((leaf + segment) % 3) * .1);
      const left = center.clone().addScaledVector(across, half), right = center.clone().addScaledVector(across, -half);
      vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, t, 1, t);
      if (segment < segments) {
        const a = base + segment * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createScene(canvas, { interactive = false, openDoors = [], takenLoot = [], defeatedThreats = [], minedNodes = [], skin = 'Rookie', mode = '', quality = 'High', timeOfDay = 9, weather = 'clear', houses = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const qualityConfig = { Low: { dpr: 1, shadows: 768, grass: true, grassCount: 6500 }, Medium: { dpr: 1.2, shadows: 1024, grass: true, grassCount: 12000 }, High: { dpr: 1.6, shadows: 1536, grass: true, grassCount: 19000 }, Ultra: { dpr: 2, shadows: 2048, grass: true, grassCount: 26000 } }[quality] || { dpr: 1.6, shadows: 1536, grass: true, grassCount: 19000 };
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, qualityConfig.dpr));
  renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
  renderer.shadowMap.enabled = quality !== 'Low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9bb4c0');
  scene.fog = new THREE.Fog('#9bb4c0', 75, 215);
  const camera = new THREE.PerspectiveCamera(62, (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight), .1, 300);
  const ambient = new THREE.HemisphereLight('#dcecff', '#35402b', 2.1); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe9bc', 2.8);
  sun.position.set(-36, 55, 30); sun.castShadow = renderer.shadowMap.enabled; sun.shadow.mapSize.set(qualityConfig.shadows, qualityConfig.shadows);
  sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65;
  scene.add(sun);

  const rand = seeded();
  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  const atlasTexture = (name, repeats = [1, 1]) => {
    const cacheKey = `${name}:${repeats[0]}:${repeats[1]}`;
    if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
    const texture = textureLoader.load(`/assets/textures/${name}.png`);
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeats[0], repeats[1]); texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textureCache.set(cacheKey, texture); return texture;
  };
  const useAtlas = (material, name, repeats = [1, 1]) => { material.map = atlasTexture(name, repeats); material.color?.set('#ffffff'); material.needsUpdate = true; return material; };
  const markTexture = textureLoader.load('/assets/textures/brdanz-mark.png'); markTexture.colorSpace = THREE.SRGBColorSpace;
  const fabricCanvas = document.createElement('canvas'); fabricCanvas.width = 128; fabricCanvas.height = 128;
  const fabricContext = fabricCanvas.getContext('2d'); fabricContext.fillStyle = '#c8c4d1'; fabricContext.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) { fabricContext.strokeStyle = i % 8 ? '#888392' : '#e8e2f0'; fabricContext.lineWidth = 1; fabricContext.beginPath(); fabricContext.moveTo(i, 0); fabricContext.lineTo(i, 128); fabricContext.stroke(); fabricContext.beginPath(); fabricContext.moveTo(0, i); fabricContext.lineTo(128, i); fabricContext.stroke(); }
  fabricContext.strokeStyle = '#73419b'; fabricContext.lineWidth = 3; fabricContext.strokeRect(5, 5, 118, 118);
  const fabricTexture = new THREE.CanvasTexture(fabricCanvas); fabricTexture.colorSpace = THREE.SRGBColorSpace; fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping; fabricTexture.repeat.set(2, 2);
  const clothMaterial = color => { const material = proceduralMaterial(color, { pattern: 'cloth', scale: 1.8, roughness: .96 }); material.map = fabricTexture; material.needsUpdate = true; return material; };
  const skyDomeMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uDaylight: { value: 1 }, uCloudiness: { value: .2 } },
    vertexShader: 'varying vec3 vSkyDirection; void main(){ vec4 worldPosition = modelMatrix * vec4(position, 1.0); vSkyDirection = normalize(worldPosition.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * worldPosition; }',
    fragmentShader: 'uniform float uDaylight; uniform float uCloudiness; varying vec3 vSkyDirection; void main(){ float h=clamp(normalize(vSkyDirection).y,0.0,1.0); vec3 dayH=mix(vec3(0.54,0.71,0.78),vec3(0.19,0.38,0.66),smoothstep(0.0,0.85,h)); vec3 nightH=mix(vec3(0.055,0.075,0.15),vec3(0.012,0.012,0.06),smoothstep(0.0,0.9,h)); vec3 sky=mix(nightH,dayH,uDaylight); sky=mix(sky,vec3(0.34,0.39,0.5),uCloudiness*0.5); gl_FragColor=vec4(sky,1.0); }'
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(248, 40, 28), skyDomeMaterial); skyDome.frustumCulled = false; scene.add(skyDome);
  const skyStarsGeometry = new THREE.BufferGeometry(), skyStarPositions = [];
  const skyRandom = seeded(34051);
  for (let i = 0; i < 420; i++) { const angle = skyRandom() * Math.PI * 2, y = skyRandom() * 160 + 38, radius = Math.sqrt(248 * 248 - y * y); skyStarPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius); }
  skyStarsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skyStarPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: '#d6c9ff', size: .68, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(skyStarsGeometry, starsMaterial); stars.frustumCulled = false; scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 18), new THREE.MeshStandardMaterial({ color: '#eee5ff', emissive: '#b9a5ff', emissiveIntensity: 1.25, roughness: .8 }));
  moon.position.set(65, 58, -145); moon.castShadow = false; scene.add(moon);
  const moonGlow = new THREE.PointLight('#aebdff', .45, 115, 1.4); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  const cloudGroups = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#d8d8e3', roughness: 1, transparent: true, opacity: .48, depthWrite: false });
  for (let cloud = 0; cloud < 13; cloud++) {
    const group = new THREE.Group(), x = (skyRandom() - .5) * 265, z = (skyRandom() - .5) * 265;
    const puffs = 5 + Math.floor(skyRandom() * 4);
    for (let puff = 0; puff < puffs; puff++) { const radius = 3.2 + skyRandom() * 3.8; const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), cloudMat); sphere.position.set((skyRandom() - .5) * 14, (skyRandom() - .5) * 2.8, (skyRandom() - .5) * 9); sphere.scale.y = .42 + skyRandom() * .22; group.add(sphere); }
    group.position.set(x, 31 + skyRandom() * 12, z); group.userData.drift = .08 + skyRandom() * .15; scene.add(group); cloudGroups.push(group);
  }
  let weatherState = ['clear', 'cloudy', 'rain'].includes(weather) ? weather : 'clear';
  let cloudiness = weatherState === 'clear' ? .18 : weatherState === 'cloudy' ? .62 : .82;
  let cloudinessTarget = cloudiness;
  const mat = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness });
  const groundTextures = createGroundTextures(256);
  groundTextures.colorMap.repeat.set(48, 48);
  groundTextures.normalMap.repeat.set(48, 48);
  groundTextures.colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  groundTextures.normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', map: groundTextures.colorMap, normalMap: groundTextures.normalMap,
    normalScale: new THREE.Vector2(.22, .22), roughness: 1
  });
  const riverCenterAt = z => 24 + Math.sin(z * .027) * 14 + Math.sin(z * .063) * 3;
  const rawHeightAt = (x, z) => Math.sin(x * .052) * 2.25 + Math.cos(z * .045) * 1.7 + Math.sin((x + z) * .035) * 1.5 + Math.max(0, Math.sin(x * .018 + 1) * Math.cos(z * .021)) * 4.2;
  const channelDepthAt = (x, z) => { const d = Math.abs(x - riverCenterAt(z)) / 5.2; return d >= 1 ? 0 : 2.8 * Math.pow(1 - d * d, 1.7); };
  const heightAt = (x, z) => rawHeightAt(x, z) - channelDepthAt(x, z);
  const paddyX = -69, paddyZ = -27, paddyRows = 6, paddyCols = 5;
  const inPaddy = (x, z) => Math.abs(x - paddyX) < 13 && Math.abs(z - paddyZ) < 12;
  const terrain = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 180, 180);
  const positions = terrain.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setZ(i, heightAt(positions.getX(i), -positions.getY(i)));
  terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, floorMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grass = makeGrass(renderer, scene, heightAt, rand, qualityConfig.grassCount); useAtlas(grass.material, 'grass');

  const obstacles = [], colliders = [], cameraBlockers = [], interactables = [];
  const fireSources = [];
  const addCollider = (x, z, width, depth, extra = {}) => colliders.push({ x, z, width, depth, y:heightAt(x,z), height:2.8, ...extra });
  const mesh = (parent, geometry, material, x, y, z, blocker = false) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object);
    if (blocker) cameraBlockers.push(object);
    return object;
  };
  const barkMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'bark', scale: .42, roughness: .94 }), 'wood', [1.5, 2.2]);
  const rockMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'stone', scale: .34, roughness: .98, flatShading: true }), 'stone');
  const foliageGeometry = makeLeafClusterGeometry({ leaves: 8, segments: 4, length: 1.12, spread: .7, width: .24 });
  const foliageMaterial = useAtlas(proceduralMaterial('#ffffff', { pattern: 'leaf', scale: 1.15, roughness: 1, side: THREE.DoubleSide, wind: .035 }), 'leaves');
  const windMaterials = [foliageMaterial];
  const foliage = new THREE.InstancedMesh(foliageGeometry, foliageMaterial, 440 * 30);
  foliage.castShadow = true; foliage.receiveShadow = true;
  const foliageDummy = new THREE.Object3D(), foliageTint = new THREE.Color();
  let foliageCount = 0;

  // Build full 3D trees from bark, bent branches and clusters of overlapping foliage.
  for (let i = 0; i < 440; i++) {
    const x = (rand() - .5) * MAP_HALF * 1.85, z = (rand() - .5) * MAP_HALF * 1.85;
    if (Math.hypot(x, z) < 10 || inPaddy(x, z) || (Math.abs(x) < 18 && z < -8 && z > -34)) continue;
    const y = heightAt(x, z), scale = .82 + rand() * .75, tree = new THREE.Group();
    tree.position.set(x, y, z); tree.scale.setScalar(scale);
    const trunkH = 4.2 + rand() * 2.7;
    const trunk = mesh(tree, new THREE.BoxGeometry(.82, trunkH, .82), barkMat, 0, trunkH / 2, 0, true);
    trunk.rotation.z = (rand() - .5) * .1;
    const leafColor = new THREE.Color().setHSL(.27 + rand() * .055, .2 + rand() * .2, .56 + rand() * .2);
    const conifer = rand() < .3;
    if (!conifer) for (let b = 0; b < 5; b++) {
      const angle = b * Math.PI * 2 / 5 + rand() * .35;
      const branch = mesh(tree, new THREE.BoxGeometry(.24, 1.85, .24), barkMat, Math.sin(angle) * .58, trunkH * (.58 + rand() * .19), Math.cos(angle) * .58);
      branch.rotation.z = Math.cos(angle) * .9; branch.rotation.x = Math.sin(angle) * .9;
    }
    // Leaf blocks form broken, layered crowns instead of a single round canopy.
    for (let layer = 0; layer < 5; layer++) {
      const leafCount = conifer ? Math.max(2, 7 - layer) : [7, 7, 6, 5, 3][layer];
      const radius = (conifer ? 1.85 - layer * .28 : 1.15 + Math.sin(layer * .82) * .42) * scale;
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const angle = leaf / leafCount * Math.PI * 2 + layer * .47 + rand() * .18;
        const leafSize = (.78 + rand() * .42) * scale;
        foliageDummy.position.set(x + Math.cos(angle) * radius + (rand() - .5) * .3, y + (trunkH * .51 + layer * .54 + (rand() - .5) * .38) * scale, z + Math.sin(angle) * radius + (rand() - .5) * .3);
        foliageDummy.rotation.set((rand() - .5) * .08, Math.round(rand() * 3) * Math.PI / 2, (rand() - .5) * .08);
        foliageDummy.scale.set(leafSize * (1.05 + rand() * .25), leafSize * (.78 + rand() * .22), leafSize * (1.05 + rand() * .25));
        foliageDummy.updateMatrix(); foliage.setMatrixAt(foliageCount, foliageDummy.matrix);
        foliageTint.copy(leafColor).multiplyScalar(.76 + rand() * .45); foliage.setColorAt(foliageCount, foliageTint);
        foliageCount++;
      }
    }
    scene.add(tree);
    obstacles.push({ x, z, radius: .62 * scale, type: 'tree' });
  }
  foliage.count = foliageCount; foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  scene.add(foliage);
  // Low shrubs and fern-like plants keep the forest floor from looking like a flat lawn.
  const bushGeometry = makeLeafClusterGeometry({ leaves: 6, segments: 3, length: .62, spread: .38, width: .17 });
  const bushMaterial = useAtlas(proceduralMaterial('#ffffff', { pattern: 'leaf', scale: 1.2, roughness: 1, side: THREE.DoubleSide, wind: .025 }), 'leaves');
  windMaterials.push(bushMaterial);
  const bushes = new THREE.InstancedMesh(bushGeometry, bushMaterial, 1050 * 6); bushes.castShadow = true;
  const bushDummy = new THREE.Object3D(), bushColor = new THREE.Color(); let bushIndex = 0;
  for (let i = 0; i < 1050; i++) {
    const x = (rand() - .5) * MAP_HALF * 1.85, z = (rand() - .5) * MAP_HALF * 1.85;
    if (Math.hypot(x, z) < 7 || inPaddy(x, z)) continue;
    for (let leaf = 0; leaf < 6; leaf++) {
      bushDummy.position.set(x + (rand() - .5) * .85, heightAt(x, z) + .25 + rand() * .3, z + (rand() - .5) * .85);
      bushDummy.rotation.set((rand() - .5) * .2, rand() * Math.PI, (rand() - .5) * .2); bushDummy.scale.set(.72 + rand() * .28, .62 + rand() * .28, .72 + rand() * .28);
      bushDummy.updateMatrix(); bushes.setMatrixAt(bushIndex, bushDummy.matrix);
      bushColor.setHSL(.27 + rand() * .055, .2 + rand() * .16, .54 + rand() * .19); bushes.setColorAt(bushIndex, bushColor); bushIndex++;
    }
  }
  bushes.count = bushIndex; bushes.instanceMatrix.needsUpdate = true; if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true; scene.add(bushes);

  // A continuous stream crosses the island, with three timber bridges at fixed crossings.
  const streamPoints = [];
  const curveX = riverCenterAt;
  for (let z = -MAP_HALF + 2; z <= MAP_HALF; z += 2) streamPoints.push({ x: curveX(z), z });
  const waterVertices = [], waterUvs = [], waterIndices = [];
  for (const p of streamPoints) {
    const y = rawHeightAt(p.x, p.z) - 1.05;
    waterVertices.push(p.x - 3.7, y, p.z, p.x + 3.7, y, p.z);
    waterUvs.push(0, p.z / 4, 1, p.z / 4);
  }
  for (let i = 0; i < streamPoints.length - 1; i++) { const a = i * 2; waterIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const riverGeo = new THREE.BufferGeometry(); riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3)); riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2)); riverGeo.setIndex(waterIndices); riverGeo.computeVertexNormals();
  const waterMaterial = useAtlas(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .24, metalness: .16, transparent: true, opacity: .9, side: THREE.DoubleSide }), 'water');
  const water = new THREE.Mesh(riverGeo, waterMaterial);
  water.receiveShadow = true; scene.add(water);
  for (const z of [-72, -4, 68]) {
    const x = curveX(z), bridgeY = rawHeightAt(x, z) - .82, bridge = new THREE.Group();
    const plankMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'bark', scale: .48, roughness: 1 }), 'wood', [1.5, 2]);
    mesh(bridge, new THREE.BoxGeometry(8.5, .32, 4.6), plankMat, 0, 0, 0, true);
    for (const side of [-1, 1]) mesh(bridge, new THREE.BoxGeometry(8.5, .42, .14), plankMat, 0, .36, side * 2.25, true);
    bridge.position.set(x, bridgeY, z); scene.add(bridge);
  }

  const woodMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'bark', scale: .46, roughness: .96 }), 'wood', [1.5, 1.5]);
  const brickMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'brick', scale: 3.4, roughness: .97 }), 'brick', [3, 2]);
  const concreteMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'concrete', scale: .8, roughness: .95 }), 'stone', [2, 2]);
  const metalMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'metal', scale: .88, roughness: .62, metalness: .55 }), 'metal', [1.5, 1.5]);
  const stoneMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'stone', scale: .38, roughness: 1, flatShading: true }), 'stone');
  const dirtMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'soil', scale: .5, roughness: 1 }), 'soil', [2.5, 2.5]);

  function addTorch(x, z, scale = 1) {
    const y = heightAt(x, z), torch = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .105, 1.45, 9), woodMat);
    pole.position.y = .72; pole.castShadow = true; torch.add(pole);
    const iron = new THREE.Mesh(new THREE.CylinderGeometry(.13, .19, .12, 8), metalMat);
    iron.position.y = 1.44; torch.add(iron);
    const ember = new THREE.MeshStandardMaterial({ color: '#ff8a25', emissive: '#ff4d12', emissiveIntensity: 2.1, roughness: .45 });
    const coreMat = new THREE.MeshStandardMaterial({ color: '#ffe27a', emissive: '#ffb42e', emissiveIntensity: 2.8, roughness: .32 });
    const flame = new THREE.Group(); flame.position.y = 1.62; torch.add(flame);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.18, .55, 7), ember); outer.position.y = .16; flame.add(outer);
    const core = new THREE.Mesh(new THREE.ConeGeometry(.095, .39, 7), coreMat); core.position.set(0, .1, -.012); flame.add(core);
    const light = new THREE.PointLight('#ff9a42', 2.6, 16, 1.65); light.position.y = 1.95; torch.add(light);
    torch.position.set(x, y, z); scene.add(torch); addCollider(x, z, .22, .22, { type: 'torch', height: 1.9 });
    fireSources.push({ light, flame, intensity: 2.6, phase: rand() * Math.PI * 2 });
  }
  for (const [x, z] of [[-9, -18], [9, -18], [-9, -31], [9, -31], [-61.5, 47], [75.5, 50], [-20, -24]]) addTorch(x, z);

  // A stone ring with stacked logs gives the safe camp a warm, visible night landmark.
  const campfire = new THREE.Group(), campX = -3, campZ = -27, campY = heightAt(campX, campZ);
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.34 + (i % 3) * .035, 0), stoneMat);
    stone.position.set(Math.cos(angle) * .86, .17, Math.sin(angle) * .86); stone.scale.y = .7; stone.castShadow = true; campfire.add(stone);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.105, .13, 1.15, 7), woodMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = i * Math.PI / 3; log.position.y = .3 + i * .1; log.castShadow = true; campfire.add(log);
  }
  const campFlame = new THREE.Group(); campFlame.position.y = .5; campfire.add(campFlame);
  const campOuter = new THREE.Mesh(new THREE.ConeGeometry(.47, 1.22, 9), new THREE.MeshStandardMaterial({ color: '#ff7a22', emissive: '#ec3c0e', emissiveIntensity: 1.9, roughness: .4 }));
  campOuter.position.y = .57; campFlame.add(campOuter);
  const campCore = new THREE.Mesh(new THREE.ConeGeometry(.23, .82, 8), new THREE.MeshStandardMaterial({ color: '#ffe28a', emissive: '#ff9d27', emissiveIntensity: 2.2, roughness: .3 }));
  campCore.position.set(.02, .48, -.02); campFlame.add(campCore);
  const campLight = new THREE.PointLight('#ff963f', 4.2, 22, 1.55); campLight.position.y = 1.25; campfire.add(campLight);
  campfire.position.set(campX, campY, campZ); scene.add(campfire); addCollider(campX, campZ, 1.5, 1.5, { type: 'campfire', height: 1.8 });
  fireSources.push({ light: campLight, flame: campFlame, intensity: 4.2, phase: .7 });

  // A terraced rice field with raised mud berms, water and planted rows.
  const paddyWater = useAtlas(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .3, metalness: .06, transparent: true, opacity: .78 }), 'water');
  const paddyMud = useAtlas(proceduralMaterial('#ffffff', { pattern: 'soil', scale: .65, roughness: 1 }), 'soil');
  const riceMat = useAtlas(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), 'leaves');
  for (let row = 0; row < paddyRows; row++) {
    for (let col = 0; col < paddyCols; col++) {
      const x = paddyX + (col - 2) * 4.05, z = paddyZ + (row - 2.5) * 3.45;
      const y = heightAt(x, z), terrace = new THREE.Group();
      mesh(terrace, new THREE.BoxGeometry(3.65, .14, 3.05), paddyWater, 0, .12, 0);
      for (const side of [-1, 1]) {
        mesh(terrace, new THREE.BoxGeometry(.28, .34, 3.25), paddyMud, side * 1.95, .13, 0);
        mesh(terrace, new THREE.BoxGeometry(4.12, .34, .26), paddyMud, 0, .13, side * 1.65);
      }
      terrace.position.set(x, y, z); scene.add(terrace);
      for (let plant = 0; plant < 8; plant++) {
        const px = (plant % 4 - 1.5) * .72, pz = (Math.floor(plant / 4) - .5) * 1.5;
        const stalk = mesh(terrace, new THREE.CylinderGeometry(.025, .045, .8 + rand() * .22, 5), riceMat, px, .58, pz);
        stalk.rotation.z = (rand() - .5) * .14;
        for (const side of [-1, 1]) {
          const leaf = mesh(terrace, new THREE.ConeGeometry(.08, .66, 5), riceMat, px + side * .11, .68, pz);
          leaf.rotation.z = side * .42;
        }
      }
    }
  }
  // Rocky highlands create a visible island rim and a mountain backdrop.
  const mountainPositions = [[-100,-78,15],[-83,-96,18],[-51,-101,14],[7,-103,18],[64,-96,15],[99,-70,20],[103,-24,16],[99,38,18],[72,94,17],[18,103,15],[-43,99,19],[-94,68,16],[-104,20,19],[-102,-28,15]];
  for (const [sourceX, sourceZ, height] of mountainPositions) {
    const x = sourceX * 1.45, z = sourceZ * 1.45;
    const mountain = new THREE.Group(), baseY = heightAt(x, z);
    const peak = mesh(mountain, new THREE.ConeGeometry(height * .68, height, 7), rockMat, 0, height * .43, 0, true);
    peak.rotation.y = rand() * Math.PI;
    for (let rock = 0; rock < 3; rock++) {
      const size = height * (.28 + rand() * .16);
      const outcrop = mesh(mountain, new THREE.DodecahedronGeometry(size, 1), rockMat, (rand() - .5) * height * .72, height * (.12 + rand() * .22), (rand() - .5) * height * .72, true);
      outcrop.scale.y = .75 + rand() * .55;
    }
    mountain.position.set(x, baseY, z); scene.add(mountain);
    obstacles.push({ x, z, radius: height * .55, type: 'mountain' });
  }

  // Winding worn road made from connected textured strips; its curved footprint is stable on every page.
  for (let i = 0; i < Math.ceil(MAP_HALF * 2 / 2.2); i++) {
    const z = MAP_HALF - i * 2.2, x = Math.sin(i * .08) * 5.5;
    const segment = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 2.5), dirtMat);
    segment.rotation.x = -Math.PI / 2; segment.rotation.z = Math.cos(i * .08) * .04;
    segment.position.set(x, heightAt(x, z) + .04, z); scene.add(segment);
  }

  const solid = (parent, geo, material, x, y, z) => mesh(parent, geo, material, x, y, z, true);
  function building({ x, z, w, d, h, wall = woodMat, roof = metalMat, label = 'Rumah', doorWidth = 1.45, window = true }) {
    const group = new THREE.Group(), base = .23, thick = .28, doorH = Math.min(2.12, h * .76), wallY = base + h / 2;
    solid(group, new THREE.BoxGeometry(w + .35, .46, d + .35), stoneMat, 0, .23, 0);
    // Furniture gives each cabin readable lived-in detail once its door is opened.
    solid(group, new THREE.BoxGeometry(w - .7, .08, d - .7), woodMat, 0, .49, 0);
    // Side and rear walls have physical colliders matching the actual wall segments.
    solid(group, new THREE.BoxGeometry(thick, h, d), wall, -w / 2, wallY, 0); addCollider(x - w / 2, z, thick, d, {height:h});
    solid(group, new THREE.BoxGeometry(thick, h, d), wall, w / 2, wallY, 0); addCollider(x + w / 2, z, thick, d, {height:h});
    solid(group, new THREE.BoxGeometry(w, h, thick), wall, 0, wallY, -d / 2); addCollider(x, z - d / 2, w, thick, {height:h});
    const sideWidth = (w - doorWidth) / 2;
    solid(group, new THREE.BoxGeometry(sideWidth, h, thick), wall, -doorWidth / 2 - sideWidth / 2, wallY, d / 2); addCollider(x - doorWidth / 2 - sideWidth / 2, z + d / 2, sideWidth, thick, {height:h});
    solid(group, new THREE.BoxGeometry(sideWidth, h, thick), wall, doorWidth / 2 + sideWidth / 2, wallY, d / 2); addCollider(x + doorWidth / 2 + sideWidth / 2, z + d / 2, sideWidth, thick, {height:h});
    solid(group, new THREE.BoxGeometry(doorWidth, h - doorH, thick), wall, 0, base + doorH + (h - doorH) / 2, d / 2);
    const doorGroup = new THREE.Group(); doorGroup.position.set(-doorWidth / 2, base, d / 2 + .18); group.add(doorGroup);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorH, .13), woodMat); door.position.set(doorWidth / 2, doorH / 2, 0); door.castShadow = true; doorGroup.add(door);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), metalMat); handle.position.set(doorWidth * .84, doorH * .49, -.1); doorGroup.add(handle);
    const doorRecord = { id: label, type: 'door', name: label, x, z: z + d / 2 + .6, radius: 2.1, open: openDoors.includes(label), object: doorGroup, collider: { x, z: z + d / 2 + .15, width: doorWidth, depth: .18, y:heightAt(x,z)+.23, height:doorH, active: !openDoors.includes(label) } };
    if (doorRecord.open) doorGroup.rotation.y = -Math.PI / 2;
    colliders.push(doorRecord.collider); interactables.push(doorRecord);
    const furnitureTop = Math.min(d / 2 - 1.25, 1.6);
    const bedX = w * .26;
    solid(group, new THREE.BoxGeometry(w * .34, .34, d * .45), woodMat, -bedX, .72, -furnitureTop * .35);
    solid(group, new THREE.BoxGeometry(w * .32, .14, d * .42), concreteMat, -bedX, .95, -furnitureTop * .35);
    solid(group, new THREE.BoxGeometry(w * .18, .7, d * .12), woodMat, w * .24, .86, -furnitureTop * .58);
    solid(group, new THREE.BoxGeometry(w * .2, .08, d * .17), woodMat, w * .24, 1.25, -furnitureTop * .58);
    for (let shelf = 0; shelf < 2; shelf++) solid(group, new THREE.BoxGeometry(w * .16, .07, d * .16), woodMat, -w * .31, 1.1 + shelf * .48, d * .12);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#f6c75b', emissive: '#dd8c21', emissiveIntensity: .85 }));
    lamp.position.set(w * .24, 1.42, -furnitureTop * .58); group.add(lamp);
    addCollider(x - bedX, z - furnitureTop * .35, w * .34, d * .45, { type: 'furniture' });
    addCollider(x + w * .24, z - furnitureTop * .58, w * .2, d * .17, { type: 'furniture' });
    if (window && w > 6) for (const side of [-1, 1]) {
      const gx = side * w * .3;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, .82, .12), new THREE.MeshStandardMaterial({ color: '#76949b', metalness: .38, roughness: .25, emissive: '#182c33' }));
      glass.position.set(gx, base + h * .66, d / 2 + .18); group.add(glass);
      solid(group, new THREE.BoxGeometry(.07, .94, .15), woodMat, gx, base + h * .66, d / 2 + .2);
    }
    const gable = new THREE.Shape(); gable.moveTo(-w / 2, 0); gable.lineTo(w / 2, 0); gable.lineTo(0, h * .38); gable.closePath();
    const gableMat = wall.clone(); gableMat.side = THREE.DoubleSide;
    const face = new THREE.Mesh(new THREE.ShapeGeometry(gable), gableMat); face.position.set(0, base + h, d / 2 + .16); group.add(face);
    const faceBack = face.clone(); faceBack.position.z = -d / 2 - .16; group.add(faceBack);
    const roofGeometry = new THREE.BufferGeometry();
    const roofVerts = new Float32Array([-w / 2, 0, -d / 2, 0, h * .38, -d / 2, 0, h * .38, d / 2, -w / 2, 0, d / 2, 0, h * .38, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, 0, h * .38, d / 2]);
    roofGeometry.setAttribute('position', new THREE.BufferAttribute(roofVerts, 3)); roofGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); roofGeometry.computeVertexNormals();
    const roofMaterial = roof.clone(); roofMaterial.side = THREE.DoubleSide; roofMaterial.roughness = .93;
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(0, base + h + .08, 0); roofMesh.castShadow = true; group.add(roofMesh);
    group.position.set(x, heightAt(x, z), z); scene.add(group);
    return { group, door: doorRecord };
  }
  const buildings = [
    building({ x: 0, z: -20, w: 9, d: 7, h: 3.5, wall: woodMat, roof: woodMat, label: 'Rumah Penjaga' }),
    building({ x: 19, z: -40, w: 13, d: 10, h: 4.1, wall: concreteMat, roof: metalMat, label: 'Gudang Utara' }),
    building({ x: -29, z: -37, w: 9, d: 8, h: 3.7, wall: brickMat, roof: woodMat, label: 'Rumah Bata' }),
    building({ x: 37, z: -7, w: 11, d: 8, h: 3.6, wall: concreteMat, roof: metalMat, label: 'Pos Timur' }),
    building({ x: -37, z: 18, w: 8, d: 7, h: 3.2, wall: woodMat, roof: metalMat, label: 'Kabin Hutan' }),
    building({ x: 14, z: 26, w: 7, d: 6, h: 3, wall: brickMat, roof: metalMat, label: 'Pos Batu' }),
    building({ x: 52, z: -40, w: 9, d: 8, h: 3.5, wall: brickMat, roof: metalMat, label: 'Pos Tambang' }),
    building({ x: -53, z: 47, w: 12, d: 9, h: 4, wall: concreteMat, roof: woodMat, label: 'Klinik Lama' }),
    building({ x: 68, z: 50, w: 11, d: 9, h: 3.7, wall: woodMat, roof: metalMat, label: 'Rumah Bukit' })
  ];
  const houseSlots = { guardian: 0, forest: 4, hill: 8 };
  function furnishUpgrade(record, level) {
    if (!record || level < 2) return;
    const group = record.group, porchZ = 4.1 + (level - 1) * .15;
    solid(group, new THREE.BoxGeometry(4.8 + level * .45, .18, 2.5), woodMat, 0, .24, porchZ);
    for (const x of [-2, 2]) { solid(group, new THREE.BoxGeometry(.16, 2.2, .16), woodMat, x, 1.3, porchZ + .9); addCollider(group.position.x + x, group.position.z + porchZ + .9, .24, .24, { type: 'porch' }); }
    solid(group, new THREE.BoxGeometry(5.2 + level * .45, .17, 2.8), metalMat, 0, 2.48, porchZ);
    addCollider(group.position.x, group.position.z + porchZ, 5.1 + level * .45, 2.35, { type: 'porch' });
    if (level >= 3) {
      solid(group, new THREE.BoxGeometry(.6, 2.5, .65), brickMat, -2.55, 4.55, -1.35);
      solid(group, new THREE.BoxGeometry(.8, .2, .85), stoneMat, -2.55, 5.85, -1.35);
    }
    if (level >= 4) {
      const panel = solid(group, new THREE.BoxGeometry(2.2, .12, 1.05), metalMat, 1.35, 4.45, -.6); panel.rotation.x = -.32;
      const light = new THREE.PointLight('#ffbd5e', 1.1, 12); light.position.set(0, 2.3, 4); group.add(light);
    }
    if (level >= 5) {
      solid(group, new THREE.BoxGeometry(1.15, 1.45, 1.15), woodMat, 0, 4.2, -1.3);
      solid(group, new THREE.ConeGeometry(.9, .8, 4), metalMat, 0, 5.33, -1.3).rotation.y = Math.PI / 4;
    }
  }
  for (const [id, index] of Object.entries(houseSlots)) if (houses[id]?.owned) furnishUpgrade(buildings[index], houses[id].level || 1);

  // Wood fence around the old camp; each rail and gate blocks movement independently.
  for (let i = 0; i < 36; i++) {
    const side = i < 9 ? 0 : i < 18 ? 1 : i < 27 ? 2 : 3;
    const n = i % 9;
    const x = side === 0 ? -12 + n * 3 : side === 1 ? 12 : side === 2 ? 12 - n * 3 : -12;
    const z = side === 0 ? -33 : side === 1 ? -33 + n * 2.6 : side === 2 ? -12 : -12 - n * 2.6;
    if ((side === 2 && (n === 3 || n === 4 || n === 5)) || (side === 1 && n === 5)) continue;
    const yy = heightAt(x, z), post = new THREE.Mesh(new THREE.BoxGeometry(.2, 1.45, .2), woodMat); post.position.set(x, yy + .72, z); post.castShadow = true; scene.add(post);
    const alongX = side === 0 || side === 2;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 3.1 : .16, .2, alongX ? .16 : 2.75), woodMat); rail.position.set(x, yy + .85, z); rail.castShadow = true; scene.add(rail);
    addCollider(x, z, alongX ? 3.05 : .23, alongX ? .23 : 2.75, { type: 'fence', height:1.45 });
  }
  const gate = new THREE.Group();
  const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.25, .2), woodMat); gateMesh.position.set(2.15, .63, 0); gateMesh.castShadow = true; gate.add(gateMesh);
  gate.position.set(-4.2, heightAt(-4.2, -12) + .1, -12); scene.add(gate);
  const gateRecord = { id: 'Gerbang kamp', type: 'gate', name: 'Gerbang kamp', x: -2.1, z: -11.7, radius: 2.3, open: openDoors.includes('Gerbang kamp'), object: gate, collider: { x: -2.1, z: -12, width: 4.3, depth: .28, y:heightAt(-2.1,-12), height:1.25, active: !openDoors.includes('Gerbang kamp') } };
  if (gateRecord.open) gate.rotation.y = -Math.PI / 2;
  colliders.push(gateRecord.collider); interactables.push(gateRecord);
  // crates/barrels have visible materials and physical footprints.
  const prop = (x, z, kind) => {
    const group = new THREE.Group(), y = heightAt(x, z);
    if (kind === 'crate') {
      mesh(group, new THREE.BoxGeometry(1.25, 1, 1.1), woodMat, 0, .5, 0, true);
      for (const side of [-1, 1]) { const brace = mesh(group, new THREE.BoxGeometry(.1, 1.18, .12), metalMat, side * .46, .5, -.56); brace.rotation.z = side * .48; }
    } else {
      const drum = mesh(group, new THREE.CylinderGeometry(.4, .43, 1.1, 16), metalMat, 0, .55, 0, true);
      const band = new THREE.Mesh(new THREE.TorusGeometry(.4, .035, 6, 16), mat('#554b3e', .72)); band.rotation.x = Math.PI / 2; band.position.y = .3; group.add(band); drum.rotation.y = .1;
    }
    group.position.set(x, y, z); scene.add(group); addCollider(x, z, .95, .9, { type: kind });
  };
  [[4, -29, 'crate'], [7, -29, 'barrel'], [23, -32, 'crate'], [-23, -31, 'barrel'], [34, -17, 'crate'], [57, -42, 'barrel'], [-51, 44, 'crate']].forEach(p => prop(...p));

  // Lookout tower, watch platform, ladder rungs and radio dish landmark.
  const towerX = -20, towerZ = -31, towerY = heightAt(towerX, towerZ), tower = new THREE.Group();
  const supportMat = useAtlas(proceduralMaterial('#ffffff', { pattern: 'bark', scale: .42, roughness: 1 }), 'wood', [1.5, 2.5]);
  for (const x of [-1.25, 1.25]) for (const z of [-1.2, 1.2]) {
    const leg = mesh(tower, new THREE.CylinderGeometry(.1, .18, 9, 8), supportMat, x, 4.5, z, true);
    leg.rotation.z = x * -.035;
    for (const h of [1.3, 2.4, 3.7, 5.1]) { const rung = mesh(tower, new THREE.BoxGeometry(2.5, .12, .12), woodMat, 0, h, z); rung.rotation.z = h % 2 ? .42 : -.42; }
  }
  mesh(tower, new THREE.BoxGeometry(3.6, .42, 3.5), woodMat, 0, 7.7, 0, true);
  mesh(tower, new THREE.BoxGeometry(3.1, .8, 3), concreteMat, 0, 8.25, 0);
  const towerRoof = mesh(tower, new THREE.ConeGeometry(2.7, 1.7, 4), metalMat, 0, 9.5, 0); towerRoof.rotation.y = Math.PI / 4;
  const antenna = mesh(tower, new THREE.CylinderGeometry(.035, .04, 2.1, 6), metalMat, 1, 9.4, -1);
  antenna.rotation.z = .22; tower.position.set(towerX, towerY, towerZ); scene.add(tower); addCollider(towerX, towerZ, 3.2, 3.2, { type: 'tower' });

  // Scattered 3D boulders and obstacle footprints.
  for (let i = 0; i < 190; i++) {
    const x = (rand() - .5) * 320, z = (rand() - .5) * 320;
    if (Math.hypot(x, z) < 12 || inPaddy(x, z)) continue;
    const r = .36 + rand() * .78;
    const rock = mesh(scene, new THREE.DodecahedronGeometry(r, 1), rockMat, x, heightAt(x, z) + r * .48, z, true);
    rock.scale.set(1 + rand() * .6, .65 + rand() * .5, .86 + rand() * .55); rock.rotation.set(rand(), rand() * Math.PI, rand());
    obstacles.push({ x, z, radius: r * .84, type: 'rock' });
  }

  // Harvestable voxel ore deposits are placed in reachable clearings across the island.
  const mineables = [], mineableById = new Map(), minedIds = new Set(minedNodes);
  const oreStone = useAtlas(proceduralMaterial('#ffffff', { pattern: 'stone', scale: .72, roughness: .96, flatShading: true }), 'stone');
  const oreMetal = useAtlas(proceduralMaterial('#ffffff', { pattern: 'metal', scale: .8, roughness: .58, metalness: .38, flatShading: true }), 'metal');
  const oreGlow = new THREE.MeshStandardMaterial({ color: '#a946ff', emissive: '#8e25ff', emissiveIntensity: 1.05, roughness: .28, metalness: .25 });
  const oreBlue = new THREE.MeshStandardMaterial({ color: '#69ddff', emissive: '#168cbd', emissiveIntensity: .7, roughness: .27, metalness: .32 });
  const oreRandom = seeded(17609);
  let oreIndex = 0;
  for (let attempt = 0; attempt < 900 && oreIndex < 78; attempt++) {
    const x = (oreRandom() - .5) * 306, z = (oreRandom() - .5) * 306;
    const riverX = riverCenterAt(z), roadX = Math.sin((MAP_HALF - z) / 2.2 * .08) * 5.5;
    if (Math.hypot(x, z) < 16 || inPaddy(x, z) || Math.abs(x - riverX) < 11 || Math.abs(x - roadX) < 5) continue;
    if (obstacles.some(item => Math.hypot(x - item.x, z - item.z) < item.radius + 2.2)) continue;
    if (colliders.some(box => Math.abs(x - box.x) < box.width / 2 + 2 && Math.abs(z - box.z) < box.depth / 2 + 2)) continue;
    const id = `ore-${oreIndex + 1}`;
    oreIndex++;
    if (minedIds.has(id)) continue;
    const resource = oreIndex % 9 === 0 ? 'crystal' : oreIndex % 3 === 0 ? 'metal' : 'stone';
    const group = new THREE.Group(), baseMaterial = resource === 'metal' ? oreMetal : oreStone, shardMaterial = resource === 'crystal' ? oreGlow : oreBlue;
    mesh(group, new THREE.BoxGeometry(.86, .72, .82), baseMaterial, 0, .36, 0, true);
    mesh(group, new THREE.BoxGeometry(.42, .88, .4), baseMaterial, -.35, .44, .22, true).rotation.y = .22;
    mesh(group, new THREE.BoxGeometry(.38, .62, .34), baseMaterial, .34, .31, -.2, true).rotation.y = -.18;
    mesh(group, new THREE.BoxGeometry(.19, .62, .2), shardMaterial, -.1, .82, -.03, true);
    mesh(group, new THREE.BoxGeometry(.14, .4, .14), shardMaterial, .34, .66, .12, true).rotation.z = -.2;
    group.position.set(x, heightAt(x, z), z); scene.add(group);
    const obstacle = { x, z, radius: .82, type: 'ore' };
    const collider = { x, z, width: 1.2, depth: 1.1, y: heightAt(x, z), height: 1.35, type: 'ore', active: true };
    obstacles.push(obstacle); colliders.push(collider);
    const node = { id, resource, amount: resource === 'crystal' ? 1 : 2, group, x, z, obstacle, collider };
    mineables.push(node); mineableById.set(id, node);
  }

  // Main player, a named trader, hostile scavengers and wolves are all procedural 3D characters.
  const skinMat = mat('#c8946d', .84), hairMat = mat('#181b1e', .92);
  const pantsMat = clothMaterial('#25232a');
  const bootsMat = proceduralMaterial('#bab7a9', { pattern: 'leather', scale: 1.25, roughness: .92 });
  const heroCloth = () => clothMaterial('#ffffff');
  const makeHero = skinStyle => createSurvivor({ cloth: heroCloth(), pants: pantsMat, skin: skinMat, hair: hairMat, boots: bootsMat, skinStyle, markTexture });
  let hero = makeHero(skin);
  hero.position.y = heightAt(0, 0); scene.add(hero);
  const rainCount = 720, rainPositions = new Float32Array(rainCount * 6), rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - .5) * 42, z = (rand() - .5) * 42, y = 2 + rand() * 24;
    rainPositions.set([x, y, z, x + .13, y - .78, z + .035], i * 6); rainSpeeds[i] = 11 + rand() * 10;
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#d8e4ff', transparent: true, opacity: .48, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeometry, rainMaterial); rainLines.position.copy(hero.position); rainLines.visible = weatherState === 'rain'; rainLines.frustumCulled = false; scene.add(rainLines);
  const lobbyActors = [];
  if (mode === 'lobby') {
    for (const [x, z, style, coat] of [[-3.1, -2.3, 'Ranger', '#59674b'], [3.4, -3.6, 'Medic', '#68746a']]) {
      const person = createSurvivor({ cloth: clothMaterial(coat), pants: pantsMat, skin: skinMat, hair: hairMat, boots: bootsMat, backpack: style === 'Medic' ? '#674238' : '#46523a', skinStyle: style, markTexture });
      person.position.set(x, heightAt(x, z), z); person.rotation.y = Math.PI; scene.add(person); lobbyActors.push(person);
    }
  }
  const merchant = createSurvivor({ cloth: clothMaterial('#9c713e'), pants: pantsMat, skin: skinMat, hair: mat('#44352b'), boots: bootsMat, backpack: '#4e573d', skinStyle: 'Nomad', markTexture });
  merchant.position.set(5.2, heightAt(5.2, -14.4) + .02, -14.4); merchant.rotation.y = Math.PI * .5; scene.add(merchant);
  interactables.push({ type: 'merchant', name: 'Nara · Pedagang', x: 5.2, z: -14.4, radius: 2.8, object: merchant });
  const npcs = [{ name: 'Mira · Dokter', role: 'Medic', x: -50.5, z: 43, line: 'Klinik lama masih punya obat. Hati-hati di jalur utara.' }, { name: 'Danu · Penjaga', role: 'Ranger', x: -7.5, z: -25, line: 'Serigala sering turun ke dekat sungai saat senja.' }, { name: 'Ari · Penyintas', role: 'Nomad', x: 71, z: 47, line: 'Akar dan batu di bukit bisa dipakai untuk crafting.' }];
  for (const npc of npcs) {
    const actor = createSurvivor({ cloth: clothMaterial(npc.role === 'Medic' ? '#40354b' : '#27362e'), pants: pantsMat, skin: skinMat, hair: hairMat, boots: bootsMat, skinStyle: npc.role, markTexture });
    actor.position.set(npc.x, heightAt(npc.x, npc.z), npc.z); actor.rotation.y = Math.PI; actor.userData.npc = npc;
    const signCanvas = document.createElement('canvas'); signCanvas.width = 320; signCanvas.height = 72; const context = signCanvas.getContext('2d');
    context.fillStyle = 'rgba(12,10,18,.82)'; context.beginPath(); context.roundRect(8, 8, 304, 56, 12); context.fill(); context.strokeStyle = '#9b4bff'; context.lineWidth = 3; context.stroke(); context.fillStyle = '#f7efff'; context.font = 'bold 28px Segoe UI'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(npc.name, 160, 37);
    const nameTexture = new THREE.CanvasTexture(signCanvas); nameTexture.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthWrite: false })); sign.position.y = 3.1; sign.scale.set(2.7, .6, 1); actor.add(sign);
    scene.add(actor); npc.group = actor; interactables.push({ type: 'npc', name: npc.name, x: npc.x, z: npc.z, radius: 2.4, object: actor, npc });
  }
  npcs.push({ name: 'Nara · Pedagang', role: 'Nomad', x: 5.2, z: -14.4, group: merchant });

  const addHealthBar = (actor, title) => {
    const element = document.createElement('canvas'); element.width = 192; element.height = 42;
    const context = element.getContext('2d'), map = new THREE.CanvasTexture(element); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    sprite.scale.set(2.2, .48, 1); sprite.position.y = 2.85; sprite.visible = false; actor.add(sprite);
    const update = (health, max) => {
      context.clearRect(0, 0, element.width, element.height); context.fillStyle = 'rgba(10,14,13,.82)'; context.fillRect(0, 0, 192, 42);
      context.fillStyle = '#f1eee0'; context.font = 'bold 18px Segoe UI'; context.textAlign = 'center'; context.fillText(title, 96, 17);
      context.fillStyle = '#382e2b'; context.fillRect(8, 25, 176, 11);
      context.fillStyle = health / max > .45 ? '#80b84e' : '#dc4c3b'; context.fillRect(8, 25, 176 * Math.max(0, health / max), 11); map.needsUpdate = true;
    };
    return { sprite, update };
  };

  const enemies = [];
  const raiderSpawns = [[-39, -8], [44, 25], [-57, -46], [77, -12], [34, 68], [-79, 22], [-91, -61], [8, 77], [96, 4], [-4, -98], [58, 91], [-61, -88]];
  raiderSpawns.forEach(([x, z], index) => {
    const kinds = ['raider', 'zombie', 'skeleton', 'creeper'];
    const type = kinds[index % kinds.length];
    const actor = type === 'raider' ? createSurvivor({ cloth: clothMaterial(index % 2 ? '#465045' : '#554137'), pants: pantsMat, skin: mat('#916444'), hair: mat('#161616'), boots: mat('#342d26'), hostile: true }) : createMob({ type });
    actor.position.set(x, heightAt(x, z), z); scene.add(actor);
    const mobNames = { raider: 'Perampok', zombie: 'Mayat hidup', skeleton: 'Tengkorak', creeper: 'Perayap' };
    const enemyName = `${mobNames[type]} ${index + 1}`;
    const healthBar = addHealthBar(actor, enemyName);
    const enemy = { id: `raider-${index + 1}`, type, name: enemyName, group: actor, x, z, homeX: x, homeZ: z, health: type === 'creeper' ? 115 : 100, maxHealth: type === 'creeper' ? 115 : 100, healthBar, speed: type === 'creeper' ? 1.65 : 1.25, attackAt: 0, alive: !defeatedThreats.includes(`raider-${index + 1}`), phase: index * .87 };
    if (!enemy.alive) actor.visible = false;
    enemies.push(enemy);
  });
  const animals = [];
  [[-29, 43], [62, -61], [-83, 72], [80, 82], [9, 91], [12, 75], [88, 60], [-92, -13], [48, -93], [103, 36], [-10, -72], [72, 8]].forEach(([x, z], index) => {
    const wolf = createWolf({ fur: ['#766957', '#8c8980', '#594e42', '#81796d', '#514b45'][index] });
    wolf.position.set(x, heightAt(x, z), z); scene.add(wolf);
    const healthBar = addHealthBar(wolf, 'Serigala liar');
    const animal = { id: `wolf-${index + 1}`, type: 'wolf', name: 'Serigala', group: wolf, x, z, homeX: x, homeZ: z, health: 75, maxHealth: 75, healthBar, speed: 2.25, attackAt: 0, alive: !defeatedThreats.includes(`wolf-${index + 1}`) };
    if (!animal.alive) wolf.visible = false;
    animals.push(animal);
  });

  // Collectables now include food, clean water, ammunition and medical supplies.
  const loot = [];
  const lootKinds = ['wood', 'stone', 'metal', 'food', 'water', 'ammo', 'medkit'];
  const lootColors = { wood: '#a27849', stone: '#7a817d', metal: '#a9aaa6', food: '#bb8650', water: '#5ba5bf', ammo: '#c6a834', medkit: '#c84c3f' };
  const rngLoot = seeded(4113);
  for (let i = 0; i < 52; i++) {
    const id = `pickup-${i + 1}`;
    const x = (rngLoot() - .5) * 172, z = (rngLoot() - .5) * 172;
    const phase = rngLoot() * Math.PI * 2;
    if (takenLoot.includes(id)) continue;
    if (Math.hypot(x, z) < 6) continue;
    const kind = lootKinds[i % lootKinds.length], group = new THREE.Group();
    const lootMat = new THREE.MeshStandardMaterial({ color: lootColors[kind], roughness: .78, metalness: kind === 'metal' ? .32 : 0, emissive: lootColors[kind], emissiveIntensity: .06 });
    if (kind === 'wood') mesh(group, new THREE.BoxGeometry(.72, .16, .2), lootMat, 0, 0, 0);
    else if (kind === 'stone' || kind === 'metal') mesh(group, new THREE.DodecahedronGeometry(.29, 0), lootMat, 0, 0, 0);
    else if (kind === 'water') mesh(group, new THREE.CylinderGeometry(.13, .14, .46, 10), lootMat, 0, 0, 0);
    else if (kind === 'medkit') { mesh(group, new THREE.BoxGeometry(.46, .31, .36), lootMat, 0, 0, 0); mesh(group, new THREE.BoxGeometry(.08, .26, .04), mat('#f4e9d3'), 0, 0, -.19); mesh(group, new THREE.BoxGeometry(.26, .08, .04), mat('#f4e9d3'), 0, 0, -.2); }
    else if (kind === 'food') { const can = mesh(group, new THREE.CylinderGeometry(.18, .18, .29, 12), lootMat, 0, 0, 0); can.rotation.z = Math.PI / 2; }
    else mesh(group, new THREE.BoxGeometry(.32, .2, .36), lootMat, 0, 0, 0);
    group.position.set(x, heightAt(x, z) + .48, z); scene.add(group);
    loot.push({ id, group, kind, taken: false, x, z, baseY: group.position.y, phase });
  }

  // Map landmark beacons are simple world geometry, not part of the HUD.
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#efb62f', emissive: '#b0770a', emissiveIntensity: .5 });
  for (const [x, z] of [[0, -20], [towerX, towerZ], [-53, 47], [68, 50]]) {
    const beacon = mesh(scene, new THREE.CylinderGeometry(.12, .12, 2.2, 8), beaconMat, x, heightAt(x, z) + 1.1, z);
    beacon.visible = false; // activate when visited so it does not clutter the 3D view
  }

  if (mode === 'lobby') {
    const platformY = heightAt(0, 0) + .08;
    const platformMat = new THREE.MeshStandardMaterial({ color: '#27113d', emissive: '#51148a', emissiveIntensity: .55, roughness: .48, metalness: .35 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.45, .18, 40), platformMat);
    platform.position.set(0, platformY, 0); platform.receiveShadow = true; scene.add(platform);
    const platformRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, .09, 10, 64), new THREE.MeshStandardMaterial({ color: '#dd8cff', emissive: '#a52aff', emissiveIntensity: 2.4, metalness: .4, roughness: .26 }));
    platformRing.rotation.x = Math.PI / 2; platformRing.position.set(0, platformY + .12, 0); scene.add(platformRing);
    const portalX = -8, portalZ = -7, portalY = heightAt(portalX, portalZ);
    const portalFrame = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: '#30223e', metalness: .65, roughness: .38 });
    const glowMat = new THREE.MeshStandardMaterial({ color: '#c060ff', emissive: '#8b21ff', emissiveIntensity: 2.1, roughness: .2, side: THREE.DoubleSide, transparent: true, opacity: .74 });
    for (const side of [-1, 1]) {
      mesh(portalFrame, new THREE.BoxGeometry(.42, 5.3, .55), frameMat, side * 2.05, 2.65, 0, true);
      mesh(portalFrame, new THREE.BoxGeometry(.62, .6, .8), frameMat, side * 2.05, .3, 0);
      const rune = new THREE.Mesh(new THREE.BoxGeometry(.09, .74, .09), glowMat); rune.position.set(side * 2.05, 3.3, -.3); portalFrame.add(rune);
    }
    mesh(portalFrame, new THREE.BoxGeometry(4.5, .48, .72), frameMat, 0, 5.1, 0, true);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.68, .12, 12, 48), new THREE.MeshStandardMaterial({ color: '#db8cff', emissive: '#9f2bff', emissiveIntensity: 2.6, metalness: .5, roughness: .2 }));
    ring.position.set(0, 2.68, -.1); portalFrame.add(ring);
    const portalSurface = new THREE.Mesh(new THREE.CircleGeometry(1.58, 40), glowMat); portalSurface.position.set(0, 2.68, -.13); portalFrame.add(portalSurface);
    portalFrame.position.set(portalX, portalY, portalZ); scene.add(portalFrame);
    const portalLight = new THREE.PointLight('#a83cff', 7.5, 24, 1.8); portalLight.position.set(portalX, portalY + 2.8, portalZ + 1); scene.add(portalLight);
    fireSources.push({ light: portalLight, flame: ring, intensity: 7.5, phase: 1.8 });
  }

  const heroFloor = heightAt(0, 0);
  if (mode === 'lobby') { hero.rotation.y = Math.PI; camera.position.set(0, heroFloor + 3.1, 10); camera.lookAt(0, heroFloor + 1.15, -1); }
  else if (mode === 'character' || mode === 'skins') { hero.rotation.y = Math.PI; camera.fov = 47; camera.position.set(2.6, heroFloor + 2.8, 6.4); camera.lookAt(0, heroFloor + 1.08, 0); camera.updateProjectionMatrix(); }
  else if (mode === 'loading') { camera.position.set(0, heroFloor + 16, 34); camera.lookAt(0, heroFloor + 3, -15); }
  else if (mode === 'home') { hero.rotation.y = Math.PI; camera.position.set(0, heroFloor + 8, 23); camera.lookAt(0, heroFloor + 2, -3); }
  else { camera.position.set(0, 4, 8); camera.lookAt(0, 1, 0); }
  const raycaster = new THREE.Raycaster();
  const shots = [];
  let nightLevel = 0;
  const setWeather = type => {
    if (!['clear', 'cloudy', 'rain'].includes(type)) return;
    weatherState = type; cloudinessTarget = type === 'clear' ? .18 : type === 'cloudy' ? .62 : .82;
    rainLines.visible = type === 'rain';
    return weatherState;
  };
  const updateTimeOfDay = hour => {
    const daylight = mode === 'lobby' ? .24 : THREE.MathUtils.smoothstep(Math.sin((hour - 6) * Math.PI / 12), -.18, .2);
    nightLevel = 1 - daylight;
    const sky = new THREE.Color(mode === 'lobby' ? '#24133a' : '#202039').lerp(new THREE.Color('#9bb4c0'), daylight);
    scene.background.copy(sky); scene.fog.color.copy(sky); scene.fog.near = THREE.MathUtils.lerp(42, 75, daylight); scene.fog.far = THREE.MathUtils.lerp(150, 215, daylight);
    const weatherDim = weatherState === 'rain' ? .32 : weatherState === 'cloudy' ? .17 : 0;
    ambient.intensity = THREE.MathUtils.lerp(1.08, 2.1, daylight); ambient.color.set(daylight > .35 ? '#dcecff' : '#a19dcc');
    sun.color.set(daylight > .35 ? '#ffe9bc' : '#aaa6e7'); sun.intensity = THREE.MathUtils.lerp(.32, 2.8 * (1 - weatherDim), daylight);
    sun.position.set(-36 + Math.cos(hour / 24 * Math.PI * 2) * 24, 12 + daylight * 45, 30 + Math.sin(hour / 24 * Math.PI * 2) * 22);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.03, 1.1, daylight);
    skyDomeMaterial.uniforms.uDaylight.value = mode === 'lobby' ? .18 : daylight;
    starsMaterial.opacity = nightLevel * .84; moon.visible = nightLevel > .18; moonGlow.visible = moon.visible;
  };
  setWeather(weatherState);
  updateTimeOfDay(timeOfDay);
  let last = performance.now(), gaitPhase = 0, moving = false, swimming = false, swimSpeed = 1, speedRatio = 1, action = '', actionEnds = 0, actionStarted = 0, sleepLift = 0, muzzleEnds = 0, previewRotation = 0;
  const resize = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize);
  const tick = now => {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    grass.material.userData.setProceduralTime(now * .001);
    windMaterials.forEach(material => material.userData.setProceduralTime(now * .001));
    cloudiness = THREE.MathUtils.damp(cloudiness, cloudinessTarget, 1.5, dt); skyDomeMaterial.uniforms.uCloudiness.value = cloudiness; cloudMat.opacity = THREE.MathUtils.damp(cloudMat.opacity, weatherState === 'clear' ? .22 : weatherState === 'cloudy' ? .64 : .78, 1.1, dt);
    cloudGroups.forEach(cloud => { cloud.position.x += cloud.userData.drift * dt; if (cloud.position.x > 155) cloud.position.x = -155; });
    skyDome.position.copy(camera.position); stars.position.copy(camera.position); moon.position.set(camera.position.x + 65, camera.position.y + 58, camera.position.z - 145); moonGlow.position.copy(moon.position);
    if (weatherState === 'rain') {
      rainLines.position.set(hero.position.x, hero.position.y, hero.position.z);
      const rainAttribute = rainGeometry.attributes.position, rainArray = rainAttribute.array;
      for (let drop = 0; drop < rainCount; drop++) {
        const offset = drop * 6; rainArray[offset + 1] -= rainSpeeds[drop] * dt; rainArray[offset + 4] -= rainSpeeds[drop] * dt;
        if (rainArray[offset + 1] < -1) { const x = (rand() - .5) * 42, z = (rand() - .5) * 42, y = 20 + rand() * 12; rainArray[offset] = x; rainArray[offset + 1] = y; rainArray[offset + 2] = z; rainArray[offset + 3] = x + .13; rainArray[offset + 4] = y - .78; rainArray[offset + 5] = z + .035; }
      }
      rainAttribute.needsUpdate = true;
    }
    fireSources.forEach((source, i) => {
      const flicker = .86 + Math.sin(now * .018 + source.phase) * .11 + Math.sin(now * .043 + i * 2.1) * .06;
      source.light.intensity = source.intensity * flicker * (.34 + nightLevel * .9);
      source.flame.scale.set(1 + Math.sin(now * .014 + source.phase) * .08, .88 + flicker * .18, 1 + Math.cos(now * .017 + source.phase) * .07);
      source.flame.rotation.z = Math.sin(now * .011 + source.phase) * .07;
    });
    const limbs = hero.userData.limbs;
    if (swimming) {
      gaitPhase += dt * 7.2 * THREE.MathUtils.clamp(swimSpeed, .55, 1.6);
      for (const l of limbs) {
        const wave = Math.sin(gaitPhase + (l.side < 0 ? Math.PI : 0));
        if (l.type === 'leg') { l.upper.rotation.x = .18 + wave * .58; l.lower.rotation.x = -.2 - Math.max(0, -wave) * .42; }
        else { l.upper.rotation.x = .38 + wave * .7; l.upper.rotation.z = l.side * (.18 + Math.cos(gaitPhase) * .12); l.lower.rotation.x = -.22 - Math.max(0, wave) * .42; }
      }
      hero.userData.torso.position.y = 1.33 + Math.sin(now * .004) * .045;
      hero.rotation.x = THREE.MathUtils.damp(hero.rotation.x, .07, 5, dt); hero.rotation.z = THREE.MathUtils.damp(hero.rotation.z, Math.sin(gaitPhase) * .035, 6, dt);
    } else if (moving) {
      const pace = THREE.MathUtils.clamp(speedRatio, .55, 1.7);
      gaitPhase += dt * 11.2 * pace;
      const stride = .46 * pace;
      const armed = Boolean(hero.userData.weaponMount?.children.length);
      for (const l of limbs) {
        const wave = Math.sin(gaitPhase + (l.side < 0 ? Math.PI : 0));
        if (l.type === 'leg') { l.upper.rotation.x = wave * stride; l.lower.rotation.x = Math.max(0, -wave) * .85; }
        else if (armed) { l.upper.rotation.x = (l.side > 0 ? .4 : .46) + wave * .09; l.upper.rotation.z = l.side < 0 ? .34 : -.03; l.lower.rotation.x = l.side < 0 ? .82 : -.18; }
        else { l.upper.rotation.x = -wave * .31; l.upper.rotation.z = THREE.MathUtils.damp(l.upper.rotation.z, l.side * .025, 8, dt); l.lower.rotation.x = .12 + Math.max(0, wave) * .2; }
      }
      hero.userData.torso.position.y = 1.36 + Math.abs(Math.sin(gaitPhase * 2)) * (.022 + pace * .022);
      hero.rotation.x = THREE.MathUtils.damp(hero.rotation.x, -.025 * pace, 7, dt);
      hero.rotation.z = THREE.MathUtils.damp(hero.rotation.z, Math.sin(gaitPhase) * .022, 8, dt);
    } else {
      gaitPhase += dt * 1.6;
      const armed = Boolean(hero.userData.weaponMount?.children.length);
      for (const l of limbs) { const armPose = armed && l.type === 'arm'; l.upper.rotation.x = THREE.MathUtils.damp(l.upper.rotation.x, armPose ? (l.side > 0 ? .4 : .46) : 0, 9, dt); l.upper.rotation.z = THREE.MathUtils.damp(l.upper.rotation.z, armPose ? (l.side < 0 ? .34 : -.03) : 0, 9, dt); l.lower.rotation.x = THREE.MathUtils.damp(l.lower.rotation.x, armPose ? (l.side < 0 ? .82 : -.18) : l.type === 'arm' ? .04 : 0, 9, dt); }
      hero.userData.torso.position.y = THREE.MathUtils.damp(hero.userData.torso.position.y, 1.36 + Math.sin(now * .0016) * .012, 4, dt);
      hero.rotation.z = THREE.MathUtils.damp(hero.rotation.z, 0, 6, dt);
    }
    if (action && now < actionEnds) {
      const arm = limbs.find(l => l.type === 'arm' && l.side === 1);
      const duration = Math.max(1, actionEnds - actionStarted), progress = THREE.MathUtils.clamp((now - actionStarted) / duration, 0, 1);
      if (arm && (action === 'eat' || action === 'drink')) { arm.upper.rotation.x = .86 + Math.sin(progress * Math.PI) * .25; arm.lower.rotation.x = 1.05; }
      else if (arm && action === 'pickup') { arm.upper.rotation.x = -.55; arm.lower.rotation.x = -.62; hero.userData.torso.position.y = 1.25 + Math.sin(progress * Math.PI) * .06; hero.rotation.x = .13; }
      else if (arm && action === 'fire') { arm.upper.rotation.x = .44 + Math.sin(progress * Math.PI) * .16; arm.lower.rotation.x = -.22; hero.rotation.x = -.035; }
      else if (arm && action === 'attack') { arm.upper.rotation.x = .35 + Math.sin(progress * Math.PI * 2) * .95; arm.lower.rotation.x = -.1 + Math.sin(progress * Math.PI) * .6; hero.rotation.z = Math.sin(progress * Math.PI) * .13; }
      else if (arm && action === 'mine') { arm.upper.rotation.x = -.75 + Math.sin(progress * Math.PI * 2) * 1.15; arm.upper.rotation.z = -.16; arm.lower.rotation.x = .22 + Math.sin(progress * Math.PI) * .5; hero.rotation.z = Math.sin(progress * Math.PI) * .09; }
      else if (arm && action === 'hurt') { limbs.filter(l => l.type === 'arm').forEach(l => { l.upper.rotation.x = .9; l.upper.rotation.z = l.side * .38; }); hero.rotation.x = .14; }
      else if (arm && action === 'interact') { arm.upper.rotation.x = .78; arm.lower.rotation.x = .25; }
      else if (action === 'sleep') { const restPose = Math.min(1, progress / .2) * (progress > .84 ? Math.max(0, 1 - (progress - .84) / .16) : 1); hero.rotation.z = restPose * 1.38; sleepLift = Math.sin(restPose * Math.PI / 2) * .42; hero.userData.torso.position.y = 1.36 - restPose * .19; limbs.filter(l => l.type === 'arm').forEach(l => { l.upper.rotation.x = .32; l.upper.rotation.z = l.side * .14; l.lower.rotation.x = .52; }); }
    } else { if (action === 'sleep') sleepLift = 0; action = ''; hero.rotation.x = THREE.MathUtils.damp(hero.rotation.x, 0, 7, dt); }
    const heldWeapon = hero.userData.weaponMount?.children[0];
    if (heldWeapon) {
      const firing = action === 'fire' && now < actionEnds;
      const mining = action === 'mine' && now < actionEnds;
      heldWeapon.position.z = THREE.MathUtils.damp(heldWeapon.position.z, firing ? .085 : 0, firing ? 24 : 12, dt);
      heldWeapon.rotation.x = THREE.MathUtils.damp(heldWeapon.rotation.x, firing ? -.1 : mining ? -.62 : 0, mining ? 18 : 14, dt);
      heldWeapon.rotation.z = THREE.MathUtils.damp(heldWeapon.rotation.z, mining ? -.18 : 0, mining ? 18 : 14, dt);
      if (now > muzzleEnds && heldWeapon.userData.muzzleFlash) { heldWeapon.userData.muzzleFlash.visible = false; heldWeapon.userData.muzzleLight.intensity = 0; }
    }
    for (const item of loot) if (!item.taken) { item.group.position.y = item.baseY + Math.sin(now * .002 + item.phase) * .07; item.group.rotation.y += dt * .45; }
    for (const item of interactables) if (item.type === 'door' || item.type === 'gate') { const target = item.open ? -Math.PI / 2 : 0; item.object.rotation.y = THREE.MathUtils.damp(item.object.rotation.y, target, 9, dt); if (!item.open && Math.abs(item.object.rotation.y) < .05) item.collider.active = true; }
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i], t = Math.min(1, (now - shot.started) / shot.duration);
      const point = shot.start.clone().lerp(shot.end, t); shot.bullet.position.copy(point);
      const trail = shot.trail.geometry.attributes.position; trail.setXYZ(0, point.x - shot.direction.x * .42, point.y - shot.direction.y * .42, point.z - shot.direction.z * .42); trail.setXYZ(1, point.x, point.y, point.z); trail.needsUpdate = true;
      shot.trail.material.opacity = 1 - t * .55;
      if (t >= 1) { scene.remove(shot.bullet, shot.trail); shot.bullet.geometry.dispose(); shot.bullet.material.dispose(); shot.trail.geometry.dispose(); shot.trail.material.dispose(); shots.splice(i, 1); }
    }
    const waterPositions = riverGeo.attributes.position;
    for (let i = 0; i < waterPositions.count; i++) {
      const x = waterPositions.getX(i), z = waterPositions.getZ(i), baseY = rawHeightAt(curveX(z), z) - 1.05;
      waterPositions.setY(i, baseY + Math.sin(now * .0017 + z * .22 + x * .09) * .045 + Math.sin(now * .0022 - z * .13) * .024);
    }
    waterPositions.needsUpdate = true; riverGeo.computeVertexNormals();
    for (const enemy of [...enemies, ...animals]) {
      if (enemy.corpseAt) {
        const elapsed = now - enemy.corpseAt, t = Math.min(1, elapsed / 850);
        enemy.group.rotation.z = THREE.MathUtils.lerp(enemy.fallFrom || 0, enemy.type === 'wolf' ? .08 : (enemy.fallSide || 1) * 1.48, t);
        if (enemy.type === 'wolf') enemy.group.rotation.x = THREE.MathUtils.lerp(0, 1.32, t);
        enemy.group.position.y = heightAt(enemy.x, enemy.z) + (1 - t) * .58;
        enemy.healthBar.sprite.visible = elapsed < 1700;
        if (elapsed > 25000 && enemy.group.visible) { enemy.group.visible = false; enemy.corpseAt = 0; }
      } else if (enemy.attackingUntil > now && enemy.group.userData.limbs) {
        const progress = 1 - (enemy.attackingUntil - now) / 520;
        const arm = enemy.group.userData.limbs.find(l => l.type === 'arm' && l.side === 1);
        if (arm) { arm.upper.rotation.x = -.8 + Math.sin(progress * Math.PI) * 1.15; arm.lower.rotation.x = .7; }
        enemy.group.rotation.x = Math.sin(progress * Math.PI) * -.09;
      } else if (!enemy.alive && enemy.group.visible) {
        enemy.group.rotation.x = THREE.MathUtils.damp(enemy.group.rotation.x, 0, 6, dt);
      }
    }
    for (const enemy of enemies) if (enemy.alive && enemy.group.userData.limbs && !(enemy.attackingUntil > now)) {
      const phase = now * (enemy.moving ? .009 : .0012) + enemy.phase;
      for (const limb of enemy.group.userData.limbs) { const wave = Math.sin(phase + (limb.side < 0 ? Math.PI : 0)); if (limb.type === 'leg') { limb.upper.rotation.x = enemy.moving ? wave * .38 : Math.sin(phase) * .025; limb.lower.rotation.x = enemy.moving ? Math.max(0, -wave) * .52 : 0; } else { limb.upper.rotation.x = enemy.moving ? -wave * .24 : -.2; limb.lower.rotation.x = enemy.moving ? .1 + Math.max(0, wave) * .12 : .18; } }
      enemy.group.userData.head.rotation.y = Math.sin(now * .0008 + enemy.phase) * .08;
    }
    for (const npc of npcs) if (npc.group && npc.group.visible) { npc.group.userData.torso.position.y = 1.36 + Math.sin(now * .0013 + npc.x) * .012; npc.group.userData.head.rotation.y = Math.sin(now * .0007 + npc.z) * .08; }
    for (const wolf of animals) if (wolf.alive) {
      for (const leg of wolf.group.userData.legs) leg.pivot.rotation.x = wolf.moving ? Math.sin(now * .012 + leg.phase) * .48 : Math.sin(now * .002 + leg.phase) * .03;
      if (wolf.attackingUntil > now) { const progress = 1 - (wolf.attackingUntil - now) / 520; wolf.group.userData.head.rotation.x = -.34 - Math.sin(progress * Math.PI) * .25; wolf.group.userData.jaw.rotation.x = -.08 - Math.sin(progress * Math.PI) * .46; wolf.group.position.y = heightAt(wolf.x, wolf.z) + Math.sin(progress * Math.PI) * .1; }
      else { wolf.group.userData.head.rotation.x = THREE.MathUtils.damp(wolf.group.userData.head.rotation.x, 0, 7, dt); wolf.group.userData.jaw.rotation.x = THREE.MathUtils.damp(wolf.group.userData.jaw.rotation.x, 0, 7, dt); wolf.group.position.y = THREE.MathUtils.damp(wolf.group.position.y, heightAt(wolf.x, wolf.z), 6, dt); }
    }
    for (const remote of remotes.values()) if (remote.group.userData.limbs) remote.group.userData.limbs.forEach(limb => { const wave = remote.moving ? Math.sin(now * .012 + (limb.side < 0 ? Math.PI : 0)) : 0; if (limb.type === 'leg') { limb.upper.rotation.x = wave * .42; limb.lower.rotation.x = Math.max(0, -wave) * .55; } else limb.upper.rotation.x = -wave * .25; });
    if (!interactive) {
      hero.rotation.y = (mode === 'lobby' || mode === 'character' || mode === 'skins' ? Math.PI : 0) + previewRotation + Math.sin(now * .00055) * .035;
      lobbyActors.forEach((person, i) => { person.rotation.y = Math.PI + Math.sin(now * .0005 + i) * .08; person.position.y = heightAt(person.position.x, person.position.z) + Math.sin(now * .0015 + i) * .025; });
    }
    renderer.render(scene, camera); api.frame = requestAnimationFrame(tick);
  };
  const remotes = new Map();
  const addRemote = username => {
    if (remotes.has(username)) return remotes.get(username);
    const group = createSurvivor({ cloth: clothMaterial('#496d83'), pants: pantsMat, skin: skinMat, hair: hairMat, boots: bootsMat, markTexture });
    group.position.set(300, -80, 300);
    const plate = document.createElement('canvas'); plate.width = 256; plate.height = 64; const ctx = plate.getContext('2d');
    ctx.fillStyle = 'rgba(9,15,18,.84)'; ctx.beginPath(); ctx.roundRect(8, 8, 240, 48, 10); ctx.fill(); ctx.strokeStyle = '#e2c454'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff7df'; ctx.font = 'bold 26px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(username.slice(0, 18), 128, 33);
    const nameTexture = new THREE.CanvasTexture(plate); nameTexture.colorSpace = THREE.SRGBColorSpace; const nameplate = new THREE.Sprite(new THREE.SpriteMaterial({ map:nameTexture, transparent:true, depthWrite:false })); nameplate.position.y = 3.05; nameplate.scale.set(2.2,.55,1); group.add(nameplate);
    scene.add(group); const remote = { group, target: new THREE.Vector3(300, -80, 300), yaw: 0, moving: false, nameTexture }; remotes.set(username, remote); return remote;
  };
  const api = {
    scene, camera, hero, renderer, terrain, ground, grass, heightAt, obstacles, colliders, cameraBlockers, loot, mineables, buildings, interactables, enemies, animals, limbs: hero.userData.limbs, remotes, raycaster,
    mapHalf: MAP_HALF, stream: streamPoints, merchant, npcs,
    waterLevelAt(x, z) { return rawHeightAt(riverCenterAt(z), z) - 1.05; },
    get sleepLift() { return sleepLift; },
    get weather() { return weatherState; },
    setSkin(style) {
      if (!['Rookie', 'Ranger', 'Shadow', 'Medic', 'Nomad'].includes(style) || hero.userData.skinStyle === style) return;
      const position = hero.position.clone(), rotation = hero.rotation.clone(), replacement = makeHero(style);
      hero.clear(); hero.userData = replacement.userData;
      for (const child of [...replacement.children]) { replacement.remove(child); hero.add(child); }
      hero.position.copy(position); hero.rotation.copy(rotation);
    },
    setFirstPerson(enabled) { hero.userData.setFirstPerson?.(enabled); },
    removeMineable(node) {
      if (!node || !mineableById.has(node.id)) return false;
      scene.remove(node.group);
      for (const child of node.group.children) child.geometry?.dispose();
      obstacles.splice(obstacles.indexOf(node.obstacle), 1); colliders.splice(colliders.indexOf(node.collider), 1);
      for (let i = cameraBlockers.length - 1; i >= 0; i--) if (cameraBlockers[i].parent === node.group) cameraBlockers.splice(i, 1);
      mineableById.delete(node.id);
      const index = mineables.indexOf(node); if (index >= 0) mineables.splice(index, 1);
      return true;
    },
    addRemote, removeRemote(username) { const remote = remotes.get(username); if (remote) { scene.remove(remote.group); remote.nameTexture?.dispose(); remotes.delete(username); } },
    updateHealth(entity) { entity?.healthBar?.update(entity.health, entity.maxHealth); if (entity?.healthBar) entity.healthBar.sprite.visible = true; },
    setMoving(value, speed = 1) { moving = value; speedRatio = speed; },
    setSwimming(value, speed = 1) { swimming = value; swimSpeed = speed; if (value) moving = false; },
    setWeather,
    setTimeOfDay(hour) { updateTimeOfDay(hour); },
    spawnShot(start, end) {
      const delta = end.clone().sub(start), distance = delta.length(), direction = delta.clone().normalize();
      const bullet = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff2a6' }));
      const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.Float32BufferAttribute([...start.toArray(), ...start.toArray()], 3));
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#ffb82e', transparent: true, opacity: .95 }));
      bullet.position.copy(start); scene.add(bullet, trail);
      shots.push({ bullet, trail, start: start.clone(), end: end.clone(), direction, started: performance.now(), duration: Math.max(.045, distance / 330) * 1000 });
    },
    rotatePreview(delta) { previewRotation += delta; },
    playAction(kind) {
      action = kind; actionStarted = performance.now(); actionEnds = actionStarted + (kind === 'sleep' ? 2600 : kind === 'mine' || kind === 'attack' ? 760 : 950);
      if (kind === 'fire') {
        const model = hero.userData.weaponMount?.children[0];
        if (model?.userData.muzzleFlash) { model.userData.muzzleFlash.visible = true; model.userData.muzzleLight.intensity = 2.8; muzzleEnds = performance.now() + 95; }
      }
    },
    equipWeapon(kind) {
      const mount = hero.userData.weaponMount;
      if (!mount) return;
      for (const child of [...mount.children]) mount.remove(child);
      mount.add(makeWeaponModel(kind));
    },
    dispose() {
      cancelAnimationFrame(api.frame); removeEventListener('resize', resize); renderer.dispose();
      terrain.dispose(); grass.geometry.dispose(); foliageGeometry.dispose(); bushGeometry.dispose();
    }
  };
  canvas.__world = api; api.frame = requestAnimationFrame(tick); return api;
}
