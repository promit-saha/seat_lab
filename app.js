(function () {
  "use strict";

  window.addEventListener('error', function (e) {
    var msg = (e && e.message) ? e.message : 'Unknown script error';
    var lt = document.getElementById('loadingText');
    if (lt) lt.textContent = 'Error: ' + msg;
    var sn = document.getElementById('statusNote');
    if (sn) sn.textContent = 'Something broke while setting up the 3D view: ' + msg;
    console.error(e);
  });

  var host = document.getElementById('canvasHost');
  var scene, camera, renderer;
  var paintMats = [];
  var leatherMats = [];
  var modelRoot = null;

  var sph = { theta: 0.7, phi: 1.15, radius: 8 };
  var target = new THREE.Vector3(0, 1, 0);
  var minR = 3, maxR = 20;
  var dragging = false, lastX = 0, lastY = 0;
  var tween = null;

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14181A);

    camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    var hemi = new THREE.HemisphereLight(0xcfd8dc, 0x1a1a1a, 0.85);
    scene.add(hemi);

    var key = new THREE.DirectionalLight(0xfff4e0, 2.1);
    key.position.set(6, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0004;
    scene.add(key);
    window.__keyLight = key;

    var fill = new THREE.DirectionalLight(0x8fb2ff, 0.55);
    fill.position.set(-7, 4, -4);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(0, 5, -9);
    scene.add(rim);

    var groundGeo = new THREE.CircleGeometry(30, 48);
    var groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1f21, roughness: 1, metalness: 0 });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    var vignette = makeVignetteTexture();
    var vGeo = new THREE.CircleGeometry(9, 48);
    var vMat = new THREE.MeshBasicMaterial({ map: vignette, transparent: true, depthWrite: false });
    var vMesh = new THREE.Mesh(vGeo, vMat);
    vMesh.rotation.x = -Math.PI / 2;
    vMesh.position.y = 0.01;
    scene.add(vMesh);

    updateCamera();
    window.addEventListener('resize', onResize);
    attachControls();
  }

  function makeVignetteTexture() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function onResize() {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  }

  function updateCamera() {
    var t = sph.theta, p = sph.phi, r = sph.radius;
    camera.position.set(
      target.x + r * Math.sin(p) * Math.sin(t),
      target.y + r * Math.cos(p),
      target.z + r * Math.sin(p) * Math.cos(t)
    );
    camera.lookAt(target);
  }

  function clampPhi(p) { return Math.max(0.35, Math.min(1.45, p)); }

  function attachControls() {
    host.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      host.classList.add('dragging');
      tween = null;
      try { host.setPointerCapture(e.pointerId); } catch (err) {}
      setActiveViewBtn(null);
    });
    host.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      sph.theta -= dx * 0.007;
      sph.phi = clampPhi(sph.phi - dy * 0.006);
      updateCamera();
    });
    window.addEventListener('pointerup', function () { dragging = false; host.classList.remove('dragging'); });
    host.addEventListener('wheel', function (e) {
      e.preventDefault();
      sph.radius = Math.max(minR, Math.min(maxR, sph.radius + e.deltaY * 0.0035 * sph.radius));
      updateCamera();
    }, { passive: false });

    document.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveViewBtn(btn);
        var toTheta = parseFloat(btn.getAttribute('data-theta'));
        var toPhi = parseFloat(btn.getAttribute('data-phi'));
        startTween(toTheta, toPhi);
      });
    });
  }

  function setActiveViewBtn(btn) {
    document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }

  function startTween(toTheta, toPhi) {
    var fromTheta = sph.theta, fromPhi = sph.phi;
    var d = toTheta - fromTheta;
    while (d > Math.PI) { toTheta -= Math.PI * 2; d = toTheta - fromTheta; }
    while (d < -Math.PI) { toTheta += Math.PI * 2; d = toTheta - fromTheta; }
    tween = { fromTheta: fromTheta, toTheta: toTheta, fromPhi: fromPhi, toPhi: toPhi, start: performance.now(), dur: 550 };
  }

  function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  var autoRotateEnabled = true;
  document.getElementById('autoRotate').addEventListener('change', function (e) { autoRotateEnabled = e.target.checked; });

  function animate() {
    requestAnimationFrame(animate);
    if (tween) {
      var t = (performance.now() - tween.start) / tween.dur;
      if (t >= 1) { sph.theta = tween.toTheta; sph.phi = tween.toPhi; tween = null; }
      else {
        var e = easeInOutCubic(t);
        sph.theta = tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
        sph.phi = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
      }
      updateCamera();
    } else if (autoRotateEnabled && !dragging) {
      sph.theta += 0.0035;
      updateCamera();
      setActiveViewBtn(null);
    }
    renderer.render(scene, camera);
  }

  function loadModel() {
    var loader = new THREE.GLTFLoader();
    loader.load('assets/raptor.glb', function (gltf) {
      modelRoot = gltf.scene;

      var box = new THREE.Box3().setFromObject(modelRoot);
      var size = new THREE.Vector3(); box.getSize(size);
      var center = new THREE.Vector3(); box.getCenter(center);
      modelRoot.position.x -= center.x;
      modelRoot.position.z -= center.z;
      modelRoot.position.y -= box.min.y;

      modelRoot.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
          var mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(function (m) {
            if (!m || !m.name) return;
            if (/paint/i.test(m.name)) paintMats.push(m);
            if (/leather/i.test(m.name)) leatherMats.push(m);
          });
        }
      });

      scene.add(modelRoot);

      target.set(0, size.y * 0.45, 0);
      var radius = Math.max(size.x, size.y, size.z);
      sph.radius = radius * 1.55;
      minR = radius * 0.7;
      maxR = radius * 3.2;

      var d = radius * 1.3;
      var key = window.__keyLight;
      key.shadow.camera.left = -d; key.shadow.camera.right = d;
      key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
      key.shadow.camera.near = 0.5; key.shadow.camera.far = radius * 6;
      key.target = modelRoot;
      scene.add(key.target);
      key.shadow.camera.updateProjectionMatrix();

      updateCamera();
      applyPaint(document.querySelector('[data-target="paint"] .swatch.active').getAttribute('data-hex'));
      applySeat(document.querySelector('[data-target="seat"] .swatch.active'));

      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('statusNote').textContent = 'Model loaded. Drag the vehicle to look around.';
      animate();
    }, function (xhr) {
      if (xhr.lengthComputable) {
        var pct = Math.round((xhr.loaded / xhr.total) * 100);
        document.getElementById('loadingText').textContent = 'Loading 3D model… ' + pct + '%';
        document.getElementById('loadingBarFill').style.width = pct + '%';
      }
    }, function (err) {
      document.getElementById('loadingText').textContent = 'Could not load the 3D model.';
      document.getElementById('statusNote').textContent = 'The 3D model failed to load. If you opened this file directly (file://), run it through a local server instead, see the README.';
      console.error(err);
    });
  }

  function applyPaint(hex) {
    paintMats.forEach(function (m) { m.color.set(hex); });
  }
  function applySeat(btn) {
    var hex = btn.getAttribute('data-hex');
    leatherMats.forEach(function (m) { m.color.set(hex); });
    var imgSrc = btn.getAttribute('data-img');
    var label = btn.parentElement.querySelector('.swatch-label').textContent;
    document.getElementById('seatPreviewImg').src = imgSrc;
    document.getElementById('seatPreviewCap').textContent = label + ' canvas seat cover';
    document.getElementById('chipSeat').textContent = label + ' seats';
  }

  document.querySelectorAll('.swatch-grid').forEach(function (grid) {
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.swatch');
      if (!btn) return;
      grid.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('active'); });
      btn.classList.add('active');
      var targetName = grid.getAttribute('data-target');
      var hex = btn.getAttribute('data-hex');
      var label = btn.parentElement.querySelector('.swatch-label').textContent;
      if (targetName === 'paint') {
        applyPaint(hex);
        document.getElementById('chipPaint').textContent = label;
      } else {
        applySeat(btn);
      }
    });
  });

  var wizard = document.getElementById('wizard');
  var toggleBtn = document.getElementById('showroomToggle');
  toggleBtn.addEventListener('click', function () {
    var collapsed = wizard.classList.toggle('collapsed');
    toggleBtn.textContent = collapsed ? 'Edit configuration' : 'View full showroom';
    setTimeout(onResize, 420);
  });

  try {
    if (typeof THREE === 'undefined') throw new Error('three.min.js did not load');
    if (typeof THREE.GLTFLoader === 'undefined') throw new Error('GLTFLoader.js did not load');
    initScene();
    loadModel();
  } catch (e) {
    document.getElementById('loadingText').textContent = 'Error: ' + e.message;
    document.getElementById('statusNote').textContent = 'Something broke while setting up the 3D view: ' + e.message;
    console.error(e);
  }
})();
