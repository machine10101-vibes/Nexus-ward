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
      strand.position.set(cx + Math.cos(a2) * (radJ * 0.94), cy + lenJ * 0.12 + lift * 0.5, cz + Math.sin(a2) * (radJ * 0.94));
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

function makeHead(parent: Object3D, skin: MeshStandardMaterial, skinDark: MeshStandardMaterial, hairCol: MeshStandardMaterial) {
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

function dressFighter(g: Group, kit: WardenKit, skin: MeshStandardMaterial, skinDark: MeshStandardMaterial, hairCol: MeshStandardMaterial) {
  const accentN = hex(kit.accent);
  const steel = mat(kit.heavy ? 0x8a929c : 0xc8d0d8, { metalness: 0.86, roughness: 0.18 });
  const steelMid = mat(kit.heavy ? 0x6a727c : 0x9aa4ae, { metalness: 0.8, roughness: 0.22 });
  const steelDark = mat(0x2a323a, { metalness: 0.55, roughness: 0.4 });
  const under = mat(0x1a2026, { roughness: 0.9 });
  const bright = mat(0xe8eef4, { metalness: 0.92, roughness: 0.12, emissive: 0xb8c8d8, emissiveIntensity: 0.35 });
  const gold = mat(accentN, { metalness: 0.55, roughness: 0.22, emissive: accentN, emissiveIntensity: 0.55 });

  const makeLeg = (side: number) => {
    const leg = new Group();
    const thigh = new Mesh(new CylinderGeometry(0.12, 0.14, 0.42, 6), under);
    thigh.position.set(0, 0.55, 0);
    addPart(thigh, leg);
    const shin = new Mesh(new CylinderGeometry(0.11, 0.12, 0.28, 6), steelDark);
    shin.position.set(0, 0.28, 0.02);
    addPart(shin, leg);
    const greave = new Mesh(new BoxGeometry(0.16, 0.26, 0.12), steel);
    greave.position.set(0, 0.3, 0.06);
    addPart(greave, leg, 1.05);
    const boot = new Mesh(new CylinderGeometry(0.12, 0.14, 0.36, 6), steelDark);
    boot.position.set(0, 0.18, 0.02);
    addPart(boot, leg, 1.06);
    const foot = new Mesh(new BoxGeometry(0.18, 0.1, 0.3), steelDark);
    foot.position.set(0, 0.05, 0.09);
    addPart(foot, leg);
    const sole = new Mesh(new BoxGeometry(0.19, 0.045, 0.32), mat(0x0c1014, { roughness: 0.95 }));
    sole.position.set(0, 0.02, 0.08);
    leg.add(sole);
    for (let i = 0; i < 3; i++) {
      const strap = new Mesh(new TorusGeometry(0.13, 0.016, 4, 8), bright);
      strap.rotation.x = Math.PI / 2;
      strap.position.set(0, 0.14 + i * 0.09, 0.03);
      leg.add(strap);
    }
    leg.position.x = side * 0.17;
    return leg;
  };
  g.add(makeLeg(-1));
  g.add(makeLeg(1));

  const hips = new Mesh(new CylinderGeometry(0.26, 0.3, 0.22, 8), steelDark);
  hips.position.y = 0.78;
  addPart(hips, g);
  for (const [z, ry] of [[0.16, 0], [-0.16, Math.PI]] as const) {
    const flap = new Mesh(new BoxGeometry(0.3, 0.22, 0.06), steelMid);
    flap.position.set(0, 0.68, z);
    flap.rotation.y = ry;
    addPart(flap, g);
  }
  for (const sx of [-1, 1] as const) {
    const flap = new Mesh(new BoxGeometry(0.07, 0.2, 0.18), steel);
    flap.position.set(sx * 0.24, 0.68, 0);
    addPart(flap, g);
  }

  const torso = new Mesh(new CylinderGeometry(0.26, 0.3, 0.55, 8), under);
  torso.position.y = 1.12;
  addPart(torso, g, 1.06);
  const pecL = new Mesh(new BoxGeometry(0.2, 0.22, 0.12), steel);
  pecL.position.set(-0.1, 1.22, 0.16);
  addPart(pecL, g);
  const pecR = new Mesh(new BoxGeometry(0.2, 0.22, 0.12), steel);
  pecR.position.set(0.1, 1.22, 0.16);
  addPart(pecR, g);
  const belly = new Mesh(new BoxGeometry(0.32, 0.16, 0.1), steelMid);
  belly.position.set(0, 1.02, 0.14);
  addPart(belly, g);
  const belt = new Mesh(new CylinderGeometry(0.3, 0.3, 0.1, 10), steelDark);
  belt.position.y = 0.88;
  addPart(belt, g);
  const buckle = new Mesh(new BoxGeometry(0.14, 0.1, 0.07), gold);
  buckle.position.set(0, 0.88, 0.3);
  g.add(buckle);
  const crest = new Mesh(new OctahedronGeometry(0.08, 0), gold);
  crest.scale.set(1.2, 0.9, 0.45);
  crest.position.set(0, 1.2, 0.28);
  g.add(crest);

  for (const sx of [-1, 1] as const) {
    const pad = new Mesh(new BoxGeometry(0.2, 0.12, 0.2), bright);
    pad.position.set(sx * 0.28, 1.4, 0);
    pad.rotation.z = sx * -0.22;
    addPart(pad, g, 1.06);
    const pad2 = new Mesh(new BoxGeometry(0.15, 0.09, 0.16), steel);
    pad2.position.set(sx * 0.34, 1.32, 0.02);
    pad2.rotation.z = sx * -0.32;
    addPart(pad2, g);
    const ring = new Mesh(new TorusGeometry(0.04, 0.012, 4, 8), gold);
    ring.position.set(sx * 0.22, 1.38, 0.12);
    g.add(ring);
  }

  const makeArm = (side: number) => {
    const arm = new Group();
    const upper = new Mesh(new CylinderGeometry(0.11, 0.12, 0.34, 7), steel);
    upper.position.set(0, 0, 0);
    upper.rotation.z = side * 0.32;
    addPart(upper, arm, 1.04);
    const gauntlet = new Mesh(new CylinderGeometry(0.1, 0.12, 0.3, 7), bright);
    gauntlet.position.set(side * 0.12, -0.3, 0.02);
    gauntlet.rotation.z = side * 0.2;
    addPart(gauntlet, arm, 1.05);
    for (let i = 0; i < 2; i++) {
      const s = new Mesh(new TorusGeometry(0.12, 0.014, 4, 8), gold);
      s.rotation.x = Math.PI / 2;
      s.position.set(side * 0.12, -0.22 - i * 0.1, 0.02);
      arm.add(s);
    }
    const hand = new Mesh(new BoxGeometry(0.11, 0.1, 0.12), skin);
    hand.position.set(side * 0.16, -0.46, 0.04);
    addPart(hand, arm);
    if (side > 0) {
      const blade = kit.bigWep ? 0.78 : 0.58;
      const sword = new Group();
      sword.position.set(side * 0.22, -0.42, 0.16);
      sword.rotation.set(0.15, 0.35, -0.9);
      const hilt = new Mesh(new CylinderGeometry(0.02, 0.024, 0.16, 6), mat(0x3a2e24, { roughness: 0.8 }));
      hilt.rotation.z = Math.PI / 2;
      sword.add(hilt);
      const guard = new Mesh(new BoxGeometry(0.05, 0.18, 0.04), bright);
      guard.position.x = 0.08;
      sword.add(guard);
      const bladeM = new Mesh(new BoxGeometry(blade, 0.07, 0.016), mat(0xe8eef4, { metalness: 0.92, roughness: 0.1 }));
      bladeM.position.x = 0.1 + blade / 2;
      addPart(bladeM, sword);
      const edge = new Mesh(new BoxGeometry(blade * 0.94, 0.016, 0.008), gold);
      edge.position.set(0.1 + blade / 2, 0, 0.01);
      sword.add(edge);
      arm.add(sword);
    } else {
      const shield = new Group();
      shield.position.set(side * 0.22, -0.2, 0.16);
      shield.rotation.y = 0.7;
      const disc = new Mesh(new BoxGeometry(0.08, 0.42, 0.32), bright);
      addPart(disc, shield, 1.04);
      const boss = new Mesh(new TorusGeometry(0.07, 0.016, 4, 10), gold);
      boss.rotation.y = Math.PI / 2;
      boss.position.x = 0.05;
      shield.add(boss);
      arm.add(shield);
    }
    arm.position.set(side * 0.38, 1.28, 0);
    return arm;
  };
  g.add(makeArm(-1));
  g.add(makeArm(1));

  const head = makeHead(g, skin, skinDark, hairCol);
  const helm = new Mesh(new SphereGeometry(0.22, 10, 8), bright);
  helm.scale.set(1.08, 0.85, 1.05);
  helm.position.set(0, 0.06, -0.02);
  addPart(helm, head, 1.08);
  const visor = new Mesh(new BoxGeometry(0.28, 0.07, 0.08), gold);
  visor.position.set(0, -0.02, 0.2);
  head.add(visor);
  const slit = new Mesh(new BoxGeometry(0.22, 0.02, 0.02), mat(0xfff4c0, { emissive: 0xfff4c0, emissiveIntensity: 1.4 }));
  slit.position.set(0, -0.02, 0.25);
  head.add(slit);
  const crestFin = new Mesh(new BoxGeometry(0.04, 0.16, 0.1), gold);
  crestFin.position.set(0, 0.22, -0.02);
  head.add(crestFin);
}

function dressRanger(g: Group, kit: WardenKit, skin: MeshStandardMaterial, skinDark: MeshStandardMaterial, hairCol: MeshStandardMaterial) {
  const accentN = hex(kit.accent);
  const weave = mat(kit.heavy ? 0x3a4a4e : 0x4a5e5a, { roughness: 0.88 });
  const kitCol = mat(kit.heavy ? 0x5a6c72 : 0x6e848a, { metalness: 0.35, roughness: 0.42 });
  const strap = mat(0x1a2024, { roughness: 0.9 });
  const cloth = mat(0x262c26, { roughness: 0.92 });
  const clothDark = mat(0x161a16, { roughness: 0.94 });
  const leather = mat(0x322012, { roughness: 0.78, metalness: 0.08 });
  const leatherDark = mat(0x1a1008, { roughness: 0.86 });
  const leatherMid = mat(0x5c3a26, { roughness: 0.68, metalness: 0.1 });
  const fur = mat(0xa07848, { roughness: 0.99, metalness: 0 });
  const furDark = mat(0x5c3a22, { roughness: 0.99, metalness: 0 });
  const furMid = mat(0x8a5e36, { roughness: 0.99, metalness: 0 });
  const glow = mat(accentN, { metalness: 0.55, roughness: 0.18, emissive: accentN, emissiveIntensity: 0.7 });

  const makeLeg = (side: number) => {
    const leg = new Group();
    const thigh = new Mesh(new CylinderGeometry(0.1, 0.12, 0.42, 6), cloth);
    thigh.position.set(0, 0.55, 0);
    addPart(thigh, leg);
    const shin = new Mesh(new CylinderGeometry(0.095, 0.105, 0.28, 6), clothDark);
    shin.position.set(0, 0.28, 0.02);
    addPart(shin, leg);
    const boot = new Mesh(new CylinderGeometry(0.11, 0.125, 0.36, 6), leather);
    boot.position.set(0, 0.18, 0.02);
    addPart(boot, leg, 1.06);
    const foot = new Mesh(new BoxGeometry(0.16, 0.09, 0.28), leatherDark);
    foot.position.set(0, 0.05, 0.08);
    addPart(foot, leg);
    const sole = new Mesh(new BoxGeometry(0.17, 0.04, 0.3), mat(0x120c08, { roughness: 0.95 }));
    sole.position.set(0, 0.02, 0.07);
    leg.add(sole);
    for (let i = 0; i < 3; i++) {
      const s = new Mesh(new TorusGeometry(0.12, 0.016, 4, 10), leatherMid);
      s.rotation.x = Math.PI / 2;
      s.position.set(0, 0.12 + i * 0.1, 0.02);
      leg.add(s);
    }
    addSpikes(leg, 0, 0.36, 0.02, 0.12, 12, 0.09, 0.022, fur, furDark, furMid);
    addSpikes(leg, 0, 0.08, 0.04, 0.11, 10, 0.07, 0.018, fur, furDark, furMid);
    leg.position.x = side * 0.16;
    return leg;
  };
  g.add(makeLeg(-1));
  g.add(makeLeg(1));

  const hips = new Mesh(new CylinderGeometry(0.23, 0.27, 0.2, 8), leather);
  hips.position.y = 0.78;
  addPart(hips, g);
  for (const [z, ry] of [[0.15, 0], [-0.15, Math.PI]] as const) {
    const flap = new Mesh(new BoxGeometry(0.26, 0.2, 0.05), leatherDark);
    flap.position.set(0, 0.68, z);
    flap.rotation.y = ry;
    addPart(flap, g);
  }

  const torso = new Mesh(new CylinderGeometry(0.22, 0.27, 0.52, 8), weave);
  torso.position.y = 1.12;
  addPart(torso, g, 1.06);
  const vest = new Mesh(new BoxGeometry(0.36, 0.26, 0.14), kitCol);
  vest.position.set(0, 1.2, 0.14);
  addPart(vest, g);
  const undershirt = new Mesh(new CylinderGeometry(0.18, 0.2, 0.1, 8), cloth);
  undershirt.position.set(0, 1.36, 0.02);
  g.add(undershirt);
  const belt = new Mesh(new CylinderGeometry(0.27, 0.27, 0.09, 10), leatherDark);
  belt.position.y = 0.88;
  addPart(belt, g);
  const buckle = new Mesh(new BoxGeometry(0.12, 0.08, 0.06), glow);
  buckle.position.set(0, 0.88, 0.28);
  g.add(buckle);

  for (const rotZ of [0.55, -0.55] as const) {
    const front = new Mesh(new BoxGeometry(0.07, 0.52, 0.035), strap);
    front.position.set(0, 1.16, 0.24);
    front.rotation.z = rotZ;
    g.add(front);
    const back = new Mesh(new BoxGeometry(0.07, 0.52, 0.035), strap);
    back.position.set(0, 1.16, -0.2);
    back.rotation.z = rotZ;
    g.add(back);
  }
  for (const sx of [-1, 1] as const) {
    const pouch = new Mesh(new BoxGeometry(0.09, 0.1, 0.07), leatherDark);
    pouch.position.set(sx * 0.12, 1.0, 0.22);
    addPart(pouch, g);
  }
  if (kit.heavy) {
    for (const sx of [-1, 1] as const) {
      const cell = new Mesh(new BoxGeometry(0.06, 0.06, 0.04), glow);
      cell.position.set(sx * 0.1, 1.18, 0.24);
      g.add(cell);
    }
  }

  for (const sx of [-1, 1] as const) {
    const pad = new Mesh(new BoxGeometry(0.13, 0.08, 0.15), kitCol);
    pad.position.set(sx * 0.24, 1.38, 0);
    pad.rotation.z = sx * -0.18;
    addPart(pad, g);
    addSpikes(g, sx * 0.3, 1.32, 0.04, 0.12, 12, 0.12, 0.022, fur, furDark, furMid);
  }

  const collar = new Mesh(new TorusGeometry(0.2, 0.07, 5, 12), furMid);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.4, 0);
  addPart(collar, g);
  addSpikes(g, 0, 1.4, 0, 0.26, 22, 0.16, 0.028, fur, furDark, furMid);
  addSpikes(g, 0, 1.5, -0.04, 0.22, 16, 0.13, 0.022, fur, furDark, furMid, 0.2);

  const makeArm = (side: number) => {
    const arm = new Group();
    const upper = new Mesh(new CylinderGeometry(0.09, 0.1, 0.34, 7), skin);
    upper.position.set(0, 0, 0);
    upper.rotation.z = side * 0.32;
    addPart(upper, arm);
    const cuff = new Mesh(new CylinderGeometry(0.095, 0.105, 0.08, 6), cloth);
    cuff.position.set(side * -0.02, 0.12, 0);
    cuff.rotation.z = side * 0.32;
    arm.add(cuff);
    const gauntlet = new Mesh(new CylinderGeometry(0.09, 0.108, 0.28, 7), leather);
    gauntlet.position.set(side * 0.12, -0.3, 0.02);
    gauntlet.rotation.z = side * 0.2;
    addPart(gauntlet, arm, 1.05);
    addSpikes(arm, side * 0.08, -0.12, 0.02, 0.1, 12, 0.085, 0.02, fur, furDark, furMid);
    const hand = new Mesh(new BoxGeometry(0.1, 0.1, 0.12), skin);
    hand.position.set(side * 0.16, -0.46, 0.04);
    addPart(hand, arm);
    if (side > 0) {
      const body = kit.bigWep ? 0.62 : 0.48;
      const rifle = new Group();
      rifle.position.set(side * 0.18, -0.38, 0.18);
      rifle.rotation.set(1.15, 0.2, 0.15);
      const rec = new Mesh(new BoxGeometry(0.07, 0.08, body), mat(0x1a2026, { metalness: 0.65, roughness: 0.28 }));
      addPart(rec, rifle);
      const barrel = new Mesh(new CylinderGeometry(0.014, 0.018, kit.bigWep ? 0.3 : 0.2, 6), mat(0x8a949c, { metalness: 0.85, roughness: 0.16 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = body * 0.52;
      rifle.add(barrel);
      const mag = new Mesh(new BoxGeometry(0.035, 0.09, 0.08), strap);
      mag.position.y = -0.06;
      rifle.add(mag);
      const optic = new Mesh(new BoxGeometry(0.04, 0.045, 0.09), glow);
      optic.position.set(0, 0.06, 0.06);
      rifle.add(optic);
      arm.add(rifle);
    }
    arm.position.set(side * 0.34, 1.28, 0);
    return arm;
  };
  g.add(makeArm(-1));
  g.add(makeArm(1));

  const head = makeHead(g, skin, skinDark, hairCol);
  const visor = new Mesh(new BoxGeometry(0.28, 0.05, 0.08), glow);
  visor.position.set(0, 0.04, 0.2);
  head.add(visor);
  const slit = new Mesh(new BoxGeometry(0.2, 0.016, 0.02), mat(0xe8f4f8, { emissive: 0xe8f4f8, emissiveIntensity: 0.9 }));
  slit.position.set(0, 0.04, 0.25);
  head.add(slit);
}

function dressMage(g: Group, kit: WardenKit, skin: MeshStandardMaterial, skinDark: MeshStandardMaterial, hairCol: MeshStandardMaterial) {
  const accentN = hex(kit.accent);
  const veil = mat(kit.heavy ? 0x3c366c : 0x564e96, { roughness: 0.82 });
  const deep = mat(kit.heavy ? 0x282244 : 0x383264, { roughness: 0.86 });
  const lining = mat(kit.heavy ? 0x8a7cc8 : 0x7a72b0, { roughness: 0.7, emissive: accentN, emissiveIntensity: 0.12 });
  const glow = mat(accentN, { metalness: 0.2, roughness: 0.16, emissive: accentN, emissiveIntensity: 1.2 });
  const wood = mat(0x4a4468, { roughness: 0.55, metalness: 0.25 });

  const makeLeg = (side: number) => {
    const leg = new Group();
    const thigh = new Mesh(new CylinderGeometry(0.1, 0.12, 0.42, 6), deep);
    thigh.position.set(0, 0.55, 0);
    addPart(thigh, leg);
    const shin = new Mesh(new CylinderGeometry(0.09, 0.1, 0.3, 6), veil);
    shin.position.set(0, 0.26, 0.02);
    addPart(shin, leg);
    const boot = new Mesh(new BoxGeometry(0.15, 0.09, 0.26), mat(0x1a1624, { roughness: 0.8 }));
    boot.position.set(0, 0.05, 0.07);
    addPart(boot, leg);
    const sole = new Mesh(new BoxGeometry(0.16, 0.035, 0.28), mat(0x0c0a12, { roughness: 0.95 }));
    sole.position.set(0, 0.02, 0.06);
    leg.add(sole);
    leg.position.x = side * 0.15;
    return leg;
  };
  g.add(makeLeg(-1));
  g.add(makeLeg(1));

  const hips = new Mesh(new CylinderGeometry(0.22, 0.28, 0.2, 8), veil);
  hips.position.y = 0.78;
  addPart(hips, g);
  const skirt = new Mesh(new CylinderGeometry(0.34, 0.2, 0.62, 8), veil);
  skirt.position.y = 0.58;
  addPart(skirt, g, 1.04);
  const slit = new Mesh(new BoxGeometry(0.12, 0.5, 0.2), deep);
  slit.position.set(0.04, 0.52, 0.12);
  slit.rotation.y = 0.25;
  addPart(slit, g);
  const liningFlap = new Mesh(new BoxGeometry(0.1, 0.44, 0.16), lining);
  liningFlap.position.set(-0.06, 0.5, 0.08);
  liningFlap.rotation.y = -0.2;
  addPart(liningFlap, g);

  const torso = new Mesh(new CylinderGeometry(0.2, 0.24, 0.5, 8), lining);
  torso.position.y = 1.12;
  addPart(torso, g, 1.05);
  const mantle = new Mesh(new BoxGeometry(0.42, 0.16, 0.28), deep);
  mantle.position.set(0, 1.34, 0.02);
  addPart(mantle, g);
  const sash = new Mesh(new CylinderGeometry(0.24, 0.24, 0.08, 8), deep);
  sash.position.y = 0.9;
  addPart(sash, g);
  const gem = new Mesh(new OctahedronGeometry(0.07, 0), glow);
  gem.position.set(0, 1.18, 0.24);
  g.add(gem);

  addSpikes(g, 0, 1.38, 0.02, 0.24, 16, 0.12, 0.02, lining, deep, glow, 0.2);
  for (const sx of [-1, 1] as const) {
    const drape = new Mesh(new ConeGeometry(0.09, 0.3, 5), deep);
    drape.position.set(sx * 0.32, 1.22, 0);
    drape.rotation.z = sx * 0.7;
    drape.rotation.x = -0.25;
    addPart(drape, g);
  }

  const makeArm = (side: number) => {
    const arm = new Group();
    const sleeve = new Mesh(new CylinderGeometry(0.1, 0.13, 0.4, 7), veil);
    sleeve.position.set(0, -0.02, 0);
    sleeve.rotation.z = side * 0.28;
    addPart(sleeve, arm, 1.04);
    const cuff = new Mesh(new CylinderGeometry(0.08, 0.11, 0.1, 6), lining);
    cuff.position.set(side * 0.1, -0.28, 0.02);
    cuff.rotation.z = side * 0.2;
    arm.add(cuff);
    const hand = new Mesh(new BoxGeometry(0.09, 0.09, 0.11), skin);
    hand.position.set(side * 0.16, -0.44, 0.04);
    addPart(hand, arm);
    if (side < 0) {
      const h = kit.bigWep ? 1.15 : 0.92;
      const staff = new Group();
      staff.position.set(side * 0.18, -0.5, 0.08);
      const shaft = new Mesh(new CylinderGeometry(0.016, 0.022, h, 6), wood);
      shaft.position.y = h * 0.35;
      addPart(shaft, staff);
      const bind = new Mesh(new TorusGeometry(0.03, 0.008, 4, 8), glow);
      bind.position.y = 0.12;
      staff.add(bind);
      const crystal = new Mesh(new OctahedronGeometry(kit.bigWep ? 0.11 : 0.085, 0), glow);
      crystal.position.y = h * 0.72;
      addPart(crystal, staff);
      arm.add(staff);
    }
    arm.position.set(side * 0.32, 1.26, 0);
    return arm;
  };
  g.add(makeArm(-1));
  g.add(makeArm(1));

  const head = makeHead(g, skin, skinDark, hairCol);
  const hood = new Mesh(new ConeGeometry(0.26, 0.36, 7), deep);
  hood.position.set(0, 0.22, -0.06);
  hood.rotation.x = -0.35;
  addPart(hood, head, 1.06);
  const cowl = new Mesh(new SphereGeometry(0.24, 8, 6), veil);
  cowl.scale.set(1.15, 0.7, 1.05);
  cowl.position.set(0, 0.04, -0.04);
  addPart(cowl, head);
  const brim = new Mesh(new BoxGeometry(0.28, 0.06, 0.16), deep);
  brim.position.set(0, 0.02, 0.14);
  brim.rotation.x = 0.35;
  head.add(brim);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const shard = new Mesh(new OctahedronGeometry(0.035, 0), glow);
    shard.position.set(Math.cos(a) * 0.28, 1.28 + Math.sin(a) * 0.04, Math.sin(a) * 0.18);
    g.add(shard);
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
  g.add(shadow);

  const skin = mat(0xc8a07c, { roughness: 0.7, metalness: 0.03 });
  const skinDark = mat(0x9a7454, { roughness: 0.78, metalness: 0.03 });
  const hairCol = mat(0x1e1208, { roughness: 0.97 });

  if (id === "fighter") dressFighter(g, kit, skin, skinDark, hairCol);
  else if (id === "ranger") dressRanger(g, kit, skin, skinDark, hairCol);
  else dressMage(g, kit, skin, skinDark, hairCol);

  return g;
}
