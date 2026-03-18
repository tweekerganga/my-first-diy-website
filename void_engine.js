let scene, camera, renderer, world, pubnub;
let peers = {}, balls = [], keys = {};
// UNIQUE ID FOR EVERY DEVICE/TAB
const myID = "chud_" + Math.random().toString(36).substr(2, 9);
let yaw = 0, pitch = 0;

function initGmod() {
    document.getElementById('join-screen').style.display = 'none';
    const container = document.getElementById('gmod-void');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 40, 15); // MASSIVE HEIGHT SPAWN

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // PHYSICS SLAB (THICK FLOOR)
    world = new CANNON.World();
    world.gravity.set(0, -20, 0); 
    const floorShape = new CANNON.Box(new CANNON.Vec3(1000, 10, 1000)); 
    const floorBody = new CANNON.Body({ mass: 0 }); 
    floorBody.addShape(floorShape);
    floorBody.position.set(0, -10, 0); 
    world.addBody(floorBody);

    const grid = new THREE.GridHelper(1000, 100, 0xff0055, 0x222222);
    scene.add(grid);

    // CHUD'S STICK GUN
    const gun = new THREE.Group();
    const g1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), new THREE.MeshStandardMaterial({color: 0x333333}));
    g1.rotation.x = Math.PI/2;
    const g2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), new THREE.MeshStandardMaterial({color: 0x999999}));
    g2.position.z = -0.4; g2.rotation.x = Math.PI/2;
    gun.add(g1, g2); gun.position.set(0.4, -0.3, -0.6);
    camera.add(gun); scene.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // MULTIPLAYER (AGGRESSIVE VERSION)
    pubnub = new PubNub({ 
        publishKey: 'pub-c-4627d355-6b60-466d-965a-0d924d6274e1', 
        subscribeKey: 'sub-c-5727932c-352b-11eb-a63e-f23023e981f3', 
        uuid: myID,
        ssl: true,
        heartbeatInterval: 10 
    });

    pubnub.addListener({
        message: (m) => {
            if (m.publisher !== myID) updatePeer(m.publisher, m.message);
        }
    });

    pubnub.subscribe({ channels: ['pete_chud_net_v1'] });

    container.addEventListener('click', () => { container.requestPointerLock(); spawnBall(); });
    
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === container) {
            yaw -= e.movementX * 0.002; pitch -= e.movementY * 0.002;
            pitch = Math.max(-1.5, Math.min(1.5, pitch));
        }
    });

    window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
    window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

    animate();
}

function spawnBall() {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({color: 0x00ff00, emissive: 0x00ff00}));
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 8, shape: new CANNON.Sphere(0.4) });
    body.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    body.velocity.set(dir.x * 35, dir.y * 35, dir.z * 35);
    world.addBody(body);
    balls.push({ mesh, body });
}

function updatePeer(id, data) {
    if (!peers[id]) {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true});
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25), mat); head.position.y = 1.8;
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.1), mat); torso.position.y = 1.2;
        const arms = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), mat); arms.position.y = 1.4;
        group.add(head, torso, arms);
        peers[id] = group;
        scene.add(group);
    }
    peers[id].position.lerp(new THREE.Vector3(data.x, data.y - 1.6, data.z), 0.4);
    peers[id].rotation.y = data.ry;
    document.getElementById('peer-count').innerText = Object.keys(peers).length + 1;
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1/60);

    if (camera) {
        // GRAVITY DROP
        if (camera.position.y > 1.7) camera.position.y -= 0.25; 
        else camera.position.y = 1.7;

        const s = 0.22;
        if (keys['w']) { camera.position.x -= Math.sin(yaw) * s; camera.position.z -= Math.cos(yaw) * s; }
        if (keys['s']) { camera.position.x += Math.sin(yaw) * s; camera.position.z += Math.cos(yaw) * s; }
        if (keys['a']) { camera.position.x -= Math.cos(yaw) * s; camera.position.z += Math.sin(yaw) * s; }
        if (keys['d']) { camera.position.x += Math.cos(yaw) * s; camera.position.z -= Math.sin(yaw) * s; }
        
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        
        // HEARTBEAT BROADCAST
        if (Date.now() % 4 === 0) {
            pubnub.publish({ 
                channel: 'pete_chud_net_v1', 
                message: { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: yaw } 
            });
        }
    }

    balls.forEach(b => {
        b.mesh.position.copy(b.body.position);
        b.mesh.quaternion.copy(b.body.quaternion);
    });

    renderer.render(scene, camera);
}
