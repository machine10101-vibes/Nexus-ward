import { useMemo } from "react";
import { AdditiveBlending } from "three";
import type { BaseClass } from "@/game/types";
import { softGlowTexture } from "./fx";
import { BevelBox } from "./bevel";
import { SURFACE_KEY, SURFACE_PATCH } from "./surface";

function Metal({ color, rough = 0.4 }: { color: string; rough?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={0.78}
      onBeforeCompile={SURFACE_PATCH.metal}
      customProgramCacheKey={SURFACE_KEY.metal}
    />
  );
}

function Living({ color, glow = 0, emissive = "#1f6a48" }: { color: string; glow?: number; emissive?: string }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.6}
      metalness={0.06}
      emissive={emissive}
      emissiveIntensity={glow}
      onBeforeCompile={SURFACE_PATCH.organic}
      customProgramCacheKey={SURFACE_KEY.organic}
    />
  );
}

const TIER = {
  organic: { a: "#10241c", b: "#173528" },
  mech: { a: "#1c1f23", b: "#2a2e32" },
  hybrid: { a: "#18222a", b: "#243038" },
} as const;

/** The ground the keep stands on. Flush enough to stay out of the pads' way. */
export function KeepDais({ cls, color }: { cls: BaseClass; color: string }) {
  const tex = softGlowTexture();
  const n = 12;
  const marks = useMemo(() => Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2), []);
  const tier = TIER[cls];
  return (
    <group name="keep-dais">
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[2.7, 2.78, 0.06, 40]} />
        {cls === "organic" ? <Living color={tier.a} /> : <Metal color={tier.a} rough={0.55} />}
      </mesh>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <cylinderGeometry args={[2.42, 2.52, 0.06, 40]} />
        {cls === "organic" ? <Living color={tier.b} /> : <Metal color={tier.b} rough={0.42} />}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.108, 0]}>
        <ringGeometry args={[2.18, 2.3, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.104, 0]}>
        <ringGeometry args={[1.5, 1.56, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      {tex ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.115, 0]}>
          <circleGeometry args={[3.6, 32]} />
          <meshBasicMaterial map={tex} color={color} transparent opacity={0.34} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ) : null}
      {marks.map((a, i) => {
        const x = Math.cos(a) * 2.34;
        const z = Math.sin(a) * 2.34;
        if (cls === "organic") {
          const h = 0.28 + (i % 3) * 0.12;
          return (
            <group key={i} position={[x, 0.1, z]} rotation={[0, -a, 0]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.07, h, 6]} />
                <Living color="#1f4a38" />
              </mesh>
              <mesh position={[0, h + 0.05, 0]} castShadow>
                <sphereGeometry args={[0.075 + (i % 2) * 0.02, 10, 8]} />
                <meshStandardMaterial color="#d8ffe8" emissive={color} emissiveIntensity={1.1} roughness={0.3} />
              </mesh>
              {i % 2 === 0 ? (
                <mesh position={[-0.28, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <capsuleGeometry args={[0.04, 0.5, 4, 6]} />
                  <Living color="#245443" />
                </mesh>
              ) : null}
            </group>
          );
        }
        if (cls === "mech") {
          return (
            <group key={i} position={[x, 0.1, z]} rotation={[0, -a, 0]}>
              {i % 2 === 0 ? (
                <>
                  <mesh position={[0, 0.2, 0]} castShadow>
                    <BevelBox args={[0.16, 0.4, 0.16]} />
                    <Metal color="#2a2e32" />
                  </mesh>
                  <mesh position={[0, 0.43, 0]}>
                    <BevelBox args={[0.2, 0.06, 0.2]} />
                    <meshStandardMaterial color="#ffb080" emissive="#ff7a2c" emissiveIntensity={1.3} />
                  </mesh>
                </>
              ) : (
                <mesh position={[0, 0.03, 0]} castShadow>
                  <BevelBox args={[0.1, 0.06, 0.55]} />
                  <meshStandardMaterial color="#d99a2a" roughness={0.5} metalness={0.5} emissive="#8a5a10" emissiveIntensity={0.35} />
                </mesh>
              )}
            </group>
          );
        }
        return (
          <group key={i} position={[x, 0.1, z]} rotation={[0, -a, 0]}>
            {i % 2 === 0 ? (
              <mesh position={[0, 0.3, 0]} rotation={[0, 0, (i % 4) * 0.08]} castShadow>
                <coneGeometry args={[0.1, 0.6 + (i % 3) * 0.14, 5]} />
                <meshStandardMaterial color="#6d8894" emissive={color} emissiveIntensity={0.55} roughness={0.14} metalness={0.3} transparent opacity={0.78} />
              </mesh>
            ) : (
              <>
                <mesh position={[0, 0.16, 0]} castShadow>
                  <BevelBox args={[0.15, 0.32, 0.15]} />
                  <Metal color="#2f3a42" />
                </mesh>
                <mesh position={[0, 0.35, 0]}>
                  <octahedronGeometry args={[0.07, 0]} />
                  <meshStandardMaterial color="#c8f0ff" emissive={color} emissiveIntensity={1.5} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
