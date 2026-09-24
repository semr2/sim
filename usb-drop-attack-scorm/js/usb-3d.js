/* Procedural USB threat asset. Three.js is loaded by index.html. */
(function () {
  'use strict';

  function init3DUsbScene() {
    var container = document.getElementById('canvas-container');
    var mount = container && container.querySelector('.three-canvas-mount');
    if (!container || !mount || container.dataset.initialized === 'true') return;
    if (!window.THREE) {
      mount.textContent = '3D preview unavailable. The rest of the simulation is still available.';
      mount.style.cssText = 'display:grid;place-items:center;color:#8b9bb4;font:13px system-ui,sans-serif;padding:20px;text-align:center';
      return;
    }
    if (!container.clientWidth || !container.clientHeight) return;

    var THREE = window.THREE;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 8);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D model of a simulated USB drive. Drag to rotate.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    mount.appendChild(renderer.domElement);
    container.dataset.initialized = 'true';

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    var redPointLight = new THREE.PointLight(0xff4757, 2, 10);
    redPointLight.position.set(2, 3, 4);
    scene.add(redPointLight);
    var bluePointLight = new THREE.PointLight(0x00d2d3, 1.5, 10);
    bluePointLight.position.set(-3, -2, -2);
    scene.add(bluePointLight);

    var usbGroup = new THREE.Group();
    var bodyGeo = new THREE.BoxGeometry(1.2, 0.4, 2.8);
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.3, metalness: 0.8 });
    usbGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

    var plugGeo = new THREE.BoxGeometry(0.8, 0.25, 1.0);
    var plugMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.95, roughness: 0.1 });
    var usbPlug = new THREE.Mesh(plugGeo, plugMat);
    usbPlug.position.set(0, 0, 1.8);
    usbGroup.add(usbPlug);

    var contactMat = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.9, roughness: 0.25 });
    for (var i = 0; i < 2; i++) {
      var contact = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.42), contactMat);
      contact.position.set(i ? 0.2 : -0.2, 0, 2.31);
      usbGroup.add(contact);
    }

    var ledMat = new THREE.MeshBasicMaterial({ color: 0xff4757, transparent: true, opacity: 1 });
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), ledMat);
    led.position.set(0.3, 0.21, -0.8);
    usbGroup.add(led);
    usbGroup.rotation.x = 0.12;
    scene.add(usbGroup);

    var wireframeSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.5, 2),
      new THREE.MeshBasicMaterial({ color: 0xff4757, wireframe: true, transparent: true, opacity: 0.15 })
    );
    scene.add(wireframeSphere);

    var dragging = false;
    var lastX = 0, lastY = 0;
    var canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', function (event) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = 'grabbing';
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      usbGroup.rotation.y += (event.clientX - lastX) * 0.01;
      usbGroup.rotation.x += (event.clientY - lastY) * 0.01;
      lastX = event.clientX;
      lastY = event.clientY;
    });
    function stopDragging() { dragging = false; canvas.style.cursor = 'grab'; }
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
    canvas.addEventListener('lostpointercapture', stopDragging);
    canvas.addEventListener('keydown', function (event) {
      var step = 0.12;
      if (event.key === 'ArrowLeft') usbGroup.rotation.y -= step;
      else if (event.key === 'ArrowRight') usbGroup.rotation.y += step;
      else if (event.key === 'ArrowUp') usbGroup.rotation.x -= step;
      else if (event.key === 'ArrowDown') usbGroup.rotation.x += step;
      else return;
      event.preventDefault();
    });

    var clock = new THREE.Clock();
    var animationId = 0;
    function animate() {
      animationId = window.requestAnimationFrame(animate);
      var elapsedTime = clock.getElapsedTime();
      if (!dragging) {
        usbGroup.rotation.y += 0.008;
        usbGroup.position.y = Math.sin(elapsedTime * 2) * 0.15;
      }
      wireframeSphere.rotation.y -= 0.002;
      wireframeSphere.rotation.x += 0.001;
      ledMat.opacity = Math.sin(elapsedTime * 8) > 0 ? 1 : 0.2;
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      var width = container.clientWidth;
      var height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    var resizeObserver = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(container);
    else window.addEventListener('resize', resize);

    window.addEventListener('pagehide', function () {
      window.cancelAnimationFrame(animationId);
      if (resizeObserver) resizeObserver.disconnect();
      renderer.dispose();
      bodyGeo.dispose(); bodyMat.dispose(); plugGeo.dispose(); plugMat.dispose(); contactMat.dispose(); ledMat.dispose();
      scene.traverse(function (object) { if (object.geometry && object.geometry !== bodyGeo && object.geometry !== plugGeo) object.geometry.dispose(); });
    }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init3DUsbScene, { once: true });
  else init3DUsbScene();
}());
