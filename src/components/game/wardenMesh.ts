import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
  type MeshStandardMaterialParameters,
} from "three";
import type { HeroId } from "@/game/types";

const matCache = new Map<string, MeshStandardMaterial>();

function mat(color: number, opts: Partial<MeshStandardMaterialParameters> = {}) {
  const key = `${color}_${opts.roughness ?? 0.78}_${opts.metalness ?? 0.08}_${opts.flatShading === false ? 0 : 1}_${opts.emissive ?? 0}_${opts.emissiveIntensity ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.78,
      metalness: opts.metalness ?? 0.08,
      flatShading: opts.flatShading ?? true,
      envMapIntensity: opts.envMapIntensity ?? 0.85,
      ...opts,
    });
    matCache.set(key, m);
  }
  return m;
}

function addOutline(target: Mesh, scale = 1.08, color = 0x0a1208) {
  const outline = new Mesh(
    target.geometry,
    new MeshBasicMaterial({ color, side: BackSide, depthWrite: false }),
  );
  outline.scale.setScalar(scale);
  outline.name = "outline";
  target.add(outline);
}

function addPart(mesh: Mesh, parent: Object3D, outlineScale?: number, outlineColor = 0x0a0806) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outlineScale) addOutline(mesh, outlineScale, outlineColor);
  parent.add(mesh);
  return mesh;
}

/** Layered fur / fold / plate teeth — same clump language as hunterscape Hunter. */
function addSpikes(
  parent: Object3D,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  count: number,
  length: number,
  tipRadius: number,
  a: MeshStandardMaterial,
  b: MeshStandardMaterial,
  c: MeshStandardMaterial,
  yawBias = 0,
) {
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + yawBias;
    const radJ = radius * (0.92 + (i % 4) * 0.035);
    const lenJ = length * (0.72 + (i % 5) * 0.08);
    const tipJ = tipRadius * (0.55 + (i % 3) * 0.08);
    const use = i % 4 === 0 ? b : i % 3 === 0 ? c : a;
    const spike = new Mesh(new ConeGeometry(tipJ, lenJ, 5), use);
    const lift = (i % 5) * 0.014;
    spike.position.set(cx + Math.cos(ang) * radJ, cy + lenJ * 0.2 + lift, cz + Math.sin(ang) * radJ);
    spike.rotation.z = -Math.cos(ang) * (0.48 + (i % 3) * 0.07);
    spike.rotation.x = Math.sin(ang) * (0.48 + (i % 2) * 0.09);
    spike.rotation.y = (i % 7) * 0.11;
    spike.castShadow = true;
    parent.add(spike);
    if (i % 2 === 0) {
      const strand = new Mesh(new ConeGeometry(tipJ * 0.55, lenJ * 0.72, 4), i % 4 === 0 ? c : b);
      const a2 = ang + 0.18;
      strand.position.set(
        cx + Math.cos(a2) * (radJ * 0.94),
        cy + lenJ * 0.12 + lift * 0.5,
        cz + Math.sin(a2) * (radJ * 0.94),
      );
      strand.rotation.z = -Math.cos(a2) * 0.55;
      strand.rotation.x = Math.sin(a2) * 0.55;
      strand.castShadow = true;
      parent.add(strand);
    }
  }
}

function hex(s: string) {
  return Number.parseInt(s.replace("#", ""), 16);
}

/** Uncached so idle/combat pulses do not rewrite shared kit materials. */
function liveGlow(color: number, intensity: number) {
  return new MeshStandardMaterial({
    color,
    roughness: 0.14,
    metalness: 0.22,
    flatShading: true,
    emissive: color,
    emissiveIntensity: intensity,
  });
}

const skinCache = new Map<string, MeshPhysicalMaterial>();

function skinMat(color: number, shade = false) {
  const key = `${color}_${shade ? 1 : 0}`;
  let m = skinCache.get(key);
  if (!m) {
    m = new MeshPhysicalMaterial({
      color,
      roughness: shade ? 0.64 : 0.48,
      metalness: 0.02,
      flatShading: false,
      sheen: 0.38,
      sheenColor: new Color(0xffc4a0),
      sheenRoughness: 0.55,
      clearcoat: 0.08,
      clearcoatRoughness: 0.68,
      envMapIntensity: 1.05,
      emissive: color,
      emissiveIntensity: 0.018,
    });
    skinCache.set(key, m);
  }
  return m;
}

export type WardenKit = {
  heavy: boolean;
  bigWep: boolean;
  accent: string;
};

type BodyMats = {
  cloth: MeshStandardMaterial;
  clothDark: MeshStandardMaterial;
  wrap: MeshStandardMaterial;
  wrapDark: MeshStandardMaterial;
  wrapMid: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  trimDark: MeshStandardMaterial;
  trimMid: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  metalBright: MeshStandardMaterial;
  accent: MeshStandardMaterial;
};

function addStrand(
  head: Object3D,
  hair: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  len: number,
  rx: number,
  ry = 0,
  rz = 0,
) {
  const strand = new Mesh(new BoxGeometry(0.01, len, 0.005), hair);
  strand.position.set(x, y, z);
  strand.rotation.set(rx, ry, rz);
  head.add(strand);
}

function addLock(
  head: Object3D,
  hair: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const lock = new Mesh(new SphereGeometry(0.05, 10, 8), hair);
  lock.scale.set(sx, sy, sz);
  lock.position.set(x, y, z);
  lock.rotation.set(rx, ry, rz);
  head.add(lock);
}

function addHunterHair(head: Object3D, hairCol: MeshStandardMaterial, id: HeroId) {
  const mid = mat(id === "mage" ? 0x3a2450 : id === "ranger" ? 0x3c2818 : 0x2a1c10, {
    roughness: 0.9,
    flatShading: false,
  });
  const cap = new Mesh(new SphereGeometry(0.13, 18, 14), hairCol);
  cap.position.set(0, 0.062, -0.018);
  cap.scale.set(1.12, 0.7, 1.08);
  head.add(cap);
  const crown = new Mesh(new SphereGeometry(0.1, 14, 12), mid);
  crown.position.set(0, 0.1, -0.01);
  crown.scale.set(1.05, 0.55, 0.95);
  head.add(crown);

  if (id === "fighter") {
    for (const [x, z, s] of [
      [-0.06, 0.06, 0.7],
      [0.05, 0.07, 0.62],
      [0, 0.02, 0.8],
      [-0.08, -0.04, 0.55],
      [0.08, -0.03, 0.58],
    ] as const) {
      addLock(head, hairCol, x, 0.1, z, s, 0.42, 0.7, -0.35);
    }
    addLock(head, mid, 0, 0.078, 0.1, 1.55, 0.28, 0.55, -0.5);
    for (const sx of [-1, 1] as const) {
      addLock(head, hairCol, sx * 0.11, 0.02, 0.02, 0.42, 0.85, 0.55);
      addLock(head, hairCol, sx * 0.108, -0.02, 0.04, 0.32, 0.7, 0.4);
      addStrand(head, mid, sx * 0.07, 0.09, 0.09, 0.07, -0.7, sx * 0.2, sx * 0.15);
    }
    for (const x of [-0.04, 0, 0.045] as const) {
      addStrand(head, hairCol, x, 0.095, 0.1, 0.055, -0.85, x * 2);
    }
  } else if (id === "ranger") {
    addLock(head, mid, 0.02, 0.1, 0.04, 1.15, 0.55, 0.85, -0.28);
    addLock(head, hairCol, -0.05, 0.092, 0.08, 0.95, 0.4, 0.7, -0.45);
    addLock(head, hairCol, 0.06, 0.088, 0.07, 0.8, 0.38, 0.62, -0.32, 0.2);
    addLock(head, mid, 0, 0.07, 0.11, 1.4, 0.26, 0.5, -0.55);
    for (const sx of [-1, 1] as const) {
      addLock(head, hairCol, sx * 0.108, 0.03, -0.01, 0.5, 1.05, 0.62);
      addLock(head, mid, sx * 0.1, -0.04, 0.03, 0.38, 0.95, 0.42);
    }
    addLock(head, hairCol, 0.02, 0.08, -0.08, 1.1, 0.5, 0.7);
    for (const x of [-0.05, -0.01, 0.04, 0.08] as const) {
      addStrand(head, x > 0 ? mid : hairCol, x, 0.1, 0.08, 0.06, -0.75, x * 1.5);
    }
  } else {
    addLock(head, mid, 0, 0.1, 0.02, 1.25, 0.6, 0.9, -0.2);
    addLock(head, hairCol, -0.04, 0.08, 0.1, 1.05, 0.32, 0.55, -0.4);
    addLock(head, mid, 0.05, 0.086, 0.09, 0.9, 0.3, 0.5, -0.35, 0.15);
    for (const sx of [-1, 1] as const) {
      addLock(head, hairCol, sx * 0.1, 0.02, -0.02, 0.55, 1.15, 0.7);
      addStrand(head, mid, sx * 0.04, 0.09, 0.1, 0.08, -0.6, sx * 0.2);
    }
    addStrand(head, hairCol, 0, 0.1, 0.09, 0.07, -0.8);
    const fall = new Mesh(new CapsuleGeometry(0.045, 0.22, 4, 8), hairCol);
    fall.position.set(-0.02, -0.08, -0.12);
    fall.rotation.x = 0.35;
    head.add(fall);
    const fall2 = new Mesh(new CapsuleGeometry(0.038, 0.2, 4, 8), mid);
    fall2.position.set(0.05, -0.12, -0.13);
    fall2.rotation.x = 0.48;
    fall2.rotation.z = 0.12;
    head.add(fall2);
    const fall3 = new Mesh(new CapsuleGeometry(0.032, 0.16, 4, 8), hairCol);
    fall3.position.set(0.08, -0.06, -0.08);
    fall3.rotation.x = 0.3;
    fall3.rotation.z = 0.25;
    head.add(fall3);
  }
}

/** Human hunter head — sculpted jaw, brow shelf, layered hair, readable eyes. */
function makeHunterHead(
  parent: Object3D,
  skin: MeshPhysicalMaterial,
  skinDark: MeshPhysicalMaterial,
  hairCol: MeshStandardMaterial,
  id: HeroId,
) {
  const head = new Group();
  head.name = "playerHead";
  head.position.set(0, 1.58, 0.02);
  head.rotation.x = -0.06;
  const fighter = id === "fighter";
  const ranger = id === "ranger";
  const blush = mat(fighter ? 0xb87860 : ranger ? 0xa86a50 : 0xc48870, { roughness: 0.62, flatShading: false });
  const lip = mat(fighter ? 0x8a4a40 : ranger ? 0x7a4034 : 0xa05858, { roughness: 0.48, flatShading: false });
  const socketMat = mat(0x1a100c, { roughness: 0.78, flatShading: false });

  const skull = new Mesh(new SphereGeometry(0.12, 24, 20), skin);
  skull.scale.set(fighter ? 1.05 : ranger ? 1.0 : 0.96, 1.14, 0.86);
  addPart(skull, head);
  const occiput = new Mesh(new SphereGeometry(0.1, 16, 14), skin);
  occiput.scale.set(0.98, 0.88, 0.92);
  occiput.position.set(0, 0.02, -0.055);
  head.add(occiput);
  const forehead = new Mesh(new SphereGeometry(0.1, 16, 12), skin);
  forehead.scale.set(1.08, 0.4, 0.52);
  forehead.position.set(0, 0.072, 0.055);
  head.add(forehead);
  const temples = new Mesh(new SphereGeometry(0.1, 14, 12), skinDark);
  temples.scale.set(1.12, 0.55, 0.62);
  temples.position.set(0, 0.03, 0.01);
  head.add(temples);

  const jawW = fighter ? 1.18 : ranger ? 1.04 : 0.92;
  const jaw = new Mesh(new SphereGeometry(0.086, 16, 12), skinDark);
  jaw.scale.set(jawW, 0.58, 0.82);
  jaw.position.set(0, -0.098, 0.028);
  head.add(jaw);
  const mandible = new Mesh(new BoxGeometry(fighter ? 0.16 : 0.13, 0.045, 0.07), skinDark);
  mandible.position.set(0, -0.128, 0.06);
  head.add(mandible);
  const chin = new Mesh(new SphereGeometry(fighter ? 0.04 : 0.032, 12, 10), skinDark);
  chin.position.set(0, -0.15, 0.1);
  chin.scale.set(1.2, 0.68, 0.92);
  head.add(chin);

  if (id !== "mage") {
    const stubble = new Mesh(
      new SphereGeometry(0.072, 12, 8),
      mat(fighter ? 0x3a281c : 0x4a3224, { roughness: 0.97, flatShading: false }),
    );
    stubble.scale.set(1.28, 0.3, 0.72);
    stubble.position.set(0, -0.122, 0.1);
    head.add(stubble);
  }

  for (const sx of [-1, 1] as const) {
    const zygoma = new Mesh(new SphereGeometry(0.046, 12, 10), skinDark);
    zygoma.scale.set(0.72, 1.08, 0.78);
    zygoma.position.set(sx * (fighter ? 0.092 : 0.084), -0.018, 0.078);
    head.add(zygoma);
    const apple = new Mesh(new SphereGeometry(0.03, 10, 8), blush);
    apple.scale.set(0.85, 0.7, 0.55);
    apple.position.set(sx * 0.07, -0.04, 0.1);
    head.add(apple);
    const fold = new Mesh(new SphereGeometry(0.022, 8, 6), skinDark);
    fold.scale.set(0.9, 0.35, 0.55);
    fold.position.set(sx * 0.042, -0.072, 0.118);
    fold.rotation.z = sx * 0.35;
    head.add(fold);
  }

  const browShelf = new Mesh(new BoxGeometry(0.15, 0.018, 0.04), skinDark);
  browShelf.position.set(0, 0.058, 0.112);
  browShelf.rotation.x = -0.18;
  head.add(browShelf);

  const bridge = new Mesh(new CylinderGeometry(0.011, 0.015, 0.055, 8), skinDark);
  bridge.rotation.x = 0.42;
  bridge.position.set(0, 0.02, 0.13);
  head.add(bridge);
  const nose = new Mesh(new ConeGeometry(0.02, 0.064, 10), skinDark);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.004, 0.168);
  head.add(nose);
  const tip = new Mesh(new SphereGeometry(0.016, 12, 10), skin);
  tip.position.set(0, -0.028, 0.19);
  head.add(tip);
  for (const sx of [-1, 1] as const) {
    const wing = new Mesh(new SphereGeometry(0.012, 8, 6), skinDark);
    wing.position.set(sx * 0.012, -0.03, 0.168);
    head.add(wing);
    const nostril = new Mesh(new SphereGeometry(0.005, 6, 5), mat(0x2a1814, { roughness: 0.9 }));
    nostril.position.set(sx * 0.008, -0.036, 0.176);
    head.add(nostril);
  }
  const philtrum = new Mesh(new CylinderGeometry(0.004, 0.005, 0.028, 6), skinDark);
  philtrum.position.set(0, -0.062, 0.15);
  head.add(philtrum);

  const irisCol = id === "mage" ? 0x5a3c98 : id === "ranger" ? 0x3a5a38 : 0x4a3220;
  for (const sx of [-1, 1] as const) {
    const brow = new Mesh(new BoxGeometry(0.052, 0.01, 0.016), hairCol);
    brow.position.set(sx * 0.048, 0.058, 0.128);
    brow.rotation.z = sx * -0.16;
    brow.rotation.x = -0.12;
    head.add(brow);
    const browHair = new Mesh(new SphereGeometry(0.018, 8, 6), hairCol);
    browHair.scale.set(1.7, 0.28, 0.5);
    browHair.position.set(sx * 0.048, 0.062, 0.122);
    browHair.rotation.z = sx * -0.18;
    head.add(browHair);

    const socket = new Mesh(new SphereGeometry(0.032, 12, 10), socketMat);
    socket.scale.set(1.12, 0.7, 0.48);
    socket.position.set(sx * 0.046, 0.02, 0.108);
    head.add(socket);
    const lid = new Mesh(new SphereGeometry(0.028, 12, 8), skin);
    lid.scale.set(1.2, 0.22, 0.48);
    lid.position.set(sx * 0.046, 0.038, 0.13);
    head.add(lid);
    const crease = new Mesh(new SphereGeometry(0.02, 8, 6), skinDark);
    crease.scale.set(1.3, 0.14, 0.4);
    crease.position.set(sx * 0.046, 0.046, 0.126);
    head.add(crease);
    const lidLow = new Mesh(new SphereGeometry(0.026, 10, 8), skinDark);
    lidLow.scale.set(1.15, 0.18, 0.44);
    lidLow.position.set(sx * 0.046, 0.004, 0.13);
    head.add(lidLow);
    const sclera = new Mesh(
      new SphereGeometry(0.026, 14, 12),
      mat(0xf7f1ea, { roughness: 0.18, metalness: 0.02, flatShading: false, emissive: 0xf4eee6, emissiveIntensity: 0.18 }),
    );
    sclera.scale.set(1.08, 0.82, 0.72);
    sclera.position.set(sx * 0.046, 0.02, 0.148);
    head.add(sclera);
    const iris = new Mesh(
      new SphereGeometry(0.015, 14, 12),
      mat(irisCol, { roughness: 0.2, flatShading: false, emissive: irisCol, emissiveIntensity: id === "mage" ? 0.55 : 0.22 }),
    );
    iris.position.set(sx * 0.046, 0.02, 0.164);
    head.add(iris);
    const pupil = new Mesh(new SphereGeometry(0.007, 8, 6), mat(0x080604, { flatShading: false }));
    pupil.position.set(sx * 0.046, 0.02, 0.174);
    head.add(pupil);
    const hl = new Mesh(new SphereGeometry(0.0048, 6, 5), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.1 }));
    hl.position.set(sx * 0.041, 0.027, 0.178);
    head.add(hl);
    const lash = new Mesh(new BoxGeometry(0.048, 0.004, 0.006), hairCol);
    lash.position.set(sx * 0.046, 0.04, 0.158);
    lash.rotation.z = sx * -0.08;
    head.add(lash);
    const caruncle = new Mesh(new SphereGeometry(0.004, 6, 5), blush);
    caruncle.position.set(sx * 0.034, 0.018, 0.148);
    head.add(caruncle);

    const helix = new Mesh(new SphereGeometry(0.03, 10, 8), skin);
    helix.scale.set(0.4, 1.22, 0.62);
    helix.position.set(sx * 0.126, 0.008, -0.012);
    helix.rotation.z = sx * 0.14;
    helix.rotation.y = sx * -0.18;
    head.add(helix);
    const lobe = new Mesh(new SphereGeometry(0.014, 8, 6), skinDark);
    lobe.position.set(sx * 0.122, -0.032, 0);
    head.add(lobe);
    const canal = new Mesh(new SphereGeometry(0.008, 6, 5), socketMat);
    canal.position.set(sx * 0.118, 0.002, 0.006);
    head.add(canal);
    if (ranger) {
      addLock(head, hairCol, sx * 0.112, -0.028, 0.012, 0.38, 1.15, 0.4);
    }
  }

  const mouth = new Mesh(new SphereGeometry(0.034, 8, 6), mat(0x3a1816, { roughness: 0.7 }));
  mouth.scale.set(1.28, 0.22, 0.48);
  mouth.position.set(0, -0.102, 0.13);
  head.add(mouth);
  const lipUp = new Mesh(new SphereGeometry(0.03, 8, 6), lip);
  lipUp.scale.set(1.22, 0.2, 0.46);
  lipUp.position.set(0, -0.092, 0.14);
  head.add(lipUp);
  const cupid = new Mesh(new SphereGeometry(0.01, 6, 5), lip);
  cupid.scale.set(1.4, 0.45, 0.6);
  cupid.position.set(0, -0.086, 0.146);
  head.add(cupid);
  const lipLow = new Mesh(new SphereGeometry(0.028, 8, 6), skin);
  lipLow.scale.set(1.12, 0.2, 0.44);
  lipLow.position.set(0, -0.114, 0.138);
  head.add(lipLow);

  if (fighter) {
    const scar = new Mesh(new BoxGeometry(0.072, 0.004, 0.005), mat(0x8a5a48, { roughness: 0.9 }));
    scar.position.set(-0.048, 0.04, 0.15);
    scar.rotation.z = 0.42;
    head.add(scar);
  }

  addHunterHair(head, hairCol, id);

  parent.add(head);
  const neck = new Mesh(new CapsuleGeometry(0.052, 0.1, 6, 10), skin);
  neck.position.set(0, 1.48, 0.02);
  addPart(neck, parent);
  const throat = new Mesh(new SphereGeometry(0.026, 8, 6), skinDark);
  throat.position.set(0, 1.445, 0.058);
  throat.scale.set(0.95, 0.62, 0.72);
  parent.add(throat);
  for (const sx of [-1, 1] as const) {
    const trap = new Mesh(new SphereGeometry(0.05, 10, 8), skinDark);
    trap.scale.set(0.85, 0.55, 0.7);
    trap.position.set(sx * 0.08, 1.42, -0.01);
    parent.add(trap);
  }
  return head;
}

function makeHunterLeg(side: number, m: BodyMats, opts: { bootFur: boolean; greave?: boolean }) {
  const leg = new Group();
  const thigh = new Mesh(new CapsuleGeometry(0.09, 0.28, 5, 10), m.cloth);
  thigh.position.set(0, 0.55, 0);
  addPart(thigh, leg);

  const shin = new Mesh(new CapsuleGeometry(0.078, 0.18, 5, 10), m.clothDark);
  shin.position.set(0, 0.3, 0.02);
  addPart(shin, leg);

  const boot = new Mesh(new CylinderGeometry(0.115, 0.13, 0.38, 6), opts.greave ? m.wrap : m.wrap);
  boot.position.set(0, 0.2, 0.02);
  addPart(boot, leg, 1.06);

  const foot = new Mesh(new BoxGeometry(0.16, 0.09, 0.26), m.wrapDark);
  foot.position.set(0, 0.05, 0.08);
  addPart(foot, leg);
  const toe = new Mesh(new SphereGeometry(0.07, 10, 8), m.wrap);
  toe.scale.set(1.05, 0.5, 1.15);
  toe.position.set(0, 0.055, 0.2);
  leg.add(toe);
  const sole = new Mesh(new BoxGeometry(0.18, 0.045, 0.32), mat(0x120c08, { roughness: 0.95 }));
  sole.position.set(0, 0.02, 0.08);
  leg.add(sole);

  for (let i = 0; i < 3; i++) {
    const strap = new Mesh(new TorusGeometry(0.125, 0.018, 4, 10), opts.greave ? m.metal : m.wrapMid);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0.12 + i * 0.1, 0.02);
    leg.add(strap);
  }

  if (opts.greave) {
    const plate = new Mesh(new BoxGeometry(0.16, 0.26, 0.1), m.metalBright);
    plate.position.set(0, 0.3, 0.07);
    addPart(plate, leg, 1.04);
    const knee = new Mesh(new SphereGeometry(0.08, 6, 5), m.metal);
    knee.position.set(0, 0.42, 0.08);
    addPart(knee, leg);
  }

  leg.name = side < 0 ? "legL" : "legR";

  if (opts.bootFur) {
    addSpikes(leg, 0, 0.36, 0.02, 0.125, 14, 0.1, 0.024, m.trim, m.trimDark, m.trimMid);
    addSpikes(leg, 0, 0.08, 0.04, 0.115, 12, 0.08, 0.02, m.trim, m.trimDark, m.trimMid);
  }

  leg.position.x = side * 0.16;
  return leg;
}

function makeHunterArm(
  side: number,
  m: BodyMats,
  skin: MeshStandardMaterial | MeshPhysicalMaterial,
  opts: { sleeve: "bare" | "steel" | "cloth"; gauntletFur: boolean },
) {
  const arm = new Group();
  arm.name = side < 0 ? "armL" : "armR";

  const upperMat = opts.sleeve === "bare" ? skin : opts.sleeve === "steel" ? m.metal : m.cloth;
  const upper = new Mesh(new CapsuleGeometry(0.072, 0.2, 5, opts.sleeve === "bare" ? 12 : 8), upperMat);
  upper.position.set(0, 0, 0);
  upper.rotation.z = side * 0.35;
  addPart(upper, arm, opts.sleeve === "bare" ? undefined : 1.04);
  const elbow = new Mesh(new SphereGeometry(0.058, 12, 10), upperMat);
  elbow.position.set(side * 0.07, -0.16, 0.01);
  arm.add(elbow);

  const cuff = new Mesh(new CylinderGeometry(0.088, 0.096, 0.07, 8), opts.sleeve === "cloth" ? m.wrapMid : m.cloth);
  cuff.position.set(side * -0.02, 0.12, 0);
  cuff.rotation.z = side * 0.35;
  arm.add(cuff);

  const gauntlet = new Mesh(
    new CapsuleGeometry(0.07, 0.16, 4, 8),
    opts.sleeve === "steel" ? m.metalBright : opts.sleeve === "cloth" ? m.wrap : m.wrap,
  );
  gauntlet.position.set(side * 0.12, -0.3, 0.02);
  gauntlet.rotation.z = side * 0.2;
  addPart(gauntlet, arm, 1.05);

  for (let i = 0; i < 2; i++) {
    const s = new Mesh(new TorusGeometry(0.11, 0.015, 4, 8), opts.sleeve === "steel" ? m.accent : m.wrapDark);
    s.rotation.x = Math.PI / 2;
    s.position.set(side * 0.12, -0.22 - i * 0.1, 0.02);
    arm.add(s);
  }

  if (opts.gauntletFur) {
    const furGroup = new Group();
    furGroup.position.set(side * 0.08, -0.12, 0.02);
    addSpikes(furGroup, 0, 0, 0, 0.105, 14, 0.095, 0.022, m.trim, m.trimDark, m.trimMid);
    arm.add(furGroup);
  }

  const hand = new Group();
  hand.position.set(side * 0.16, -0.46, 0.04);
  const palm = new Mesh(new BoxGeometry(0.072, 0.055, 0.082), skin);
  addPart(palm, hand);
  const heel = new Mesh(new SphereGeometry(0.028, 8, 6), skin);
  heel.scale.set(1.15, 0.7, 0.9);
  heel.position.set(0, 0.012, -0.01);
  hand.add(heel);
  for (let i = 0; i < 4; i++) {
    const curl = 0.2 + i * 0.05;
    const finger = new Mesh(new CapsuleGeometry(0.007, 0.032, 3, 6), skin);
    finger.position.set((i - 1.5) * 0.016, -0.046, 0.014);
    finger.rotation.x = curl;
    hand.add(finger);
    const tip = new Mesh(new CapsuleGeometry(0.006, 0.018, 3, 6), skin);
    tip.position.set((i - 1.5) * 0.016, -0.074, 0.026);
    tip.rotation.x = curl + 0.3;
    hand.add(tip);
    const nail = new Mesh(new BoxGeometry(0.008, 0.01, 0.004), mat(0xe8d8c8, { roughness: 0.35, metalness: 0.08 }));
    nail.position.set((i - 1.5) * 0.016, -0.084, 0.036);
    nail.rotation.x = curl + 0.35;
    hand.add(nail);
    const knuckle = new Mesh(new SphereGeometry(0.009, 6, 5), skin);
    knuckle.position.set((i - 1.5) * 0.016, -0.024, 0.03);
    hand.add(knuckle);
  }
  const thumb = new Mesh(new CapsuleGeometry(0.008, 0.024, 3, 6), skin);
  thumb.position.set(side * 0.04, -0.014, 0.026);
  thumb.rotation.z = side * 0.62;
  thumb.rotation.x = 0.35;
  hand.add(thumb);
  arm.add(hand);

  arm.position.set(side * 0.36, 1.28, 0);
  return arm;
}

function addHunterHips(g: Group, m: BodyMats, longSkirt = false) {
  const hips = new Mesh(new CylinderGeometry(0.2, 0.24, 0.2, 8), m.wrap);
  hips.position.y = 0.78;
  addPart(hips, g);

  for (const [z, ry] of [
    [0.16, 0],
    [-0.16, Math.PI],
  ] as const) {
    const flap = new Mesh(new BoxGeometry(0.28, longSkirt ? 0.38 : 0.22, 0.06), m.wrapDark);
    flap.position.set(0, longSkirt ? 0.6 : 0.68, z);
    flap.rotation.y = ry;
    addPart(flap, g);
  }
  for (const sx of [-1, 1] as const) {
    const flap = new Mesh(new BoxGeometry(0.06, longSkirt ? 0.34 : 0.2, 0.18), m.wrapMid);
    flap.position.set(sx * 0.22, longSkirt ? 0.62 : 0.68, 0);
    addPart(flap, g);
  }
}

function addHunterTorso(
  g: Group,
  m: BodyMats,
  opts: { xStraps: boolean; chestKind: "leather" | "plate" | "cloth" },
) {
  const torso = new Group();
  torso.name = "playerTorso";
  const rib = new Mesh(new CylinderGeometry(0.17, 0.23, 0.5, 12), m.wrap);
  rib.position.y = 1.12;
  addPart(rib, torso, 1.05, 0x0a0806);

  if (opts.chestKind === "plate") {
    for (const sx of [-1, 1] as const) {
      const pec = new Mesh(new SphereGeometry(0.11, 12, 10), sx < 0 ? m.metalBright : m.metal);
      pec.scale.set(0.85, 1.05, 0.55);
      pec.position.set(sx * 0.09, 1.24, 0.14);
      addPart(pec, torso);
      const clav = new Mesh(new CapsuleGeometry(0.016, 0.12, 4, 8), m.metalBright);
      clav.position.set(sx * 0.1, 1.4, 0.08);
      clav.rotation.z = sx * -0.28;
      clav.rotation.x = -0.15;
      torso.add(clav);
    }
    const belly = new Mesh(new BoxGeometry(0.28, 0.14, 0.1), m.wrapMid);
    belly.position.set(0, 1.0, 0.13);
    addPart(belly, torso);
    const sternum = new Mesh(new BoxGeometry(0.04, 0.22, 0.03), m.metalBright);
    sternum.position.set(0, 1.22, 0.2);
    torso.add(sternum);
    for (const y of [1.32, 1.16, 1.02] as const) {
      const seam = new Mesh(new BoxGeometry(0.3, 0.008, 0.012), m.wrapDark);
      seam.position.set(0, y, 0.2);
      torso.add(seam);
    }
  } else if (opts.chestKind === "cloth") {
    const robe = new Mesh(new BoxGeometry(0.32, 0.3, 0.13), m.wrapMid);
    robe.position.set(0, 1.2, 0.12);
    addPart(robe, torso);
    for (const [x, y, z, ry] of [
      [-0.08, 1.18, 0.18, 0.2],
      [0.1, 1.12, 0.17, -0.25],
      [0.02, 1.28, 0.16, 0.08],
    ] as const) {
      const fold = new Mesh(new BoxGeometry(0.08, 0.2, 0.03), m.wrap);
      fold.position.set(x, y, z);
      fold.rotation.y = ry;
      torso.add(fold);
    }
    for (const sx of [-1, 1] as const) {
      const clav = new Mesh(new CapsuleGeometry(0.014, 0.1, 4, 8), m.wrapMid);
      clav.position.set(sx * 0.1, 1.4, 0.08);
      clav.rotation.z = sx * -0.28;
      torso.add(clav);
    }
  } else {
    const chestPlate = new Mesh(new BoxGeometry(0.32, 0.24, 0.12), m.wrapMid);
    chestPlate.position.set(0, 1.2, 0.13);
    addPart(chestPlate, torso);
    for (const sx of [-1, 1] as const) {
      const pec = new Mesh(new SphereGeometry(0.09, 10, 8), m.wrap);
      pec.scale.set(0.8, 0.95, 0.5);
      pec.position.set(sx * 0.085, 1.24, 0.15);
      torso.add(pec);
      const clav = new Mesh(new CapsuleGeometry(0.014, 0.11, 4, 8), m.trim);
      clav.position.set(sx * 0.1, 1.4, 0.08);
      clav.rotation.z = sx * -0.28;
      torso.add(clav);
    }
  }

  const undershirt = new Mesh(new CylinderGeometry(0.18, 0.2, 0.1, 10), m.cloth);
  undershirt.position.set(0, 1.38, 0.02);
  torso.add(undershirt);

  const belt = new Mesh(new CylinderGeometry(0.29, 0.29, 0.1, 10), m.wrapDark);
  belt.position.y = 0.88;
  addPart(belt, torso);
  const beltBuckle = new Mesh(new BoxGeometry(0.14, 0.1, 0.07), m.metalBright);
  beltBuckle.position.set(0, 0.88, 0.3);
  torso.add(beltBuckle);

  if (opts.xStraps) {
    const makeStrap = (rotZ: number, z: number) => {
      const strap = new Mesh(new BoxGeometry(0.08, 0.56, 0.04), m.wrapDark);
      strap.position.set(0, 1.18, z);
      strap.rotation.z = rotZ;
      torso.add(strap);
    };
    makeStrap(0.55, 0.26);
    makeStrap(-0.55, 0.26);
    makeStrap(0.55, -0.22);
    makeStrap(-0.55, -0.22);

    const bucklePad = new Mesh(new BoxGeometry(0.16, 0.14, 0.045), m.wrapDark);
    bucklePad.position.set(0, 1.2, 0.3);
    torso.add(bucklePad);
    const chestBuckle = new Mesh(new OctahedronGeometry(0.1, 0), m.metalBright);
    chestBuckle.scale.set(1.35, 1.05, 0.55);
    chestBuckle.position.set(0, 1.2, 0.36);
    torso.add(chestBuckle);
    const facet = new Mesh(
      new OctahedronGeometry(0.055, 0),
      mat(0xffffff, { metalness: 0.98, roughness: 0.08, emissive: 0xd0e0f0, emissiveIntensity: 0.55 }),
    );
    facet.scale.set(1.2, 0.9, 0.4);
    facet.position.set(0, 1.2, 0.4);
    torso.add(facet);
    const ring = new Mesh(new TorusGeometry(0.058, 0.014, 4, 10), m.metalBright);
    ring.position.set(0, 1.2, 0.385);
    torso.add(ring);
    for (const [dx, dy] of [
      [-0.07, 0.06],
      [0.07, 0.06],
      [-0.07, -0.06],
      [0.07, -0.06],
    ] as const) {
      const rivet = new Mesh(new SphereGeometry(0.018, 5, 4), m.metalBright);
      rivet.position.set(dx, 1.2 + dy, 0.34);
      torso.add(rivet);
    }
  } else {
    const gem = new Mesh(new OctahedronGeometry(0.08, 0), m.accent);
    gem.position.set(0, 1.18, 0.3);
    torso.add(gem);
  }
  g.add(torso);
  return torso;
}

function addHunterShoulders(
  g: Group,
  m: BodyMats,
  kind: "leather" | "steel" | "cloth",
) {
  for (const sx of [-1, 1] as const) {
    const pad = new Mesh(
      new BoxGeometry(kind === "steel" ? 0.28 : 0.16, kind === "steel" ? 0.16 : 0.09, kind === "steel" ? 0.26 : 0.17),
      kind === "steel" ? m.metalBright : kind === "cloth" ? m.wrapMid : m.wrapMid,
    );
    pad.position.set(sx * (kind === "steel" ? 0.3 : 0.24), 1.42, 0.02);
    pad.rotation.z = sx * -0.22;
    addPart(pad, g, 1.05);
    const pad2 = new Mesh(
      new BoxGeometry(kind === "steel" ? 0.2 : 0.12, kind === "steel" ? 0.1 : 0.07, kind === "steel" ? 0.2 : 0.14),
      kind === "steel" ? m.metal : m.wrapDark,
    );
    pad2.position.set(sx * (kind === "steel" ? 0.38 : 0.28), 1.34, 0.04);
    pad2.rotation.z = sx * -0.32;
    addPart(pad2, g);
    const ring = new Mesh(new TorusGeometry(0.035, 0.01, 4, 8), kind === "cloth" ? m.accent : m.metal);
    ring.position.set(sx * 0.2, 1.38, 0.12);
    g.add(ring);
  }
}

function addCommsCollar(g: Group, m: BodyMats) {
  const collarBase = new Mesh(new TorusGeometry(0.2, 0.055, 6, 12), m.metal);
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.set(0, 1.4, 0);
  collarBase.scale.set(1.18, 1.02, 0.92);
  addPart(collarBase, g);
  const yoke = new Mesh(new BoxGeometry(0.34, 0.08, 0.16), m.wrapDark);
  yoke.position.set(0, 1.38, 0.14);
  addPart(yoke, g);
  const bead = new Mesh(new BoxGeometry(0.16, 0.03, 0.04), m.accent);
  bead.position.set(0, 1.4, 0.22);
  g.add(bead);
  for (const sx of [-1, 1] as const) {
    const pod = new Mesh(new BoxGeometry(0.08, 0.1, 0.07), m.metalBright);
    pod.position.set(sx * 0.26, 1.4, 0.04);
    addPart(pod, g);
    const pip = new Mesh(new SphereGeometry(0.018, 6, 4), m.accent);
    pip.position.set(sx * 0.26, 1.44, 0.08);
    g.add(pip);
    const aerial = new Mesh(new CylinderGeometry(0.006, 0.008, 0.18, 5), m.metal);
    aerial.position.set(sx * 0.3, 1.52, -0.02);
    aerial.rotation.z = sx * -0.28;
    g.add(aerial);
  }
}

function addSteelGorget(g: Group, m: BodyMats) {
  const collarBase = new Mesh(new TorusGeometry(0.22, 0.07, 6, 12), m.metal);
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.set(0, 1.42, 0);
  collarBase.scale.set(1.15, 1.02, 0.95);
  addPart(collarBase, g, 1.05);
  const plate = new Mesh(new BoxGeometry(0.28, 0.1, 0.16), m.metalBright);
  plate.position.set(0, 1.4, 0.16);
  addPart(plate, g);
  addSpikes(g, 0, 1.44, 0, 0.24, 16, 0.1, 0.02, m.metal, m.wrapDark, m.metalBright);
  for (const sx of [-1, 1] as const) {
    const drape = new Mesh(new ConeGeometry(0.08, 0.22, 5), m.metal);
    drape.position.set(sx * 0.32, 1.28, 0);
    drape.rotation.z = sx * 0.65;
    drape.rotation.x = -0.22;
    addPart(drape, g);
  }
}

function addClothCowl(g: Group, m: BodyMats) {
  const collarBase = new Mesh(new TorusGeometry(0.22, 0.08, 6, 14), m.wrapMid);
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.set(0, 1.36, -0.06);
  collarBase.scale.set(1.18, 1.0, 0.88);
  addPart(collarBase, g);
  addSpikes(g, 0, 1.32, -0.1, 0.2, 8, 0.08, 0.016, m.trim, m.trimDark, m.trimMid);
  addSpikes(g, 0, 1.28, -0.14, 0.16, 6, 0.07, 0.014, m.trim, m.trimDark, m.trimMid, 0.25);
  for (const sx of [-1, 1] as const) {
    const drape = new Mesh(new ConeGeometry(0.12, 0.4, 5), m.wrapDark);
    drape.position.set(sx * 0.34, 1.16, -0.04);
    drape.rotation.z = sx * 0.7;
    drape.rotation.x = -0.28;
    addPart(drape, g);
    const lining = new Mesh(new ConeGeometry(0.08, 0.28, 4), m.trimMid);
    lining.position.set(sx * 0.38, 1.1, 0.02);
    lining.rotation.z = sx * 0.8;
    lining.rotation.x = -0.18;
    addPart(lining, g);
  }
}

function addFighterKit(armR: Group, armL: Group, kit: WardenKit, m: BodyMats) {
  const blade = kit.bigWep ? 1.16 : 0.94;
  const ion = mat(0xb8e6ff, { metalness: 0.15, roughness: 0.08, emissive: 0x6ad0ff, emissiveIntensity: 1.35 });
  const sword = new Group();
  sword.name = "wep";
  sword.position.set(0.22, -0.34, 0.28);
  sword.rotation.set(0.15, 0.35, -1.15);
  const grip = new Mesh(new CylinderGeometry(0.02, 0.028, 0.2, 7), m.wrapDark);
  grip.rotation.z = Math.PI / 2;
  sword.add(grip);
  const emitter = new Mesh(new BoxGeometry(0.12, 0.07, 0.07), m.metal);
  emitter.position.x = 0.08;
  addPart(emitter, sword);
  const vents = new Mesh(new BoxGeometry(0.08, 0.09, 0.02), m.accent);
  vents.position.set(0.08, 0, 0.04);
  sword.add(vents);
  const pommel = new Mesh(new OctahedronGeometry(0.038, 0), m.accent);
  pommel.position.x = -0.12;
  sword.add(pommel);
  const guard = new Mesh(new BoxGeometry(0.04, 0.18, 0.08), m.metalBright);
  guard.position.x = 0.14;
  sword.add(guard);
  const bladeM = new Mesh(new BoxGeometry(blade, 0.078, 0.02), ion);
  bladeM.position.x = 0.16 + blade / 2;
  addPart(bladeM, sword);
  const core = new Mesh(new BoxGeometry(blade * 0.92, 0.028, 0.01), liveGlow(0xffffff, 1.6));
  core.name = "wepGlow";
  core.position.set(0.16 + blade / 2, 0, 0.01);
  sword.add(core);
  const tip = new Mesh(new ConeGeometry(0.028, 0.14, 5), ion);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.16 + blade + 0.05;
  sword.add(tip);
  armR.add(sword);

  const shield = new Group();
  shield.position.set(-0.22, -0.12, 0.28);
  shield.rotation.y = 0.28;
  const projector = new Mesh(new BoxGeometry(0.08, 0.16, 0.12), m.metal);
  addPart(projector, shield);
  const face = new Mesh(new CylinderGeometry(0.28, 0.3, 0.04, 6), m.metalBright);
  face.rotation.z = Math.PI / 2;
  face.position.x = 0.06;
  addPart(face, shield, 1.04);
  const pane = new Mesh(
    new CylinderGeometry(0.22, 0.24, 0.02, 6),
    mat(0x6ad0ff, { metalness: 0.2, roughness: 0.12, emissive: 0x3aa8d0, emissiveIntensity: 0.85 }),
  );
  pane.name = "shieldGlow";
  pane.rotation.z = Math.PI / 2;
  pane.position.x = 0.08;
  shield.add(pane);
  const rim = new Mesh(new TorusGeometry(0.24, 0.018, 5, 6), m.accent);
  rim.rotation.y = Math.PI / 2;
  rim.position.x = 0.08;
  shield.add(rim);
  for (const [oy, oz] of [
    [0.1, 0],
    [-0.1, 0.08],
    [-0.1, -0.08],
  ] as const) {
    const cell = new Mesh(new CylinderGeometry(0.05, 0.05, 0.016, 6), m.accent);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0.09, oy, oz);
    shield.add(cell);
  }
  const boss = new Mesh(new SphereGeometry(0.045, 7, 5), m.accent);
  boss.position.x = 0.1;
  shield.add(boss);
  armL.add(shield);
}

function addRangerKit(armR: Group, kit: WardenKit, m: BodyMats) {
  const body = kit.bigWep ? 0.98 : 0.78;
  const rifle = new Group();
  rifle.name = "wep";
  rifle.position.set(0.14, -0.28, 0.32);
  rifle.rotation.set(0.35, 0.55, 0.12);
  const stock = new Mesh(new BoxGeometry(0.05, 0.08, 0.18), m.wrapDark);
  stock.position.z = -body * 0.46;
  addPart(stock, rifle);
  const rec = new Mesh(new BoxGeometry(0.075, 0.07, body), mat(0x14181e, { metalness: 0.78, roughness: 0.22 }));
  addPart(rec, rifle);
  const rail = new Mesh(new BoxGeometry(0.03, 0.02, body * 0.7), m.metalBright);
  rail.position.set(0, 0.048, 0.04);
  rifle.add(rail);
  const handguard = new Mesh(new BoxGeometry(0.06, 0.05, body * 0.42), m.metal);
  handguard.position.z = body * 0.22;
  rifle.add(handguard);
  const barrel = new Mesh(
    new CylinderGeometry(0.014, 0.018, kit.bigWep ? 0.42 : 0.3, 7),
    mat(0xc8d2da, { metalness: 0.92, roughness: 0.12 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = body * 0.6;
  rifle.add(barrel);
  const coil = new Mesh(new TorusGeometry(0.028, 0.007, 4, 10), m.accent);
  coil.rotation.x = Math.PI / 2;
  coil.position.z = body * 0.48;
  rifle.add(coil);
  const brake = new Mesh(new CylinderGeometry(0.026, 0.018, 0.07, 7), m.metalBright);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = body * 0.6 + (kit.bigWep ? 0.22 : 0.16);
  rifle.add(brake);
  const glow = new Mesh(new CylinderGeometry(0.014, 0.014, 0.05, 6), liveGlow(0x4ad0f0, 1.4));
  glow.name = "wepGlow";
  glow.rotation.x = Math.PI / 2;
  glow.position.z = body * 0.6 + (kit.bigWep ? 0.26 : 0.2);
  rifle.add(glow);
  const sight = new Mesh(new BoxGeometry(0.008, 0.008, kit.bigWep ? 0.34 : 0.24), liveGlow(0x5ce0ff, 0.9));
  sight.position.set(0, 0.03, body * 0.42);
  rifle.add(sight);
  const mag = new Mesh(new BoxGeometry(0.04, 0.14, 0.07), m.accent);
  mag.position.set(0, -0.08, 0.02);
  rifle.add(mag);
  const cell = new Mesh(new BoxGeometry(0.02, 0.1, 0.03), mat(0xffffff, { emissive: 0xa8f0ff, emissiveIntensity: 1.1 }));
  cell.position.set(0.022, -0.08, 0.02);
  rifle.add(cell);
  const trigger = new Mesh(new BoxGeometry(0.018, 0.04, 0.025), m.metal);
  trigger.position.set(0, -0.05, -0.05);
  rifle.add(trigger);
  const optic = new Mesh(new BoxGeometry(0.04, 0.045, 0.16), m.wrapDark);
  optic.position.set(0, 0.07, 0.06);
  rifle.add(optic);
  const holo = new Mesh(new BoxGeometry(0.05, 0.04, 0.01), mat(0x5ce0ff, { emissive: 0x3ad0f0, emissiveIntensity: 1.2 }));
  holo.position.set(0, 0.078, 0.14);
  rifle.add(holo);
  const rear = new Mesh(new BoxGeometry(0.03, 0.03, 0.04), m.metalBright);
  rear.position.set(0, 0.06, -0.1);
  rifle.add(rear);
  armR.add(rifle);
}

function addMageKit(armL: Group, kit: WardenKit, m: BodyMats) {
  const h = kit.bigWep ? 1.5 : 1.3;
  const staff = new Group();
  staff.name = "wep";
  staff.position.set(-0.12, -0.42, 0.28);
  const shaft = new Mesh(new CylinderGeometry(0.02, 0.026, h, 7), mat(0x1c1828, { roughness: 0.28, metalness: 0.72 }));
  shaft.position.y = h * 0.38;
  addPart(shaft, staff);
  for (const t of [0.1, 0.28, h * 0.48, h * 0.66] as const) {
    const ring = new Mesh(new TorusGeometry(0.034, 0.007, 5, 10), m.accent);
    ring.position.y = t;
    staff.add(ring);
  }
  const grip = new Mesh(new CylinderGeometry(0.028, 0.024, 0.16, 7), m.metal);
  grip.position.y = 0.18;
  staff.add(grip);
  const cradle = new Mesh(new CylinderGeometry(0.05, 0.02, 0.1, 6), m.metalBright);
  cradle.position.y = h * 0.7;
  staff.add(cradle);
  const halo = new Mesh(new TorusGeometry(0.11, 0.012, 5, 14), m.accent);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = h * 0.82;
  staff.add(halo);
  const crystal = new Mesh(new OctahedronGeometry(kit.bigWep ? 0.15 : 0.12, 0), m.accent);
  crystal.position.y = h * 0.82;
  addPart(crystal, staff);
  const core = new Mesh(new SphereGeometry(0.048, 7, 5), liveGlow(hex(kit.accent) || 0x8b7cc8, 1.7));
  core.name = "wepGlow";
  core.position.y = h * 0.82;
  staff.add(core);
  for (const a of [0, 2.1, 4.2] as const) {
    const prong = new Mesh(new BoxGeometry(0.018, 0.16, 0.018), m.metalBright);
    prong.position.set(Math.cos(a) * 0.08, h * 0.74, Math.sin(a) * 0.08);
    prong.rotation.z = Math.cos(a) * 0.4;
    staff.add(prong);
  }
  armL.add(staff);
}

function dressFighter(
  g: Group,
  kit: WardenKit,
  skin: MeshPhysicalMaterial,
  skinDark: MeshPhysicalMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const steel = kit.heavy ? 0x9aa4ae : 0xd0d8e0;
  const m: BodyMats = {
    cloth: mat(0x1a2026, { roughness: 0.9, flatShading: false }),
    clothDark: mat(0x12161a, { roughness: 0.92, flatShading: false }),
    wrap: mat(kit.heavy ? 0x1c2228 : 0x242a30, { metalness: 0.22, roughness: 0.7, flatShading: false }),
    wrapDark: mat(0x101418, { metalness: 0.28, roughness: 0.72, flatShading: false }),
    wrapMid: mat(kit.heavy ? 0xa8b2bc : 0xd4dce4, { metalness: 0.92, roughness: 0.12, flatShading: false }),
    trim: mat(steel, { metalness: 0.88, roughness: 0.16, flatShading: false }),
    trimDark: mat(0x3a424a, { metalness: 0.7, roughness: 0.28, flatShading: false }),
    trimMid: mat(0xc8d0d8, { metalness: 0.9, roughness: 0.14, flatShading: false }),
    metal: mat(steel, { metalness: 0.86, roughness: 0.18, flatShading: false }),
    metalBright: mat(0xe8eef4, { metalness: 0.92, roughness: 0.14, emissive: 0xa8b8c8, emissiveIntensity: 0.12, flatShading: false }),
    accent: mat(accentN, { metalness: 0.55, roughness: 0.22, emissive: accentN, emissiveIntensity: 0.55 }),
  };

  g.add(makeHunterLeg(-1, m, { bootFur: false, greave: true }));
  g.add(makeHunterLeg(1, m, { bootFur: false, greave: true }));
  addHunterHips(g, m);
  const torso = addHunterTorso(g, m, { xStraps: true, chestKind: "plate" });
  addHunterShoulders(torso, m, "steel");
  for (const sx of [-1, 1] as const) {
    const ridge = new Mesh(new BoxGeometry(0.1, 0.06, 0.18), m.accent);
    ridge.position.set(sx * 0.28, 1.42, 0.04);
    ridge.rotation.z = sx * -0.2;
    torso.add(ridge);
    const pauldronFin = new Mesh(new ConeGeometry(0.07, 0.22, 5), m.metalBright);
    pauldronFin.position.set(sx * 0.4, 1.52, 0);
    pauldronFin.rotation.z = sx * -0.55;
    addPart(pauldronFin, torso);
    const vent = new Mesh(new BoxGeometry(0.06, 0.14, 0.04), m.accent);
    vent.position.set(sx * 0.22, 1.2, -0.2);
    vent.rotation.x = 0.35;
    torso.add(vent);
  }
  for (let i = 0; i < 5; i++) {
    const lame = new Mesh(new BoxGeometry(0.3 - i * 0.016, 0.045, 0.11), i % 2 ? m.metal : m.metalBright);
    lame.position.set(0, 1.1 - i * 0.055, 0.175);
    addPart(lame, torso);
  }
  for (const sx of [-1, 1] as const) {
    const fauld = new Mesh(new BoxGeometry(0.14, 0.2, 0.06), m.metal);
    fauld.position.set(sx * 0.16, 0.78, 0.2);
    fauld.rotation.x = 0.18;
    addPart(fauld, torso);
    const rivet = new Mesh(new SphereGeometry(0.016, 5, 4), m.metalBright);
    rivet.position.set(sx * 0.1, 1.24, 0.24);
    torso.add(rivet);
  }
  const plackart = new Mesh(new BoxGeometry(0.28, 0.09, 0.09), m.metalBright);
  plackart.position.set(0, 1.02, 0.2);
  addPart(plackart, torso);
  const tabard = new Mesh(new BoxGeometry(0.14, 0.68, 0.03), m.accent);
  tabard.name = "clothSwing";
  tabard.position.set(0, 0.78, 0.26);
  addPart(tabard, torso);
  const conduit = new Mesh(new BoxGeometry(0.04, 0.58, 0.02), mat(0xffffff, { emissive: accentN, emissiveIntensity: 1.15 }));
  conduit.position.set(0, 0.8, 0.28);
  torso.add(conduit);
  const tabardBack = new Mesh(new BoxGeometry(0.2, 0.58, 0.035), m.wrapDark);
  tabardBack.position.set(0, 0.82, -0.24);
  addPart(tabardBack, torso);
  const chestGlow = new Mesh(new BoxGeometry(0.22, 0.04, 0.04), m.accent);
  chestGlow.position.set(0, 1.16, 0.24);
  torso.add(chestGlow);
  addSteelGorget(torso, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "steel", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "steel", gauntletFur: false });
  for (const arm of [armL, armR]) {
    const knuckles = new Mesh(new BoxGeometry(0.12, 0.05, 0.1), m.metalBright);
    knuckles.position.set(arm === armR ? 0.16 : -0.16, -0.48, 0.06);
    arm.add(knuckles);
  }
  addFighterKit(armR, armL, kit, m);
  g.add(armL);
  g.add(armR);

  const head = makeHunterHead(g, skin, skinDark, hairCol, "fighter");
  const brow = new Mesh(new BoxGeometry(0.15, 0.022, 0.04), m.metalBright);
  brow.position.set(0, 0.078, 0.128);
  head.add(brow);
  const slit = new Mesh(new BoxGeometry(0.13, 0.01, 0.012), liveGlow(0x6ad8ff, 1.35));
  slit.name = "visorGlow";
  slit.position.set(0, 0.064, 0.146);
  head.add(slit);
  const visor = new Mesh(new BoxGeometry(0.14, 0.026, 0.016), m.wrapDark);
  visor.position.set(0, 0.064, 0.132);
  head.add(visor);
  for (const sx of [-1, 1] as const) {
    const cheek = new Mesh(new BoxGeometry(0.028, 0.09, 0.07), m.metal);
    cheek.position.set(sx * 0.122, -0.02, 0.02);
    head.add(cheek);
  }
  const nape = new Mesh(new BoxGeometry(0.13, 0.07, 0.05), m.metal);
  nape.position.set(0, 0.02, -0.12);
  head.add(nape);
  const crest = new Mesh(new BoxGeometry(0.02, 0.1, 0.05), m.accent);
  crest.position.set(0, 0.15, -0.02);
  head.add(crest);
}

function dressRanger(
  g: Group,
  kit: WardenKit,
  skin: MeshPhysicalMaterial,
  skinDark: MeshPhysicalMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const m: BodyMats = {
    cloth: mat(0x1a2226, { roughness: 0.82, metalness: 0.18, flatShading: false }),
    clothDark: mat(0x101618, { roughness: 0.86, metalness: 0.2, flatShading: false }),
    wrap: mat(kit.heavy ? 0x1c2428 : 0x243034, { roughness: 0.42, metalness: 0.55, flatShading: false }),
    wrapDark: mat(0x12181c, { roughness: 0.5, metalness: 0.48, flatShading: false }),
    wrapMid: mat(kit.heavy ? 0x3a4c56 : 0x4a6470, { roughness: 0.36, metalness: 0.62, flatShading: false }),
    trim: mat(0x8aa4b0, { roughness: 0.28, metalness: 0.78, flatShading: false }),
    trimDark: mat(0x2a3438, { roughness: 0.4, metalness: 0.6, flatShading: false }),
    trimMid: mat(0x6a8490, { roughness: 0.3, metalness: 0.7, flatShading: false }),
    metal: mat(0xe4ecf4, { metalness: 0.9, roughness: 0.16, flatShading: false }),
    metalBright: mat(0xf6fafc, { metalness: 0.96, roughness: 0.1, emissive: 0xb8c8d8, emissiveIntensity: 0.42, flatShading: false }),
    accent: mat(accentN, { metalness: 0.55, roughness: 0.18, emissive: accentN, emissiveIntensity: 0.7 }),
  };

  g.add(makeHunterLeg(-1, m, { bootFur: false, greave: true }));
  g.add(makeHunterLeg(1, m, { bootFur: false, greave: true }));
  addHunterHips(g, m);
  const torso = addHunterTorso(g, m, { xStraps: true, chestKind: "leather" });
  addHunterShoulders(torso, m, "leather");
  addCommsCollar(torso, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "steel", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "steel", gauntletFur: false });
  addRangerKit(armR, kit, m);
  g.add(armL);
  g.add(armR);

  for (const sx of [-1, 1] as const) {
    const pouch = new Mesh(new BoxGeometry(0.1, 0.12, 0.08), m.wrapDark);
    pouch.position.set(sx * 0.22, 0.86, 0.14);
    addPart(pouch, g);
    const flap = new Mesh(new BoxGeometry(0.1, 0.04, 0.09), m.wrapMid);
    flap.position.set(sx * 0.22, 0.93, 0.14);
    g.add(flap);
    const buckle = new Mesh(new BoxGeometry(0.04, 0.02, 0.03), m.metalBright);
    buckle.position.set(sx * 0.22, 0.93, 0.19);
    g.add(buckle);
  }
  for (let i = 0; i < 5; i++) {
    const cell = new Mesh(new CylinderGeometry(0.018, 0.018, 0.08, 6), m.accent);
    cell.rotation.z = 0.7;
    cell.position.set(-0.18 + i * 0.08, 1.08 + (i % 2) * 0.02, 0.24);
    torso.add(cell);
  }
  const bandolier = new Mesh(new BoxGeometry(0.06, 0.5, 0.03), m.wrapDark);
  bandolier.position.set(0.04, 1.12, 0.24);
  bandolier.rotation.z = 0.55;
  torso.add(bandolier);
  const cape = new Mesh(new BoxGeometry(0.38, 0.55, 0.06), m.wrapDark);
  cape.name = "clothSwing";
  cape.position.set(0, 1.05, -0.26);
  cape.rotation.x = 0.18;
  addPart(cape, torso);
  const capeFold = new Mesh(new BoxGeometry(0.16, 0.48, 0.04), m.wrapMid);
  capeFold.position.set(0.1, 1.0, -0.3);
  capeFold.rotation.x = 0.22;
  addPart(capeFold, torso);
  const pack = new Group();
  pack.position.set(-0.16, 1.05, -0.24);
  pack.rotation.z = 0.18;
  const housing = new Mesh(new BoxGeometry(0.16, 0.28, 0.12), m.wrapDark);
  addPart(housing, pack);
  for (let i = 0; i < 3; i++) {
    const cell = new Mesh(new BoxGeometry(0.04, 0.2, 0.03), m.accent);
    cell.position.set(-0.04 + i * 0.04, 0, 0.07);
    pack.add(cell);
  }
  const dish = new Mesh(new CylinderGeometry(0.05, 0.04, 0.04, 8), m.metalBright);
  dish.position.set(0.02, 0.16, 0);
  pack.add(dish);
  torso.add(pack);

  const head = makeHunterHead(g, skin, skinDark, hairCol, "ranger");
  const band = new Mesh(new BoxGeometry(0.2, 0.02, 0.042), m.wrapDark);
  band.position.set(0, 0.05, 0.118);
  head.add(band);
  const bridge = new Mesh(new BoxGeometry(0.03, 0.012, 0.02), m.metal);
  bridge.position.set(0, 0.024, 0.15);
  head.add(bridge);
  for (const sx of [-1, 1] as const) {
    const cup = new Mesh(new TorusGeometry(0.02, 0.005, 5, 10), m.metal);
    cup.position.set(sx * 0.046, 0.022, 0.148);
    head.add(cup);
    const lens = liveGlow(0x4ad0f0, 0.35);
    lens.transparent = true;
    lens.opacity = 0.42;
    lens.depthWrite = false;
    const glass = new Mesh(new SphereGeometry(0.016, 10, 8), lens);
    if (sx < 0) glass.name = "visorGlow";
    glass.position.set(sx * 0.046, 0.022, 0.156);
    head.add(glass);
    const strap = new Mesh(new BoxGeometry(0.04, 0.012, 0.02), m.wrapDark);
    strap.position.set(sx * 0.1, 0.04, 0.04);
    strap.rotation.y = sx * 0.4;
    head.add(strap);
  }
}

function dressMage(
  g: Group,
  kit: WardenKit,
  skin: MeshPhysicalMaterial,
  skinDark: MeshPhysicalMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const m: BodyMats = {
    cloth: mat(kit.heavy ? 0x2a2448 : 0x383264, { roughness: 0.86, flatShading: false }),
    clothDark: mat(0x1a1630, { roughness: 0.9, flatShading: false }),
    wrap: mat(kit.heavy ? 0x3c366c : 0x5c54a0, { roughness: 0.82, flatShading: false }),
    wrapDark: mat(kit.heavy ? 0x1c1834 : 0x2a2448, { roughness: 0.88, flatShading: false }),
    wrapMid: mat(kit.heavy ? 0x9a8cd8 : 0x8a82c4, { roughness: 0.64, emissive: accentN, emissiveIntensity: 0.22, flatShading: false }),
    trim: mat(0x6a62a0, { roughness: 0.8, flatShading: false }),
    trimDark: mat(0x2a2448, { roughness: 0.88, flatShading: false }),
    trimMid: mat(0x9a8ed4, { roughness: 0.72, emissive: accentN, emissiveIntensity: 0.18, flatShading: false }),
    metal: mat(0xc8c0e8, { metalness: 0.62, roughness: 0.22, flatShading: false }),
    metalBright: mat(accentN, { metalness: 0.35, roughness: 0.14, emissive: accentN, emissiveIntensity: 1.1 }),
    accent: mat(accentN, { metalness: 0.28, roughness: 0.14, emissive: accentN, emissiveIntensity: 1.25 }),
  };

  g.add(makeHunterLeg(-1, m, { bootFur: false }));
  g.add(makeHunterLeg(1, m, { bootFur: false }));
  addHunterHips(g, m, true);
  for (const [x, z, ry] of [
    [0.1, 0.2, 0.2],
    [-0.12, 0.18, -0.25],
    [0.02, -0.2, 3.0],
    [0.16, 0.08, 0.55],
    [-0.18, 0.1, -0.6],
    [0.06, -0.24, 2.7],
  ] as const) {
    const fold = new Mesh(new BoxGeometry(0.15, 0.5, 0.045), m.wrapDark);
    fold.position.set(x, 0.5, z);
    fold.rotation.y = ry;
    addPart(fold, g);
  }
  const skirt = new Mesh(new CylinderGeometry(0.48, 0.2, 0.68, 10), m.wrap);
  skirt.position.y = 0.48;
  addPart(skirt, g, 1.04);
  const hem = new Mesh(new CylinderGeometry(0.52, 0.44, 0.1, 10), m.wrapDark);
  hem.position.y = 0.18;
  addPart(hem, g);
  const overskirt = new Mesh(new CylinderGeometry(0.42, 0.22, 0.36, 8), m.wrapMid);
  overskirt.name = "clothSwing";
  overskirt.position.y = 0.62;
  addPart(overskirt, g);
  const torso = addHunterTorso(g, m, { xStraps: false, chestKind: "cloth" });
  addHunterShoulders(torso, m, "cloth");
  addClothCowl(torso, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "cloth", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "cloth", gauntletFur: false });
  addMageKit(armL, kit, m);
  g.add(armL);
  g.add(armR);

  for (const sx of [-1, 1] as const) {
    const bell = new Mesh(new CylinderGeometry(0.18, 0.1, 0.28, 7), m.wrap);
    bell.position.set(sx * 0.38, 1.02, 0.02);
    bell.rotation.z = sx * 0.35;
    addPart(bell, torso);
  }
  const sash = new Mesh(new BoxGeometry(0.08, 0.42, 0.04), m.trimMid);
  sash.position.set(0.12, 0.72, 0.22);
  sash.rotation.z = -0.15;
  addPart(sash, g);
  const rune = new Mesh(new TorusGeometry(0.07, 0.012, 6, 12), m.accent);
  rune.position.set(0, 1.2, 0.26);
  torso.add(rune);
  const runeCore = new Mesh(new SphereGeometry(0.03, 6, 5), m.metalBright);
  runeCore.position.set(0, 1.2, 0.28);
  torso.add(runeCore);
  const circuit = new Mesh(new BoxGeometry(0.22, 0.015, 0.03), m.accent);
  circuit.position.set(0, 1.08, 0.24);
  torso.add(circuit);
  const circuit2 = new Mesh(new BoxGeometry(0.015, 0.18, 0.025), m.accent);
  circuit2.position.set(0.1, 1.14, 0.22);
  torso.add(circuit2);
  const orbit = new Group();
  orbit.name = "orbit";
  orbit.position.set(0, 1.28, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const shard = new Mesh(new OctahedronGeometry(i % 3 === 0 ? 0.05 : 0.036, 0), m.accent);
    shard.position.set(Math.cos(a) * 0.5, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.3);
    orbit.add(shard);
  }
  torso.add(orbit);

  const head = makeHunterHead(g, skin, skinDark, hairCol, "mage");
  const haloCore = new Mesh(new TorusGeometry(0.11, 0.01, 6, 16), liveGlow(accentN, 1.1));
  haloCore.name = "visorGlow";
  haloCore.rotation.x = Math.PI / 2;
  haloCore.position.set(0, 0.16, 0);
  head.add(haloCore);
  const hoodPanel = new Mesh(new BoxGeometry(0.2, 0.24, 0.05), m.wrapDark);
  hoodPanel.position.set(0, 0.06, -0.14);
  hoodPanel.rotation.x = 0.2;
  addPart(hoodPanel, head);
  const hoodFold = new Mesh(new BoxGeometry(0.15, 0.18, 0.036), m.wrap);
  hoodFold.position.set(0, -0.02, -0.18);
  hoodFold.rotation.x = 0.36;
  head.add(hoodFold);
  const hoodRim = new Mesh(new TorusGeometry(0.12, 0.012, 5, 12), m.wrapMid);
  hoodRim.rotation.x = 1.15;
  hoodRim.position.set(0, 0.08, 0.02);
  head.add(hoodRim);
  const hoodTip = new Mesh(new ConeGeometry(0.045, 0.11, 5), m.wrapDark);
  hoodTip.position.set(0, -0.12, -0.2);
  hoodTip.rotation.x = 1.1;
  head.add(hoodTip);
  for (const sx of [-1, 1] as const) {
    const sideHood = new Mesh(new BoxGeometry(0.045, 0.18, 0.11), m.wrap);
    sideHood.position.set(sx * 0.118, 0.01, -0.09);
    sideHood.rotation.y = sx * -0.3;
    head.add(sideHood);
    const cuff = new Mesh(new TorusGeometry(0.026, 0.006, 4, 8), m.accent);
    cuff.position.set(sx * 0.132, 0.012, 0);
    head.add(cuff);
  }
}

export function createWardenMesh(id: HeroId, kit: WardenKit) {
  const g = new Group();
  g.name = `warden-${id}`;

  const shadow = new Mesh(
    new CircleGeometry(0.42, 20),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.name = "contactShadow";
  g.add(shadow);

  const skinTone = id === "mage" ? 0xe0c09a : id === "ranger" ? 0xc49a70 : 0xd4ae82;
  const skinShade = id === "mage" ? 0xb8926c : id === "ranger" ? 0x8c6a48 : 0xa07850;
  const skin = skinMat(skinTone);
  const skinDark = skinMat(skinShade, true);
  const hairCol = mat(id === "mage" ? 0x2a1838 : id === "ranger" ? 0x2a1c10 : 0x1a1208, {
    roughness: 0.92,
    flatShading: false,
  });

  if (id === "fighter") dressFighter(g, kit, skin, skinDark, hairCol);
  else if (id === "ranger") dressRanger(g, kit, skin, skinDark, hairCol);
  else dressMage(g, kit, skin, skinDark, hairCol);

  return g;
}
