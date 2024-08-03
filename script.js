import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { GUI } from "lil-gui";

// Constants for action states
const ACTION_SELECT = 1,
  ACTION_NONE = 0;
const curveHandles = []; // Array to store curve handles
const mouse = new THREE.Vector2(); // Vector to store mouse coordinates

let stats; // Variable to store stats
let scene,
  camera,
  renderer,
  rayCaster,
  control,
  action = ACTION_NONE,
  cube,
  curve;
let t = 0;
let initialPoints;
let line;

init();
animate();

function init() {
  // Create a new scene
  scene = new THREE.Scene();

  // Create a new perspective camera
  camera = new THREE.PerspectiveCamera(
    40, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    1, // Near clipping plane
    1000 // Far clipping plane
  );
  camera.position.set(2, 2, 4); // Set camera position
  camera.lookAt(scene.position); // Make the camera look at the center of the scene

  // Define initial points for the curve
  initialPoints = [
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
  ];

  // Create geometry and material for the curve handles
  const boxGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const boxMaterial = new THREE.MeshBasicMaterial();

  // Create and add curve handles to the scene
  for (const handlePos of initialPoints) {
    const handle = new THREE.Mesh(boxGeometry, boxMaterial);
    handle.position.copy(handlePos);
    curveHandles.push(handle);
    scene.add(handle);
  }

  // Create a CatmullRomCurve3 with the initial points
  curve = new THREE.CatmullRomCurve3(
    curveHandles.map((handle) => handle.position)
  );
  curve.curveType = "chordal"; // Set curve type to "chordal"
  curve.closed = true; // Close the curve

  // Get points from the curve and create a line
  const points = curve.getPoints(5000);
  line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x00ff00 })
  );

  scene.add(line);

  // Create the cube that will move along the curve
  const cubeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube);

  // Add directional light to the scene
  const light = new THREE.DirectionalLight(0xffaa33);
  light.position.set(-10, 10, 10);
  light.intensity = 1.0;
  scene.add(light);

  // Add ambient light to the scene
  const light2 = new THREE.AmbientLight(0x003973);
  light2.intensity = 1.0;
  scene.add(light2);

  // Create a WebGL renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio); // Set pixel ratio
  renderer.setSize(window.innerWidth, window.innerHeight); // Set renderer size
  document.body.appendChild(renderer.domElement); // Add renderer to the DOM

  // Create orbit controls for the camera
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  // Add event listener for pointer down
  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  // Create a raycaster
  rayCaster = new THREE.Raycaster();

  // Create transform controls for manipulating objects
  control = new TransformControls(camera, renderer.domElement);

  // Add event listener for dragging changes
  control.addEventListener("dragging-changed", function (event) {
    if (!event.value) {
      const points = curve.getPoints(50);
      line.geometry.setFromPoints(points);
    }
  });

  // Create and add stats to the DOM
  stats = new Stats();
  document.body.appendChild(stats.dom);

  // Add event listener for window resize
  window.addEventListener("resize", onWindowResize, false);

  // Create a GUI for adding points to the curve
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

  // Add GUI controls for curve parameters
  gui.add(curveParams, "x", -10, 10).step(0.001);
  gui.add(curveParams, "y", -10, 10).step(0.001);
  gui.add(curveParams, "z", -10, 10).step(0.001);
  gui.add(curveParams, "addPoint").name("Add Point");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight; // Update aspect ratio
  camera.updateProjectionMatrix(); // Update projection matrix

  renderer.setSize(window.innerWidth, window.innerHeight); // Update renderer size
}

function onPointerDown(event) {
  action = ACTION_SELECT; // Set action to select
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1; // Calculate mouse x position
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; // Calculate mouse y position
}

function updateCurve() {
  // Update the curve with the current handles
  curve.points = curveHandles.map((handle) => handle.position);
  const points = curve.getPoints(50);
  line.geometry.setFromPoints(points);
}

function animate() {
  requestAnimationFrame(animate);
  if (action === ACTION_SELECT) {
    rayCaster.setFromCamera(mouse, camera); // Set raycaster from camera and mouse
    action = ACTION_NONE; // Reset action
    const intersects = rayCaster.intersectObjects(curveHandles); // Find intersected objects
    if (intersects.length) {
      const target = intersects[0].object; // Get the intersected object
      control.attach(target); // Attach transform controls to the object
      scene.add(control); // Add transform controls to the scene
    }
  }

  // Animate the cube along the curve
  t += 0.005; // Speed of the animation
  if (t > 1) t = 0; // Loop the animation

  const point = curve.getPointAt(t); // Get the point on the curve at time t
  const tangent = curve.getTangentAt(t); // Get the tangent on the curve at time t
  cube.position.copy(point); // Set cube position to the point on the curve
  cube.lookAt(point.clone().add(tangent)); // Make the cube look in the direction of the tangent

  render(); // Render the scene
}

function render() {
  renderer.render(scene, camera); // Render the scene from the perspective of the camera
  stats.update(); // Update stats
}
