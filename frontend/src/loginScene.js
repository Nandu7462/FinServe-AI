import * as THREE from 'three'

export function mountLoginScene(canvas, wrap, activeRef, selectStage) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x0b1020, 9, 18)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 0.4, 8.6)

  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xdbe7ff, 0.9)
  key.position.set(3, 5, 6)
  scene.add(key)
  const rim = new THREE.PointLight(0x3b82f6, 2.2, 14)
  rim.position.set(-3, -2, 3)
  scene.add(rim)

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.6, -0.3, -0.6),
    new THREE.Vector3(-2.2, 0.9, 0.5),
    new THREE.Vector3(0, -0.2, 0.2),
    new THREE.Vector3(2.2, 0.8, -0.4),
    new THREE.Vector3(4.6, -0.2, 0.4)
  ])
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 240, 0.012, 8, false),
    new THREE.MeshBasicMaterial({ color: 0x93b5ff, transparent: true, opacity: 0.35 })
  )
  scene.add(tube)

  const grid = new THREE.GridHelper(26, 26, 0x3b5bdb, 0x1e2a55)
  grid.position.y = -2.4
  grid.material.transparent = true
  grid.material.opacity = 0.35
  scene.add(grid)

  function cardTexture(kind) {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 320
    const g = c.getContext('2d')
    const bg = g.createLinearGradient(0, 0, 512, 320)
    bg.addColorStop(0, '#f7f9ff'); bg.addColorStop(1, '#dfe8ff')
    g.fillStyle = bg; g.fillRect(0, 0, 512, 320)
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 512, 56)
    g.fillStyle = '#fff'
    g.font = '600 26px Outfit, Arial, sans-serif'
    g.fillText(kind.title, 24, 38)
    kind.lines.forEach((ln, i) => {
      g.fillStyle = i === kind.highlight ? '#2563eb' : '#94a3b8'
      g.fillRect(24, 84 + i * 42, kind.widths[i] * 4.4, 14)
    })
    if (kind.badge) {
      g.fillStyle = '#16a34a'
      g.beginPath(); g.roundRect(340, 250, 150, 44, 22); g.fill()
      g.fillStyle = '#fff'; g.font = '600 18px Outfit, Arial'; g.fillText(kind.badge, 362, 279)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    return tex
  }

  const cardDefs = [
    { title: 'HDFC BANK · SOURCE', lines: ['Rate', 'Fees', 'Eligibility', 'Disclosure'], widths: [70, 55, 80, 62], highlight: 2 },
    { title: 'DRAFT · CUSTOMER', lines: ['Dear customer,', 'Your rate is', 'Fees apply', 'Thank you'], widths: [45, 70, 60, 35], highlight: 1 },
    { title: 'SOURCE REVIEW', lines: ['Source ✓', 'Clause ✓', 'Tone ✓', 'Compliance ✓'], widths: [40, 40, 40, 50], highlight: 3, badge: 'REVIEW' }
  ]

  const cards = cardDefs.map((def, i) => {
    const group = new THREE.Group()
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.MeshStandardMaterial({ map: cardTexture(def), roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide })
    )
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, side: THREE.DoubleSide })
    )
    back.rotation.y = Math.PI; back.position.z = -0.01
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(face.geometry),
      new THREE.LineBasicMaterial({ color: 0x93b5ff, transparent: true, opacity: 0.25 })
    )
    edges.position.z = 0.01
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, 2.3),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false })
    )
    halo.position.z = -0.05
    group.add(halo, face, back, edges)
    const t = [0.14, 0.5, 0.86][i]
    const p = curve.getPointAt(t)
    group.position.copy(p)
    group.userData = { t, halo, face, back, i, baseY: p.y, flip: 0, wasActive: false }
    scene.add(group)
    return group
  })

  const N = 90
  const pGeo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pMat = new THREE.PointsMaterial({ color: 0xc7d7ff, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)
  const phases = Array.from({ length: N }, (_, i) => i / N)

  const dGeo = new THREE.BufferGeometry()
  const dPos = new Float32Array(120 * 3)
  for (let i = 0; i < 120; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 16
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 8
    dPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0x9fb4e8, size: 0.03, transparent: true, opacity: 0.5, depthWrite: false }))
  scene.add(dust)

  const pointer = { x: 0, y: 0 }, camTarget = { x: 0, y: 0 }
  let drag = null
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  function pick(e) {
    const r = canvas.getBoundingClientRect()
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(cards.map(c => c.userData.face), false)
    return hits.length ? cards.indexOf(hits[0].object.parent) : -1
  }

  const onDown = e => {
    drag = { x: e.clientX, y: e.clientY, moved: false }
    wrap.classList.add('grabbing')
  }
  wrap.addEventListener('pointerdown', onDown)
  const onMove = e => {
    const r = wrap.getBoundingClientRect()
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
      if (drag.moved) {
        scene.rotation.y = Math.max(-0.5, Math.min(0.5, scene.rotation.y + dx * 0.004))
        scene.rotation.x = Math.max(-0.3, Math.min(0.3, scene.rotation.x + dy * 0.002))
        drag.x = e.clientX; drag.y = e.clientY
      }
    }
  }
  const onUp = e => {
    if (drag && !drag.moved) {
      const i = pick(e)
      if (i >= 0) selectStage(i)
    }
    if (!drag) { scene.rotation.x *= 0.2; scene.rotation.y *= 0.2 }
    drag = null
    wrap.classList.remove('grabbing')
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = w < 600 ? 10.5 : 8.6
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  let raf
  const clock = new THREE.Clock()
  function animate() {
    const t = clock.getElapsedTime()
    camTarget.x += (pointer.x * 0.6 - camTarget.x) * 0.05
    camTarget.y += (-pointer.y * 0.35 - camTarget.y) * 0.05
    camera.position.x = camTarget.x
    camera.position.y = 0.4 + camTarget.y
    camera.lookAt(0, 0, 0)
    cards.forEach((c, i) => {
      const u = c.userData
      const isActive = i === activeRef.current
      if (isActive && !u.wasActive) u.flip = -Math.PI * 2
      u.wasActive = isActive
      const targetZ = isActive ? 0.6 : 0
      const targetS = isActive ? 1.1 : 1.0
      c.position.y = u.baseY + Math.sin(t * 1.4 + i * 1.7) * 0.12
      c.position.z += (targetZ - c.position.z) * 0.08
      const s = c.scale.x + (targetS - c.scale.x) * 0.08
      c.scale.set(s, s, s)
      u.flip *= 0.91
      c.rotation.y = u.flip
      c.rotation.x = Math.sin(t * 0.9 + i) * 0.05
      u.halo.material.opacity += ((isActive ? 0.25 : 0) - u.halo.material.opacity) * 0.1
    })
    const arr = pGeo.attributes.position.array
    for (let i = 0; i < N; i++) {
      phases[i] = (phases[i] + 0.0022 + (i % 5) * 0.00008) % 1
      const p = curve.getPointAt(phases[i])
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y + Math.sin(t * 3 + i) * 0.03; arr[i * 3 + 2] = p.z
    }
    pGeo.attributes.position.needsUpdate = true
    dust.rotation.y = t * 0.02
    rim.position.x = Math.sin(t * 0.6) * 4
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    wrap.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('resize', resize)
    scene.traverse(object => {
      object.geometry?.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) {
          material.map?.dispose()
          material.dispose()
        }
      }
    })
    renderer.dispose()
  }
}
