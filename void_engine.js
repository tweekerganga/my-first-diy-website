let scene, camera, renderer, world, pubnub;
let peers = {}, balls = [], keys = {};
const myID = "pete_" + Math.random().toString(36).substr(2, 4);
let yaw = 0, pitch = 0;

function initGmod() {
    document.getElementById('join-screen').style.display = 'none';
    const container = document.getElementById('gmod-void');

    // FIX THE "PINK LINES" glitch:
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // Set a solid background color

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 1); // Force clear every frame
    container.appendChild(renderer.domElement);

    // PHYSICS
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);

    // THE FLOOR (Actual solid object so you don't see the horizon glitch)
    const floorGeo = new THREE.PlaneGeometry(1000, 1000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(1000, 100, 0xff0055, 0x222222);
    grid.position.y = 0.01;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(0xffaa00, 2, 50);
    light.position.set(0, 5, 0);
    scene.add(light);

    // CONTROLS
    container.addEventListener('click', () => { container.requestPointerLock(); spawnBall(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === container) {
            yaw -= e.movementX * 0.002;
            pitch -= e.movementY * 0.002;
            pitch = Math.max(-1.5, Math.min(1.5, pitch));
        }
    });

    // MULTIPLAYER PULSE
    pubnub = new PubNub({ 
        publishKey: 'pub-c-4627d355-6b60-466d-965a-0d924d6274e1', 
        subscribeKey: 'sub-c-5727932c-352b-11eb-a63e-f23023e981f3', 
        uuid: myID 
    });
    pubnub.subscribe({ channels: ['pete_final_void'] });
    pubnub.addListener({ message: (m) => { 
        if (m.publisher !== myID) updatePeer(m.publisher, m.message); 
    }});

    window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
    window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

    animate();
}

function spawnBall() {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({color: 0x00ff00}));
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(0.4) });
    body.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    body.velocity.set(dir.x * 20, dir.y * 20, dir.z * 20);
    world.addBody(body);
    balls.push({ mesh, body });
}

function updatePeer(id, data) {
    if (!peers[id]) {
        peers[id] = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff, wireframe: true}));
        scene.add(peers[id]);
    }
    peers[id].position.set(data.x, 0.9, data.z);
    document.getElementById('peer-count').innerText = Object.keys(peers).length + 1;
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1/60);
    if (camera) {
        const s = 0.15;
        if (keys['w']) { camera.position.x -= Math.sin(yaw) * s; camera.position.z -= Math.cos(yaw) * s; }
        if (keys['s']) { camera.position.x += Math.sin(yaw) * s; camera.position.z += Math.cos(yaw) * s; }
        if (keys['a']) { camera.position.x -= Math.cos(yaw) * s; camera.position.z += Math.sin(yaw) * s; }
        if (keys['d']) { camera.position.x += Math.cos(yaw) * s; camera.position.z -= Math.sin(yaw) * s; }
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        if (Date.now() % 10 === 0) pubnub.publish({ channel: 'pete_final_void', message: { x: camera.position.x, z: camera.position.z } });
    }
    balls.forEach(b => { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); });
    renderer.render(scene, camera);
}
