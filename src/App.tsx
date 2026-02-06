import { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Text, Float, ContactShadows, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// Game state types
type GameState = 'ready' | 'player-turn' | 'opponent-turn' | 'slapping' | 'reacting' | 'game-over'

interface GameStats {
  playerScore: number
  opponentScore: number
  currentSlapper: 'player' | 'opponent'
}

// Impact text component that appears on slap
function ImpactText({ visible, position }: { visible: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null!)
  const [scale, setScale] = useState(0)
  const slapTexts = ['SLAP!', 'POW!', 'THWACK!', 'WHAM!', 'SMACK!']
  const [text] = useState(() => slapTexts[Math.floor(Math.random() * slapTexts.length)])

  useFrame((_, delta) => {
    if (visible && scale < 1) {
      setScale(Math.min(1, scale + delta * 8))
    } else if (!visible && scale > 0) {
      setScale(Math.max(0, scale - delta * 4))
    }
    if (ref.current) {
      ref.current.rotation.z = Math.sin(Date.now() * 0.01) * 0.1
    }
  })

  return (
    <group ref={ref} position={position} scale={scale}>
      <Text
        fontSize={0.8}
        color="#FFE135"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#FF1493"
        font="https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH55Q2J5hm24.woff2"
      >
        {text}
      </Text>
    </group>
  )
}

// Slapping hand component
function SlappingHand({
  isSlapping,
  side,
  onSlapComplete
}: {
  isSlapping: boolean
  side: 'left' | 'right'
  onSlapComplete: () => void
}) {
  const ref = useRef<THREE.Group>(null!)
  const startX = side === 'left' ? -4 : 4
  const targetX = side === 'left' ? 0.5 : -0.5
  const [progress, setProgress] = useState(0)
  const hasCompletedRef = useRef(false)

  useFrame((_, delta) => {
    if (isSlapping) {
      if (progress < 1) {
        const newProgress = Math.min(1, progress + delta * 6)
        setProgress(newProgress)

        // Slap motion - fast in, bouncy out
        const eased = newProgress < 0.5
          ? Math.pow(newProgress * 2, 3) * 0.5
          : 1 - Math.pow(-2 * newProgress + 2, 3) / 2

        if (ref.current) {
          ref.current.position.x = THREE.MathUtils.lerp(startX, targetX, eased < 0.5 ? eased * 2 : 1 - (eased - 0.5) * 2)
          ref.current.rotation.z = (side === 'left' ? 1 : -1) * Math.sin(eased * Math.PI) * 0.5
        }

        // Trigger slap effect at peak
        if (newProgress >= 0.5 && !hasCompletedRef.current) {
          hasCompletedRef.current = true
          onSlapComplete()
        }
      }
    } else {
      if (progress > 0) {
        setProgress(0)
        hasCompletedRef.current = false
      }
      if (ref.current) {
        ref.current.position.x = startX
        ref.current.rotation.z = 0
      }
    }
  })

  return (
    <group ref={ref} position={[startX, 0.5, 0]}>
      {/* Palm */}
      <RoundedBox args={[0.6, 0.8, 0.2]} radius={0.1}>
        <meshStandardMaterial color="#FFB6C1" roughness={0.7} />
      </RoundedBox>
      {/* Fingers */}
      {[...Array(4)].map((_, i) => (
        <RoundedBox
          key={i}
          args={[0.12, 0.4, 0.15]}
          radius={0.05}
          position={[-0.18 + i * 0.12, 0.55, 0]}
        >
          <meshStandardMaterial color="#FFB6C1" roughness={0.7} />
        </RoundedBox>
      ))}
      {/* Thumb */}
      <RoundedBox
        args={[0.15, 0.35, 0.15]}
        radius={0.05}
        position={[side === 'left' ? 0.35 : -0.35, 0.1, 0]}
        rotation={[0, 0, side === 'left' ? -0.5 : 0.5]}
      >
        <meshStandardMaterial color="#FFB6C1" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

// Face component with reactions
function Face({
  position,
  color,
  isGettingSlapped,
  wobbleIntensity = 0
}: {
  position: [number, number, number]
  color: string
  isGettingSlapped: boolean
  wobbleIntensity: number
}) {
  const ref = useRef<THREE.Group>(null!)
  const [eyeSize, setEyeSize] = useState(0.15)
  const [mouthOpen, setMouthOpen] = useState(0.1)

  useFrame((state) => {
    if (ref.current) {
      // Wobble effect when slapped
      if (wobbleIntensity > 0) {
        ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 30) * wobbleIntensity * 0.3
        ref.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 25) * wobbleIntensity * 0.2
      } else {
        ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, 0, 0.1)
        ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, position[0], 0.1)
      }

      // Idle breathing animation
      ref.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02
    }

    // Eye and mouth reactions
    if (isGettingSlapped) {
      setEyeSize(0.05)
      setMouthOpen(0.4)
    } else {
      setEyeSize(THREE.MathUtils.lerp(eyeSize, 0.15, 0.1))
      setMouthOpen(THREE.MathUtils.lerp(mouthOpen, 0.1, 0.1))
    }
  })

  return (
    <group ref={ref} position={position}>
      {/* Head */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.3, 0.2, 0.85]}>
        <sphereGeometry args={[eyeSize, 16, 16]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.3, 0.2, 0.85]}>
        <sphereGeometry args={[eyeSize, 16, 16]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Eye whites */}
      <mesh position={[-0.3, 0.2, 0.8]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.3, 0.2, 0.8]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, -0.3, 0.9]} scale={[0.3, mouthOpen, 0.1]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>

      {/* Cheek (slap mark when hit) */}
      {isGettingSlapped && (
        <mesh position={[0.6, 0, 0.7]} rotation={[0, 0.3, 0]}>
          <circleGeometry args={[0.3, 32]} />
          <meshStandardMaterial color="#FF1493" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}

// Screen shake camera
function CameraShake({ intensity }: { intensity: number }) {
  const { camera } = useThree()
  const originalPosition = useRef(new THREE.Vector3(0, 1, 6))

  useFrame(() => {
    if (intensity > 0) {
      camera.position.x = originalPosition.current.x + (Math.random() - 0.5) * intensity * 0.5
      camera.position.y = originalPosition.current.y + (Math.random() - 0.5) * intensity * 0.3
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, originalPosition.current.x, 0.1)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, originalPosition.current.y, 0.1)
    }
  })

  return null
}

// Particle burst on slap
function SlapParticles({ active, position }: { active: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Points>(null!)
  const [particles] = useState(() => {
    const positions = new Float32Array(50 * 3)
    const velocities: THREE.Vector3[] = []
    for (let i = 0; i < 50; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2,
        (Math.random() - 0.5) * 2
      ))
    }
    return { positions, velocities }
  })
  const [life, setLife] = useState(0)

  useFrame((_, delta) => {
    if (active && life < 1) {
      setLife(Math.min(1, life + delta * 3))

      if (ref.current) {
        const positions = ref.current.geometry.attributes.position.array as Float32Array
        for (let i = 0; i < 50; i++) {
          positions[i * 3] += particles.velocities[i].x * delta * 3
          positions[i * 3 + 1] += particles.velocities[i].y * delta * 3 - life * delta * 5
          positions[i * 3 + 2] += particles.velocities[i].z * delta * 3
        }
        ref.current.geometry.attributes.position.needsUpdate = true
      }
    } else if (!active && life > 0) {
      setLife(0)
      // Reset particles
      if (ref.current) {
        const positions = ref.current.geometry.attributes.position.array as Float32Array
        for (let i = 0; i < 50; i++) {
          positions[i * 3] = 0
          positions[i * 3 + 1] = 0
          positions[i * 3 + 2] = 0
        }
        ref.current.geometry.attributes.position.needsUpdate = true
      }
    }
  })

  return (
    <points ref={ref} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={50}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#FFE135"
        transparent
        opacity={1 - life}
      />
    </points>
  )
}

// Main 3D Scene
function Scene({
  gameState,
  onSlap,
  stats
}: {
  gameState: GameState
  onSlap: () => void
  stats: GameStats
}) {
  const [showImpact, setShowImpact] = useState(false)
  const [wobblePlayer, setWobblePlayer] = useState(0)
  const [wobbleOpponent, setWobbleOpponent] = useState(0)
  const [shakeIntensity, setShakeIntensity] = useState(0)
  const [showParticles, setShowParticles] = useState(false)

  const handleSlapComplete = useCallback(() => {
    setShowImpact(true)
    setShakeIntensity(1)
    setShowParticles(true)

    if (stats.currentSlapper === 'player') {
      setWobbleOpponent(1)
    } else {
      setWobblePlayer(1)
    }

    setTimeout(() => {
      setShowImpact(false)
      setShowParticles(false)
      onSlap()
    }, 500)
  }, [onSlap, stats.currentSlapper])

  useFrame((_, delta) => {
    if (wobblePlayer > 0) setWobblePlayer(Math.max(0, wobblePlayer - delta * 2))
    if (wobbleOpponent > 0) setWobbleOpponent(Math.max(0, wobbleOpponent - delta * 2))
    if (shakeIntensity > 0) setShakeIntensity(Math.max(0, shakeIntensity - delta * 3))
  })

  return (
    <>
      <CameraShake intensity={shakeIntensity} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <pointLight position={[-5, 3, 0]} intensity={0.5} color="#FF1493" />
      <pointLight position={[5, 3, 0]} intensity={0.5} color="#FFE135" />

      {/* Environment */}
      <Environment preset="city" />

      {/* Arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>

      {/* Arena ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.48, 0]}>
        <ringGeometry args={[4.8, 5, 64]} />
        <meshStandardMaterial color="#FF1493" emissive="#FF1493" emissiveIntensity={0.3} />
      </mesh>

      {/* Player face */}
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.3}>
        <Face
          position={[-1.5, 0, 0]}
          color="#4ECDC4"
          isGettingSlapped={stats.currentSlapper === 'opponent' && gameState === 'slapping'}
          wobbleIntensity={wobblePlayer}
        />
      </Float>

      {/* Opponent face */}
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.3}>
        <Face
          position={[1.5, 0, 0]}
          color="#FF6B6B"
          isGettingSlapped={stats.currentSlapper === 'player' && gameState === 'slapping'}
          wobbleIntensity={wobbleOpponent}
        />
      </Float>

      {/* Slapping hands */}
      <SlappingHand
        isSlapping={gameState === 'slapping' && stats.currentSlapper === 'player'}
        side="left"
        onSlapComplete={handleSlapComplete}
      />
      <SlappingHand
        isSlapping={gameState === 'slapping' && stats.currentSlapper === 'opponent'}
        side="right"
        onSlapComplete={handleSlapComplete}
      />

      {/* Impact text */}
      <ImpactText visible={showImpact} position={[0, 2, 0]} />

      {/* Particles */}
      <SlapParticles
        active={showParticles}
        position={stats.currentSlapper === 'player' ? [1.5, 0.5, 0.5] : [-1.5, 0.5, 0.5]}
      />

      {/* Score displays */}
      <Text
        position={[-2.5, 2.5, 0]}
        fontSize={0.4}
        color="#4ECDC4"
        font="https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH55Q2J5hm24.woff2"
        anchorX="center"
      >
        {`YOU: ${stats.playerScore}`}
      </Text>
      <Text
        position={[2.5, 2.5, 0]}
        fontSize={0.4}
        color="#FF6B6B"
        font="https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH55Q2J5hm24.woff2"
        anchorX="center"
      >
        {`CPU: ${stats.opponentScore}`}
      </Text>

      {/* Contact shadows */}
      <ContactShadows
        position={[0, -1.49, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={12}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        enablePan={false}
      />
    </>
  )
}

// Power meter component
function PowerMeter({ power, isActive }: { power: number; isActive: boolean }) {
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 bottom-32 md:bottom-40 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className="relative w-48 md:w-64 h-6 md:h-8 bg-gray-900/80 rounded-full overflow-hidden border-2 border-pink-500 shadow-lg shadow-pink-500/30">
        <div
          className="h-full transition-all duration-75 rounded-full"
          style={{
            width: `${power}%`,
            background: power < 50
              ? 'linear-gradient(90deg, #4ECDC4, #45B7AA)'
              : power < 80
                ? 'linear-gradient(90deg, #FFE135, #FFC107)'
                : 'linear-gradient(90deg, #FF1493, #FF6B6B)'
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-xs md:text-sm drop-shadow-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {Math.round(power)}% POWER
          </span>
        </div>
      </div>
    </div>
  )
}

// Main App component
export default function App() {
  const [gameState, setGameState] = useState<GameState>('ready')
  const [stats, setStats] = useState<GameStats>({
    playerScore: 0,
    opponentScore: 0,
    currentSlapper: 'player'
  })
  const [power, setPower] = useState(0)
  const [isPowerCharging, setIsPowerCharging] = useState(false)
  const powerDirection = useRef(1)
  const animationRef = useRef<number>()

  // Power meter animation
  useEffect(() => {
    if (isPowerCharging) {
      const animate = () => {
        setPower(prev => {
          let next = prev + powerDirection.current * 2
          if (next >= 100) {
            powerDirection.current = -1
            next = 100
          } else if (next <= 0) {
            powerDirection.current = 1
            next = 0
          }
          return next
        })
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPowerCharging])

  const startGame = () => {
    setGameState('player-turn')
    setStats({ playerScore: 0, opponentScore: 0, currentSlapper: 'player' })
    setIsPowerCharging(true)
    powerDirection.current = 1
    setPower(0)
  }

  const handleSlapClick = () => {
    if (gameState === 'player-turn' && stats.currentSlapper === 'player') {
      setIsPowerCharging(false)
      setGameState('slapping')
    }
  }

  const handleSlapComplete = useCallback(() => {
    const currentPower = power
    const damage = Math.ceil(currentPower / 20) // 1-5 damage based on power

    setStats(prev => {
      const newStats = { ...prev }

      if (prev.currentSlapper === 'player') {
        newStats.opponentScore = prev.opponentScore + damage
        if (newStats.opponentScore >= 10) {
          setGameState('game-over')
          return newStats
        }
        newStats.currentSlapper = 'opponent'
        // Opponent's turn after a delay
        setTimeout(() => {
          setGameState('slapping')
          // Opponent slaps back after animation
        }, 1000)
      } else {
        newStats.playerScore = prev.playerScore + Math.ceil(Math.random() * 5)
        if (newStats.playerScore >= 10) {
          setGameState('game-over')
          return newStats
        }
        newStats.currentSlapper = 'player'
        setGameState('player-turn')
        setIsPowerCharging(true)
        powerDirection.current = 1
        setPower(0)
      }

      return newStats
    })
  }, [power])

  const winner = stats.opponentScore >= 10 ? 'YOU WIN!' : stats.playerScore >= 10 ? 'CPU WINS!' : null

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)' }}>
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-yellow-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl" />
      </div>

      {/* Title */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-10">
        <h1
          className="text-3xl md:text-5xl lg:text-6xl text-transparent bg-clip-text font-bold tracking-wider"
          style={{
            fontFamily: 'Bangers, cursive',
            backgroundImage: 'linear-gradient(135deg, #FF1493 0%, #FFE135 50%, #FF6B6B 100%)',
            textShadow: '0 0 40px rgba(255, 20, 147, 0.5)'
          }}
        >
          SLAP BATTLE
        </h1>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 1, 6], fov: 50 }}
        shadows
        className="touch-none"
      >
        <Scene gameState={gameState} onSlap={handleSlapComplete} stats={stats} />
      </Canvas>

      {/* Power meter */}
      <PowerMeter power={power} isActive={gameState === 'player-turn' && stats.currentSlapper === 'player'} />

      {/* Start screen overlay */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <div className="text-center p-6 md:p-8">
            <h2
              className="text-4xl md:text-6xl lg:text-7xl mb-4 md:mb-6 text-transparent bg-clip-text animate-pulse"
              style={{
                fontFamily: 'Bangers, cursive',
                backgroundImage: 'linear-gradient(135deg, #FF1493, #FFE135)'
              }}
            >
              SLAP BATTLE
            </h2>
            <p className="text-gray-300 mb-6 md:mb-8 text-sm md:text-lg max-w-xs md:max-w-md mx-auto" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Take turns slapping! Time your power meter for maximum damage. First to 10 damage wins!
            </p>
            <button
              onClick={startGame}
              className="px-8 md:px-12 py-3 md:py-4 text-lg md:text-xl font-bold text-white rounded-full transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
              style={{
                fontFamily: 'Bangers, cursive',
                background: 'linear-gradient(135deg, #FF1493, #FF6B6B)',
                boxShadow: '0 0 30px rgba(255, 20, 147, 0.5)'
              }}
            >
              START SLAPPING!
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {gameState === 'game-over' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20">
          <div className="text-center p-6 md:p-8">
            <h2
              className="text-4xl md:text-6xl lg:text-7xl mb-4 md:mb-6"
              style={{
                fontFamily: 'Bangers, cursive',
                color: winner === 'YOU WIN!' ? '#4ECDC4' : '#FF6B6B',
                textShadow: `0 0 40px ${winner === 'YOU WIN!' ? 'rgba(78, 205, 196, 0.7)' : 'rgba(255, 107, 107, 0.7)'}`
              }}
            >
              {winner}
            </h2>
            <p className="text-gray-300 mb-6 md:mb-8 text-lg md:text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Final Score: You took {stats.playerScore} damage, CPU took {stats.opponentScore}
            </p>
            <button
              onClick={startGame}
              className="px-8 md:px-12 py-3 md:py-4 text-lg md:text-xl font-bold text-white rounded-full transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
              style={{
                fontFamily: 'Bangers, cursive',
                background: 'linear-gradient(135deg, #FF1493, #FF6B6B)',
                boxShadow: '0 0 30px rgba(255, 20, 147, 0.5)'
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Slap button */}
      {gameState === 'player-turn' && stats.currentSlapper === 'player' && (
        <div className="absolute bottom-12 md:bottom-16 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={handleSlapClick}
            className="px-10 md:px-16 py-4 md:py-5 text-xl md:text-2xl font-bold text-white rounded-full transition-all duration-150 hover:scale-110 active:scale-90 animate-bounce touch-manipulation"
            style={{
              fontFamily: 'Bangers, cursive',
              background: 'linear-gradient(135deg, #FF1493, #FF6B6B)',
              boxShadow: '0 0 40px rgba(255, 20, 147, 0.6), inset 0 2px 20px rgba(255, 255, 255, 0.2)'
            }}
          >
            SLAP! 👋
          </button>
        </div>
      )}

      {/* Turn indicator */}
      {(gameState === 'player-turn' || gameState === 'slapping') && (
        <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 z-10">
          <div
            className="px-4 md:px-6 py-2 rounded-full text-sm md:text-base"
            style={{
              fontFamily: 'Outfit, sans-serif',
              background: stats.currentSlapper === 'player' ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255, 107, 107, 0.3)',
              border: `2px solid ${stats.currentSlapper === 'player' ? '#4ECDC4' : '#FF6B6B'}`,
              color: 'white'
            }}
          >
            {stats.currentSlapper === 'player' ? 'YOUR TURN' : 'CPU TURN'}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 z-10">
        <p className="text-gray-500 text-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Requested by <a href="https://twitter.com/sfenXyz" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">@sfenXyz</a> · Built by <a href="https://twitter.com/clonkbot" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">@clonkbot</a>
        </p>
      </div>
    </div>
  )
}
