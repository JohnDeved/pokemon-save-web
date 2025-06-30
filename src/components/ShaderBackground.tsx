import { useMemo, memo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ShaderMaterial } from "three";

import fragmentShader from "../glsl/shader.glsl?raw";

const vertexShader = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;
const uniforms = {
  time: { value: 0 },
  resolution: { value: [window.innerWidth, window.innerHeight] },
};

const Scene = memo(function Scene() {
  const material = useMemo(
    () => new ShaderMaterial({ uniforms, fragmentShader, vertexShader }),
    [],
  );

  useFrame((_, delta) => {
    uniforms.time.value += delta;
    uniforms.resolution.value = [window.innerWidth, window.innerHeight];
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} />
    </mesh>
  );
});

export function ShaderBackground() {
  return (
    <div className="fixed inset-0 z-10">
      {useMemo(
        () => (
          <Canvas>
            <Scene />
          </Canvas>
        ),
        [],
      )}
    </div>
  );
}