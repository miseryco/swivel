import React, { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Canvas, useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"

const SHELL_RADIUS = 1.2
const SHELL_COLOR = "#f3efe7"
const GLOW_COLOR = "#ff4d94"
const GLASS_TINT = "#ff86b8"
const CUTOUT_ANGLE = 0.62
const SHELL_OPENING = {
  z: SHELL_RADIUS * Math.cos(CUTOUT_ANGLE),
  radius: SHELL_RADIUS * Math.sin(CUTOUT_ANGLE),
}
const LENS_Z = SHELL_OPENING.z - 0.09
// Four profile points form three small steps clustered around the lens.
const BEZEL_STEPS = [
  { z: LENS_Z + 0.075, radius: 0.535 },
  { z: LENS_Z + 0.05, radius: 0.51 },
  { z: LENS_Z + 0.025, radius: 0.485 },
  { z: LENS_Z, radius: 0.46 },
]

function CameraLens() {
  return (
    <group>
      <mesh position={[0, 0, -0.06]}>
        <circleGeometry args={[0.36, 64]} />
        <meshStandardMaterial color="#0a0b10" roughness={0.55} metalness={0.35} />
      </mesh>

      <mesh>
        <circleGeometry args={[0.16, 64]} />
        <meshStandardMaterial color="#050608" metalness={0.6} roughness={0.12} />
      </mesh>

      <mesh position={[0, 0, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.52, 64, 48, 0, Math.PI * 2, 0, 0.74]} />
        <MeshTransmissionMaterial
          color="#ffffff"
          transmission={1}
          thickness={0.65}
          ior={1.65}
          roughness={0.12}
          chromaticAberration={0.18}
          anisotropicBlur={0.16}
          distortion={0.18}
          distortionScale={0.35}
          temporalDistortion={0.06}
          clearcoat={1}
          clearcoatRoughness={0.025}
          backside
          backsideThickness={0.3}
          samples={6}
          resolution={512}
          attenuationColor={GLASS_TINT}
          attenuationDistance={0.65}
        />
      </mesh>

    </group>
  )
}

function Webcam() {
  const head = useRef(null)
  const cursor = useRef({ x: 0, y: 0 })
  const target = useRef(new THREE.Vector3(0, 0, 4))
  const aim = useRef(new THREE.Object3D())
  const reduceMotion = useRef(false)

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotionPreference = () => {
      reduceMotion.current = motionQuery.matches
    }
    const followPointer = (event) => {
      cursor.current.x = (event.clientX / window.innerWidth) * 2 - 1
      cursor.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    updateMotionPreference()
    motionQuery.addEventListener("change", updateMotionPreference)
    window.addEventListener("pointermove", followPointer, { passive: true })

    return () => {
      motionQuery.removeEventListener("change", updateMotionPreference)
      window.removeEventListener("pointermove", followPointer)
    }
  }, [])

  useFrame(() => {
    target.current.set(cursor.current.x * 2.6, cursor.current.y * 1.8, 4)
    aim.current.position.set(0, 0, 0)
    aim.current.lookAt(target.current)

    if (head.current) {
      const easing = reduceMotion.current ? 1 : 0.1
      head.current.quaternion.slerp(aim.current.quaternion, easing)
    }
  })

  return (
    <group ref={head}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry
          args={[
            SHELL_RADIUS,
            96,
            72,
            0,
            Math.PI * 2,
            CUTOUT_ANGLE,
            Math.PI - CUTOUT_ANGLE,
          ]}
        />
        <meshPhysicalMaterial
          color={SHELL_COLOR}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0}
          clearcoat={0.6}
          clearcoatRoughness={0.35}
          sheen={0.6}
          sheenColor="#ffffff"
        />
      </mesh>

      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, (SHELL_OPENING.z + BEZEL_STEPS[0].z) / 2]}
      >
        <cylinderGeometry
          args={[
            SHELL_OPENING.radius,
            BEZEL_STEPS[0].radius,
            SHELL_OPENING.z - BEZEL_STEPS[0].z,
            72,
            1,
            true,
          ]}
        />
        <meshPhysicalMaterial
          color={SHELL_COLOR}
          side={THREE.DoubleSide}
          roughness={0.55}
          clearcoat={0.4}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {BEZEL_STEPS.slice(0, -1).map((step, index) => {
        const nextStep = BEZEL_STEPS[index + 1]
        const height = step.z - nextStep.z

        return (
          <group key={step.z}>
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, (step.z + nextStep.z) / 2]}
            >
              <cylinderGeometry
                args={[step.radius, step.radius, height, 72, 1, true]}
              />
              <meshPhysicalMaterial
                color={SHELL_COLOR}
                side={THREE.DoubleSide}
                roughness={0.55}
                clearcoat={0.4}
                clearcoatRoughness={0.4}
              />
            </mesh>

            <mesh position={[0, 0, nextStep.z]}>
              <ringGeometry args={[nextStep.radius, step.radius, 72]} />
              <meshPhysicalMaterial
                color={SHELL_COLOR}
                side={THREE.DoubleSide}
                roughness={0.6}
                clearcoat={0.3}
                clearcoatRoughness={0.45}
              />
            </mesh>
          </group>
        )
      })}

      <mesh position={[0, 0, LENS_Z + 0.035]}>
        <torusGeometry args={[0.44, 0.022, 20, 96]} />
        <meshStandardMaterial
          color={GLOW_COLOR}
          emissive={GLOW_COLOR}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, 0, LENS_Z]}
        color={GLOW_COLOR}
        intensity={2.2}
        distance={1.5}
        decay={2.4}
      />

      <group position={[0, 0, LENS_Z]}>
        <CameraLens />
      </group>
    </group>
  )
}

function WebcamScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 3.75], fov: 42 }}
    >
      <ambientLight intensity={0.8} />
      <hemisphereLight args={["#ffffff", "#c9cdd6", 0.6]} />
      <directionalLight position={[4, 6, 5]} intensity={2.4} />
      <directionalLight position={[-5, 2, -1]} intensity={1} color="#dfe7ff" />
      <directionalLight position={[0, -3, -4]} intensity={0.8} color="#ffffff" />
      <Webcam />
    </Canvas>
  )
}

const rootElement = document.querySelector("#webcam-root")

if (rootElement) {
  createRoot(rootElement).render(<WebcamScene />)
}
