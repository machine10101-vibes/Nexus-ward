import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import { BackSide, Color, type Mesh } from "three";
import { useGameStore } from "@/game/store";
import { PLANET_THEME } from "@/game/config";
import { PlanetGlobe, PLANET_PALETTE } from "./Planet";
import { useWorldArt } from "./worldArt";

export function MenuScene() {
  return (
    <Suspense fallback={null}>
      <MenuWorld />
    </Suspense>
  );
}

function MenuWorld() {
  const preview = useGameStore((s) => s.preview);
  const ring = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);
  const art = useWorldArt(preview);

  useFrame((state, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.04;
    if (ring2.current) ring2.current.rotation.z -= dt * 0.025;
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    cam.position.x = Math.sin(t * 0.07) * 0.7;
    cam.position.y = 0.32 + Math.sin(t * 0.05) * 0.18;
    cam.lookAt(0, 0, 0);
  });

  const pal = PLANET_PALETTE[preview];
  const theme = PLANET_THEME[preview];

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, 12, 48]} />
      <ambientLight intensity={0.2} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.7]} />
      <directionalLight position={[6, 8, 4]} intensity={2.05} color={theme.dir} />
      <pointLight position={[-4, 2, 3]} intensity={24} distance={18} color={pal.atmo} />
      <pointLight position={[5, -1, 2]} intensity={12} distance={14} color={pal.ring} />
      <MenuSky key={preview} map={art.sky} fog={theme.fog} accent={pal.atmo} />
      <Stars radius={70} depth={32} count={1200} factor={2.8} fade speed={0.45} />
      <Sparkles count={28} scale={12} size={2.4} speed={0.35} color={pal.atmo} opacity={0.55} />
      <PlanetGlobe id={preview} />
      <mesh ref={ring} rotation={[Math.PI / 2.6, 0.2, 0.3]}>
        <torusGeometry args={[3.4, 0.038, 8, 96]} />
        <meshStandardMaterial color={pal.ring} emissive={pal.ring} emissiveIntensity={0.95} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2.2, -0.15, 0.5]}>
        <torusGeometry args={[3.85, 0.016, 6, 80]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.32} />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0.2, 0.3]}>
        <torusGeometry args={[3.55, 0.01, 6, 64]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 3.4, Math.sin(a) * 0.55, Math.sin(a) * 3.4 * 0.35]}>
            <boxGeometry args={[0.12, 0.08, 0.18]} />
            <meshStandardMaterial color={pal.ring} emissive={pal.ring} emissiveIntensity={0.7} metalness={0.6} roughness={0.28} />
          </mesh>
        );
      })}
      <mesh position={[3.35, 0.85, -1.5]}>
        <sphereGeometry args={[0.24, 20, 16]} />
        <meshStandardMaterial color="#c8d0d4" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[-2.7, -0.45, 2.15]}>
        <sphereGeometry args={[0.13, 14, 12]} />
        <meshStandardMaterial color="#8a9098" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[1.8, -1.4, -2.4]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color={pal.atmo} emissive={pal.atmo} emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
    </>
  );
}

function MenuSky({ map, fog, accent }: { map: ReturnType<typeof useWorldArt>["sky"]; fog: string; accent: string }) {
  const uniforms = {
    sky: { value: map },
    fogCol: { value: new Color(fog) },
    accent: { value: new Color(accent) },
  };
  return (
    <mesh>
      <sphereGeometry args={[42, 40, 24]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; varying vec2 vUv; void main(){ vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform sampler2D sky; uniform vec3 fogCol; uniform vec3 accent;
          varying vec3 vP; varying vec2 vUv;
          void main() {
            vec3 n = normalize(vP);
            vec3 tex = texture2D(sky, vec2(vUv.x + 0.08, vUv.y * 0.82 + 0.1)).rgb * 1.12;
            float h = n.y;
            vec3 col = mix(tex * 0.72, tex, smoothstep(-0.15, 0.5, h));
            col = mix(col, fogCol, smoothstep(0.08, -0.35, h) * 0.4);
            col += accent * pow(1.0 - abs(h), 6.0) * 0.08;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
