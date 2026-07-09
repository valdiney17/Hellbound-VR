import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer, controller1, controller2, controllerGrip1, controllerGrip2;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let raycaster, bullets = [], enemyBullets = [], enemies = [], particles = [], trees = [];
let fireflies = [], ambientParticles = [], floatingLeaves = [];
let health = 100, score = 0, kills = 0, combo = 0, lastKillTime = 0;
let isVR = false;
let prevTime = performance.now();
let cameraRig;
let headBobTime = 0, weaponSwayX = 0, weaponSwayY = 0;
let screenShake = 0, damageVignette = 0;
let footstepTimer = 0, isWalking = false;
let vrMoveAxes = [0, 0];
let leftHandModel = null;

const WEAPONS = {
    knife: { name: 'Faca', ammo: 999, maxAmmo: 999, damage: 50, fireRate: 400, reloadTime: 0, spread: 0, bulletsPerShot: 0, color: 0xcccccc, melee: true, range: 2.0 },
    pistol: { name: 'Pistola', ammo: 12, maxAmmo: 12, damage: 25, fireRate: 300, reloadTime: 1500, spread: 0.02, bulletsPerShot: 1, color: 0x00ff88 },
    smg: { name: 'SMG', ammo: 30, maxAmmo: 30, damage: 15, fireRate: 80, reloadTime: 2000, spread: 0.08, bulletsPerShot: 1, color: 0x00aaff },
    shotgun: { name: 'Shotgun', ammo: 4, maxAmmo: 4, damage: 40, fireRate: 800, reloadTime: 2500, spread: 0.15, bulletsPerShot: 6, color: 0xff8800 },
    sniper: { name: 'Sniper', ammo: 5, maxAmmo: 5, damage: 100, fireRate: 1500, reloadTime: 3000, spread: 0.005, bulletsPerShot: 1, color: 0xff0044 }
};

let currentWeapon = 'pistol';
let weaponAmmo = {};
let lastFireTime = 0;
let isReloading = false;
let guns = {};
let currentGun = null;
let audioCtx = null;
let pistolBuffer = null;
let smgFireBuffer = null;
let smgEndBuffer = null;
let smgReloadBuffer = null;
let smgFireSource = null;
let campfires = [];
let weaponModel = null;
let shotgunModel = null;
let smgModel = null;
let knifeModel = null;

init();

function init() {
    console.log('Starting init...');

    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d1a0d);
        scene.fog = new THREE.FogExp2(0x0d1a0d, 0.02);

        // Carregar textura do ceu noturno
        const skyLoader = new THREE.TextureLoader();
        const skyTex = skyLoader.load('assets/cenario/ceu/sky-night.jpg?t=' + Date.now(),
            (tex) => { console.log('Sky texture loaded OK'); },
            undefined,
            (err) => { console.error('Sky texture error:', err); }
        );
        skyTex.colorSpace = THREE.SRGBColorSpace;
        skyTex.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = skyTex;

        camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.05, 200);
        camera.position.set(0, 1.7, 0);

        cameraRig = new THREE.Group();
        cameraRig.position.set(0, 0, 0);
        cameraRig.add(camera);
        scene.add(cameraRig);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.8;
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType('local-floor');
        document.body.appendChild(renderer.domElement);

        console.log('Scene setup done');
    } catch (e) {
        console.error('Scene setup error:', e);
    }

    try {
        initAudio();
    } catch (e) {
        console.error('Audio init error:', e);
    }

    try {
        setupLights();
    } catch (e) {
        console.error('Lights error:', e);
    }

    try {
        loadWeaponModel();
        loadShotgunModel();
        loadSMGModel();
        loadKnifeModel();
    } catch (e) {
        console.error('Weapons error:', e);
    }

    try {
        createForest();
        createCampfires();
    } catch (e) {
        console.error('Environment error:', e);
    }

    try {
        createFallbackWeapons();
    } catch (e) {
        console.error('Fallback weapons error:', e);
    }

    try {
        createAllEnemies();
    } catch (e) {
        console.error('Enemies error:', e);
    }

    try {
        createAmbientParticles();
        createFireflies();
        createFloatingLeaves();
    } catch (e) {
        console.error('Particles error:', e);
    }

    try {
        setupControllers();
        setupKeyboard();
    } catch (e) {
        console.error('Input error:', e);
    }

    raycaster = new THREE.Raycaster();
    Object.keys(WEAPONS).forEach(w => { weaponAmmo[w] = WEAPONS[w].maxAmmo; });

    window.addEventListener('resize', onWindowResize);

    // Botão INICIAR - funciona sempre
    const btn = document.getElementById('blocker-btn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Botão clicado!');
            if ('xr' in navigator) {
                startVRSession();
            } else {
                startDesktopMode();
            }
        });
    }

    // Clicar no blocker inteiro também funciona
    const blocker = document.getElementById('blocker');
    if (blocker) {
        blocker.addEventListener('click', () => {
            console.log('Blocker clicado!');
            if ('xr' in navigator) {
                startVRSession();
            } else {
                startDesktopMode();
            }
        });
    }

    console.log('Init complete, setting up VR...');
    setTimeout(() => setupVR(), 100);
    createMenuParticles();
    renderer.setAnimationLoop(animate);
}

// ==================== MENU PARTICLES ====================
function createMenuParticles() {
    const container = document.getElementById('menu-particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'menu-particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (8 + Math.random() * 15) + 's';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.width = (1 + Math.random() * 2) + 'px';
        p.style.height = p.style.width;
        container.appendChild(p);
    }
}

// ==================== LOAD FBX WEAPON ====================
function loadWeaponModel() {
    try {
        const loader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();

        const gunTexture = textureLoader.load('assets/arma/99-weapon-3-pack/glock.jpg');
        gunTexture.colorSpace = THREE.SRGBColorSpace;

        loader.load(
            'assets/arma/99-weapon-3-pack/pistol.fbx',
            (model) => {
                weaponModel = model;

                // Primeiro medir o tamanho real do modelo em escala 1.0
                const bbox = new THREE.Box3().setFromObject(model);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // Ctrl grip Quest2 ~= 0.14m. Arma real ~= 0.20m. Escalar para tamanho real
                const targetSize = 0.20;
                const scaleFactor = targetSize / maxDim;
                model.scale.setScalar(scaleFactor);

                // Recalcular bounding box na escala correta
                const scaledBox = new THREE.Box3().setFromObject(model);
                const center = scaledBox.getCenter(new THREE.Vector3());

                // Centralizar na origem do controller
                model.position.set(-center.x, -center.y, -center.z);

                // Alinhar cano com direcao do tiro (-Z = frente do controller)
                // Ajustar angulo para o cano apontar na mesma linha do flash/bala
                model.rotation.set(0, Math.PI, 0);

                // Posicionar no centro exato do controller
                model.position.set(0, 0, 0);

                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material = new THREE.MeshStandardMaterial({
                            map: gunTexture,
                            roughness: 0.4,
                            metalness: 0.6,
                            envMapIntensity: 0.8
                        });
                    }
                });

                // Adicionar ao controller2 (mesmo lugar onde saem balas)
                controller2.add(model);
                console.log('Pistol FBX loaded! Model size:', size, 'Scale:', scaleFactor);
            },
            undefined,
            (err) => {
                console.log('FBX load error, using fallback:', err);
            }
        );
    } catch (e) {
        console.log('FBXLoader error:', e);
    }
}

function loadShotgunModel() {
    try {
        const loader = new GLTFLoader();
        loader.load(
            'assets/audio/arma/Shotgun/benelli_m4/scene.gltf',
            (gltf) => {
                const model = gltf.scene;
                shotgunModel = model;

                const bbox = new THREE.Box3().setFromObject(model);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // Shotgun real ~= 1.0m. Escalar para 0.90m (0.75 + 0.15)
                const targetSize = 0.90;
                const scaleFactor = targetSize / maxDim;
                model.scale.setScalar(scaleFactor);

                const scaledBox = new THREE.Box3().setFromObject(model);
                const center = scaledBox.getCenter(new THREE.Vector3());
                model.position.set(-center.x, -center.y, -center.z);

                // Shotgun: cano para frente (-Z)
                model.rotation.set(0, Math.PI / 2, 0);
                model.position.set(0, 0, 0);

                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                controller2.add(model);
                model.visible = false;
                console.log('Shotgun GLTF loaded! Scale:', scaleFactor);
            },
            undefined,
            (err) => {
                console.log('Shotgun GLTF load error:', err);
            }
        );
    } catch (e) {
        console.log('GLTFLoader error:', e);
    }
}

function loadSMGModel() {
    try {
        const loader = new GLTFLoader();
        loader.load(
            'assets/audio/arma/smg/low-poly_msmc.glb',
            (gltf) => {
                const model = gltf.scene;
                smgModel = model;

                const bbox = new THREE.Box3().setFromObject(model);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // SMG real ~= 0.45m
                const targetSize = 0.45;
                const scaleFactor = targetSize / maxDim;
                model.scale.setScalar(scaleFactor);

                const scaledBox = new THREE.Box3().setFromObject(model);
                const center = scaledBox.getCenter(new THREE.Vector3());
                model.position.set(-center.x, -center.y, -center.z);

                // SMG: cano para frente (-Z)
                model.rotation.set(0, Math.PI / 2, 0);
                model.position.set(0, 0, 0);

                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                controller2.add(model);
                model.visible = false;
                console.log('SMG GLB loaded! Scale:', scaleFactor);
            },
            undefined,
            (err) => {
                console.log('SMG GLB load error:', err);
            }
        );
    } catch (e) {
        console.log('GLTFLoader error:', e);
    }
}

function loadKnifeModel() {
    try {
        const loader = new GLTFLoader();
        loader.load(
            'assets/audio/arma/faca/combat_knife.glb',
            (gltf) => {
                const model = gltf.scene;
                knifeModel = model;

                const bbox = new THREE.Box3().setFromObject(model);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // Faca real ~= 0.30m
                const targetSize = 0.30;
                const scaleFactor = targetSize / maxDim;
                model.scale.setScalar(scaleFactor);

                const scaledBox = new THREE.Box3().setFromObject(model);
                const center = scaledBox.getCenter(new THREE.Vector3());
                model.position.set(-center.x, -center.y, -center.z);

                // Faca: ponta para cima (+Y), cabo na mao
                model.rotation.set(0, Math.PI, Math.PI / 2);
                model.position.set(0, 0, 0);

                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                controller2.add(model);
                model.visible = false;
                console.log('Knife GLB loaded! Scale:', scaleFactor);
            },
            undefined,
            (err) => {
                console.log('Knife GLB load error:', err);
            }
        );
    } catch (e) {
        console.log('GLTFLoader error:', e);
    }
}

// ==================== LEFT HAND (procedural, real size) ====================
function loadLeftHand() {
    const handGroup = new THREE.Group();
    handGroup.name = 'leftHand';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, metalness: 0.05 });

    // Palma (~8cm x 7cm x 3cm)
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.08), skinMat);
    palm.position.set(0, 0, -0.02);
    handGroup.add(palm);

    // Dedos (5) - tamanhos reais
    const fingerData = [
        { x: -0.025, z: -0.065, len: 0.055, r: 0.008 },   // mindinho
        { x: -0.012, z: -0.070, len: 0.065, r: 0.008 },   // anelar
        { x: 0.000,  z: -0.075, len: 0.070, r: 0.009 },   // medio
        { x: 0.012,  z: -0.070, len: 0.060, r: 0.008 },   // indicador
        { x: 0.030,  z: -0.040, len: 0.045, r: 0.008 },   // polegar (pro lado)
    ];

    fingerData.forEach(f => {
        const finger = new THREE.Mesh(
            new THREE.CylinderGeometry(f.r, f.r * 0.8, f.len, 6),
            skinMat
        );
        finger.position.set(f.x, 0, f.z - f.len / 2);
        finger.rotation.x = -Math.PI / 2;
        handGroup.add(finger);
    });

    // Pulso
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.05, 8), skinMat);
    wrist.position.set(0, 0, 0.05);
    wrist.rotation.x = -Math.PI / 2;
    handGroup.add(wrist);

    // Escala e orientacao para bater com a grip do controller esquerdo
    handGroup.scale.x = -1; // espelhar para parecer mao esquerda
    handGroup.rotation.set(0, Math.PI, 0);

    leftHandModel = handGroup;

    if (controller1) {
        controller1.add(handGroup);
    }

    console.log('Left hand created (procedural, real size)');
}

function createFallbackWeapons() {
    Object.keys(WEAPONS).forEach(key => {
        const w = WEAPONS[key];
        const gunGroup = new THREE.Group();
        gunGroup.name = key;
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.2 });
        const accentMat = new THREE.MeshStandardMaterial({ color: w.color, emissive: w.color, emissiveIntensity: 0.3 });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

        if (key === 'knife') {
            // Lâmina
            addPart(gunGroup, new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 }), 'box', [0.005, 0.015, 0.22, 0, 0, 0.12]);
            // Borda da lâmina (triângulo aproximado)
            addPart(gunGroup, new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 }), 'box', [0.003, 0.01, 0.18, 0, 0.008, 0.13, 0, 0, 0.15]);
            // Guard (proteção entre lâmina e cabo)
            addPart(gunGroup, new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 }), 'box', [0.025, 0.012, 0.015, 0, 0, 0.02]);
            // Cabo (cabo de faca)
            addPart(gunGroup, new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.8 }), 'cyl', [0.008, 0.1, 0, 0, -0.04, Math.PI / 2, 0, 0]);
            // Rebite do cabo
            addPart(gunGroup, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }), 'cyl', [0.005, 0.012, 0, 0, -0.09, Math.PI / 2, 0, 0]);
        } else if (key === 'pistol') {
            addPart(gunGroup, bodyMat, 'box', [0.04, 0.06, 0.25]);
            addPart(gunGroup, bodyMat, 'cyl', [0.012, 0.2, 0, 0, -0.22, Math.PI / 2, 0, 0]);
            addPart(gunGroup, gripMat, 'box', [0.035, 0.1, 0.05, 0, -0.08, 0.03, 0.3, 0, 0]);
            addPart(gunGroup, accentMat, 'sphere', [0.007, 0, 0.04, -0.1]);
        } else if (key === 'smg') {
            addPart(gunGroup, bodyMat, 'box', [0.05, 0.06, 0.35]);
            addPart(gunGroup, bodyMat, 'cyl', [0.015, 0.15, 0, 0, -0.28, Math.PI / 2, 0, 0]);
            addPart(gunGroup, bodyMat, 'box', [0.03, 0.12, 0.04, 0, -0.1, 0, 0.2, 0, 0]);
            addPart(gunGroup, accentMat, 'box', [0.055, 0.005, 0.36, 0, 0, 0, 0, 0, 0]);
        } else if (key === 'shotgun') {
            addPart(gunGroup, bodyMat, 'box', [0.05, 0.07, 0.45]);
            addPart(gunGroup, bodyMat, 'cyl', [0.02, 0.35, 0, 0.015, -0.3, Math.PI / 2, 0, 0]);
            addPart(gunGroup, bodyMat, 'cyl', [0.02, 0.35, 0, -0.015, -0.3, Math.PI / 2, 0, 0]);
            addPart(gunGroup, gripMat, 'box', [0.04, 0.14, 0.06, 0, -0.1, 0.05, 0.4, 0, 0]);
        } else if (key === 'sniper') {
            addPart(gunGroup, bodyMat, 'box', [0.04, 0.05, 0.5]);
            addPart(gunGroup, bodyMat, 'cyl', [0.018, 0.45, 0, 0, -0.35, Math.PI / 2, 0, 0]);
            addPart(gunGroup, gripMat, 'box', [0.035, 0.12, 0.05, 0, -0.09, 0.05, 0.3, 0, 0]);
            addPart(gunGroup, accentMat, 'sphere', [0.008, 0, 0.09, -0.15]);
        }

        gunGroup.add(new THREE.PointLight(w.color, 0.3, 1.2).translateZ(-0.2));
        gunGroup.visible = false;
        guns[key] = gunGroup;
        scene.add(gunGroup);
    });
    switchWeapon('pistol');
}

function addPart(parent, mat, type, args) {
    let geo, mesh;
    if (type === 'box') {
        geo = new THREE.BoxGeometry(args[0], args[1], args[2]);
        mesh = new THREE.Mesh(geo, mat);
        if (args[3] !== undefined) mesh.position.set(args[3], args[4], args[5]);
        if (args[6] !== undefined) mesh.rotation.set(args[6], args[7], args[8]);
    } else if (type === 'cyl') {
        geo = new THREE.CylinderGeometry(args[0], args[0], args[1], 8);
        mesh = new THREE.Mesh(geo, mat);
        if (args[2] !== undefined) mesh.position.set(args[2], args[3], args[4]);
        if (args[5] !== undefined) mesh.rotation.set(args[5], args[6], args[7]);
    } else if (type === 'sphere') {
        geo = new THREE.SphereGeometry(args[0], 8, 8);
        mesh = new THREE.Mesh(geo, mat);
        if (args[1] !== undefined) mesh.position.set(args[1], args[2], args[3]);
    }
    parent.add(mesh);
}

function switchWeapon(name) {
    if (!WEAPONS[name]) return;
    Object.values(guns).forEach(g => { g.visible = false; });
    currentWeapon = name;
    currentGun = guns[name];
    isReloading = false;
    updateAmmoDisplay();
    document.querySelectorAll('.weapon-slot').forEach(el => el.classList.toggle('active', el.dataset.weapon === name));

    // Trocar modelo 3D no VR
    if (isVR) {
        // Esconder todos modelos 3D
        if (weaponModel) weaponModel.visible = false;
        if (shotgunModel) shotgunModel.visible = false;
        if (smgModel) smgModel.visible = false;
        if (knifeModel) knifeModel.visible = false;

        // Mostrar modelo correto
        if (name === 'shotgun' && shotgunModel) {
            shotgunModel.visible = true;
        } else if (name === 'smg' && smgModel) {
            smgModel.visible = true;
        } else if (name === 'knife' && knifeModel) {
            knifeModel.visible = true;
        } else if (weaponModel) {
            weaponModel.visible = true;
        }
    }
}

// ==================== AUDIO ====================
let audioInitDone = false;
let menuMusic = null;

function ensureAudio() {
    if (audioInitDone) {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    audioInitDone = true;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startAmbientSounds();
    // Carregar som da pistola
    fetch('assets/audio/arma/pistola/pistola-1.m4a')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => { pistolBuffer = decoded; console.log('Pistol .m4a loaded OK, duration:', decoded.duration.toFixed(2), 's'); })
        .catch(e => console.warn('Pistol .m4a decode failed, using procedural sound:', e.message));
    // Carregar sons da SMG
    fetch('assets/audio/arma/smg/smg tiro continuo.mp3')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => { smgFireBuffer = decoded; console.log('SMG fire loaded OK'); })
        .catch(e => console.warn('SMG fire load failed:', e.message));
    fetch('assets/audio/arma/smg/smg tiro fim.mp3')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => { smgEndBuffer = decoded; console.log('SMG end loaded OK'); })
        .catch(e => console.warn('SMG end load failed:', e.message));
    fetch('assets/audio/arma/smg/smg recarregando.mp3')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => { smgReloadBuffer = decoded; console.log('SMG reload loaded OK'); })
        .catch(e => console.warn('SMG reload load failed:', e.message));
    // Musica do menu
    startMenuMusic();
}

function startMenuMusic() {
    if (menuMusic) return;
    menuMusic = new Audio('assets/audio/gamaplay/menu.mp3');
    menuMusic.loop = true;
    menuMusic.volume = 0.3;
    menuMusic.play().then(() => {
        console.log('Menu music playing');
    }).catch(e => console.warn('Menu music failed:', e.message));
}

function stopMenuMusic() {
    if (menuMusic) {
        menuMusic.pause();
        menuMusic.currentTime = 0;
        menuMusic = null;
        console.log('Menu music stopped');
    }
}

// ==================== GAMEPLAY MUSIC ====================
let gameplayMusic = null;
const gameplayTracks = [
    'assets/audio/gamaplay/Abandoned Echoes.mp3',
    'assets/audio/gamaplay/Abandoned Echoes (1).mp3'
];

function startGameplayMusic() {
    if (gameplayMusic) return;
    const track = gameplayTracks[Math.floor(Math.random() * gameplayTracks.length)];
    gameplayMusic = new Audio(track);
    gameplayMusic.loop = true;
    gameplayMusic.volume = 0.25;
    gameplayMusic.play().then(() => {
        console.log('Gameplay music:', track);
    }).catch(e => console.warn('Gameplay music failed:', e.message));
}

function stopGameplayMusic() {
    if (gameplayMusic) {
        gameplayMusic.pause();
        gameplayMusic.currentTime = 0;
        gameplayMusic = null;
    }
}

function initAudio() {
    const init = () => {
        ensureAudio();
    };
    document.addEventListener('click', init, { once: false });
    document.addEventListener('keydown', init, { once: false });
    document.addEventListener('touchstart', init, { once: false });
}

function startAmbientSounds() {
    if (!audioCtx) return;
    function playWind() {
        if (!audioCtx || audioCtx.state === 'closed') return;
        const bufSize = audioCtx.sampleRate * 3;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02 * (1 + Math.sin(i / audioCtx.sampleRate * 0.5) * 0.5);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.08;
        src.connect(filter).connect(gain).connect(audioCtx.destination);
        src.start();
        src.stop(audioCtx.currentTime + 3);
        setTimeout(playWind, 2500);
    }
    playWind();

    function playBird() {
        if (!audioCtx || audioCtx.state === 'closed') return;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        const f = 2000 + Math.random() * 2000;
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        o.frequency.setValueAtTime(f * 1.2, audioCtx.currentTime + 0.05);
        o.frequency.setValueAtTime(f * 0.8, audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.04, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        o.connect(g).connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + 0.2);
        setTimeout(playBird, 3000 + Math.random() * 8000);
    }
    setTimeout(playBird, 1000);

    function playCricket() {
        if (!audioCtx || audioCtx.state === 'closed') return;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!audioCtx || audioCtx.state === 'closed') return;
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine';
                o.frequency.value = 4000 + Math.random() * 1000;
                g.gain.setValueAtTime(0.015, audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
                o.connect(g).connect(audioCtx.destination);
                o.start(); o.stop(audioCtx.currentTime + 0.03);
            }, i * 50);
        }
        setTimeout(playCricket, 1500 + Math.random() * 4000);
    }
    setTimeout(playCricket, 2000);

    // Sons de monstros aleatorios
    function playMonsterAmbient() {
        if (!audioCtx || audioCtx.state === 'closed') return;
        const sounds = ['zombie', 'werewolf', 'ghost'];
        const sound = sounds[Math.floor(Math.random() * sounds.length)];
        playSound(sound);
        setTimeout(playMonsterAmbient, 8000 + Math.random() * 15000);
    }
    setTimeout(playMonsterAmbient, 5000);
}

function playSound(type) {
    if (!audioCtx) { console.warn('playSound: audioCtx is null'); return; }
    if (audioCtx.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        audioCtx.resume();
    }
    switch (type) {
        case 'pistol':
            if (pistolBuffer) {
                const src = audioCtx.createBufferSource();
                src.buffer = pistolBuffer;
                const g = audioCtx.createGain();
                g.gain.value = 0.5;
                src.connect(g).connect(audioCtx.destination);
                src.start();
            } else {
                playGunshot(800, 0.08, 0.25);
            }
            break;
        case 'smg':
            if (smgFireBuffer) {
                if (smgFireSource) try { smgFireSource.stop(); } catch(e) {}
                smgFireSource = audioCtx.createBufferSource();
                smgFireSource.buffer = smgFireBuffer;
                smgFireSource.loop = true;
                const g = audioCtx.createGain();
                g.gain.value = 0.4;
                smgFireSource.connect(g).connect(audioCtx.destination);
                smgFireSource.start();
            } else {
                playGunshot(1200, 0.05, 0.15);
            }
            break;
        case 'shotgun': playGunshot(300, 0.15, 0.4); break;
        case 'sniper': playGunshot(150, 0.2, 0.5); break;
        case 'hit': playHitSound(); break;
        case 'kill': playKillSound(); break;
        case 'reload': playReloadSound(); break;
        case 'empty': playEmptySound(); break;
        case 'hurt': playHurtSound(); break;
        case 'enemyShoot': playEnemyShootSound(); break;
        case 'zombie': playZombieSound(); break;
        case 'werewolf': playWerewolfSound(); break;
        case 'demon': playDemonSound(); break;
        case 'ghost': playGhostSound(); break;
        case 'footstep': playFootstep(); break;
        case 'combo': playComboSound(); break;
    }
}

function playGunshot(freq, dur, vol) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const bufSize = audioCtx.sampleRate * dur * 0.5;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    const nG = audioCtx.createGain();
    nG.gain.setValueAtTime(vol * 0.4, audioCtx.currentTime);
    nG.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur * 0.5);
    o.connect(g).connect(audioCtx.destination);
    noise.connect(nG).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
    noise.start(); noise.stop(audioCtx.currentTime + dur * 0.5);
    screenShake = 0.03;
}

function playHitSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(800, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.06);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.06);
}

function playKillSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(500, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.2);
}

function playReloadSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, audioCtx.currentTime);
    o.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
    o.frequency.setValueAtTime(400, audioCtx.currentTime + 0.2);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.35);
    setTimeout(() => {
        if (!audioCtx) return;
        const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
        o2.type = 'triangle'; o2.frequency.value = 2000;
        g2.gain.setValueAtTime(0.08, audioCtx.currentTime); g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
        o2.connect(g2).connect(audioCtx.destination); o2.start(); o2.stop(audioCtx.currentTime + 0.02);
    }, 200);
}

function playEmptySound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'triangle'; o.frequency.value = 120;
    g.gain.setValueAtTime(0.08, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.06);
}

function playHurtSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(180, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.15);
    g.gain.setValueAtTime(0.3, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.15);
    damageVignette = 1;
}

function playEnemyShootSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(250, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.1);
}

function playZombieSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(80, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.3);
}

function playWerewolfSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.25);
}

function playDemonSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(100, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.4);
}

function playGhostSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(1200, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.5);
}

function playFootstep() {
    if (!audioCtx) return;
    const bufSize = audioCtx.sampleRate * 0.08;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize) * 0.3;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 800;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.06;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
}

function playComboSound() {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(800 + combo * 100, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200 + combo * 100, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.15);
}

// ==================== FLORESTA ====================
function setupLights() {
    scene.add(new THREE.AmbientLight(0x1a2a1a, 0.4));
    const moon = new THREE.DirectionalLight(0x8899bb, 0.3);
    moon.position.set(-15, 30, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -35;
    moon.shadow.camera.right = 35;
    moon.shadow.camera.top = 35;
    moon.shadow.camera.bottom = -35;
    scene.add(moon);
    scene.add(new THREE.HemisphereLight(0x223322, 0x112211, 0.3));
}

function createForest() {
    const groundGeo = new THREE.PlaneGeometry(120, 120, 30, 30);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) posAttr.setZ(i, Math.random() * 0.2);
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const pathMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9 });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 100), pathMat);
    p1.rotation.x = -Math.PI / 2; p1.position.y = 0.01; scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(100, 3.5), pathMat);
    p2.rotation.x = -Math.PI / 2; p2.position.y = 0.01; scene.add(p2);

    // Carregar texturas de arvore
    const textureLoader = new THREE.TextureLoader();
    const leafTextures = [
        textureLoader.load('assets/cenario/arvore/1f9jtr180dxk-Tree1ByTyroSmith/Tree1/Leaves0120_35_S.png'),
        textureLoader.load('assets/cenario/arvore/1f9jtr180dxk-Tree1ByTyroSmith/Tree1/Leaves0142_4_S.png'),
        textureLoader.load('assets/cenario/arvore/1f9jtr180dxk-Tree1ByTyroSmith/Tree1/Leaves0156_1_S.png'),
    ];
    leafTextures.forEach(t => { t.colorSpace = THREE.SRGBColorSpace; t.transparent = true; t.alphaTest = 0.3; });

    const barkTex = textureLoader.load('assets/cenario/arvore/1f9jtr180dxk-Tree1ByTyroSmith/Tree1/BarkDecidious0143_5_S.jpg');
    barkTex.colorSpace = THREE.SRGBColorSpace;

    // InstancedMesh para troncos (uma draw call para todas as 70 arvores)
    const TRUNK_COUNT = 70;
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.9 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TRUNK_COUNT);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    // InstancedMesh para copas com textura real de folhas
    const FOLIAGE_COUNT = 200;
    const foliageGeo = new THREE.SphereGeometry(1.5, 8, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
        map: leafTextures[0],
        alphaMap: leafTextures[0],
        alphaTest: 0.3,
        transparent: true,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, FOLIAGE_COUNT);
    foliageMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    let foliageIdx = 0;

    for (let i = 0; i < TRUNK_COUNT; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const scale = 0.6 + Math.random() * 0.7;
        const h = (3 + Math.random() * 4) * scale;
        const r = (0.12 + Math.random() * 0.12) * scale;

        // Tronco
        dummy.position.set(x, h / 2, z);
        dummy.scale.set(r * 2, h / 4, r * 2);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Copas (2-3 esferas)
        const numFoliage = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < numFoliage && foliageIdx < FOLIAGE_COUNT; j++) {
            const fR = 1.2 + Math.random() * 1.8;
            dummy.position.set(
                x + (Math.random() - 0.5) * 0.6 * scale,
                h + j * 1.3 * scale + Math.random() * 0.5,
                z + (Math.random() - 0.5) * 0.6 * scale
            );
            dummy.scale.set(fR, fR * 0.8, fR);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.updateMatrix();
            foliageMesh.setMatrixAt(foliageIdx, dummy.matrix);

            // Color variation per foliage cluster
            const c = new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.45, 0.15 + Math.random() * 0.1);
            foliageMesh.setColorAt(foliageIdx, c);
            foliageIdx++;
        }
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    foliageMesh.instanceMatrix.needsUpdate = true;
    if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(foliageMesh);
    trees.push(trunkMesh, foliageMesh);

    for (let i = 0; i < 30; i++) createBush((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 0.3 + Math.random() * 0.6);
    for (let i = 0; i < 20; i++) createRock((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.2 + Math.random() * 0.6);
    for (let i = 0; i < 8; i++) createLog((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70);
    for (let i = 0; i < 6; i++) createCrate((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    createTent(-5, -8); createTent(6, -10);
    createBarrel(-2, -6); createBarrel(3, -7);

    for (let i = 0; i < 10; i++) {
        const fog = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 6, 4, 4), new THREE.MeshBasicMaterial({ color: 0x334433, transparent: true, opacity: 0.04 }));
        fog.position.set((Math.random() - 0.5) * 90, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 90);
        scene.add(fog);
    }
}

function createTree(x, z, scale) {
    if (treeModel1) {
        const clone = treeModel1.clone();
        clone.scale.set(scale, scale, scale);
        clone.position.set(x, 0, z);
        clone.rotation.y = Math.random() * Math.PI * 2;
        trees.push(clone);
        scene.add(clone);
        return;
    }
    // Fallback procedural
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const h = 3 + Math.random() * 4;
    const r = 0.12 + Math.random() * 0.12;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.4, h, 6), new THREE.MeshStandardMaterial({ color: 0x3a2815, roughness: 0.9 }));
    trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        const fR = 1.2 + Math.random() * 1.8;
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(fR, 7, 5), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.45, 0.15 + Math.random() * 0.1), roughness: 0.85 }));
        foliage.position.set((Math.random() - 0.5) * 0.6, h + i * 1.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
        foliage.castShadow = true; g.add(foliage);
    }
    g.scale.set(scale, scale, scale); trees.push(g); scene.add(g);
}

function createBush(x, z, scale) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const r = 0.3 + Math.random() * 0.5;
        const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 5), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.28 + Math.random() * 0.1, 0.45, 0.15 + Math.random() * 0.08), roughness: 0.85 }));
        bush.position.set((Math.random() - 0.5) * 0.6, r * 0.6, (Math.random() - 0.5) * 0.6);
        bush.castShadow = true; g.add(bush);
    }
    g.scale.set(scale, scale, scale); scene.add(g);
}

function createRock(x, z, scale) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 }));
    rock.position.set(x, scale * 0.35, z); rock.scale.set(scale, scale * 0.5, scale);
    rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
}

function createLog(x, z) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2 + Math.random() * 2.5, 6), new THREE.MeshStandardMaterial({ color: 0x4a3518, roughness: 0.9 }));
    log.position.set(x, 0.18, z); log.rotation.z = Math.PI / 2; log.rotation.y = Math.random() * Math.PI; log.castShadow = true; scene.add(log);
}

function createCrate(x, z) {
    const s = 0.7 + Math.random() * 0.4;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: 0x7a6a40, roughness: 0.85 }));
    crate.position.set(x, s / 2, z); crate.rotation.y = Math.random() * Math.PI; crate.castShadow = true; crate.receiveShadow = true; scene.add(crate);
}

function createTent(x, z) {
    const g = new THREE.Group();
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x556644, roughness: 0.8, side: THREE.DoubleSide });
    const shape = new THREE.Shape();
    shape.moveTo(-1.2, 0); shape.lineTo(0, 1.5); shape.lineTo(1.2, 0); shape.lineTo(-1.2, 0);
    const frontGeo = new THREE.ShapeGeometry(shape);
    const front = new THREE.Mesh(frontGeo, tentMat); front.position.set(0, 0, 1); g.add(front);
    const back = new THREE.Mesh(frontGeo, tentMat); back.position.set(0, 0, -1); back.rotation.y = Math.PI; g.add(back);
    const sideGeo = new THREE.PlaneGeometry(2, 2.1);
    const left = new THREE.Mesh(sideGeo, tentMat); left.position.set(-1, 0.75, 0); left.rotation.y = Math.PI / 2; left.scale.set(1, 1, 0.7); g.add(left);
    const right = new THREE.Mesh(sideGeo, tentMat); right.position.set(1, 0.75, 0); right.rotation.y = -Math.PI / 2; right.scale.set(1, 1, 0.7); g.add(right);
    g.position.set(x, 0, z); g.rotation.y = Math.random() * Math.PI * 2; g.castShadow = true; scene.add(g);
}

function createBarrel(x, z) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7, metalness: 0.2 }));
    barrel.position.set(x, 0.4, z); barrel.castShadow = true; scene.add(barrel);
}

function createCampfires() {
    const positions = [[0, 0], [-8, 5], [10, -6], [-5, -12], [7, 8]];
    positions.forEach(([x, z]) => {
        const g = new THREE.Group(); g.position.set(x, 0, z);
        for (let i = 0; i < 5; i++) {
            const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6 + Math.random() * 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.9 }));
            stick.position.set((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3); stick.rotation.z = Math.random() * 0.5; stick.rotation.x = Math.random() * 0.5; g.add(stick);
        }
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }));
            stone.position.set(Math.cos(angle) * 0.4, 0.08, Math.sin(angle) * 0.4); stone.rotation.set(Math.random(), Math.random(), Math.random()); g.add(stone);
        }
        const fireLight = new THREE.PointLight(0xff6622, 2, 12);
        fireLight.position.y = 0.5; fireLight.castShadow = true; fireLight.shadow.mapSize.set(512, 512); g.add(fireLight);

        const fireGeo = new THREE.BufferGeometry();
        const fireCount = 20;
        const firePos = new Float32Array(fireCount * 3);
        const fireColors = new Float32Array(fireCount * 3);
        for (let i = 0; i < fireCount; i++) {
            firePos[i * 3] = (Math.random() - 0.5) * 0.3;
            firePos[i * 3 + 1] = Math.random() * 0.5;
            firePos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
            const c = new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.5 + Math.random() * 0.3);
            fireColors[i * 3] = c.r; fireColors[i * 3 + 1] = c.g; fireColors[i * 3 + 2] = c.b;
        }
        fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
        fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));
        const firePoints = new THREE.Points(fireGeo, new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.9 }));
        g.add(firePoints);

        campfires.push({ group: g, light: fireLight, particles: firePoints, time: Math.random() * 100 });
        scene.add(g);
    });
}

function createAmbientParticles() {
    const count = 200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = Math.random() * 5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x88aa77, size: 0.04, transparent: true, opacity: 0.4 }));
    points.userData.velocities = [];
    for (let i = 0; i < count; i++) points.userData.velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.002, (Math.random() - 0.5) * 0.001, (Math.random() - 0.5) * 0.002));
    ambientParticles.push(points); scene.add(points);
}

function createFireflies() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = 0.5 + Math.random() * 3;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        colors[i * 3] = 0.5 + Math.random() * 0.5;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.8 }));
    points.userData.phase = [];
    for (let i = 0; i < count; i++) points.userData.phase.push(Math.random() * Math.PI * 2);
    fireflies.push(points); scene.add(points);
}

function createFloatingLeaves() {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = 1 + Math.random() * 5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
        const c = new THREE.Color().setHSL(0.25 + Math.random() * 0.15, 0.5, 0.2 + Math.random() * 0.15);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.6 }));
    points.userData.fallSpeed = []; points.userData.swayPhase = [];
    for (let i = 0; i < count; i++) { points.userData.fallSpeed.push(0.003 + Math.random() * 0.005); points.userData.swayPhase.push(Math.random() * Math.PI * 2); }
    floatingLeaves.push(points); scene.add(points);
}

// ==================== CONTROLLERS VR ====================
function setupControllers() {
    // Controller 0 = ESQUERDO (movimento)
    controller1 = renderer.xr.getController(0);
    scene.add(controller1);

    // Controller 1 = DIREITO (arma/tiro)
    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('squeezestart', () => reload());
    scene.add(controller2);

    const factory = new XRControllerModelFactory();

    // Grip models (os controllers físicos)
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(factory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(factory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    // Laser pointers
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15 });
    controller1.add(new THREE.Line(lineGeo.clone(), lineMat));
    controller2.add(new THREE.Line(lineGeo.clone(), lineMat.clone()));
}

// Poll gamepad diretamente do XR session
let _lastVRWeaponBtn = false;
let vrTriggerHeld = false;
let vrTriggerReleased = true;

function pollXRGamepad() {
    const session = xrSession || renderer.xr.getSession();
    if (!session) return;
    try {
        const sources = session.inputSources;
        for (let i = 0; i < sources.length; i++) {
            const src = sources[i];
            if (!src.gamepad) continue;
            // Thumbstick esquerdo para movimento
            if (src.handedness === 'left' && src.gamepad.axes.length >= 2) {
                vrMoveAxes = [src.gamepad.axes[0] || 0, src.gamepad.axes[1] || 0];
            }
            // Botao A/X (indice 3) no controller esquerdo para trocar arma
            if (src.handedness === 'left' && src.gamepad.buttons.length > 3) {
                const btnPressed = src.gamepad.buttons[3].pressed;
                if (btnPressed && !_lastVRWeaponBtn) {
                    const keys = Object.keys(WEAPONS);
                    const idx = keys.indexOf(currentWeapon);
                    switchWeapon(keys[(idx + 1) % keys.length]);
                }
                _lastVRWeaponBtn = btnPressed;
            }
            // Trigger direito para tiro continuo (auto-fire)
            if (src.handedness === 'right' && src.gamepad.buttons.length > 0) {
                const triggerPressed = src.gamepad.buttons[0].pressed;
                if (triggerPressed) {
                    vrTriggerHeld = true;
                    vrTriggerReleased = false;
                } else {
                    vrTriggerHeld = false;
                    vrTriggerReleased = true;
                }
            }
        }
    } catch (e) {}
}

// ==================== VR ====================
let xrSession = null;

function setupVR() {
    console.log('setupVR called');
    const btn = document.getElementById('blocker-btn');
    const vrInfo = document.getElementById('vr-info');
    const noVrInfo = document.getElementById('no-vr-info');
    const subtitle = document.getElementById('blocker-subtitle');

    // SEMPRE mostra o botão
    if (btn) {
        btn.style.display = 'block';
        btn.style.visibility = 'visible';
    }
    if (subtitle) subtitle.textContent = '';

    if ('xr' in navigator) {
        if (vrInfo) vrInfo.style.display = 'block';
        if (noVrInfo) noVrInfo.style.display = 'none';
        if (btn) {
            btn.textContent = 'ENTRAR EM VR';
            btn.classList.add('vr-btn');
        }
        if (subtitle) {
            subtitle.textContent = 'Clique para entrar em VR';
            subtitle.style.color = '#44cc44';
        }
    } else {
        if (vrInfo) vrInfo.style.display = 'none';
        if (noVrInfo) noVrInfo.style.display = 'block';
        if (btn) btn.textContent = 'JOGAR';
        if (subtitle) subtitle.textContent = 'Modo desktop';
    }
    console.log('setupVR complete');
}

function onClickBlocker() {
    console.log('onClickBlocker called');
    ensureAudio();
    stopMenuMusic();
    startGameplayMusic();
    if ('xr' in navigator) {
        startVRSession();
    } else {
        startDesktopMode();
    }
}

function startVRSession() {
    const btn = document.getElementById('blocker-btn');
    const subtitle = document.getElementById('blocker-subtitle');

    if (!('xr' in navigator)) {
        subtitle.innerHTML = '<span style="color:#ff4444">WebXR nao disponivel</span><br><small>Use HTTPS no Quest Browser</small>';
        return;
    }

    btn.textContent = 'CONECTANDO...';
    btn.classList.add('loading');
    subtitle.textContent = 'Aceite "Allow VR" no Quest...';

    navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    }).then(session => {
        ensureAudio();
        xrSession = session;
        isVR = true;
        renderer.xr.setSession(session);
        document.getElementById('blocker').style.display = 'none';
        btn.textContent = 'CONECTADO!';
        btn.classList.remove('loading');
        subtitle.textContent = '';
        // Reset cameraRig e camera para origem em VR
        cameraRig.position.set(0, 0, 0);
        camera.position.set(0, 0, 0);

        // Otimizacoes VR para performance
        renderer.shadowMap.enabled = false;
        scene.fog.density = 0.015;

        // Esconder modelo default dos grips
        if (controllerGrip1) {
            controllerGrip1.children.forEach(c => c.visible = false);
        }
        if (controllerGrip2) {
            controllerGrip2.children.forEach(c => c.visible = false);
        }
        // Esconder laser pointers
        if (controller1) controller1.children.forEach(c => { if (c.isLine) c.visible = false; });
        if (controller2) controller2.children.forEach(c => { if (c.isLine) c.visible = false; });

        session.addEventListener('end', () => {
            xrSession = null;
            document.getElementById('blocker').style.display = 'flex';
            btn.textContent = 'ENTRAR EM VR';
            btn.classList.remove('loading');
            subtitle.textContent = 'Sessao encerrada.';
        });

        playSound('ambient');
        console.log('VR Session started!');
    }).catch(err => {
        console.error('VR session error:', err);
        btn.textContent = 'ERRO - CLIQUE NOVAMENTE';
        btn.classList.remove('loading');
        if (err.name === 'NotAllowedError') {
            subtitle.innerHTML = '<span style="color:#ff6644">Permissao negada</span><br><small>Acesse via HTTPS</small>';
        } else {
            subtitle.innerHTML = '<span style="color:#ff6644">Erro: ' + err.message + '</span>';
        }
        setTimeout(() => { btn.textContent = 'ENTRAR EM VR'; subtitle.textContent = 'Clique para tentar novamente'; }, 3000);
    });
}

function startDesktopMode() {
    ensureAudio();
    document.getElementById('blocker').style.display = 'none';
    renderer.domElement.requestPointerLock();
    playSound('ambient');
}

// ==================== INPUT ====================
function setupKeyboard() {
    document.addEventListener('keydown', e => {
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space': shoot(); break;
            case 'KeyR': reload(); break;
            case 'Digit0': switchWeapon('knife'); break;
        case 'Digit1': switchWeapon('pistol'); break;
            case 'Digit2': switchWeapon('smg'); break;
            case 'Digit3': switchWeapon('shotgun'); break;
            case 'Digit4': switchWeapon('sniper'); break;
        }
    });
    document.addEventListener('keyup', e => {
        switch (e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
        }
    });
    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement === renderer.domElement) {
            cameraRig.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        }
    });
    document.addEventListener('wheel', e => {
        const keys = Object.keys(WEAPONS);
        const idx = keys.indexOf(currentWeapon);
        if (e.deltaY > 0) switchWeapon(keys[(idx + 1) % keys.length]);
        else switchWeapon(keys[(idx - 1 + keys.length) % keys.length]);
    });
    renderer.domElement.addEventListener('click', () => {
        if (!isVR && document.getElementById('blocker').style.display === 'none') {
            renderer.domElement.requestPointerLock();
        }
    });
}

// ==================== KILL FEED ====================
function addKillFeed(text, color) {
    const feed = document.getElementById('kill-feed');
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `<span class="kill-icon" style="color:${color}">X</span> ${text}`;
    feed.appendChild(entry);
    setTimeout(() => { entry.style.opacity = '0'; setTimeout(() => entry.remove(), 500); }, 3000);
    if (feed.children.length > 5) feed.firstChild.remove();
}

// ==================== TIRO ====================
function shoot() {
    const now = performance.now();
    const w = WEAPONS[currentWeapon];
    if (isReloading) return;
    if (weaponAmmo[currentWeapon] <= 0) { playSound('empty'); return; }
    if (now - lastFireTime < w.fireRate) return;
    lastFireTime = now;
    if (!w.melee) weaponAmmo[currentWeapon]--;
    updateAmmoDisplay();
    playSound(currentWeapon);

    // Vibracao do controller direito (recoil haptico)
    if (isVR && controller2) {
        try {
            const session = renderer.xr.getSession();
            if (session) {
                const sources = session.inputSources;
                for (let i = 0; i < sources.length; i++) {
                    const src = sources[i];
                    if (src.handedness === 'right' && src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators.length > 0) {
                        const intensity = w.melee ? 0.6 : 0.4;
                        const duration = w.melee ? 150 : 80;
                        src.gamepad.hapticActuators[0].pulse(intensity, duration);
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    // ANIMAÇÃO DA FACA - swing na VR
    if (w.melee && isVR && weaponModel) {
        const origRot = weaponModel.rotation.x;
        weaponModel.rotation.x -= 0.5;
        setTimeout(() => { if (weaponModel) weaponModel.rotation.x = origRot; }, 100);
    }

    // ATAQUE CORPO A CORPO (faca)
    if (w.melee) {
        const tempMatrix = new THREE.Matrix4();
        let origin, direction;
        if (isVR && controller2) {
            tempMatrix.identity().extractRotation(controller2.matrixWorld);
            origin = new THREE.Vector3().setFromMatrixPosition(controller2.matrixWorld);
            direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
        } else {
            tempMatrix.identity().extractRotation(camera.matrixWorld);
            origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
            direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
        }

        // Raio de ataque corpo a corpo (2m)
        raycaster.ray.origin.copy(origin);
        raycaster.ray.direction.copy(direction);
        raycaster.far = w.range;

        const intersects = raycaster.intersectObjects(enemies, true);
        raycaster.far = Infinity;
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj.parent && !obj.userData.type) obj = obj.parent;
            if (obj.userData.type) hitEnemy(obj, w.damage);
        }

        // Efeito visual do swing
        const slashEffect = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.5, 8, 1, 0, Math.PI * 0.6),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        slashEffect.position.copy(origin).add(direction.clone().multiplyScalar(0.5));
        slashEffect.lookAt(origin);
        scene.add(slashEffect);
        setTimeout(() => scene.remove(slashEffect), 100);

        return;
    }

    // TIRO COM BALA (armas de fogo)
    for (let i = 0; i < w.bulletsPerShot; i++) {
        const tempMatrix = new THREE.Matrix4();
        if (isVR && controller2) {
            tempMatrix.identity().extractRotation(controller2.matrixWorld);
            raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
            raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
            const barrelOffset = new THREE.Vector3(-0.03, 0, -0.12);
            barrelOffset.applyMatrix4(tempMatrix);
            raycaster.ray.origin.add(barrelOffset);
        } else {
            tempMatrix.identity().extractRotation(camera.matrixWorld);
            raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);
            raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        }
        raycaster.ray.direction.x += (Math.random() - 0.5) * w.spread;
        raycaster.ray.direction.y += (Math.random() - 0.5) * w.spread;
        raycaster.ray.direction.normalize();

        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), new THREE.MeshBasicMaterial({ color: w.color }));
        bullet.position.copy(raycaster.ray.origin);
        bullet.userData = { velocity: raycaster.ray.direction.clone().multiplyScalar(4), life: 60, damage: w.damage };
        bullets.push(bullet);
        scene.add(bullet);

        const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.9 }));
        const flashOffset = new THREE.Vector3(-0.03, 0.04, 0).applyMatrix4(tempMatrix);
        flash.position.copy(raycaster.ray.origin).add(raycaster.ray.direction.clone().multiplyScalar(0.2)).add(flashOffset);
        scene.add(flash);
        const fLight = new THREE.PointLight(0xffffaa, 2, 5);
        fLight.position.copy(flash.position);
        scene.add(fLight);
        setTimeout(() => { scene.remove(flash); scene.remove(fLight); }, 25);
    }

    const intersects = raycaster.intersectObjects(enemies, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !obj.userData.type) obj = obj.parent;
        if (obj.userData.type) hitEnemy(obj, w.damage);
    }
}

function hitEnemy(enemy, damage) {
    if (!enemy.userData.alive) return;
    enemy.userData.health -= damage;
    enemy.userData.stagger = 1;
    playSound('hit');
    enemy.children.forEach(child => {
        if (child.material && child.material.emissive) {
            const orig = child.material.emissive.clone();
            child.material.emissive.setHex(0xffffff);
            setTimeout(() => { if (child.material) child.material.emissive.copy(orig); }, 50);
        }
    });
    spawnParticles(enemy.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xaa0000, 8);
    if (enemy.userData.health <= 0) {
        enemy.userData.alive = false;
        playSound('kill');
        playSound(enemy.userData.type); // Sound for monster type
        const now = performance.now();
        if (now - lastKillTime < 3000) combo++; else combo = 1;
        lastKillTime = now;
        kills++;
        const pts = { boss: 500, heavy: 200, sniper_e: 150, scout: 75, soldier: 100, zombie: 120, werewolf: 180, demon: 350, ghost: 100 };
        const earned = (pts[enemy.userData.type] || 100) * combo;
        score += earned;
        document.getElementById('score').textContent = score;
        document.getElementById('combo').textContent = combo > 1 ? `x${combo}` : '';
        document.getElementById('combo').style.opacity = combo > 1 ? '1' : '0';
        document.getElementById('kills').textContent = kills;
        const names = { soldier: 'Soldado', scout: 'Batedor', heavy: 'Pesado', sniper_e: 'Francotirador', boss: 'Chefe', zombie: 'Zumbi', werewolf: 'Lobisomem', demon: 'Demo', ghost: 'Fantasma' };
        addKillFeed(`${names[enemy.userData.type] || enemy.userData.type} +${earned}`, '#' + enemy.userData.color.toString(16).padStart(6, '0'));
        spawnParticles(enemy.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff2200, 25);
        scene.remove(enemy);
    }
}

function enemyShoot(enemy) {
    const now = performance.now();
    if (now - enemy.userData.lastShot < enemy.userData.shootRate) return;
    enemy.userData.lastShot = now;
    const playerPos = camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
    dir.x += (Math.random() - 0.5) * 0.12;
    dir.y += (Math.random() - 0.5) * 0.08;
    dir.normalize();
    
    // Demon: projeteis de fogo maiores e mais lentos
    const isDemon = enemy.userData.type === 'demon';
    const bulletColor = isDemon ? 0xff6600 : 0xff3333;
    const bulletSize = isDemon ? 0.08 : 0.04;
    const bulletSpeed = isDemon ? 0.2 : 0.35;
    const bulletDamage = isDemon ? enemy.userData.damage * 1.5 : enemy.userData.damage;
    
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(bulletSize, 6, 6), new THREE.MeshBasicMaterial({ color: bulletColor }));
    const muzzlePos = enemy.position.clone();
    muzzlePos.y += 1.2 * enemy.userData.scale;
    muzzlePos.add(dir.clone().multiplyScalar(0.5));
    bullet.position.copy(muzzlePos);
    bullet.userData = { velocity: dir.multiplyScalar(bulletSpeed), life: 120, damage: bulletDamage, demon: isDemon };
    enemyBullets.push(bullet);
    scene.add(bullet);
    playSound('enemyShoot');
    const flash = new THREE.PointLight(isDemon ? 0xff6600 : 0xff4444, isDemon ? 2.0 : 1.5, isDemon ? 6 : 4);
    flash.position.copy(muzzlePos);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), isDemon ? 50 : 30);
}

function spawnParticles(pos, color, count) {
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 4, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
        p.position.copy(pos);
        p.userData = { velocity: new THREE.Vector3((Math.random() - 0.5) * 0.15, Math.random() * 0.15, (Math.random() - 0.5) * 0.15), life: 20 + Math.random() * 20 };
        particles.push(p); scene.add(p);
    }
}

function reload() {
    if (isReloading || weaponAmmo[currentWeapon] === WEAPONS[currentWeapon].maxAmmo) return;
    isReloading = true;
    // Parar som de tiro SMG antes de recarregar
    if (smgFireSource) {
        try { smgFireSource.stop(); } catch(e) {}
        smgFireSource = null;
    }
    // Tocar som de recarga da SMG ou som generico
    if (currentWeapon === 'smg' && smgReloadBuffer && audioCtx) {
        const src = audioCtx.createBufferSource();
        src.buffer = smgReloadBuffer;
        const g = audioCtx.createGain();
        g.gain.value = 0.4;
        src.connect(g).connect(audioCtx.destination);
        src.start();
    } else {
        playSound('reload');
    }
    const bar = document.getElementById('reload-bar-fill');
    bar.style.width = '0%';
    document.getElementById('reload-bar').style.display = 'block';
    let progress = 0;
    const interval = setInterval(() => {
        progress += 100 / (WEAPONS[currentWeapon].reloadTime / 50);
        bar.style.width = `${Math.min(100, progress)}%`;
        if (progress >= 100) {
            clearInterval(interval);
            weaponAmmo[currentWeapon] = WEAPONS[currentWeapon].maxAmmo;
            isReloading = false;
            document.getElementById('reload-bar').style.display = 'none';
            updateAmmoDisplay();
        }
    }, 50);
}

function updateAmmoDisplay() {
    const w = WEAPONS[currentWeapon];
    if (w.melee) {
        document.getElementById('ammo').textContent = `∞`;
    } else {
        document.getElementById('ammo').textContent = `${weaponAmmo[currentWeapon]} / ${w.maxAmmo}`;
    }
    document.getElementById('weapon-name').textContent = w.name;
    document.getElementById('enemy-total').textContent = enemies.filter(e => e.userData.alive).length;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateDamageVignette() {
    if (damageVignette > 0) {
        damageVignette -= 0.03;
        document.getElementById('damage-overlay').style.opacity = Math.max(0, damageVignette);
    }
}

// ==================== INIMIGOS ====================
function createAllEnemies() {
    const types = [
        { name: 'soldier', color: 0x6B3A1F, skin: 0xDEB887, health: 100, speed: 0.02, damage: 8, count: 4, shootRate: 2000, scale: 1 },
        { name: 'scout', color: 0x2E5A1C, skin: 0xD2B48C, health: 60, speed: 0.05, damage: 5, count: 3, shootRate: 1500, scale: 0.9 },
        { name: 'heavy', color: 0x333333, skin: 0xC8A882, health: 250, speed: 0.01, damage: 15, count: 2, shootRate: 3000, scale: 1.3 },
        { name: 'sniper_e', color: 0x3a3a2a, skin: 0xD2B48C, health: 80, speed: 0.015, damage: 20, count: 2, shootRate: 2500, scale: 1 },
        { name: 'boss', color: 0x5a1a1a, skin: 0xBFA07A, health: 600, speed: 0.012, damage: 25, count: 1, shootRate: 1800, scale: 1.5 },
        // MONSTROS
        { name: 'zombie', color: 0x2a3a1a, skin: 0x556B2F, health: 120, speed: 0.015, damage: 12, count: 5, shootRate: 0, scale: 1.1, monster: true },
        { name: 'werewolf', color: 0x3a2a1a, skin: 0x8B7355, health: 150, speed: 0.045, damage: 18, count: 3, shootRate: 0, scale: 1.2, monster: true },
        { name: 'demon', color: 0x4a0a0a, skin: 0x8B0000, health: 300, speed: 0.02, damage: 22, count: 2, shootRate: 2000, scale: 1.4, monster: true },
        { name: 'ghost', color: 0x1a1a3a, skin: 0x8888cc, health: 80, speed: 0.03, damage: 10, count: 4, shootRate: 1500, scale: 1.0, monster: true, flying: true }
    ];
    types.forEach(type => {
        for (let i = 0; i < type.count; i++) {
            const enemy = type.monster ? createMonsterEnemy(type) : createHumanoidEnemy(type);
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 20;
            enemy.position.set(Math.cos(angle) * radius, type.flying ? 1.5 : 0, Math.sin(angle) * radius);
            enemies.push(enemy); scene.add(enemy);
        }
    });
}

function createHumanoidEnemy(type) {
    const g = new THREE.Group(); g.name = type.name;
    const skinMat = new THREE.MeshStandardMaterial({ color: type.skin, roughness: 0.7 });
    const clothMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupil = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const s = type.scale;

    [-0.12, 0.12].forEach((x, idx) => {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.06 * s, 0.45 * s, 6), clothMat);
        thigh.position.set(x * s, 0.65 * s, 0); thigh.name = idx === 0 ? 'leftThigh' : 'rightThigh'; g.add(thigh);
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.05 * s, 0.4 * s, 6), skinMat);
        calf.position.set(x * s, 0.22 * s, 0); calf.name = idx === 0 ? 'leftCalf' : 'rightCalf'; g.add(calf);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.14 * s), darkMat);
        boot.position.set(x * s, 0.05 * s, -0.02 * s); g.add(boot);
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.5 * s, 0.2 * s), clothMat);
    torso.position.y = 1.05 * s; g.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.05 * s, 0.21 * s), darkMat);
    belt.position.y = 0.82 * s; g.add(belt);

    [-0.24, 0.24].forEach((x, idx) => {
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.04 * s, 0.35 * s, 6), clothMat);
        upper.position.set(x * s, 1.15 * s, 0); upper.name = idx === 0 ? 'leftUpperArm' : 'rightUpperArm'; g.add(upper);
        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.3 * s, 6), skinMat);
        forearm.position.set(x * s, 0.82 * s, 0); forearm.name = idx === 0 ? 'leftForearm' : 'rightForearm'; g.add(forearm);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 6), skinMat);
        hand.position.set(x * s, 0.65 * s, 0); g.add(hand);
    });

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.04 * s, 0.3 * s), darkMat);
    gunBody.position.set(0.24 * s, 0.85 * s, -0.12 * s); g.add(gunBody);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.2 * s, 6), darkMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.24 * s, 0.86 * s, -0.32 * s); g.add(gunBarrel);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 8), skinMat);
    head.position.y = 1.45 * s; g.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.08 * s, 6), skinMat);
    neck.position.y = 1.3 * s; g.add(neck);

    [-0.04, 0.04].forEach(x => {
        g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 6, 6), eyeWhite), { position: new THREE.Vector3(x * s, 1.47 * s, -0.1 * s) }));
        g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 6, 6), eyePupil), { position: new THREE.Vector3(x * s, 1.47 * s, -0.115 * s) }));
    });
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.008 * s, 0.01 * s), eyePupil), { position: new THREE.Vector3(0, 1.4 * s, -0.115 * s) }));
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.8 });
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.125 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat), { position: new THREE.Vector3(0, 1.48 * s, 0) }));

    g.userData = { type: type.name, health: type.health, maxHealth: type.health, speed: type.speed, damage: type.damage, shootRate: type.shootRate, lastShot: 0, alive: true, scale: type.scale, color: type.color, walkPhase: Math.random() * Math.PI * 2, stagger: 0 };
    return g;
}

function createMonsterEnemy(type) {
    const g = new THREE.Group(); g.name = type.name;
    const s = type.scale;
    const skinMat = new THREE.MeshStandardMaterial({ color: type.skin, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.7 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: type.name === 'demon' ? 0xff0000 : type.name === 'ghost' ? 0x00ffff : 0xffff00 });
    const eyePupil = new THREE.MeshBasicMaterial({ color: 0x000000 });

    if (type.name === 'zombie') {
        // Corpo torto e decadente
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.6 * s, 0.25 * s), darkMat);
        torso.position.y = 1.0 * s; torso.rotation.z = 0.1; g.add(torso);
        // Cabeca torta
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 8, 6), skinMat);
        head.position.set(0.05 * s, 1.5 * s, 0); head.rotation.z = -0.2; g.add(head);
        // Olhos brilhantes
        [-0.04, 0.04].forEach(x => {
            g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 6, 6), eyeMat), { position: new THREE.Vector3(x * s + 0.05 * s, 1.52 * s, -0.12 * s) }));
            g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 6, 6), eyePupil), { position: new THREE.Vector3(x * s + 0.05 * s, 1.52 * s, -0.135 * s) }));
        });
        // Bracos estendidos (zombie)
        [-0.28, 0.28].forEach((x, idx) => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.5 * s, 6), skinMat);
            arm.position.set(x * s, 0.9 * s, -0.15 * s); arm.rotation.x = -0.8; g.add(arm);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 6, 6), skinMat);
            hand.position.set(x * s, 0.6 * s, -0.35 * s); g.add(hand);
        });
        // Pernas mancando
        [-0.12, 0.12].forEach((x, idx) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.05 * s, 0.5 * s, 6), darkMat);
            leg.position.set(x * s, 0.25 * s, 0); g.add(leg);
        });
    } else if (type.name === 'werewolf') {
        // Corpo quadrupedal inclinado
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.3 * s, 0.6 * s), darkMat);
        torso.position.set(0, 0.8 * s, 0); torso.rotation.x = 0.3; g.add(torso);
        // Pernas traseiras
        [-0.15, 0.15].forEach(x => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.5 * s, 6), darkMat);
            leg.position.set(x * s, 0.3 * s, 0.15 * s); g.add(leg);
            const paw = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.04 * s, 0.1 * s), darkMat);
            paw.position.set(x * s, 0.05 * s, 0.15 * s); g.add(paw);
        });
        // Pernas dianteiras
        [-0.15, 0.15].forEach(x => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.45 * s, 6), darkMat);
            leg.position.set(x * s, 0.35 * s, -0.2 * s); g.add(leg);
            const claw = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.03 * s, 0.08 * s), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            claw.position.set(x * s, 0.05 * s, -0.25 * s); g.add(claw);
        });
        // Cabeca de lobo
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.18 * s, 0.25 * s), darkMat);
        head.position.set(0, 1.0 * s, -0.4 * s); g.add(head);
        // Focinho
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.15 * s), skinMat);
        snout.position.set(0, 0.95 * s, -0.55 * s); g.add(snout);
        // Olhos vermelhos
        [-0.05, 0.05].forEach(x => {
            g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), eyeMat), { position: new THREE.Vector3(x * s, 1.05 * s, -0.5 * s) }));
        });
        // Presas
        const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffcc });
        [-0.025, 0.025].forEach(x => {
            const fang = new THREE.Mesh(new THREE.ConeGeometry(0.008 * s, 0.06 * s, 4), fangMat);
            fang.position.set(x * s, 0.88 * s, -0.58 * s); g.add(fang);
        });
        // Cauda
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.015 * s, 0.3 * s, 6), darkMat);
        tail.position.set(0, 1.0 * s, 0.45 * s); tail.rotation.x = -0.5; g.add(tail);
    } else if (type.name === 'demon') {
        // Corpo grande e imponente
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.7 * s, 0.3 * s), darkMat);
        torso.position.y = 1.1 * s; g.add(torso);
        // Cabeca com chifres
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 8), skinMat);
        head.position.y = 1.7 * s; g.add(head);
        // Chifres grandes
        const hornMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.3 });
        [-0.12, 0.12].forEach(x => {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.2 * s, 6), hornMat);
            horn.position.set(x * s, 1.9 * s, 0); horn.rotation.z = x > 0 ? -0.3 : 0.3; g.add(horn);
        });
        // Olhos vermelhos brilhantes
        [-0.05, 0.05].forEach(x => {
            g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 6), eyeMat), { position: new THREE.Vector3(x * s, 1.73 * s, -0.14 * s) }));
        });
        // Bracos grossos com garras
        [-0.32, 0.32].forEach(x => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.5 * s, 6), skinMat);
            arm.position.set(x * s, 1.0 * s, 0); g.add(arm);
            const clawMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
            for (let c = 0; c < 3; c++) {
                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.015 * s, 0.1 * s, 4), clawMat);
                claw.position.set(x * s + (c - 1) * 0.03 * s, 0.7 * s, -0.05 * s); claw.rotation.x = 0.5; g.add(claw);
            }
        });
        // Pernas
        [-0.15, 0.15].forEach(x => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.06 * s, 0.5 * s, 6), darkMat);
            leg.position.set(x * s, 0.25 * s, 0); g.add(leg);
        });
        // Cauda de demonio
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.01 * s, 0.5 * s, 6), skinMat);
        tail.position.set(0, 0.8 * s, 0.4 * s); tail.rotation.x = -0.8; g.add(tail);
        // Fogo nos olhos (luz vermelha)
        const demonLight = new THREE.PointLight(0xff0000, 0.5, 3);
        demonLight.position.set(0, 1.7 * s, -0.2 * s); g.add(demonLight);
    } else if (type.name === 'ghost') {
        // Corpo etereo e transparente
        const ghostMat = new THREE.MeshStandardMaterial({ color: type.skin, transparent: true, opacity: 0.5, roughness: 0.3 });
        // Corpo principal (cone invertido)
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.25 * s, 0.8 * s, 8, 1, true), ghostMat);
        body.position.y = 1.0 * s; body.rotation.x = Math.PI; g.add(body);
        // Cabeca
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 8, 8), ghostMat);
        head.position.y = 1.5 * s; g.add(head);
        // Olhos vazios brilhantes
        [-0.05, 0.05].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            eye.position.set(x * s, 1.52 * s, -0.13 * s); g.add(eye);
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 6, 6), eyeMat);
            glow.position.set(x * s, 1.52 * s, -0.14 * s); g.add(glow);
        });
        // Bracos etereos
        [-0.2, 0.2].forEach(x => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.02 * s, 0.4 * s, 6), ghostMat);
            arm.position.set(x * s, 0.9 * s, -0.1 * s); arm.rotation.x = -0.5; g.add(arm);
        });
        // Aura fantasma
        const ghostLight = new THREE.PointLight(0x4444ff, 0.4, 4);
        ghostLight.position.y = 1.2 * s; g.add(ghostLight);
    }

    g.userData = { type: type.name, health: type.health, maxHealth: type.health, speed: type.speed, damage: type.damage, shootRate: type.shootRate, lastShot: 0, alive: true, scale: type.scale, color: type.color, walkPhase: Math.random() * Math.PI * 2, stagger: 0, monster: true, flying: type.flying || false };
    return g;
}

// ==================== ANIMATE ====================
function animate() {
    try {
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    // Poll gamepad do Quest 2 (thumbstick esquerdo)
    if (isVR) pollXRGamepad();

    // Auto-fire: se gatilho VR segurado, dispara continuamente (fire rate controlado dentro de shoot)
    if (isVR && vrTriggerHeld) {
        shoot();
    }

    // Parar som de tiro SMG quando soltar gatilho ou acabar balas
    if (isVR && !vrTriggerHeld && smgFireSource) {
        try { smgFireSource.stop(); } catch(e) {}
        smgFireSource = null;
        if (smgEndBuffer && audioCtx) {
            const src = audioCtx.createBufferSource();
            src.buffer = smgEndBuffer;
            const g = audioCtx.createGain();
            g.gain.value = 0.3;
            src.connect(g).connect(audioCtx.destination);
            src.start();
        }
    }
    // Parar som se acabou municao
    if (isVR && smgFireSource && weaponAmmo[currentWeapon] <= 0) {
        try { smgFireSource.stop(); } catch(e) {}
        smgFireSource = null;
        if (smgEndBuffer && audioCtx) {
            const src = audioCtx.createBufferSource();
            src.buffer = smgEndBuffer;
            const g = audioCtx.createGain();
            g.gain.value = 0.3;
            src.connect(g).connect(audioCtx.destination);
            src.start();
        }
    }

    isWalking = moveForward || moveBackward || moveLeft || moveRight;

    // Desktop movement
    if (!isVR) {
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        if (moveForward || moveBackward) velocity.z -= direction.z * 50 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 50 * delta;
        const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
        cameraRig.position.addScaledVector(fwd, -velocity.z * delta);
        cameraRig.position.addScaledVector(right, -velocity.x * delta);

        if (isWalking) {
            headBobTime += delta * 8;
            camera.position.y = 1.7 + Math.sin(headBobTime) * 0.04;
        } else {
            camera.position.y += (1.7 - camera.position.y) * 0.1;
        }

        if (isWalking) {
            footstepTimer += delta;
            if (footstepTimer > 0.35) { footstepTimer = 0; playSound('footstep'); }
        } else { footstepTimer = 0.3; }

        if (screenShake > 0) {
            camera.position.x += (Math.random() - 0.5) * screenShake;
            camera.position.y += (Math.random() - 0.5) * screenShake;
            screenShake *= 0.85;
            if (screenShake < 0.001) screenShake = 0;
        }
        updateDamageVignette();
    }

    // VR: movimento pelo thumbstick esquerdo (processado no animate)
    if (isVR) {
        const deadzone = 0.15;
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1); // fallback: para frente
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));

        const moveSpeed = 3.5;
        const moved = Math.abs(vrMoveAxes[0]) > deadzone || Math.abs(vrMoveAxes[1]) > deadzone;
        if (moved) {
            if (Math.abs(vrMoveAxes[1]) > deadzone) {
                cameraRig.position.addScaledVector(fwd, -vrMoveAxes[1] * moveSpeed * delta);
            }
            if (Math.abs(vrMoveAxes[0]) > deadzone) {
                cameraRig.position.addScaledVector(right, vrMoveAxes[0] * moveSpeed * delta);
            }
            isWalking = true;
        } else {
            isWalking = false;
        }

        if (isWalking) {
            footstepTimer += delta;
            if (footstepTimer > 0.35) { footstepTimer = 0; playSound('footstep'); }
        } else { footstepTimer = 0.3; }
    }

    // ARMA NO CONTROLLER DIREITO (VR)
    if (isVR) {
        // Esconder fallback guns em VR
        Object.values(guns).forEach(g => { g.visible = false; });
        // Esconder todos modelos 3D
        if (weaponModel) weaponModel.visible = false;
        if (shotgunModel) shotgunModel.visible = false;
        if (smgModel) smgModel.visible = false;
        if (knifeModel) knifeModel.visible = false;
        // Mostrar modelo correto baseado na arma selecionada
        if (currentWeapon === 'shotgun' && shotgunModel) {
            shotgunModel.visible = true;
        } else if (currentWeapon === 'smg' && smgModel) {
            smgModel.visible = true;
        } else if (currentWeapon === 'knife' && knifeModel) {
            knifeModel.visible = true;
        } else if (weaponModel) {
            weaponModel.visible = true;
        }
        // Esconder laser pointers
        if (controller1) controller1.children.forEach(c => { if (c.isLine) c.visible = false; });
        if (controller2) controller2.children.forEach(c => { if (c.isLine) c.visible = false; });
    } else if (!isVR && currentGun) {
        // Desktop: arma na frente
        currentGun.visible = true;
        const camWorld = new THREE.Matrix4().copy(camera.matrixWorld);
        currentGun.quaternion.setFromRotationMatrix(camWorld);
        currentGun.position.setFromMatrixPosition(camWorld);
        currentGun.translateZ(-0.45);
        currentGun.translateY(-0.25);
        currentGun.translateX(0.18 + weaponSwayX);
        currentGun.position.y += weaponSwayY;

        if (isWalking) {
            headBobTime += delta * 8;
            weaponSwayX = Math.sin(headBobTime * 0.5) * 0.003;
            weaponSwayY = Math.abs(Math.sin(headBobTime)) * 0.002;
        } else {
            weaponSwayX *= 0.9;
            weaponSwayY *= 0.9;
        }
    }

    // Bullets
    bullets = bullets.filter(b => {
        b.position.add(b.userData.velocity);
        b.userData.life--;
        b.scale.multiplyScalar(0.96);
        if (b.userData.life <= 0) { scene.remove(b); return false; }
        raycaster.set(b.position, b.userData.velocity.clone().normalize());
        const hits = raycaster.intersectObjects(enemies, true);
        if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj.parent && !obj.userData.type) obj = obj.parent;
            if (obj.userData.type) hitEnemy(obj, b.userData.damage);
            scene.remove(b); return false;
        }
        return true;
    });

    enemyBullets = enemyBullets.filter(b => {
        b.position.add(b.userData.velocity);
        b.userData.life--;
        b.scale.multiplyScalar(0.98);
        if (b.userData.life <= 0) { scene.remove(b); return false; }
        const playerPos = camera.getWorldPosition(new THREE.Vector3());
        if (b.position.distanceTo(playerPos) < 0.5) {
            health -= b.userData.damage;
            playSound('hurt');
            document.getElementById('health-fill').style.width = `${Math.max(0, health)}%`;
            document.getElementById('health-text').textContent = Math.max(0, Math.round(health));
            spawnParticles(b.position.clone(), 0xff0000, 5);
            scene.remove(b);
            if (health <= 0) {
                health = 100; score = Math.max(0, score - 200); combo = 0;
                document.getElementById('health-fill').style.width = '100%';
                document.getElementById('health-text').textContent = '100';
                document.getElementById('score').textContent = score;
                cameraRig.position.set(0, 0, isVR ? 0 : 5);
                respawnEnemies();
            }
            return false;
        }
        return true;
    });

    particles = particles.filter(p => {
        p.position.add(p.userData.velocity);
        p.userData.velocity.y -= 0.004;
        p.userData.life--;
        p.material.opacity = Math.max(0, p.userData.life / 30);
        p.scale.multiplyScalar(0.93);
        if (p.userData.life <= 0) { scene.remove(p); return false; }
        return true;
    });

    ambientParticles.forEach(pts => {
        const pos = pts.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.array[i * 3] += pts.userData.velocities[i].x;
            pos.array[i * 3 + 1] += pts.userData.velocities[i].y;
            pos.array[i * 3 + 2] += pts.userData.velocities[i].z;
            if (Math.abs(pos.array[i * 3]) > 40) pts.userData.velocities[i].x *= -1;
            if (pos.array[i * 3 + 1] > 5 || pos.array[i * 3 + 1] < 0) pts.userData.velocities[i].y *= -1;
            if (Math.abs(pos.array[i * 3 + 2]) > 40) pts.userData.velocities[i].z *= -1;
        }
        pos.needsUpdate = true;
    });

    fireflies.forEach(pts => {
        const pos = pts.geometry.attributes.position;
        pts.material.opacity = 0.3 + Math.sin(time * 0.003) * 0.3;
        for (let i = 0; i < pos.count; i++) {
            const phase = pts.userData.phase[i];
            pos.array[i * 3] += Math.sin(time * 0.001 + phase) * 0.003;
            pos.array[i * 3 + 1] += Math.cos(time * 0.002 + phase) * 0.002;
            pos.array[i * 3 + 2] += Math.sin(time * 0.0015 + phase * 2) * 0.003;
        }
        pos.needsUpdate = true;
    });

    floatingLeaves.forEach(pts => {
        const pos = pts.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.array[i * 3 + 1] -= pts.userData.fallSpeed[i];
            pos.array[i * 3] += Math.sin(time * 0.001 + pts.userData.swayPhase[i]) * 0.005;
            pos.array[i * 3 + 2] += Math.cos(time * 0.0008 + pts.userData.swayPhase[i]) * 0.003;
            if (pos.array[i * 3 + 1] < 0) {
                pos.array[i * 3 + 1] = 4 + Math.random() * 2;
                pos.array[i * 3] = (Math.random() - 0.5) * 80;
                pos.array[i * 3 + 2] = (Math.random() - 0.5) * 80;
            }
        }
        pos.needsUpdate = true;
    });

    campfires.forEach(cf => {
        cf.time += delta;
        cf.light.intensity = 1.5 + Math.sin(cf.time * 10) * 0.3 + Math.sin(cf.time * 7.3) * 0.2;
        cf.light.color.setHSL(0.06 + Math.sin(cf.time * 5) * 0.02, 1, 0.5);
        const fPos = cf.particles.geometry.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
            fPos.array[i * 3 + 1] += 0.01;
            fPos.array[i * 3] += (Math.random() - 0.5) * 0.01;
            if (fPos.array[i * 3 + 1] > 0.6) {
                fPos.array[i * 3 + 1] = 0;
                fPos.array[i * 3] = (Math.random() - 0.5) * 0.3;
                fPos.array[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
            }
        }
        fPos.needsUpdate = true;
    });

    // Inimigos
    const aliveEnemies = enemies.filter(e => e.userData.alive);
    document.getElementById('enemy-total').textContent = aliveEnemies.length;

    aliveEnemies.forEach(enemy => {
        const playerPos = camera.getWorldPosition(new THREE.Vector3());
        const dist = enemy.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
        const s = enemy.userData.scale;
        const t = enemy.userData.type;

        if (dist < 35) enemyShoot(enemy);

        if (enemy.userData.stagger > 0) {
            enemy.position.add(dir.clone().multiplyScalar(-enemy.userData.stagger * 0.3));
            enemy.userData.stagger *= 0.9;
        }

        if (t === 'scout') {
            const perp = new THREE.Vector3(-dir.z, 0, dir.x);
            enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
            enemy.position.add(perp.multiplyScalar(Math.sin(time * 0.004) * 0.04));
        } else if (t === 'heavy') {
            if (dist > 5) enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        } else if (t === 'sniper_e') {
            if (dist < 12) enemy.position.add(dir.clone().multiplyScalar(-enemy.userData.speed * 0.5));
            else if (dist > 20) enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        } else if (t === 'boss') {
            if (dist > 4) enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        } else if (t === 'zombie') {
            // Zombie: lento, constante, sempre avanca
            enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        } else if (t === 'werewolf') {
            // Werewolf: rapido, corre em circulos, salta para atacar
            const perp = new THREE.Vector3(-dir.z, 0, dir.x);
            if (dist > 3) {
                enemy.position.add(dir.multiplyScalar(enemy.userData.speed * 1.2));
                enemy.position.add(perp.multiplyScalar(Math.sin(time * 0.006) * 0.08));
            } else {
                // Salto de ataque
                enemy.position.add(dir.multiplyScalar(enemy.userData.speed * 2));
                enemy.position.y = Math.abs(Math.sin(time * 0.01)) * 0.5;
            }
        } else if (t === 'demon') {
            // Demon: medio, lança projeteis de fogo
            if (dist > 6) enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        } else if (t === 'ghost') {
            // Ghost: flutua,move-se erraticamente, atravesa paredes
            const hover = Math.sin(time * 0.003) * 0.3;
            enemy.position.y = 1.5 + hover;
            const erratic = new THREE.Vector3(Math.sin(time * 0.005) * 0.05, 0, Math.cos(time * 0.007) * 0.05);
            enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
            enemy.position.add(erratic);
        } else {
            enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
        }

        enemy.position.y = enemy.userData.flying ? enemy.position.y : 0;
        const lookTarget = playerPos.clone(); lookTarget.y = 1.2 * s; enemy.lookAt(lookTarget);

        enemy.userData.walkPhase += delta * (t === 'scout' ? 12 : t === 'heavy' ? 5 : 8);
        const walkAngle = Math.sin(enemy.userData.walkPhase) * 0.4;
        const leftThigh = enemy.children.find(c => c.name === 'leftThigh');
        const rightThigh = enemy.children.find(c => c.name === 'rightThigh');
        const leftCalf = enemy.children.find(c => c.name === 'leftCalf');
        const rightCalf = enemy.children.find(c => c.name === 'rightCalf');
        if (leftThigh) leftThigh.rotation.x = walkAngle;
        if (rightThigh) rightThigh.rotation.x = -walkAngle;
        if (leftCalf) leftCalf.rotation.x = Math.max(0, -walkAngle * 0.5);
        if (rightCalf) rightCalf.rotation.x = Math.max(0, walkAngle * 0.5);

        const armAngle = dist < 25 ? -0.8 + Math.sin(time * 0.003) * 0.05 : 0;
        const leftUpper = enemy.children.find(c => c.name === 'leftUpperArm');
        const rightUpper = enemy.children.find(c => c.name === 'rightUpperArm');
        if (leftUpper) leftUpper.rotation.x = armAngle;
        if (rightUpper) rightUpper.rotation.x = armAngle;

        if (dist < 1.8 * s) {
            health -= enemy.userData.damage * 0.02;
            document.getElementById('health-fill').style.width = `${Math.max(0, health)}%`;
            document.getElementById('health-text').textContent = Math.max(0, Math.round(health));
            if (health <= 0) {
                health = 100; score = Math.max(0, score - 200); combo = 0;
                document.getElementById('health-fill').style.width = '100%';
                document.getElementById('health-text').textContent = '100';
                document.getElementById('score').textContent = score;
                cameraRig.position.set(0, 0, isVR ? 0 : 5);
                respawnEnemies();
            }
        }
    });

    prevTime = time;
    renderer.render(scene, camera);
    } catch (e) { console.error('Animate error:', e); }
}

function respawnEnemies() {
    enemies.forEach(e => {
        if (!e.userData.alive) {
            e.userData.alive = true;
            e.userData.health = e.userData.maxHealth;
            scene.add(e);
            const a = Math.random() * Math.PI * 2;
            const r = 15 + Math.random() * 20;
            e.position.set(Math.cos(a) * r, e.userData.flying ? 1.5 : 0, Math.sin(a) * r);
        }
    });
}
