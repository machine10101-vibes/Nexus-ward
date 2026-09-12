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

/** Hunterscape Hunter head — jaw, stubble, brows, full eyes, spiky hair. Face stays open. */
function makeHunterHead(
  parent: Object3D,
  skin: MeshStandardMaterial,
  skinDark: MeshStandardMaterial,
  hairCol: MeshStandardMaterial,
) {
  const head = new Group();
  head.name = "playerHead";
  head.position.set(0, 1.6, 0.02);
  head.rotation.x = -0.14;

  const skull = new Mesh(new SphereGeometry(0.2, 12, 10), skin);
  skull.scale.set(1.02, 1.14, 1.0);
  addPart(skull, head, 1.1, 0x1a1008);

  const jaw = new Mesh(new BoxGeometry(0.28, 0.17, 0.22), skinDark);
  jaw.position.set(0, -0.13, 0.08);
  addPart(jaw, head);
  const chin = new Mesh(new BoxGeometry(0.13, 0.1, 0.13), skinDark);
  chin.position.set(0, -0.2, 0.15);
  head.add(chin);
  const stubble = new Mesh(new BoxGeometry(0.24, 0.09, 0.07), mat(0x5a4030, { roughness: 0.95 }));
  stubble.position.set(0, -0.15, 0.17);
  head.add(stubble);

  for (const sx of [-1, 1] as const) {
    const cheek = new Mesh(new BoxGeometry(0.09, 0.13, 0.13), skinDark);
    cheek.position.set(sx * 0.145, -0.02, 0.12);
    head.add(cheek);
  }

  const noseBridge = new Mesh(new BoxGeometry(0.05, 0.1, 0.08), skinDark);
  noseBridge.position.set(0, 0.03, 0.19);
  head.add(noseBridge);
  const nose = new Mesh(new BoxGeometry(0.07, 0.07, 0.12), skinDark);
  nose.position.set(0, -0.03, 0.24);
  head.add(nose);

  for (const sx of [-1, 1] as const) {
    const brow = new Mesh(new BoxGeometry(0.11, 0.042, 0.055), hairCol);
    brow.position.set(sx * 0.085, 0.095, 0.19);
    brow.rotation.z = sx * -0.22;
    head.add(brow);
    const browRidge = new Mesh(new BoxGeometry(0.08, 0.025, 0.04), mat(0x2a1a10, { roughness: 0.9 }));
    browRidge.position.set(sx * 0.085, 0.075, 0.205);
    browRidge.rotation.z = sx * -0.18;
    head.add(browRidge);
  }

  for (const sx of [-1, 1] as const) {
    const socket = new Mesh(new SphereGeometry(0.055, 7, 5), mat(0x0c0806));
    socket.position.set(sx * 0.08, 0.03, 0.175);
    head.add(socket);
    const sclera = new Mesh(new SphereGeometry(0.038, 6, 5), mat(0xe8e0d4, { roughness: 0.45 }));
    sclera.position.set(sx * 0.08, 0.03, 0.21);
    head.add(sclera);
    const iris = new Mesh(new SphereGeometry(0.026, 6, 5), mat(0x4a3424, { emissive: 0x3a2818, emissiveIntensity: 0.65 }));
    iris.position.set(sx * 0.08, 0.03, 0.235);
    head.add(iris);
    const pupil = new Mesh(new SphereGeometry(0.012, 4, 3), mat(0x0a0604));
    pupil.position.set(sx * 0.08, 0.03, 0.25);
    head.add(pupil);
    const hl = new Mesh(new SphereGeometry(0.01, 4, 3), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 }));
    hl.position.set(sx * 0.072, 0.04, 0.255);
    head.add(hl);
    const ear = new Mesh(new BoxGeometry(0.055, 0.1, 0.05), skin);
    ear.position.set(sx * 0.19, 0.02, 0);
    head.add(ear);
  }

  const mouth = new Mesh(new BoxGeometry(0.11, 0.022, 0.045), mat(0x3a2014));
  mouth.position.set(0, -0.145, 0.2);
  head.add(mouth);

  const hairCap = new Mesh(new SphereGeometry(0.195, 8, 5), hairCol);
  hairCap.position.set(0, 0.08, -0.04);
  hairCap.scale.set(1.08, 0.72, 1.05);
  addPart(hairCap, head);

  const spikePts: [number, number, number, number][] = [
    [0, 0.24, 0.0, 1.2],
    [-0.09, 0.22, 0.04, 1.05],
    [0.09, 0.22, 0.04, 1.05],
    [-0.14, 0.17, -0.04, 1.0],
    [0.14, 0.17, -0.04, 1.0],
    [0, 0.2, -0.14, 1.1],
    [-0.12, 0.15, -0.12, 0.95],
    [0.12, 0.15, -0.12, 0.95],
    [-0.07, 0.24, -0.06, 1.15],
    [0.07, 0.24, -0.06, 1.15],
    [0, 0.26, 0.06, 0.9],
    [-0.16, 0.11, 0.0, 0.85],
    [0.16, 0.11, 0.0, 0.85],
    [-0.05, 0.28, -0.02, 1.0],
    [0.05, 0.28, -0.02, 1.0],
    [-0.1, 0.2, 0.08, 0.8],
    [0.1, 0.2, 0.08, 0.8],
  ];
  for (const [x, y, z, s] of spikePts) {
    const spike = new Mesh(new ConeGeometry(0.042 * s, 0.145 * s, 4), hairCol);
    spike.position.set(x, y, z);
    spike.rotation.x = z * 0.9 - 0.15;
    spike.rotation.z = -x * 1.4;
    head.add(spike);
  }

  parent.add(head);
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
  }

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

  const hand = new Mesh(new BoxGeometry(0.1, 0.1, 0.12), skin);
  hand.position.set(side * 0.16, -0.46, 0.04);
  addPart(hand, arm);

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
      new BoxGeometry(kind === "steel" ? 0.2 : 0.15, kind === "steel" ? 0.12 : 0.09, kind === "steel" ? 0.2 : 0.17),
      kind === "steel" ? m.metalBright : kind === "cloth" ? m.wrapMid : m.wrapMid,
    );
    pad.position.set(sx * (kind === "steel" ? 0.26 : 0.24), 1.4, 0);
    pad.rotation.z = sx * -0.18;
    addPart(pad, g, 1.05);
    const pad2 = new Mesh(
      new BoxGeometry(kind === "steel" ? 0.16 : 0.12, 0.07, kind === "steel" ? 0.16 : 0.14),
      kind === "steel" ? m.metal : m.wrapDark,
    );
    pad2.position.set(sx * (kind === "steel" ? 0.32 : 0.28), 1.34, 0.02);
    pad2.rotation.z = sx * -0.28;
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
  const blade = kit.bigWep ? 0.78 : 0.58;
  const sword = new Group();
  sword.position.set(0.22, -0.42, 0.16);
  sword.rotation.set(0.15, 0.35, -0.9);
  const hilt = new Mesh(new CylinderGeometry(0.02, 0.024, 0.16, 6), mat(0x3a2e24, { roughness: 0.8 }));
  hilt.rotation.z = Math.PI / 2;
  sword.add(hilt);
  const guard = new Mesh(new BoxGeometry(0.05, 0.18, 0.04), m.metalBright);
  guard.position.x = 0.08;
  sword.add(guard);
  const bladeM = new Mesh(new BoxGeometry(blade, 0.07, 0.016), mat(0xe8eef4, { metalness: 0.92, roughness: 0.1 }));
  bladeM.position.x = 0.1 + blade / 2;
  addPart(bladeM, sword);
  const edge = new Mesh(new BoxGeometry(blade * 0.94, 0.016, 0.008), m.accent);
  edge.position.set(0.1 + blade / 2, 0, 0.01);
  sword.add(edge);
  armR.add(sword);

  const shield = new Group();
  shield.position.set(-0.22, -0.2, 0.16);
  shield.rotation.y = 0.7;
  const disc = new Mesh(new BoxGeometry(0.08, 0.42, 0.32), m.metalBright);
  addPart(disc, shield, 1.04);
  const boss = new Mesh(new TorusGeometry(0.07, 0.016, 4, 10), m.accent);
  boss.rotation.y = Math.PI / 2;
  boss.position.x = 0.05;
  shield.add(boss);
  armL.add(shield);
}

function addRangerKit(armR: Group, kit: WardenKit, m: BodyMats) {
  const body = kit.bigWep ? 0.62 : 0.48;
  const rifle = new Group();
  rifle.position.set(0.18, -0.38, 0.18);
  rifle.rotation.set(1.15, 0.2, 0.15);
  const rec = new Mesh(new BoxGeometry(0.07, 0.08, body), mat(0x1a2026, { metalness: 0.65, roughness: 0.28 }));
  addPart(rec, rifle);
  const barrel = new Mesh(
    new CylinderGeometry(0.014, 0.018, kit.bigWep ? 0.3 : 0.2, 6),
    mat(0x8a949c, { metalness: 0.85, roughness: 0.16 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = body * 0.52;
  rifle.add(barrel);
  const mag = new Mesh(new BoxGeometry(0.035, 0.09, 0.08), m.wrapDark);
  mag.position.y = -0.06;
  rifle.add(mag);
  const optic = new Mesh(new BoxGeometry(0.04, 0.045, 0.09), m.accent);
  optic.position.set(0, 0.06, 0.06);
  rifle.add(optic);
  armR.add(rifle);
}

function addMageKit(armL: Group, kit: WardenKit, m: BodyMats) {
  const h = kit.bigWep ? 1.15 : 0.92;
  const staff = new Group();
  staff.position.set(-0.18, -0.5, 0.08);
  const shaft = new Mesh(new CylinderGeometry(0.016, 0.022, h, 6), mat(0x4a4468, { roughness: 0.55, metalness: 0.25 }));
  shaft.position.y = h * 0.35;
  addPart(shaft, staff);
  const bind = new Mesh(new TorusGeometry(0.03, 0.008, 4, 8), m.accent);
  bind.position.y = 0.12;
  staff.add(bind);
  const crystal = new Mesh(new OctahedronGeometry(kit.bigWep ? 0.11 : 0.085, 0), m.accent);
  crystal.position.y = h * 0.72;
  addPart(crystal, staff);
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
    wrap: mat(kit.heavy ? 0x3a424a : 0x4a525a, { metalness: 0.35, roughness: 0.55 }),
    wrapDark: mat(0x1c2228, { metalness: 0.4, roughness: 0.55 }),
    wrapMid: mat(kit.heavy ? 0x8a929c : 0xb0b8c2, { metalness: 0.82, roughness: 0.18 }),
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
  }
  addSteelGorget(g, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "steel", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "steel", gauntletFur: false });
  addFighterKit(armR, armL, kit, m);
  g.add(armL);
  g.add(armR);

  const head = makeHunterHead(g, skin, skinDark, hairCol);
  const brow = new Mesh(new BoxGeometry(0.22, 0.05, 0.08), m.metalBright);
  brow.position.set(0, 0.1, 0.18);
  head.add(brow);
  const crest = new Mesh(new BoxGeometry(0.04, 0.14, 0.08), m.accent);
  crest.position.set(0, 0.22, -0.02);
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
  makeHunterHead(g, skin, skinDark, hairCol);
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
    wrap: mat(kit.heavy ? 0x3c366c : 0x564e96, { roughness: 0.82 }),
    wrapDark: mat(kit.heavy ? 0x282244 : 0x383264, { roughness: 0.86 }),
    wrapMid: mat(kit.heavy ? 0x8a7cc8 : 0x7a72b0, { roughness: 0.7, emissive: accentN, emissiveIntensity: 0.12 }),
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
  ] as const) {
    const fold = new Mesh(new BoxGeometry(0.16, 0.46, 0.05), m.wrapDark);
    fold.position.set(x, 0.52, z);
    fold.rotation.y = ry;
    addPart(fold, g);
  }
  const skirt = new Mesh(new CylinderGeometry(0.36, 0.2, 0.58, 8), m.wrap);
  skirt.position.y = 0.52;
  addPart(skirt, g, 1.04);
  addHunterTorso(g, m, { xStraps: false, chestKind: "cloth" });
  addHunterShoulders(g, m, "cloth");
  addClothCowl(g, m);
  const armL = makeHunterArm(-1, m, skin, { sleeve: "cloth", gauntletFur: false });
  const armR = makeHunterArm(1, m, skin, { sleeve: "cloth", gauntletFur: false });
  addMageKit(armL, kit, m);
  g.add(armL);
  g.add(armR);

  const head = makeHunterHead(g, skin, skinDark, hairCol);
  const hoodBack = new Mesh(new ConeGeometry(0.16, 0.28, 6), m.wrapDark);
  hoodBack.position.set(0, 0.04, -0.24);
  hoodBack.rotation.x = -1.15;
  addPart(hoodBack, head);
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

  const skin = mat(0xc8a07c, { roughness: 0.7, metalness: 0.03 });
  const skinDark = mat(0x9a7454, { roughness: 0.78, metalness: 0.03 });
  const hairCol = mat(0x1e1208, { roughness: 0.97 });

  if (id === "fighter") dressFighter(g, kit, skin, skinDark, hairCol);
  else if (id === "ranger") dressRanger(g, kit, skin, skinDark, hairCol);
  else dressMage(g, kit, skin, skinDark, hairCol);

  return g;
}
