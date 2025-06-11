import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import './App.css'

function App() {
  const mountRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioFile, setAudioFile] = useState(null)
  const [sensitivity, setSensitivity] = useState(1.0)
  const [showConnections, setShowConnections] = useState(true)
  
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const audioRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const neuralNetworkRef = useRef(null)
  const connectionsRef = useRef([])
  const nodesRef = useRef([])
  const particlesRef = useRef([])

  useEffect(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000005, 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountRef.current.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0x0a0a2a, 0.1)
    scene.add(ambientLight)

    const pointLight1 = new THREE.PointLight(0x4444ff, 0.5, 100)
    pointLight1.position.set(50, 50, 50)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xff4444, 0.3, 100)
    pointLight2.position.set(-50, -50, 50)
    scene.add(pointLight2)

    camera.position.set(0, 20, 100)

    const networkGroup = new THREE.Group()
    const nodes = []
    const connections = []
    const particles = []

    const totalNodes = 120
    const spaceRadius = 80
    const allNodes = []

    for (let i = 0; i < totalNodes; i++) {
      const theta = Math.acos(1 - 2 * Math.random())
      const phi = 2 * Math.PI * Math.random()
      const r = spaceRadius * Math.cbrt(Math.random())
      
      const x = r * Math.sin(theta) * Math.cos(phi)
      const y = r * Math.sin(theta) * Math.sin(phi) 
      const z = r * Math.cos(theta)
      
      const nodeSize = 0.4 + Math.random() * 0.6
      const nodeGeometry = new THREE.SphereGeometry(nodeSize, 12, 12)
      
      const baseHue = (Math.atan2(z, x) + Math.PI) / (2 * Math.PI)
      const saturation = 0.7 + Math.random() * 0.3
      const lightness = 0.3 + Math.random() * 0.2
      
      const nodeMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(baseHue, saturation, lightness),
        transparent: true,
        opacity: 0.8,
        emissive: new THREE.Color().setHSL(baseHue, 0.5, 0.1)
      })
      
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial)
      node.position.set(x, y, z)
      node.castShadow = true
      
      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(nodeSize * 1.8, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue, 1, 0.5),
          transparent: true,
          opacity: 0.2
        })
      )
      innerGlow.position.copy(node.position)
      
      const outerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(nodeSize * 3, 6, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue, 0.8, 0.7),
          transparent: true,
          opacity: 0.1
        })
      )
      outerGlow.position.copy(node.position)
      
      networkGroup.add(node)
      networkGroup.add(innerGlow)
      networkGroup.add(outerGlow)
      
      allNodes.push({
        mesh: node,
        innerGlow: innerGlow,
        outerGlow: outerGlow,
        originalPosition: node.position.clone(),
        originalSize: nodeSize,
        index: i,
        activity: 0,
        lastActivity: 0,
        connections: [],
        frequencyBand: Math.floor((i / totalNodes) * 7),
        baseHue: baseHue
      })
    }

    allNodes.forEach((node1, i) => {
      const nearbyNodes = allNodes.filter((node2, j) => {
        if (i === j) return false
        const distance = node1.mesh.position.distanceTo(node2.mesh.position)
        return distance < 25
      })
      
      const connectionCount = Math.min(nearbyNodes.length, 3 + Math.floor(Math.random() * 4))
      const shuffled = nearbyNodes.sort(() => 0.5 - Math.random())
      
      for (let k = 0; k < connectionCount; k++) {
        const node2 = shuffled[k]
        
        const existingConnection = connections.find(conn => 
          (conn.from === node1 && conn.to === node2) || 
          (conn.from === node2 && conn.to === node1)
        )
        
        if (!existingConnection) {
          const geometry = new THREE.BufferGeometry().setFromPoints([
            node1.mesh.position,
            node2.mesh.position
          ])
          
          const material = new THREE.LineBasicMaterial({
            color: 0x333366,
            transparent: true,
            opacity: 0.05,
            linewidth: 1
          })
          
          const line = new THREE.Line(geometry, material)
          if (showConnections) networkGroup.add(line)
          
          const distance = node1.mesh.position.distanceTo(node2.mesh.position)
          const connection = {
            line: line,
            material: material,
            from: node1,
            to: node2,
            strength: 0,
            distance: distance,
            active: false
          }
          
          connections.push(connection)
          node1.connections.push(connection)
          node2.connections.push(connection)
        }
      }
    })

    for (let i = 0; i < 100; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.15, 6, 6)
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0
      })
      const particle = new THREE.Mesh(particleGeometry, particleMaterial)
      
      particles.push({
        mesh: particle,
        connection: null,
        progress: 0,
        speed: 0.01 + Math.random() * 0.04,
        active: false,
        trail: [],
        energy: 0
      })
      
      networkGroup.add(particle)
    }

    scene.add(networkGroup)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    neuralNetworkRef.current = networkGroup
    connectionsRef.current = connections
    nodesRef.current = nodes
    particlesRef.current = particles

    const animate = () => {
      requestAnimationFrame(animate)
      
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current)
        
        const frequencyBands = 7
        const bandSize = Math.floor(dataArrayRef.current.length / frequencyBands)
        
        const bandIntensities = []
        for (let band = 0; band < frequencyBands; band++) {
          const startIndex = band * bandSize
          const endIndex = Math.min(startIndex + bandSize, dataArrayRef.current.length)
          
          let intensity = 0
          for (let i = startIndex; i < endIndex; i++) {
            intensity += dataArrayRef.current[i]
          }
          intensity = (intensity / (endIndex - startIndex) / 255) * sensitivity
          bandIntensities.push(intensity)
        }
        
        allNodes.forEach((node, nodeIndex) => {
          const bandIntensity = bandIntensities[node.frequencyBand] || 0
          
          const timeVariation = 0.3 + Math.sin(Date.now() * 0.003 + nodeIndex * 0.2) * 0.7
          const localIntensity = bandIntensity * timeVariation
          
          node.activity = localIntensity
          node.lastActivity = THREE.MathUtils.lerp(node.lastActivity, node.activity, 0.08)
          
          const hue = (node.baseHue + node.lastActivity * 0.2) % 1
          const lightness = 0.2 + node.lastActivity * 0.8
          
          node.mesh.material.color.setHSL(hue, 0.9, lightness)
          node.mesh.material.opacity = 0.6 + node.lastActivity * 0.4
          node.mesh.material.emissive.setHSL(hue, 0.8, node.lastActivity * 0.4)
          
          const pulseScale = 1 + node.lastActivity * 1.2
          node.mesh.scale.setScalar(pulseScale)
          
          const time = Date.now() * 0.0008
          const offset = new THREE.Vector3(
            Math.sin(time + nodeIndex * 0.1) * node.lastActivity * 1.5,
            Math.cos(time * 0.8 + nodeIndex * 0.15) * node.lastActivity * 1.2,
            Math.sin(time * 1.2 + nodeIndex * 0.12) * node.lastActivity * 1.5
          )
          node.mesh.position.copy(node.originalPosition).add(offset)
          
          node.innerGlow.material.opacity = 0.15 + node.lastActivity * 0.7
          node.innerGlow.scale.setScalar(1 + node.lastActivity * 2)
          node.innerGlow.position.copy(node.mesh.position)
          node.innerGlow.material.color.setHSL(hue, 1, 0.6)
          
          node.outerGlow.material.opacity = 0.08 + node.lastActivity * 0.5
          node.outerGlow.scale.setScalar(1 + node.lastActivity * 3.5)
          node.outerGlow.position.copy(node.mesh.position)
          node.outerGlow.material.color.setHSL(hue, 0.9, 0.8)
        })
        
        connections.forEach((connection) => {
          const combinedActivity = (connection.from.activity + connection.to.activity) / 2
          const strengthMultiplier = Math.max(0.1, 1 - connection.distance / 40)
          connection.strength = combinedActivity * strengthMultiplier * sensitivity
          
          if (connection.strength > 0.15) {
            connection.active = true
            connection.material.opacity = Math.min(0.9, connection.strength * 3)
            
            const hue1 = connection.from.baseHue
            const hue2 = connection.to.baseHue
            const avgHue = (hue1 + hue2) / 2
            connection.material.color.setHSL(avgHue, 0.8, 0.4 + connection.strength * 0.6)
            
            if (connection.strength > 0.3 && Math.random() < 0.06) {
              const availableParticle = particles.find(p => !p.active)
              if (availableParticle) {
                availableParticle.connection = connection
                availableParticle.progress = 0
                availableParticle.active = true
                availableParticle.energy = connection.strength
                availableParticle.mesh.material.color.setHSL(avgHue, 1, 0.9)
              }
            }
          } else {
            connection.active = false
            connection.material.opacity = Math.max(0.02, connection.material.opacity * 0.92)
          }
        })
        
        particles.forEach(particle => {
          if (particle.active && particle.connection) {
            particle.progress += particle.speed * (1 + particle.energy)
            
            if (particle.progress >= 1) {
              const targetNode = particle.connection.to
              targetNode.activity = Math.min(1, targetNode.activity + particle.energy * 0.1)
              
              particle.active = false
              particle.mesh.material.opacity = 0
              particle.progress = 0
            } else {
              const from = particle.connection.from.mesh.position
              const to = particle.connection.to.mesh.position
              particle.mesh.position.lerpVectors(from, to, particle.progress)
              
              const fadeIn = Math.min(1, particle.progress * 4)
              const fadeOut = Math.min(1, (1 - particle.progress) * 4)
              particle.mesh.material.opacity = particle.energy * fadeIn * fadeOut
              particle.mesh.scale.setScalar(1 + particle.energy * 2)
            }
          }
        })
      }

      const time = Date.now() * 0.0002
      camera.position.x = Math.cos(time) * 120 + Math.sin(time * 0.3) * 20
      camera.position.z = Math.sin(time) * 120 + Math.cos(time * 0.7) * 20
      camera.position.y = 20 + Math.sin(time * 0.5) * 30
      
      camera.lookAt(0, 0, 0)

      if (neuralNetworkRef.current) {
        neuralNetworkRef.current.rotation.y += 0.001
        neuralNetworkRef.current.rotation.x = Math.sin(time * 0.5) * 0.05
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [sensitivity, showConnections])

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      setAudioFile(file)
      const url = URL.createObjectURL(file)
      
      if (audioRef.current) {
        audioRef.current.pause()
      }
      
      const audio = new Audio(url)
      audioRef.current = audio
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      const analyser = audioContext.createAnalyser()
      
      analyser.fftSize = 512
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      source.connect(analyser)
      analyser.connect(audioContext.destination)
      
      analyserRef.current = analyser
      dataArrayRef.current = dataArray
      
      setIsPlaying(false)
    }
  }

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="app">
      <div ref={mountRef} className="canvas-container" />
      <div className="controls">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="file-input"
        />
        {audioFile && (
          <button onClick={togglePlayback} className="play-button">
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
        )}

        <div className="control-section">
          <label>Sensitivity: {sensitivity.toFixed(1)}</label>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="control-slider"
          />
        </div>

        <div className="control-section">
          <label>
            <input
              type="checkbox"
              checked={showConnections}
              onChange={(e) => setShowConnections(e.target.checked)}
              className="control-checkbox"
            />
            Show Connections
          </label>
        </div>

        <div className="info">
          <h1>Neural Sound Web</h1>
          <p>Audio Reactive Visualization</p>
          <div className="legend">
            <div className="legend-item">
              <span className="legend-color bass"></span>
              <span>Bass Frequencies</span>
            </div>
            <div className="legend-item">
              <span className="legend-color mid"></span>
              <span>Mid Frequencies</span>
            </div>
            <div className="legend-item">
              <span className="legend-color high"></span>
              <span>High Frequencies</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
