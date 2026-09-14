import {
  BackSide,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
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

/** Hunterscape Hunter head — open face, class bones, layered hair. */
function makeHunterHead(
  parent: Object3D,
  skin: MeshStandardMaterial,
  skinDark: MeshStandardMaterial,
  hairCol: MeshStandardMaterial,
  id: HeroId,
) {
  const head = new Group();
  head.name = "playerHead";
  head.position.set(0, 1.6, 0.02);
  head.rotation.x = -0.12;

  const skull = new Mesh(new SphereGeometry(0.2, 10, 8), skin);
  skull.scale.set(id === "fighter" ? 1.06 : 1.02, id === "mage" ? 1.18 : 1.14, 0.98);
  addPart(skull, head, 1.1, 0x1a1008);

  const temple = new Mesh(new SphereGeometry(0.16, 8, 6), skin);
  temple.scale.set(1.16, 0.68, 0.78);
  temple.position.set(0, 0.04, 0.0);
  head.add(temple);

  const jawW = id === "fighter" ? 1.22 : id === "ranger" ? 1.1 : 1.02;
  const jaw = new Mesh(new SphereGeometry(0.155, 10, 8), skinDark);
  jaw.scale.set(jawW, 0.7, 0.98);
  jaw.position.set(0, -0.125, 0.07);
  addPart(jaw, head);
  const chin = new Mesh(new SphereGeometry(id === "fighter" ? 0.078 : 0.064, 8, 6), skinDark);
  chin.position.set(0, -0.205, 0.155);
  chin.scale.set(1.05, 0.72, 0.9);
  head.add(chin);

  if (id !== "mage") {
    const stubble = new Mesh(
      new SphereGeometry(0.11, 8, 6),
      mat(id === "fighter" ? 0x4a3424 : 0x5a4030, { roughness: 0.96, flatShading: false }),
    );
    stubble.scale.set(1.35, 0.42, 0.7);
    stubble.position.set(0, -0.155, 0.175);
    head.add(stubble);
  }

  for (const sx of [-1, 1] as const) {
    const cheek = new Mesh(new SphereGeometry(0.072, 8, 6), skinDark);
    cheek.scale.set(0.88, 1.08, 0.92);
    cheek.position.set(sx * (id === "fighter" ? 0.145 : 0.128), -0.02, 0.125);
    head.add(cheek);
    const zygoma = new Mesh(new SphereGeometry(0.04, 6, 5), skin);
    zygoma.position.set(sx * 0.155, 0.02, 0.1);
    head.add(zygoma);
  }

  const bridge = new Mesh(new SphereGeometry(0.03, 6, 5), skinDark);
  bridge.scale.set(0.72, 1.6, 1.15);
  bridge.position.set(0, 0.04, 0.21);
  head.add(bridge);
  const nose = new Mesh(new SphereGeometry(0.042, 6, 5), skinDark);
  nose.scale.set(0.88, 0.95, 1.35);
  nose.position.set(0, -0.015, 0.255);
  head.add(nose);
  const tip = new Mesh(new SphereGeometry(0.024, 5, 4), skin);
  tip.position.set(0, -0.038, 0.285);
  head.add(tip);
  for (const sx of [-1, 1] as const) {
    const nostril = new Mesh(new SphereGeometry(0.008, 4, 3), mat(0x2a1810, { roughness: 0.9 }));
    nostril.position.set(sx * 0.014, -0.05, 0.25);
    head.add(nostril);
  }

  const irisCol = id === "mage" ? 0x6a4cb0 : id === "ranger" ? 0x3a5a38 : 0x4a3424;
  const irisGlow = id === "mage" ? 0.95 : 0.45;
  for (const sx of [-1, 1] as const) {
    const brow = new Mesh(new SphereGeometry(0.05, 6, 4), hairCol);
    brow.scale.set(1.35, 0.38, 0.7);
    brow.position.set(sx * 0.082, 0.1, 0.188);
    brow.rotation.z = sx * -0.28;
    head.add(brow);
    const ridge = new Mesh(new SphereGeometry(0.032, 6, 4), skinDark);
    ridge.scale.set(1.3, 0.45, 0.8);
    ridge.position.set(sx * 0.08, 0.078, 0.205);
    head.add(ridge);

    const socket = new Mesh(new SphereGeometry(0.052, 8, 6), mat(0x0c0806, { roughness: 0.85 }));
    socket.scale.set(1.05, 0.85, 0.7);
    socket.position.set(sx * 0.078, 0.032, 0.175);
    head.add(socket);
    const lid = new Mesh(new SphereGeometry(0.042, 8, 5), skin);
    lid.scale.set(1.15, 0.35, 0.7);
    lid.position.set(sx * 0.078, 0.055, 0.2);
    head.add(lid);
    const lidLow = new Mesh(new SphereGeometry(0.038, 7, 5), skinDark);
    lidLow.scale.set(1.1, 0.28, 0.65);
    lidLow.position.set(sx * 0.078, 0.01, 0.2);
    head.add(lidLow);
    const sclera = new Mesh(new SphereGeometry(0.042, 7, 5), mat(0xf2ebe0, { roughness: 0.38 }));
    sclera.position.set(sx * 0.08, 0.034, 0.218);
    head.add(sclera);
    const iris = new Mesh(
      new SphereGeometry(0.028, 7, 5),
      mat(irisCol, { emissive: irisCol, emissiveIntensity: irisGlow, roughness: 0.32 }),
    );
    iris.position.set(sx * 0.08, 0.034, 0.246);
    head.add(iris);
    const pupil = new Mesh(new SphereGeometry(0.013, 5, 4), mat(0x080604));
    pupil.position.set(sx * 0.08, 0.034, 0.262);
    head.add(pupil);
    const hl = new Mesh(new SphereGeometry(0.009, 4, 3), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }));
    hl.position.set(sx * 0.072, 0.044, 0.268);
    head.add(hl);

    const ear = new Mesh(new SphereGeometry(0.05, 7, 6), skin);
    ear.scale.set(0.55, 1.15, 0.7);
    ear.position.set(sx * 0.2, 0.015, -0.01);
    ear.rotation.z = sx * 0.18;
    head.add(ear);
    const canal = new Mesh(new SphereGeometry(0.018, 5, 4), skinDark);
    canal.position.set(sx * 0.205, 0.01, 0.01);
    head.add(canal);
    if (id === "ranger") {
      const burn = new Mesh(new SphereGeometry(0.028, 5, 4), hairCol);
      burn.scale.set(0.7, 1.4, 0.55);
      burn.position.set(sx * 0.175, -0.04, 0.02);
      head.add(burn);
    }
  }

  const mouth = new Mesh(new SphereGeometry(0.055, 8, 5), mat(0x3a2018, { roughness: 0.7 }));
  mouth.scale.set(1.15, 0.28, 0.55);
  mouth.position.set(0, -0.148, 0.2);
  head.add(mouth);
  const lipUp = new Mesh(new SphereGeometry(0.048, 7, 5), skinDark);
  lipUp.scale.set(1.1, 0.22, 0.5);
  lipUp.position.set(0, -0.132, 0.212);
  head.add(lipUp);
  const lipLow = new Mesh(new SphereGeometry(0.046, 7, 5), skin);
  lipLow.scale.set(1.05, 0.2, 0.48);
  lipLow.position.set(0, -0.16, 0.208);
  head.add(lipLow);

  if (id === "fighter") {
    const scar = new Mesh(new BoxGeometry(0.12, 0.008, 0.01), mat(0x8a5a48, { roughness: 0.9 }));
    scar.position.set(-0.08, 0.06, 0.22);
    scar.rotation.z = 0.45;
    head.add(scar);
  }

  const hairCap = new Mesh(new SphereGeometry(0.198, 10, 7), hairCol);
  hairCap.position.set(0, 0.08, -0.045);
  hairCap.scale.set(1.1, 0.74, 1.06);
  addPart(hairCap, head);

  const fighterHair: [number, number, number, number][] = [
    [0, 0.22, 0.02, 0.85],
    [-0.08, 0.2, 0.04, 0.75],
    [0.08, 0.2, 0.04, 0.75],
    [-0.13, 0.16, -0.04, 0.7],
    [0.13, 0.16, -0.04, 0.7],
    [0, 0.18, -0.12, 0.8],
    [-0.1, 0.18, -0.08, 0.72],
    [0.1, 0.18, -0.08, 0.72],
    [-0.16, 0.1, 0, 0.6],
    [0.16, 0.1, 0, 0.6],
  ];
  const rangerHair: [number, number, number, number][] = [
    [0, 0.24, 0.0, 1.15],
    [-0.09, 0.22, 0.05, 1.0],
    [0.09, 0.22, 0.05, 1.0],
    [-0.14, 0.17, -0.04, 0.95],
    [0.14, 0.17, -0.04, 0.95],
    [0, 0.2, -0.14, 1.15],
    [-0.12, 0.15, -0.13, 1.0],
    [0.12, 0.15, -0.13, 1.0],
    [-0.07, 0.25, -0.06, 1.1],
    [0.07, 0.25, -0.06, 1.1],
    [0, 0.26, 0.06, 0.85],
    [-0.16, 0.1, 0.0, 0.8],
    [0.16, 0.1, 0.0, 0.8],
    [-0.05, 0.28, -0.02, 0.95],
    [0.05, 0.28, -0.02, 0.95],
  ];
  const mageHair: [number, number, number, number][] = [
    [0, 0.22, -0.04, 1.05],
    [-0.08, 0.2, -0.02, 1.15],
    [0.08, 0.2, -0.02, 1.15],
    [-0.12, 0.12, -0.1, 1.35],
    [0.12, 0.12, -0.1, 1.35],
    [0, 0.1, -0.16, 1.45],
    [-0.06, 0.0, -0.18, 1.5],
    [0.06, 0.0, -0.18, 1.5],
    [-0.1, -0.06, -0.16, 1.25],
    [0.1, -0.06, -0.16, 1.25],
    [-0.14, 0.08, -0.06, 1.05],
    [0.14, 0.08, -0.06, 1.05],
    [0, -0.12, -0.2, 1.2],
  ];
  const spikePts = id === "mage" ? mageHair : id === "ranger" ? rangerHair : fighterHair;
  for (const [x, y, z, s] of spikePts) {
    const long = id === "mage" ? 0.26 : id === "ranger" ? 0.18 : 0.14;
    const spike = new Mesh(new ConeGeometry(0.042 * s, long * s, 5), hairCol);
    spike.position.set(x, y + (id === "mage" ? -0.02 : 0.02), z);
    spike.rotation.x = id === "mage" ? 0.85 + z * 0.4 : z * 0.9 - 0.15;
    spike.rotation.z = -x * (id === "mage" ? 0.7 : 1.4);
    head.add(spike);
  }

  parent.add(head);
  const neck = new Mesh(new CylinderGeometry(0.085, 0.112, 0.18, 8), skin);
  neck.position.set(0, 1.5, 0.02);
  addPart(neck, parent);
  const throat = new Mesh(new SphereGeometry(0.04, 6, 5), skinDark);
  throat.position.set(0, 1.46, 0.08);
  throat.scale.set(0.9, 0.7, 0.7);
  parent.add(throat);
  return head;
}

function makeHunterLeg(side: number, m: BodyMats, opts: { bootFur: boolean; greave?: boolean }) {
  const leg = new Group();
  const thigh = new Mesh(new CylinderGeometry(0.11, 0.13, 0.42, 6), m.cloth);
  thigh.position.set(0, 0.55, 0);
  addPart(thigh, leg);

  const shin = new Mesh(new CylinderGeometry(0.1, 0.11, 0.28, 6), m.clothDark);
  shin.position.set(0, 0.28, 0.02);
  addPart(shin, leg);

  const boot = new Mesh(new CylinderGeometry(0.115, 0.13, 0.38, 6), opts.greave ? m.wrap : m.wrap);
  boot.position.set(0, 0.2, 0.02);
  addPart(boot, leg, 1.06);

  const foot = new Mesh(new BoxGeometry(0.17, 0.1, 0.3), m.wrapDark);
  foot.position.set(0, 0.05, 0.09);
  addPart(foot, leg);
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
  skin: MeshStandardMaterial,
  opts: { sleeve: "bare" | "steel" | "cloth"; gauntletFur: boolean },
) {
  const arm = new Group();
  arm.name = side < 0 ? "armL" : "armR";

  const upperMat = opts.sleeve === "bare" ? skin : opts.sleeve === "steel" ? m.metal : m.cloth;
  const upper = new Mesh(new CylinderGeometry(0.095, 0.105, 0.34, 7), upperMat);
  upper.position.set(0, 0, 0);
  upper.rotation.z = side * 0.35;
  addPart(upper, arm, opts.sleeve === "bare" ? undefined : 1.04);

  const cuff = new Mesh(new CylinderGeometry(0.1, 0.11, 0.08, 6), opts.sleeve === "cloth" ? m.wrapMid : m.cloth);
  cuff.position.set(side * -0.02, 0.12, 0);
  cuff.rotation.z = side * 0.35;
  arm.add(cuff);

  const gauntlet = new Mesh(
    new CylinderGeometry(0.098, 0.115, 0.3, 7),
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
  const palm = new Mesh(new BoxGeometry(0.09, 0.075, 0.1), skin);
  addPart(palm, hand);
  for (let i = 0; i < 4; i++) {
    const finger = new Mesh(new BoxGeometry(0.016, 0.062, 0.016), skin);
    finger.position.set((i - 1.5) * 0.02, -0.062, 0.02);
    hand.add(finger);
    const knuckle = new Mesh(new SphereGeometry(0.01, 4, 3), skin);
    knuckle.position.set((i - 1.5) * 0.02, -0.03, 0.04);
    hand.add(knuckle);
  }
  const thumb = new Mesh(new BoxGeometry(0.016, 0.045, 0.016), skin);
  thumb.position.set(side * 0.048, -0.02, 0.03);
  thumb.rotation.z = side * 0.7;
  hand.add(thumb);
  arm.add(hand);

  arm.position.set(side * 0.36, 1.28, 0);
  return arm;
}

function addHunterHips(g: Group, m: BodyMats, longSkirt = false) {
  const hips = new Mesh(new CylinderGeometry(0.24, 0.28, 0.22, 8), m.wrap);
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
  const torso = new Mesh(new CylinderGeometry(0.24, 0.29, 0.55, 9), m.wrap);
  torso.name = "playerTorso";
  torso.position.y = 1.12;
  addPart(torso, g, 1.07, 0x0a0806);

  if (opts.chestKind === "plate") {
    const pecL = new Mesh(new BoxGeometry(0.2, 0.28, 0.14), m.metalBright);
    pecL.position.set(-0.1, 1.22, 0.16);
    addPart(pecL, g);
    const pecR = new Mesh(new BoxGeometry(0.2, 0.28, 0.14), m.metal);
    pecR.position.set(0.1, 1.22, 0.16);
    addPart(pecR, g);
    const belly = new Mesh(new BoxGeometry(0.36, 0.16, 0.12), m.wrapMid);
    belly.position.set(0, 1.0, 0.15);
    addPart(belly, g);
  } else if (opts.chestKind === "cloth") {
    const robe = new Mesh(new BoxGeometry(0.4, 0.32, 0.16), m.wrapMid);
    robe.position.set(0, 1.2, 0.15);
    addPart(robe, g);
  } else {
    const chestPlate = new Mesh(new BoxGeometry(0.4, 0.3, 0.16), m.wrapMid);
    chestPlate.position.set(0, 1.2, 0.15);
    addPart(chestPlate, g);
  }

  const undershirt = new Mesh(new CylinderGeometry(0.2, 0.22, 0.12, 8), m.cloth);
  undershirt.position.set(0, 1.38, 0.02);
  g.add(undershirt);

  const belt = new Mesh(new CylinderGeometry(0.29, 0.29, 0.1, 10), m.wrapDark);
  belt.position.y = 0.88;
  addPart(belt, g);
  const beltBuckle = new Mesh(new BoxGeometry(0.14, 0.1, 0.07), m.metalBright);
  beltBuckle.position.set(0, 0.88, 0.3);
  g.add(beltBuckle);

  if (opts.xStraps) {
    const makeStrap = (rotZ: number, z: number) => {
      const strap = new Mesh(new BoxGeometry(0.08, 0.56, 0.04), m.wrapDark);
      strap.position.set(0, 1.18, z);
      strap.rotation.z = rotZ;
      g.add(strap);
    };
    makeStrap(0.55, 0.26);
    makeStrap(-0.55, 0.26);
    makeStrap(0.55, -0.22);
    makeStrap(-0.55, -0.22);

    const bucklePad = new Mesh(new BoxGeometry(0.16, 0.14, 0.045), m.wrapDark);
    bucklePad.position.set(0, 1.2, 0.3);
    g.add(bucklePad);
    const chestBuckle = new Mesh(new OctahedronGeometry(0.1, 0), m.metalBright);
    chestBuckle.scale.set(1.35, 1.05, 0.55);
    chestBuckle.position.set(0, 1.2, 0.36);
    g.add(chestBuckle);
    const facet = new Mesh(
      new OctahedronGeometry(0.055, 0),
      mat(0xffffff, { metalness: 0.98, roughness: 0.08, emissive: 0xd0e0f0, emissiveIntensity: 0.55 }),
    );
    facet.scale.set(1.2, 0.9, 0.4);
    facet.position.set(0, 1.2, 0.4);
    g.add(facet);
    const ring = new Mesh(new TorusGeometry(0.058, 0.014, 4, 10), m.metalBright);
    ring.position.set(0, 1.2, 0.385);
    g.add(ring);
    for (const [dx, dy] of [
      [-0.07, 0.06],
      [0.07, 0.06],
      [-0.07, -0.06],
      [0.07, -0.06],
    ] as const) {
      const rivet = new Mesh(new SphereGeometry(0.018, 5, 4), m.metalBright);
      rivet.position.set(dx, 1.2 + dy, 0.34);
      g.add(rivet);
    }
  } else {
    const gem = new Mesh(new OctahedronGeometry(0.08, 0), m.accent);
    gem.position.set(0, 1.18, 0.3);
    g.add(gem);
  }
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

function addFurCollar(g: Group, m: BodyMats) {
  const collarBase = new Mesh(new TorusGeometry(0.23, 0.095, 6, 14), m.trimMid);
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.set(0, 1.42, 0);
  collarBase.scale.set(1.2, 1.05, 0.98);
  addPart(collarBase, g);
  const collarUnder = new Mesh(new TorusGeometry(0.2, 0.07, 5, 12), m.trimDark);
  collarUnder.rotation.x = Math.PI / 2;
  collarUnder.position.set(0, 1.38, 0.02);
  collarUnder.scale.set(1.15, 1.0, 0.95);
  g.add(collarUnder);

  addSpikes(g, 0, 1.4, 0, 0.29, 30, 0.2, 0.032, m.trim, m.trimDark, m.trimMid);
  addSpikes(g, 0, 1.52, -0.04, 0.25, 24, 0.16, 0.028, m.trim, m.trimDark, m.trimMid, 0.15);
  addSpikes(g, 0, 1.34, 0.08, 0.32, 20, 0.14, 0.026, m.trim, m.trimDark, m.trimMid, 0.32);
  addSpikes(g, 0, 1.46, 0.02, 0.2, 16, 0.11, 0.022, m.trim, m.trimDark, m.trimMid, 0.5);
  addSpikes(g, 0, 1.48, -0.08, 0.22, 12, 0.13, 0.02, m.trim, m.trimDark, m.trimMid, 0.7);
  for (const sx of [-1, 1] as const) {
    addSpikes(g, sx * 0.3, 1.35, 0.05, 0.14, 16, 0.15, 0.026, m.trim, m.trimDark, m.trimMid);
    addSpikes(g, sx * 0.36, 1.2, 0.02, 0.11, 12, 0.12, 0.022, m.trim, m.trimDark, m.trimMid);
    const drape = new Mesh(new ConeGeometry(0.1, 0.32, 5), m.trimDark);
    drape.position.set(sx * 0.35, 1.26, 0);
    drape.rotation.z = sx * 0.72;
    drape.rotation.x = -0.32;
    addPart(drape, g);
    const drape2 = new Mesh(new ConeGeometry(0.07, 0.22, 4), m.trimMid);
    drape2.position.set(sx * 0.4, 1.16, 0.06);
    drape2.rotation.z = sx * 0.85;
    drape2.rotation.x = -0.2;
    addPart(drape2, g);
    const drape3 = new Mesh(new ConeGeometry(0.055, 0.18, 4), m.trim);
    drape3.position.set(sx * 0.38, 1.2, -0.04);
    drape3.rotation.z = sx * 0.65;
    drape3.rotation.x = -0.15;
    addPart(drape3, g);
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
  addSpikes(g, 0, 1.32, -0.1, 0.24, 18, 0.14, 0.024, m.trim, m.trimDark, m.trimMid);
  addSpikes(g, 0, 1.28, -0.16, 0.2, 12, 0.12, 0.02, m.trim, m.trimDark, m.trimMid, 0.25);
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
  const blade = kit.bigWep ? 1.12 : 0.92;
  const sword = new Group();
  sword.name = "wep";
  sword.position.set(0.22, -0.34, 0.28);
  sword.rotation.set(0.15, 0.35, -1.15);
  const grip = new Mesh(new CylinderGeometry(0.022, 0.026, 0.18, 6), mat(0x3a2e24, { roughness: 0.8 }));
  grip.rotation.z = Math.PI / 2;
  sword.add(grip);
  for (const ox of [-0.04, 0.02] as const) {
    const wrap = new Mesh(new TorusGeometry(0.028, 0.006, 4, 8), mat(0x5a4030, { roughness: 0.9 }));
    wrap.rotation.y = Math.PI / 2;
    wrap.position.x = ox;
    sword.add(wrap);
  }
  const pommel = new Mesh(new SphereGeometry(0.035, 6, 4), m.accent);
  pommel.position.x = -0.1;
  sword.add(pommel);
  const guard = new Mesh(new BoxGeometry(0.05, 0.22, 0.05), m.metalBright);
  guard.position.x = 0.1;
  sword.add(guard);
  const bladeM = new Mesh(new BoxGeometry(blade, 0.11, 0.028), mat(0xf2f6fa, { metalness: 0.94, roughness: 0.08 }));
  bladeM.position.x = 0.12 + blade / 2;
  addPart(bladeM, sword);
  const fuller = new Mesh(new BoxGeometry(blade * 0.82, 0.018, 0.006), m.accent);
  fuller.position.set(0.12 + blade / 2, 0, 0.012);
  sword.add(fuller);
  const tip = new Mesh(new ConeGeometry(0.04, 0.12, 4), mat(0xf2f6fa, { metalness: 0.94, roughness: 0.08 }));
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.12 + blade + 0.04;
  sword.add(tip);
  armR.add(sword);

  const shield = new Group();
  shield.position.set(-0.22, -0.12, 0.28);
  shield.rotation.y = 0.28;
  const face = new Mesh(new BoxGeometry(0.08, 0.56, 0.38), m.metalBright);
  addPart(face, shield, 1.04);
  const taper = new Mesh(new BoxGeometry(0.055, 0.22, 0.2), m.metal);
  taper.position.set(0.01, -0.3, 0);
  addPart(taper, shield);
  const point = new Mesh(new ConeGeometry(0.1, 0.12, 4), m.metal);
  point.rotation.x = Math.PI;
  point.position.set(0.01, -0.44, 0);
  shield.add(point);
  const rim = new Mesh(new BoxGeometry(0.02, 0.5, 0.36), m.accent);
  rim.position.x = 0.04;
  shield.add(rim);
  const boss = new Mesh(new SphereGeometry(0.07, 7, 5), m.accent);
  boss.position.x = 0.06;
  shield.add(boss);
  const crossV = new Mesh(new BoxGeometry(0.02, 0.28, 0.05), m.wrapDark);
  crossV.position.x = 0.05;
  shield.add(crossV);
  const crossH = new Mesh(new BoxGeometry(0.02, 0.05, 0.2), m.wrapDark);
  crossH.position.x = 0.05;
  shield.add(crossH);
  armL.add(shield);
}

function addRangerKit(armR: Group, kit: WardenKit, m: BodyMats) {
  const body = kit.bigWep ? 0.92 : 0.74;
  const rifle = new Group();
  rifle.name = "wep";
  rifle.position.set(0.14, -0.28, 0.32);
  rifle.rotation.set(0.35, 0.55, 0.12);
  const stock = new Mesh(new BoxGeometry(0.06, 0.09, 0.16), m.wrapMid);
  stock.position.z = -body * 0.42;
  addPart(stock, rifle);
  const rec = new Mesh(new BoxGeometry(0.07, 0.075, body), mat(0x1a2026, { metalness: 0.65, roughness: 0.28 }));
  addPart(rec, rifle);
  const handguard = new Mesh(new BoxGeometry(0.055, 0.055, body * 0.45), m.wrapDark);
  handguard.position.z = body * 0.22;
  rifle.add(handguard);
  const barrel = new Mesh(
    new CylinderGeometry(0.012, 0.016, kit.bigWep ? 0.38 : 0.26, 6),
    mat(0x8a949c, { metalness: 0.85, roughness: 0.16 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = body * 0.58;
  rifle.add(barrel);
  const brake = new Mesh(new CylinderGeometry(0.02, 0.016, 0.05, 6), m.metalBright);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = body * 0.58 + (kit.bigWep ? 0.2 : 0.14);
  rifle.add(brake);
  const mag = new Mesh(new BoxGeometry(0.035, 0.11, 0.08), m.wrapDark);
  mag.position.y = -0.07;
  rifle.add(mag);
  const trigger = new Mesh(new BoxGeometry(0.02, 0.045, 0.03), m.metal);
  trigger.position.set(0, -0.05, -0.04);
  rifle.add(trigger);
  const guard = new Mesh(new TorusGeometry(0.028, 0.006, 4, 8), m.metalBright);
  guard.position.set(0, -0.04, -0.03);
  rifle.add(guard);
  const optic = new Mesh(new BoxGeometry(0.035, 0.04, 0.14), m.accent);
  optic.position.set(0, 0.055, 0.04);
  rifle.add(optic);
  const lens = new Mesh(new CylinderGeometry(0.016, 0.016, 0.03, 6), mat(0x7ad0e8, { emissive: 0x4aa8c0, emissiveIntensity: 0.8 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.055, 0.12);
  rifle.add(lens);
  const rear = new Mesh(new BoxGeometry(0.03, 0.028, 0.04), m.metalBright);
  rear.position.set(0, 0.05, -0.08);
  rifle.add(rear);
  armR.add(rifle);
}

function addMageKit(armL: Group, kit: WardenKit, m: BodyMats) {
  const h = kit.bigWep ? 1.48 : 1.28;
  const staff = new Group();
  staff.name = "wep";
  staff.position.set(-0.12, -0.42, 0.28);
  const shaft = new Mesh(new CylinderGeometry(0.018, 0.024, h, 6), mat(0x3a3458, { roughness: 0.55, metalness: 0.25 }));
  shaft.position.y = h * 0.38;
  addPart(shaft, staff);
  for (const t of [0.08, 0.22, h * 0.62] as const) {
    const ring = new Mesh(new TorusGeometry(0.032, 0.008, 4, 8), m.accent);
    ring.position.y = t;
    staff.add(ring);
  }
  const cradle = new Mesh(new CylinderGeometry(0.04, 0.02, 0.08, 6), m.wrapMid);
  cradle.position.y = h * 0.7;
  staff.add(cradle);
  const crystal = new Mesh(new OctahedronGeometry(kit.bigWep ? 0.16 : 0.13, 0), m.accent);
  crystal.position.y = h * 0.82;
  addPart(crystal, staff);
  const core = new Mesh(new SphereGeometry(0.04, 6, 5), mat(0xffffff, { emissive: hex(kit.accent) || 0x8b7cc8, emissiveIntensity: 1.4 }));
  core.position.y = h * 0.82;
  staff.add(core);
  for (const [oy, s] of [
    [h * 0.74, 0.04],
    [h * 0.9, 0.032],
  ] as const) {
    const shard = new Mesh(new OctahedronGeometry(s, 0), m.metalBright);
    shard.position.y = oy;
    shard.rotation.z = 0.4;
    staff.add(shard);
  }
  armL.add(staff);
}

function dressFighter(
  g: Group,
  kit: WardenKit,
  skin: MeshStandardMaterial,
  skinDark: MeshStandardMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const steel = kit.heavy ? 0x9aa4ae : 0xd0d8e0;
  const m: BodyMats = {
    cloth: mat(0x1a2026, { roughness: 0.9 }),
    clothDark: mat(0x12161a, { roughness: 0.92 }),
    wrap: mat(kit.heavy ? 0x2a3238 : 0x343c44, { metalness: 0.28, roughness: 0.62 }),
    wrapDark: mat(0x14181c, { metalness: 0.35, roughness: 0.62 }),
    wrapMid: mat(kit.heavy ? 0x9aa4ae : 0xc8d0d8, { metalness: 0.88, roughness: 0.14 }),
    trim: mat(steel, { metalness: 0.88, roughness: 0.16 }),
    trimDark: mat(0x3a424a, { metalness: 0.7, roughness: 0.28 }),
    trimMid: mat(0xc8d0d8, { metalness: 0.9, roughness: 0.14 }),
    metal: mat(steel, { metalness: 0.86, roughness: 0.18 }),
    metalBright: mat(0xf0f4f8, { metalness: 0.94, roughness: 0.1, emissive: 0xb8c8d8, emissiveIntensity: 0.38 }),
    accent: mat(accentN, { metalness: 0.55, roughness: 0.22, emissive: accentN, emissiveIntensity: 0.55 }),
  };

  g.add(makeHunterLeg(-1, m, { bootFur: false, greave: true }));
  g.add(makeHunterLeg(1, m, { bootFur: false, greave: true }));
  addHunterHips(g, m);
  addHunterTorso(g, m, { xStraps: true, chestKind: "plate" });
  addHunterShoulders(g, m, "steel");
  for (const sx of [-1, 1] as const) {
    const ridge = new Mesh(new BoxGeometry(0.1, 0.06, 0.18), m.accent);
    ridge.position.set(sx * 0.28, 1.42, 0.04);
    ridge.rotation.z = sx * -0.2;
    g.add(ridge);
    const pauldronFin = new Mesh(new ConeGeometry(0.05, 0.16, 5), m.metalBright);
    pauldronFin.position.set(sx * 0.36, 1.48, 0);
    pauldronFin.rotation.z = sx * -0.55;
    addPart(pauldronFin, g);
  }
  for (let i = 0; i < 5; i++) {
    const lame = new Mesh(new BoxGeometry(0.35 - i * 0.018, 0.05, 0.125), i % 2 ? m.metal : m.metalBright);
    lame.position.set(0, 1.1 - i * 0.055, 0.175);
    addPart(lame, g);
  }
  for (const sx of [-1, 1] as const) {
    const fauld = new Mesh(new BoxGeometry(0.14, 0.2, 0.06), m.metal);
    fauld.position.set(sx * 0.16, 0.78, 0.2);
    fauld.rotation.x = 0.18;
    addPart(fauld, g);
    const rivet = new Mesh(new SphereGeometry(0.016, 5, 4), m.metalBright);
    rivet.position.set(sx * 0.1, 1.24, 0.24);
    g.add(rivet);
  }
  const plackart = new Mesh(new BoxGeometry(0.32, 0.1, 0.1), m.metalBright);
  plackart.position.set(0, 1.02, 0.2);
  addPart(plackart, g);
  const tabard = new Mesh(new BoxGeometry(0.18, 0.72, 0.045), m.accent);
  tabard.position.set(0, 0.78, 0.26);
  addPart(tabard, g);
  const tabardBack = new Mesh(new BoxGeometry(0.2, 0.64, 0.04), m.wrapDark);
  tabardBack.position.set(0, 0.82, -0.24);
  addPart(tabardBack, g);
  addSteelGorget(g, m);
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
  const brow = new Mesh(new BoxGeometry(0.26, 0.05, 0.08), m.metalBright);
  brow.position.set(0, 0.14, 0.16);
  head.add(brow);
  const slit = new Mesh(new BoxGeometry(0.18, 0.012, 0.02), mat(0xfff4c0, { emissive: 0xfff4c0, emissiveIntensity: 1.1 }));
  slit.position.set(0, 0.118, 0.205);
  head.add(slit);
  for (const sx of [-1, 1] as const) {
    const cheek = new Mesh(new BoxGeometry(0.05, 0.15, 0.12), m.metal);
    cheek.position.set(sx * 0.21, -0.03, 0.02);
    head.add(cheek);
  }
  const nape = new Mesh(new BoxGeometry(0.22, 0.12, 0.08), m.metal);
  nape.position.set(0, 0.02, -0.16);
  head.add(nape);
  const crest = new Mesh(new BoxGeometry(0.035, 0.2, 0.1), m.accent);
  crest.position.set(0, 0.26, -0.02);
  head.add(crest);
}

function dressRanger(
  g: Group,
  kit: WardenKit,
  skin: MeshStandardMaterial,
  skinDark: MeshStandardMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const m: BodyMats = {
    cloth: mat(0x262c26, { roughness: 0.92 }),
    clothDark: mat(0x161a16, { roughness: 0.94 }),
    wrap: mat(kit.heavy ? 0x28180e : 0x322012, { roughness: 0.78, metalness: 0.08 }),
    wrapDark: mat(0x1a1008, { roughness: 0.86 }),
    wrapMid: mat(kit.heavy ? 0x4a3220 : 0x5c3a26, { roughness: 0.68, metalness: 0.1 }),
    trim: mat(0xa07848, { roughness: 0.99, metalness: 0 }),
    trimDark: mat(0x5c3a22, { roughness: 0.99, metalness: 0 }),
    trimMid: mat(0x8a5e36, { roughness: 0.99, metalness: 0 }),
    metal: mat(0xe4ecf4, { metalness: 0.9, roughness: 0.16 }),
    metalBright: mat(0xf6fafc, { metalness: 0.96, roughness: 0.1, emissive: 0xb8c8d8, emissiveIntensity: 0.42 }),
    accent: mat(accentN, { metalness: 0.55, roughness: 0.18, emissive: accentN, emissiveIntensity: 0.7 }),
  };

  g.add(makeHunterLeg(-1, m, { bootFur: true }));
  g.add(makeHunterLeg(1, m, { bootFur: true }));
  addHunterHips(g, m);
  addHunterTorso(g, m, { xStraps: true, chestKind: "leather" });
  addHunterShoulders(g, m, "leather");
  addFurCollar(g, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "bare", gauntletFur: true });
  const armR = makeHunterArm(1, m, skin, { sleeve: "bare", gauntletFur: true });
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
    g.add(cell);
  }
  const bandolier = new Mesh(new BoxGeometry(0.06, 0.5, 0.03), m.wrapDark);
  bandolier.position.set(0.04, 1.12, 0.24);
  bandolier.rotation.z = 0.55;
  g.add(bandolier);
  const cape = new Mesh(new BoxGeometry(0.38, 0.55, 0.06), m.wrapDark);
  cape.position.set(0, 1.05, -0.26);
  cape.rotation.x = 0.18;
  addPart(cape, g);
  const capeFold = new Mesh(new BoxGeometry(0.16, 0.48, 0.04), m.wrapMid);
  capeFold.position.set(0.1, 1.0, -0.3);
  capeFold.rotation.x = 0.22;
  addPart(capeFold, g);
  const quiver = new Group();
  quiver.position.set(-0.16, 1.05, -0.24);
  quiver.rotation.z = 0.25;
  quiver.rotation.x = -0.15;
  const tube = new Mesh(new CylinderGeometry(0.055, 0.06, 0.42, 7), m.wrapDark);
  addPart(tube, quiver);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const shaft = new Mesh(new CylinderGeometry(0.008, 0.008, 0.38, 4), mat(0x4a3a22, { roughness: 0.85 }));
    shaft.position.set(Math.cos(a) * 0.025, 0.18, Math.sin(a) * 0.025);
    quiver.add(shaft);
    const fletch = new Mesh(new ConeGeometry(0.018, 0.06, 4), m.accent);
    fletch.position.set(Math.cos(a) * 0.025, 0.38, Math.sin(a) * 0.025);
    quiver.add(fletch);
  }
  g.add(quiver);

  const head = makeHunterHead(g, skin, skinDark, hairCol, "ranger");
  const band = new Mesh(new BoxGeometry(0.28, 0.035, 0.08), m.wrapDark);
  band.position.set(0, 0.14, 0.16);
  head.add(band);
  for (const sx of [-1, 1] as const) {
    const cup = new Mesh(new TorusGeometry(0.03, 0.01, 4, 8), m.metal);
    cup.position.set(sx * 0.07, 0.16, 0.2);
    head.add(cup);
    const glass = new Mesh(new SphereGeometry(0.022, 6, 4), mat(0x6aa8b8, { metalness: 0.4, roughness: 0.2, emissive: 0x3a7080, emissiveIntensity: 0.35 }));
    glass.position.set(sx * 0.07, 0.16, 0.21);
    head.add(glass);
  }
}

function dressMage(
  g: Group,
  kit: WardenKit,
  skin: MeshStandardMaterial,
  skinDark: MeshStandardMaterial,
  hairCol: MeshStandardMaterial,
) {
  const accentN = hex(kit.accent);
  const m: BodyMats = {
    cloth: mat(kit.heavy ? 0x2a2448 : 0x383264, { roughness: 0.86 }),
    clothDark: mat(0x1a1630, { roughness: 0.9 }),
    wrap: mat(kit.heavy ? 0x3c366c : 0x5c54a0, { roughness: 0.82 }),
    wrapDark: mat(kit.heavy ? 0x1c1834 : 0x2a2448, { roughness: 0.88 }),
    wrapMid: mat(kit.heavy ? 0x9a8cd8 : 0x8a82c4, { roughness: 0.64, emissive: accentN, emissiveIntensity: 0.22 }),
    trim: mat(0x6a62a0, { roughness: 0.8 }),
    trimDark: mat(0x2a2448, { roughness: 0.88 }),
    trimMid: mat(0x9a8ed4, { roughness: 0.72, emissive: accentN, emissiveIntensity: 0.18 }),
    metal: mat(0xc8c0e8, { metalness: 0.35, roughness: 0.35 }),
    metalBright: mat(accentN, { metalness: 0.2, roughness: 0.16, emissive: accentN, emissiveIntensity: 1.1 }),
    accent: mat(accentN, { metalness: 0.2, roughness: 0.16, emissive: accentN, emissiveIntensity: 1.2 }),
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
  overskirt.position.y = 0.62;
  addPart(overskirt, g);
  addHunterTorso(g, m, { xStraps: false, chestKind: "cloth" });
  addHunterShoulders(g, m, "cloth");
  addClothCowl(g, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "cloth", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "cloth", gauntletFur: false });
  addMageKit(armL, kit, m);
  g.add(armL);
  g.add(armR);

  for (const sx of [-1, 1] as const) {
    const bell = new Mesh(new CylinderGeometry(0.18, 0.1, 0.28, 7), m.wrap);
    bell.position.set(sx * 0.38, 1.02, 0.02);
    bell.rotation.z = sx * 0.35;
    addPart(bell, g);
  }
  const sash = new Mesh(new BoxGeometry(0.08, 0.42, 0.04), m.trimMid);
  sash.position.set(0.12, 0.72, 0.22);
  sash.rotation.z = -0.15;
  addPart(sash, g);
  const rune = new Mesh(new TorusGeometry(0.07, 0.012, 6, 12), m.accent);
  rune.position.set(0, 1.2, 0.26);
  g.add(rune);
  const runeCore = new Mesh(new SphereGeometry(0.03, 6, 5), m.metalBright);
  runeCore.position.set(0, 1.2, 0.28);
  g.add(runeCore);
  const orbit = new Group();
  orbit.name = "orbit";
  orbit.position.set(0, 1.28, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const shard = new Mesh(new OctahedronGeometry(0.04, 0), m.accent);
    shard.position.set(Math.cos(a) * 0.46, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.28);
    orbit.add(shard);
  }
  g.add(orbit);

  const head = makeHunterHead(g, skin, skinDark, hairCol, "mage");
  const hoodPanel = new Mesh(new BoxGeometry(0.3, 0.4, 0.08), m.wrapDark);
  hoodPanel.position.set(0, 0.02, -0.22);
  hoodPanel.rotation.x = 0.25;
  addPart(hoodPanel, head);
  const hoodFold = new Mesh(new BoxGeometry(0.22, 0.3, 0.05), m.wrap);
  hoodFold.position.set(0, -0.08, -0.28);
  hoodFold.rotation.x = 0.42;
  head.add(hoodFold);
  const hoodTip = new Mesh(new ConeGeometry(0.08, 0.18, 5), m.wrapDark);
  hoodTip.position.set(0, -0.22, -0.3);
  hoodTip.rotation.x = 1.15;
  head.add(hoodTip);
  for (const sx of [-1, 1] as const) {
    const sideHood = new Mesh(new BoxGeometry(0.08, 0.28, 0.16), m.wrap);
    sideHood.position.set(sx * 0.16, -0.02, -0.16);
    sideHood.rotation.y = sx * -0.35;
    head.add(sideHood);
    const cuff = new Mesh(new TorusGeometry(0.04, 0.01, 4, 8), m.accent);
    cuff.position.set(sx * 0.19, 0.02, 0.02);
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

  const skinTone = id === "mage" ? 0xd8b896 : id === "ranger" ? 0xb89068 : 0xc8a07c;
  const skinShade = id === "mage" ? 0xb08a68 : id === "ranger" ? 0x8a6848 : 0x9a7454;
  const skin = mat(skinTone, { roughness: 0.62, metalness: 0.02 });
  const skinDark = mat(skinShade, { roughness: 0.74, metalness: 0.02 });
  const hairCol = mat(id === "mage" ? 0x2a1838 : id === "ranger" ? 0x2a1c10 : 0x1a1208, { roughness: 0.97 });

  if (id === "fighter") dressFighter(g, kit, skin, skinDark, hairCol);
  else if (id === "ranger") dressRanger(g, kit, skin, skinDark, hairCol);
  else dressMage(g, kit, skin, skinDark, hairCol);

  return g;
}
