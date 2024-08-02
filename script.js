import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Flow } from "three/examples/jsm/modifiers/CurveModifier.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { GUI } from "lil-gui";

const ACTION_SELECT = 1,
  ACTION_NONE = 0;
const curveHandles = [];
const mouse = new THREE.Vector2();

let stats;
let scene,
  camera,
  renderer,
  rayCaster,
  control,
  flow,
  action = ACTION_NONE,
  cube, // Declare the cube
  curve; // Declare the curve
let t = 0;
let initialPoints;
let line;

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.set(2, 2, 4);
  camera.lookAt(scene.position);

  initialPoints = [
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    // { x: -1, y: 0, z: 1 },
    // { x: -1, y: 0, z: -1 },
  ];

  const boxGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const boxMaterial = new THREE.MeshBasicMaterial();

  for (const handlePos of initialPoints) {
    const handle = new THREE.Mesh(boxGeometry, boxMaterial);
    handle.position.copy(handlePos);
    curveHandles.push(handle);
    scene.add(handle);
  }

  curve = new THREE.CatmullRomCurve3(
    curveHandles.map((handle) => handle.position)
  );
  curve.curveType = "chordal";
  curve.closed = true;

  const points = curve.getPoints(5000);
  line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x00ff00 })
  );

  scene.add(line);

  // Create the colored cube
  const cubeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube);

  const light = new THREE.DirectionalLight(0xffaa33);
  light.position.set(-10, 10, 10);
  light.intensity = 1.0;
  scene.add(light);

  const light2 = new THREE.AmbientLight(0x003973);
  light2.intensity = 1.0;
  scene.add(light2);

  const loader = new FontLoader();

  loader.load("fonts/helvetiker_regular.typeface.json", function (font) {
    const geometry = new THREE.TubeGeometry("Hello three.js!", {
      font: font,
      size: 100.2,
      height: 0.05,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 500,
    });

    geometry.rotateX(Math.PI);

    const material = new THREE.MeshStandardMaterial({
      color: 0x99ffff,
    });

    const objectToCurve = new THREE.Mesh(geometry, material);
    console.log(objectToCurve);
    flow = new Flow(objectToCurve);
    flow.updateCurve(0, curve);
    scene.add(flow.object3D);
  });

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();
  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  rayCaster = new THREE.Raycaster();
  control = new TransformControls(camera, renderer.domElement);

  control.addEventListener("dragging-changed", function (event) {
    if (!event.value) {
      const points = curve.getPoints(50);
      line.geometry.setFromPoints(points);
      flow.updateCurve(0, curve);
      // control.setMode("rotate");
    }
  });

  stats = new Stats();
  document.body.appendChild(stats.dom);
  window.addEventListener("resize", onWindowResize, false);

  //GUI
  const gui = new GUI();
  const curveParams = {
    x: 0,
    y: 0,
    z: 0,
    addPoint: () => {
      const newPoint = new THREE.Vector3(
        curveParams.x,
        curveParams.y,
        curveParams.z
      );
      const handle = new THREE.Mesh(boxGeometry, boxMaterial);
      handle.position.copy(newPoint);
      curveHandles.push(handle);
      scene.add(handle);
      updateCurve();
    },
  };

  gui.add(curveParams, "x", -10, 10).step(0.001);
  gui.add(curveParams, "y", -10, 10).step(0.001);
  gui.add(curveParams, "z", -10, 10).step(0.001);
  gui.add(curveParams, "addPoint").name("Add Point");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event) {
  action = ACTION_SELECT;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
function updateCurve() {
  // Update the curve with the current handles
  curve.points = curveHandles.map((handle) => handle.position);
  const points = curve.getPoints(50);
  line.geometry.setFromPoints(points);
}
// Parameter for moving along the curve

function animate() {
  requestAnimationFrame(animate);

  if (action === ACTION_SELECT) {
    rayCaster.setFromCamera(mouse, camera);
    action = ACTION_NONE;
    const intersects = rayCaster.intersectObjects(curveHandles);
    if (intersects.length) {
      const target = intersects[0].object;
      control.attach(target);
      scene.add(control);
    }
  }

  if (flow) {
    flow.moveAlongCurve(0.001);
  }

  // Animate the cube along the curve
  t += 0.005; // Speed of the animation
  if (t > 1) t = 0; // Loop the animation

  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t);
  cube.position.copy(point);
  cube.lookAt(point.clone().add(tangent));

  render();
}

function render() {
  renderer.render(scene, camera);
  stats.update();
}
