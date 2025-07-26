import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, memo } from 'react'
import { ShaderMaterial } from 'three'

import fragmentShader from '../../glsl/shader.glsl?raw'

const vertexShader = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}'

const Scene = memo(() => {
  const { material, uniformsRef } = useMemo(() => {
    const uniforms = {
      time: { value: 0 },
      resolution: { value: [window.innerWidth, window.innerHeight] },
    }
    const mat = new ShaderMaterial({ uniforms, fragmentShader, vertexShader })
    return { material: mat, uniformsRef: uniforms }
  }, [])

  useFrame((_, delta) => {
    uniformsRef.time.value += delta
    uniformsRef.resolution.value = [window.innerWidth, window.innerHeight]
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]}/>
      <primitive object={material}/>
    </mesh>
  )
})

Scene.displayName = 'Scene'

export const ShaderBackground = memo(() => {
  return (
    <div className="fixed inset-0">
      <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <Scene/>
      </Canvas>
    </div>
  )
})

ShaderBackground.displayName = 'ShaderBackground'
