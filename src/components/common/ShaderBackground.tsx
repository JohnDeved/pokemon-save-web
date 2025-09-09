import { Canvas, useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useState } from 'react'
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
      <planeGeometry args={[2, 2]} />
      <primitive object={material} />
    </mesh>
  )
})

Scene.displayName = 'Scene'

export const ShaderBackground = memo(({ inverted = false }: { inverted?: boolean }) => {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Delay the shader fade-in to allow pattern to render first
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`fixed inset-0 transition-opacity duration-500 pointer-events-none z-[-1] ${isLoaded ? 'opacity-100' : 'opacity-0'} ${inverted ? 'invert' : ''}`}>
      <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <Scene />
      </Canvas>
    </div>
  )
})

ShaderBackground.displayName = 'ShaderBackground'
