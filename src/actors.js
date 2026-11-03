import * as THREE from 'three';
import { proceduralMaterial } from './materials.js';

const box = (parent, size, material, position) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

/** A jointed procedural survivor. Local forward is -Z. */
export function createSurvivor({ cloth, pants, skin, hair, boots, backpack = '#54412e', hostile = false, skinStyle = 'Rookie', markTexture = null }) {
  const root = new THREE.Group();
  const styles = {
    Rookie: { jacket: '#201c29', pants: '#17161d', pack: '#292331', helmet: '#25202e', vest: '#292431', mask: '#111117', accent: '#a735ff' },
    Ranger: { jacket: '#343d35', pants: '#202721', pack: '#2e352b', helmet: '#46513f', vest: '#353d31', mask: '#171b17', accent: '#9b5dff' },
    Shadow: { jacket: '#17161f', pants: '#131319', pack: '#1a1922', helmet: '#191720', vest: '#211e2c', mask: '#0d0d12', accent: '#bd3cff' },
    Medic: { jacket: '#403b4b', pants: '#24212b', pack: '#342b38', helmet: '#655776', vest: '#322b3d', mask: '#17141b', accent: '#df4e72' },
    Nomad: { jacket: '#514438', pants: '#2a2726', pack: '#453b32', helmet: '#705b43', vest: '#4a3e34', mask: '#1d1917', accent: '#d69b42' }
  };
  const style = styles[skinStyle] || styles.Rookie;
  const color = hostile ? proceduralMaterial('#4f3028', { pattern: 'cloth', scale: 2.0, roughness: .96 }) : cloth.clone();
  if (!hostile && color.color) color.color.set(style.jacket);
  const trouserMaterial = pants.clone(); trouserMaterial.color.set(style.pants);
  const mesh = (parent, geometry, material, x, y, z) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };
  const torso = mesh(root, new THREE.BoxGeometry(.62, .82, .42), color, 0, 1.36, 0);
  const packMaterial = new THREE.MeshStandardMaterial({ color: hostile ? backpack : style.pack, roughness: 1 });
  mesh(root, new THREE.BoxGeometry(.52, .54, .22), packMaterial, 0, 1.39, .29);
  mesh(root, new THREE.BoxGeometry(.33, .18, .05), new THREE.MeshStandardMaterial({ color: '#92713e', roughness: .9 }), 0, 1.27, .41);
  if (!hostile) {
    const vest = new THREE.MeshStandardMaterial({ color: style.vest, roughness: .92 });
    const shoulder = new THREE.MeshStandardMaterial({ color: style.jacket, roughness: .94 });
    const accent = new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.accent, emissiveIntensity: .12, roughness: .72 });
    const trim = new THREE.MeshStandardMaterial({ color: '#101015', roughness: .82 });
    mesh(root, new THREE.BoxGeometry(.53, .48, .105), vest, 0, 1.39, -.237);
    mesh(root, new THREE.BoxGeometry(.035, .67, .035), accent, -.24, 1.38, -.262);
    mesh(root, new THREE.BoxGeometry(.035, .67, .035), accent, .24, 1.38, -.262);
    mesh(root, new THREE.BoxGeometry(.035, .53, .035), accent, 0, 1.38, -.299);
    mesh(root, new THREE.BoxGeometry(.17, .07, .035), trim, 0, 1.62, -.292);
    mesh(root, new THREE.BoxGeometry(.22, .06, .035), accent, 0, 1.58, -.31);
    mesh(root, new THREE.CylinderGeometry(.255, .28, .12, 12), packMaterial, 0, 1.02, 0);
    mesh(root, new THREE.BoxGeometry(.56, .065, .08), trim, 0, 1.05, -.275);
    for (const side of [-1, 1]) mesh(root, new THREE.BoxGeometry(.145, .22, .09), packMaterial, side * .235, 1.15, -.29);
    const hood = mesh(root, new THREE.BoxGeometry(.62, .2, .47), packMaterial, 0, 1.87, .07); hood.rotation.x = -.12;
    mesh(root, new THREE.BoxGeometry(.04, .56, .035), accent, -.285, 1.36, -.12);
    mesh(root, new THREE.BoxGeometry(.04, .56, .035), accent, .285, 1.36, -.12);
    for (const side of [-1, 1]) {
      mesh(root, new THREE.BoxGeometry(.25, .2, .25), shoulder, side * .35, 1.61, -.015);
      mesh(root, new THREE.BoxGeometry(.2, .045, .12), accent, side * .36, 1.61, -.15);
      mesh(root, new THREE.BoxGeometry(.16, .18, .105), vest, side * .17, 1.53, -.3);
      mesh(root, new THREE.BoxGeometry(.12, .2, .1), new THREE.MeshStandardMaterial({ color: skinStyle === 'Medic' ? '#b83d32' : style.accent, roughness: .8 }), side * .34, 1.47, -.07);
      mesh(root, new THREE.BoxGeometry(.145, .18, .105), packMaterial, side * .22, 1.14, -.27);
    }
    mesh(root, new THREE.BoxGeometry(.24, .18, .25), color, 0, 1.78, 0);
    mesh(root, new THREE.BoxGeometry(.52, .1, .34), packMaterial, 0, 1.02, 0);
    for (const side of [-1, 1]) mesh(root, new THREE.BoxGeometry(.115, .14, .12), new THREE.MeshStandardMaterial({ color: '#292d2a', roughness: .9 }), side * .15, .91, -.04);
  }
  mesh(root, new THREE.BoxGeometry(.2, .2, .2), skin, 0, 1.79, 0);
  const head = new THREE.Group();
  head.position.y = 2.05;
  root.add(head);
  mesh(head, new THREE.BoxGeometry(.46, .47, .42), skin, 0, 0, 0);
  // Cubic hair and facial pieces are procedural 3D meshes, not a flat sprite.
  mesh(head, new THREE.BoxGeometry(.54, .17, .5), hair, 0, .2, .018);
  mesh(head, new THREE.BoxGeometry(.49, .12, .08), hair, 0, .08, -.23);
  for (let spike = 0; spike < 7; spike++) { const x = (spike - 3) * .105, tuft = mesh(head, new THREE.BoxGeometry(.16, .17 + (spike % 3) * .035, .16), hair, x, .27, -.02 + (spike % 2) * .08); tuft.rotation.z = (spike - 3) * -.12; }
  for (const side of [-1, 1]) mesh(head, new THREE.BoxGeometry(.1, .24, .15), hair, side * .22, -.02, -.15);
  if (!hostile && skinStyle === 'Ranger') {
    const helmetMat = new THREE.MeshStandardMaterial({ color: style.helmet, roughness: .86 });
    mesh(head, new THREE.BoxGeometry(.56, .2, .54), helmetMat, 0, .16, .01);
    mesh(head, new THREE.BoxGeometry(.61, .07, .48), helmetMat, 0, .08, -.015);
  } else if (!hostile && skinStyle === 'Shadow') {
    mesh(head, new THREE.BoxGeometry(.56, .28, .54), new THREE.MeshStandardMaterial({ color: style.helmet, roughness: .97 }), 0, .09, .045);
    mesh(head, new THREE.BoxGeometry(.3, .12, .09), new THREE.MeshStandardMaterial({ color: style.mask, roughness: .94 }), 0, -.1, -.19);
  } else if (!hostile && skinStyle === 'Medic') {
    mesh(head, new THREE.BoxGeometry(.3, .12, .075), new THREE.MeshStandardMaterial({ color: '#39423c', roughness: .9 }), 0, -.1, -.2);
  } else if (!hostile && skinStyle === 'Nomad') {
    mesh(head, new THREE.BoxGeometry(.54, .08, .35), new THREE.MeshStandardMaterial({ color: '#735a3d', roughness: 1 }), 0, .14, -.01);
  }
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#eee6d3', roughness: .42 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: hostile ? '#f04a2e' : '#20252a', emissive: hostile ? '#8d170b' : '#000000', emissiveIntensity: .4 });
  for (const side of [-1, 1]) {
    mesh(head, new THREE.BoxGeometry(.075, .065, .035), eyeWhite, side * .083, .005, -.238);
    mesh(head, new THREE.BoxGeometry(.035, .045, .025), eyeDark, side * .083, .005, -.26);
    mesh(head, new THREE.BoxGeometry(.1, .035, .04), hair, side * .083, .07, -.24);
  }
  mesh(head, new THREE.BoxGeometry(.075, .09, .08), skin, 0, -.055, -.24);
  if (!hostile) {
    const faceCover = new THREE.MeshStandardMaterial({ color: style.mask, roughness: .92 });
    mesh(head, new THREE.BoxGeometry(.39, .19, .075), faceCover, 0, -.14, -.235);
    mesh(head, new THREE.BoxGeometry(.44, .075, .45), faceCover, 0, -.28, .005);
    const hoodShade = mesh(head, new THREE.BoxGeometry(.5, .13, .13), faceCover, 0, .11, -.18); hoodShade.rotation.x = -.22;
    if (markTexture) {
      const badgeMaterial = new THREE.MeshBasicMaterial({ map: markTexture, transparent: true, alphaTest: .12, side: THREE.DoubleSide, depthWrite: false });
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(.2, .24), badgeMaterial); badge.position.set(.155, -.04, -.257); badge.rotation.y = Math.PI; torso.add(badge);
      const backBadge = new THREE.Mesh(new THREE.PlaneGeometry(.26, .3), badgeMaterial); backBadge.position.set(0, .02, .237); torso.add(backBadge);
    }
  }
  const limbs = [];
  const legMaterial = hostile ? new THREE.MeshStandardMaterial({ color: '#322a24', roughness: 1 }) : trouserMaterial;
  const shoeMaterial = boots || new THREE.MeshStandardMaterial({ color: '#b6b0a2', roughness: .9 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * .17, 1.02, 0);
    root.add(leg);
    mesh(leg, new THREE.BoxGeometry(.23, .48, .27), legMaterial, 0, -.27, 0);
    const knee = new THREE.Group(); knee.position.y = -.49; leg.add(knee);
    mesh(knee, new THREE.BoxGeometry(.2, .4, .24), legMaterial, 0, -.2, 0);
    if (!hostile) mesh(knee, new THREE.BoxGeometry(.16, .12, .08), new THREE.MeshStandardMaterial({ color: style.vest, roughness: .9 }), 0, -.17, -.07);
    mesh(knee, new THREE.BoxGeometry(.19, .12, .31), shoeMaterial, 0, -.43, -.035);
    if (!hostile) { mesh(knee, new THREE.BoxGeometry(.205, .045, .33), new THREE.MeshStandardMaterial({ color: '#ece9f5', roughness: .72 }), 0, -.49, -.04); mesh(knee, new THREE.BoxGeometry(.18, .035, .12), new THREE.MeshStandardMaterial({ color: style.accent, roughness: .68, metalness: .08 }), 0, -.385, -.13); }
    limbs.push({ upper: leg, lower: knee, type: 'leg', side });
    const arm = new THREE.Group();
    arm.position.set(side * .39, 1.63, 0);
    root.add(arm);
    mesh(arm, new THREE.BoxGeometry(.2, .39, .23), color, 0, -.2, 0);
    const elbow = new THREE.Group(); elbow.position.y = -.39; arm.add(elbow);
    mesh(elbow, new THREE.BoxGeometry(.17, .35, .2), color, 0, -.17, 0);
    mesh(elbow, new THREE.BoxGeometry(.13, .12, .16), skin, 0, -.37, -.015);
    arm.userData.firstPersonVisible = true;
    limbs.push({ upper: arm, lower: elbow, type: 'arm', side });
    if (side === 1 && !hostile) {
      const gun = new THREE.Group(); gun.position.set(.005, -.4, -.025); gun.rotation.x = -.12; elbow.add(gun);
      const metal = new THREE.MeshStandardMaterial({ color: '#222a2b', metalness: .45, roughness: .62 });
      const wood = new THREE.MeshStandardMaterial({ color: '#705339', roughness: .85 });
      box(gun, [.13, .12, .38], metal, [0, -.02, -.16]);
      box(gun, [.075, .07, .48], metal, [0, .03, -.48]);
      box(gun, [.09, .18, .12], wood, [0, -.14, -.08]);
      const weapon = new THREE.Group();
      box(weapon, [.13, .12, .38], metal, [0, -.02, -.16]);
      box(weapon, [.075, .07, .48], metal, [0, .03, -.48]);
      box(weapon, [.09, .18, .12], wood, [0, -.14, -.08]);
      box(weapon, [.08, .18, .13], metal, [0, .1, -.22]);
      gun.add(weapon);
      root.userData.weaponMount = gun;
      root.userData.weaponModels = { rifle: weapon };
    }
  }
  root.userData.limbs = limbs;
  root.userData.torso = torso;
  root.userData.head = head;
  root.userData.skinStyle = skinStyle;
  root.userData.setFirstPerson = enabled => root.children.forEach(child => { child.visible = !enabled || Boolean(child.userData.firstPersonVisible); });
  return root;
}

export function createWolf({ fur = '#766957', eye = '#eab13a' } = {}) {
  const root = new THREE.Group();
  const bodyMat = proceduralMaterial(fur, { pattern: 'fur', scale: 1.9, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#342d27', roughness: .96 });
  const eyes = new THREE.MeshStandardMaterial({ color: eye, emissive: eye, emissiveIntensity: .55 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; };
  add(new THREE.BoxGeometry(.62, .55, 1.08), bodyMat, 0, .65, .04);
  const head = new THREE.Group(); head.position.set(0, .83, -.54); root.add(head);
  const h = new THREE.Mesh(new THREE.BoxGeometry(.48, .45, .48), bodyMat); h.castShadow = true; head.add(h);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(.29, .25, .38), bodyMat); snout.position.z = -.35; snout.castShadow = true; head.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(.13, .12, .08), dark); nose.position.z = -.56; head.add(nose);
  const jaw = new THREE.Group(); jaw.position.set(0, -.1, -.42); head.add(jaw);
  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(.26, .12, .3), dark); lowerJaw.position.z = -.08; lowerJaw.castShadow = true; jaw.add(lowerJaw);
  for (const side of [-1, 1]) { const fang = new THREE.Mesh(new THREE.ConeGeometry(.045, .13, 5), new THREE.MeshStandardMaterial({ color: '#e3d8bd', roughness: .78 })); fang.position.set(side * .085, .06, -.18); fang.rotation.x = Math.PI; jaw.add(fang); }
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(.14, .3, .14), dark); ear.position.set(side * .17, .29, -.02); ear.castShadow = true; head.add(ear);
    const e = new THREE.Mesh(new THREE.BoxGeometry(.07, .06, .04), eyes); e.position.set(side * .205, .035, -.25); head.add(e);
  }
  const legs = [];
  for (const x of [-.19, .19]) for (const z of [-.32, .42]) {
    const pivot = new THREE.Group(); pivot.position.set(x, .58, z); root.add(pivot);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .42, .16), bodyMat); leg.position.y = -.22; leg.castShadow = true; pivot.add(leg); legs.push({ pivot, phase: x * z > 0 ? 0 : Math.PI });
  }
  const tail = add(new THREE.BoxGeometry(.18, .18, .48), bodyMat, 0, .72, .58); tail.rotation.x = Math.PI / 2.7;
  root.userData.legs = legs; root.userData.head = head; root.userData.jaw = jaw;
  return root;
}

/** Distinct block-built hostile models share real arm and leg pivots for attack and gait poses. */
export function createMob({ type = 'zombie' } = {}) {
  const root = new THREE.Group(), limbs = [];
  const mat = (color, roughness = .92, emissive = null) => new THREE.MeshStandardMaterial({ color, roughness, ...(emissive ? { emissive, emissiveIntensity: .72 } : {}) });
  const skin = type === 'skeleton' ? mat('#d4cbb4') : type === 'creeper' ? mat('#5c9e36') : mat('#5f9072');
  const shirt = type === 'skeleton' ? mat('#514a45') : type === 'creeper' ? mat('#3f7d31') : mat('#314843');
  const trouser = type === 'skeleton' ? mat('#8f8979') : type === 'creeper' ? mat('#427b2e') : mat('#252b29');
  const bone = mat('#e1d7c2'), eye = mat('#ff593d', .36, '#a91608'), dark = mat('#17151a');
  const add = (parent, size, material, x, y, z) => { const part = new THREE.Mesh(new THREE.BoxGeometry(...size), material); part.position.set(x, y, z); part.castShadow = true; part.receiveShadow = true; parent.add(part); return part; };
  const head = new THREE.Group(); head.position.y = 2.02; root.add(head);
  if (type === 'creeper') {
    add(root, [.72, 1.25, .52], skin, 0, 1.15, 0);
    add(head, [.59, .58, .56], skin, 0, 0, 0);
    add(head, [.105, .15, .035], dark, -.14, .06, -.292); add(head, [.105, .15, .035], dark, .14, .06, -.292);
    add(head, [.27, .21, .04], dark, 0, -.16, -.293); add(head, [.09, .19, .045], skin, -.09, -.1, -.32); add(head, [.09, .19, .045], skin, .09, -.1, -.32);
    for (const side of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(side * .42, 1.55, 0); root.add(arm); add(arm, [.2, .4, .24], skin, 0, -.19, 0); const elbow = new THREE.Group(); elbow.position.y = -.38; arm.add(elbow); add(elbow, [.18, .3, .2], skin, 0, -.15, 0); limbs.push({ upper: arm, lower: elbow, type: 'arm', side }); }
    for (const side of [-1, 1]) for (const front of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(side * .22, .59, front * .16); root.add(leg); add(leg, [.23, .39, .23], skin, 0, -.19, 0); const knee = new THREE.Group(); knee.position.y = -.38; leg.add(knee); add(knee, [.22, .34, .22], skin, 0, -.17, 0); limbs.push({ upper: leg, lower: knee, type: 'leg', side: side * front }); }
  } else {
    add(root, [.62, .76, .4], type === 'skeleton' ? dark : shirt, 0, 1.35, 0);
    add(root, [.46, .24, .34], type === 'skeleton' ? bone : trouser, 0, .9, 0);
    if (type === 'skeleton') for (let rib = 0; rib < 4; rib++) add(root, [.58 - rib * .035, .075, .09], bone, 0, 1.55 - rib * .13, -.22);
    else { add(root, [.62, .14, .06], mat('#27372c'), 0, 1.28, -.24); add(root, [.16, .14, .06], mat('#659473'), -.17, 1.48, -.23); }
    if (type === 'skeleton') {
      add(head, [.5, .48, .46], bone, 0, 0, 0);
      add(head, [.13, .14, .045], dark, -.13, .035, -.24); add(head, [.13, .14, .045], dark, .13, .035, -.24);
      add(head, [.055, .05, .04], eye, -.13, .035, -.27); add(head, [.055, .05, .04], eye, .13, .035, -.27);
      add(head, [.11, .18, .08], bone, 0, -.16, -.2);
    } else {
      add(head, [.49, .5, .44], skin, 0, 0, 0); add(head, [.18, .06, .035], eye, -.11, .04, -.227); add(head, [.18, .06, .035], eye, .11, .04, -.227);
      add(head, [.36, .12, .06], mat('#35443c'), 0, -.15, -.23);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .16, .9, 0); root.add(leg); add(leg, [.23, .43, .25], type === 'skeleton' ? bone : trouser, 0, -.23, 0);
      const knee = new THREE.Group(); knee.position.y = -.43; leg.add(knee); add(knee, [.2, .42, .22], type === 'skeleton' ? bone : trouser, 0, -.21, 0); add(knee, [.2, .12, .32], dark, 0, -.43, -.04);
      limbs.push({ upper: leg, lower: knee, type: 'leg', side });
      const arm = new THREE.Group(); arm.position.set(side * .37, 1.62, 0); root.add(arm); add(arm, [.2, .45, .22], type === 'skeleton' ? bone : shirt, 0, -.21, 0);
      const elbow = new THREE.Group(); elbow.position.y = -.42; arm.add(elbow); add(elbow, [.18, .4, .2], type === 'skeleton' ? bone : skin, 0, -.2, 0); add(elbow, [.15, .13, .17], type === 'skeleton' ? bone : skin, 0, -.39, -.02);
      limbs.push({ upper: arm, lower: elbow, type: 'arm', side });
    }
  }
  root.userData.limbs = limbs; root.userData.head = head; root.userData.mobType = type;
  return root;
}

export function makeWeaponModel(kind) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#202729', metalness: .42, roughness: .62 });
  const wood = new THREE.MeshStandardMaterial({ color: '#77563a', roughness: .88 });
  const part = (size, material, x, y, z) => box(group, size, material, [x, y, z]);
  if (kind === 'knife') {
    part([.08, .09, .28], wood, 0, -.05, -.1); part([.035, .025, .35], metal, 0, .01, -.4);
  } else if (kind === 'pickaxe') {
    const head = new THREE.MeshStandardMaterial({ color: '#bdc7d0', metalness: .68, roughness: .34 });
    part([.1, .1, .72], wood, 0, -.02, -.26);
    part([.72, .13, .15], head, 0, .29, -.26);
    part([.2, .18, .16], head, -.26, .31, -.26);
    part([.14, .25, .16], head, .31, .29, -.26);
  } else if (kind === 'pistol') {
    const purple = new THREE.MeshStandardMaterial({ color: '#9b3dff', metalness: .58, roughness: .34 });
    part([.15, .15, .24], metal, 0, .02, -.13); part([.075, .075, .3], metal, 0, .055, -.38); part([.09, .22, .13], wood, 0, -.15, -.08);
    part([.13, .035, .1], purple, 0, .108, -.13); part([.035, .04, .25], metal, .055, .01, -.2);
  } else {
    const scale = kind === 'sniper' ? 1.35 : 1;
    const purple = new THREE.MeshStandardMaterial({ color: '#9a39ff', metalness: .52, roughness: .36 });
    const receiverLength = .46 * scale, barrelLength = kind === 'sniper' ? .84 : .67;
    part([.15, .15, receiverLength], metal, 0, -.02, -.2);
    part([.08, .075, barrelLength], metal, 0, .035, -.63 * scale);
    part([.18, .11, .28], metal, 0, -.03, -.52 * scale);
    part([.14, .08, .2], wood, 0, -.015, .14);
    part([.1, .22, .14], wood, 0, -.17, -.11);
    part([.07, .035, .38 * scale], purple, 0, .097, -.54 * scale);
    part([.08, .22, .16], metal, 0, -.19, -.32);
    part([.08, .14, .24], metal, 0, -.025, .19);
    part([.17, .055, .12], metal, 0, .12, -.26);
    if (kind === 'sniper') { part([.085, .095, .32], metal, 0, .15, -.37); part([.18, .14, .16], metal, 0, .16, -.38); part([.23, .035, .04], purple, 0, .235, -.38); }
    else { part([.09, .15, .12], metal, 0, .14, -.34); part([.19, .035, .24], purple, 0, .21, -.36); }
  }
  if (!['knife', 'pickaxe'].includes(kind)) {
    const muzzle = new THREE.Mesh(new THREE.OctahedronGeometry(.105, 0), new THREE.MeshBasicMaterial({ color: '#ffbd53', transparent: true, opacity: .92 }));
    muzzle.position.set(0, .03, kind === 'sniper' ? -1.25 : kind === 'pistol' ? -.47 : -.96); muzzle.visible = false; group.add(muzzle);
    const light = new THREE.PointLight('#ff8d33', 0, 2.3, 2); light.position.copy(muzzle.position); group.add(light);
    group.userData.muzzleFlash = muzzle; group.userData.muzzleLight = light;
  }
  return group;
}
