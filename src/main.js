// Dolymod: a point-and-click ball-and-stick model kit.
// The model is plain data (atoms with a position and orientation, bonds
// between numbered holes); every change rebuilds the 3D scene from it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ELEMENTS, KINDS, KIND } from './kit.js';
import { toSmiles, lookUp } from './naming.js';

const $ = id => document.getElementById(id);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

// ---- Scene ------------------------------------------------------------------

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(0, 0, 9);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(3, 4, 2);
sun.target.position.set(0, 0, -10);
camera.add(sun, sun.target);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

new ResizeObserver(() => {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(canvas);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// ---- Model ------------------------------------------------------------------

let model = { atoms: [], bonds: [], nextId: 1 };
const undoStack = [];

function change(fn) {
  const before = JSON.stringify(model);
  fn();
  if (JSON.stringify(model) === before) return false;
  undoStack.push(before);
  rebuild();
  return true;
}

function undo() {
  if (!undoStack.length) return;
  model = JSON.parse(undoStack.pop());
  linkFrom = null;
  rebuild();
}

const atomById = id => model.atoms.find(a => a.id === id);
const kindOf = atom => KIND[atom.kind];
const radiusOf = kindId => ELEMENTS[KIND[kindId].el].radius;
const posOf = atom => new THREE.Vector3().fromArray(atom.p);
const quatOf = atom => new THREE.Quaternion().fromArray(atom.q);
const holeDir = (atom, i) => kindOf(atom).holes[i].clone().applyQuaternion(quatOf(atom));
const bondsOf = id => model.bonds.filter(b => b.a === id || b.b === id);
const bonded = (x, y) => model.bonds.some(b => (b.a === x && b.b === y) || (b.a === y && b.b === x));

function freeHoles(atom) {
  const used = new Set(bondsOf(atom.id).map(b => (b.a === atom.id ? b.ha : b.hb)));
  return kindOf(atom).holes.map((_, i) => i).filter(i => !used.has(i));
}

function nearestHole(atom, holes, towards) {
  let best = null;
  let bestDot = -Infinity;
  for (const i of holes) {
    const d = holeDir(atom, i).dot(towards);
    if (d > bestDot) [best, bestDot] = [i, d];
  }
  return best;
}

function addAtom(kindId, p, q) {
  const atom = { id: model.nextId++, kind: kindId, p: p.toArray(), q: q.toArray() };
  model.atoms.push(atom);
  return atom;
}

function addBond(a, ha, b, hb) {
  model.bonds.push({ id: model.nextId++, a: a.id, ha, b: b.id, hb, order: 1 });
}

// Removing an atom also removes anything that only hung off it (its hydrogens).
function deleteAtom(id) {
  const loose = bondsOf(id).map(b => (b.a === id ? b.b : b.a)).filter(n => bondsOf(n).length === 1);
  const doomed = new Set([id, ...loose]);
  model.atoms = model.atoms.filter(a => !doomed.has(a.id));
  model.bonds = model.bonds.filter(b => !doomed.has(b.a) && !doomed.has(b.b));
}

// ---- Geometry rules ---------------------------------------------------------

// Centre-to-centre distance: both ball radii plus the visible length of link.
function bondLength(kindA, kindB) {
  const short = KIND[kindA].el === 'H' || KIND[kindB].el === 'H';
  return radiusOf(kindA) + radiusOf(kindB) + (short ? 0.34 : 0.56);
}

function overlaps(p, kindId) {
  return model.atoms.some(a => posOf(a).distanceTo(p) < 0.9 * (radiusOf(a.kind) + radiusOf(kindId)));
}

// Angles of `dirs` around `axis`, ignoring any that run along the axis.
function anglesAround(dirs, axis) {
  const e1 = new THREE.Vector3().crossVectors(axis, Math.abs(axis.x) < 0.9 ? X : Y).normalize();
  const e2 = new THREE.Vector3().crossVectors(axis, e1);
  return dirs
    .filter(d => d.clone().addScaledVector(axis, -d.dot(axis)).length() > 0.1)
    .map(d => Math.atan2(d.dot(e2), d.dot(e1)));
}

const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// How far to spin a new atom about its bond. Planar atoms line up with their
// neighbour's plane; anything else is turned as far from staggered clashes as
// it will go, which gives the staggered conformation for tetrahedral carbons.
function twistAngle(parent, hole, kind, q1, axis) {
  const parentDirs = kindOf(parent).holes
    .filter((_, i) => i !== hole)
    .map(d => d.clone().applyQuaternion(quatOf(parent)));
  const alphas = anglesAround(parentDirs, axis);
  const betas = anglesAround(kind.holes.slice(1).map(d => d.clone().applyQuaternion(q1)), axis);
  if (!alphas.length || !betas.length) return 0;
  if (kindOf(parent).planar || kind.planar) return alphas[0] - betas[0];
  let best = 0;
  let bestGap = -1;
  for (let deg = 0; deg < 360; deg++) {
    const t = THREE.MathUtils.degToRad(deg);
    const gap = Math.min(...alphas.flatMap(a => betas.map(b => angleGap(a, b + t))));
    if (gap > bestGap + 1e-9) [best, bestGap] = [t, gap];
  }
  return best;
}

// Where a new atom of `kindId` sits when pushed into `hole` of `parent`.
function placement(parent, hole, kindId) {
  const kind = KIND[kindId];
  const axis = holeDir(parent, hole);
  const p = posOf(parent).addScaledVector(axis, bondLength(parent.kind, kindId));
  const q1 = new THREE.Quaternion().setFromUnitVectors(kind.holes[0], axis.clone().negate());
  const q = new THREE.Quaternion()
    .setFromAxisAngle(axis, twistAngle(parent, hole, kind, q1, axis))
    .multiply(q1);
  return { p, q, blocked: overlaps(p, kindId) };
}

// Close a ring when one of the new atom's free holes lines up with a free hole
// on another atom at about the right distance, as the real kit would let you.
function closeRings(atom) {
  for (const h of freeHoles(atom)) {
    const dir = holeDir(atom, h);
    for (const other of model.atoms) {
      if (other === atom || bonded(atom.id, other.id)) continue;
      const toOther = posOf(other).sub(posOf(atom));
      const length = bondLength(atom.kind, other.kind);
      if (Math.abs(toOther.length() - length) > 0.2 * length) continue;
      toOther.normalize();
      if (dir.dot(toOther) < 0.9) continue;
      const back = freeHoles(other).find(i => holeDir(other, i).dot(toOther) < -0.9);
      if (back !== undefined) {
        addBond(atom, h, other, back);
        break;
      }
    }
  }
}

// Join two atoms. Joining them again adds a link, as with the real kit:
// a second makes a double bond, a third a triple.
function link(a, b) {
  const existing = model.bonds.find(bd => (bd.a === a.id && bd.b === b.id) || (bd.a === b.id && bd.b === a.id));
  if (existing) {
    if (existing.order === 3) return flash('That is already a triple bond');
    return change(() => { existing.order += 1; });
  }
  const toB = posOf(b).sub(posOf(a)).normalize();
  const ha = nearestHole(a, freeHoles(a), toB);
  const hb = nearestHole(b, freeHoles(b), toB.clone().negate());
  if (ha === null || hb === null) return flash('Both atoms need a free hole');
  change(() => addBond(a, ha, b, hb));
}

// How many more bonds an atom wants to reach its usual valence. A double bond
// takes one hole here, so a double-bonded 4-hole carbon keeps a spare hole.
function bondsWanted(atom) {
  const sum = bondsOf(atom.id).reduce((n, b) => n + b.order, 0);
  const valence = ELEMENTS[kindOf(atom).el].valence;
  return (valence.find(v => v >= sum) ?? sum) - sum;
}

// Holes still waiting for an atom: free holes, up to what valence wants.
const openHoles = atom => Math.min(freeHoles(atom).length, bondsWanted(atom));

function fillHydrogens() {
  const filled = change(() => {
    for (const atom of [...model.atoms]) {
      if (kindOf(atom).el === 'H') continue;
      let wanted = bondsWanted(atom);
      for (const h of freeHoles(atom)) {
        if (wanted <= 0) break;
        const spot = placement(atom, h, 'H');
        if (spot.blocked) continue;
        addBond(atom, h, addAtom('H', spot.p, spot.q), 0);
        wanted--;
      }
    }
  });
  if (!filled) flash('No open holes to fill');
}

// ---- Rendering --------------------------------------------------------------

const root = new THREE.Group();
const ghost = new THREE.Group();
scene.add(root, ghost);

const SPHERE = new THREE.SphereGeometry(1, 48, 32);
const HOLE_HOVER = new THREE.MeshBasicMaterial({ color: 0xffb000, side: THREE.DoubleSide });
const BLUE = 0x2f6bff;
const RED = 0xff3b30;

const makeHalo = () => {
  const halo = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
  halo.visible = false;
  scene.add(halo);
  return halo;
};
const hoverHalo = makeHalo();
const selectHalo = makeHalo();

const view = { holes: new Map(), bonds: new Map() };
let disposables = [];
const own = thing => (disposables.push(thing), thing);

// ---- Drilled balls ----
// Each ball's shader cuts a round opening for every hole, and a short bore
// (a cup turned on a lathe) sits behind it, so you can see into the hole and
// the links look plugged in. Materials and bores are shared per kind of atom.
const holeRadius = r => Math.min(0.11, 0.24 * r);
const ballMaterials = new Map();
const bores = new Map();

function ballMaterial(kind) {
  if (!ballMaterials.has(kind.id)) {
    const el = ELEMENTS[kind.el];
    const dirs = Array.from({ length: 6 }, (_, i) => kind.holes[i]?.clone() ?? new THREE.Vector3());
    const material = new THREE.MeshStandardMaterial({ color: el.color, roughness: 0.3 });
    material.customProgramCacheKey = () => 'drilled';
    material.onBeforeCompile = shader => {
      shader.uniforms.holeDirs = { value: dirs };
      shader.uniforms.holeCount = { value: kind.holes.length };
      shader.uniforms.holeCos = { value: Math.sqrt(1 - (holeRadius(el.radius) / el.radius) ** 2) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSpherePos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpherePos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vSpherePos;
          uniform vec3 holeDirs[6];
          uniform int holeCount;
          uniform float holeCos;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 spherePos = normalize(vSpherePos);
          for (int i = 0; i < 6; i++) {
            if (i >= holeCount) break;
            if (dot(spherePos, holeDirs[i]) > holeCos) discard;
          }`);
    };
    ballMaterials.set(kind.id, material);
  }
  return ballMaterials.get(kind.id);
}

function bore(elId) {
  if (!bores.has(elId)) {
    const r = ELEMENTS[elId].radius;
    const rho = holeRadius(r);
    const depth = 0.42 * r;
    const profile = [new THREE.Vector2(0, -depth), new THREE.Vector2(rho, -depth), new THREE.Vector2(rho, 0.006)];
    bores.set(elId, {
      geometry: new THREE.LatheGeometry(profile, 24),
      material: new THREE.MeshStandardMaterial({
        color: new THREE.Color(ELEMENTS[elId].color).multiplyScalar(0.35),
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
      rim: Math.sqrt(r * r - rho * rho),
    });
  }
  return bores.get(elId);
}

// A link leaves each ball along its hole and bends to meet the other, so
// strained rings and Link-tool joins curve like the kit's flexible links.
// Double and triple bonds are drawn as two or three bowed links.
function linkCurves(pA, dA, rA, pB, dB, rB, order, normal) {
  const p0 = pA.clone().addScaledVector(dA, rA * 0.8);
  const p3 = pB.clone().addScaledVector(dB, rB * 0.8);
  const reach = p0.distanceTo(p3) / 3;
  const p1 = p0.clone().addScaledVector(dA, reach);
  const p2 = p3.clone().addScaledVector(dB, reach);
  if (order === 1) return [new THREE.CubicBezierCurve3(p0, p1, p2, p3)];
  const axis = p3.clone().sub(p0).normalize();
  const side = new THREE.Vector3().crossVectors(axis, normal);
  return Array.from({ length: order }, (_, k) => {
    const t = (2 * Math.PI * k) / order;
    const u = normal.clone().multiplyScalar(Math.cos(t)).addScaledVector(side, Math.sin(t));
    return new THREE.CubicBezierCurve3(
      p0.clone().addScaledVector(u, 0.04),
      p1.clone().addScaledVector(u, 0.2),
      p2.clone().addScaledVector(u, 0.2),
      p3.clone().addScaledVector(u, 0.04),
    );
  });
}

// Multiple bonds bow out of the plane of the atoms' other holes, like pi bonds.
function bondNormal(a, ha, b, hb) {
  const axis = posOf(b).sub(posOf(a)).normalize();
  for (const [atom, skip] of [[a, ha], [b, hb]]) {
    for (const i of kindOf(atom).holes.keys()) {
      if (i === skip) continue;
      const d = holeDir(atom, i);
      const perp = d.addScaledVector(axis, -d.dot(axis));
      if (perp.length() > 0.2) return new THREE.Vector3().crossVectors(axis, perp).normalize();
    }
  }
  return new THREE.Vector3().crossVectors(axis, Math.abs(axis.x) < 0.9 ? X : Y).normalize();
}

function rebuild() {
  clearHover();
  disposables.forEach(d => d.dispose());
  disposables = [];
  root.clear();
  view.holes.clear();
  view.bonds.clear();

  for (const atom of model.atoms) {
    const kind = kindOf(atom);
    const el = ELEMENTS[kind.el];
    const group = new THREE.Group();
    group.position.fromArray(atom.p);
    group.quaternion.fromArray(atom.q);
    const ball = new THREE.Mesh(SPHERE, ballMaterial(kind));
    ball.scale.setScalar(el.radius);
    ball.userData = { type: 'atom', id: atom.id };
    group.add(ball);
    const { geometry, material, rim } = bore(kind.el);
    kind.holes.forEach((dir, i) => {
      const cup = new THREE.Mesh(geometry, material);
      cup.position.copy(dir).multiplyScalar(rim);
      cup.quaternion.setFromUnitVectors(Y, dir);
      cup.raycast = () => {};
      cup.userData.base = material;
      group.add(cup);
      view.holes.set(`${atom.id}:${i}`, cup);
    });
    root.add(group);
  }

  for (const bond of model.bonds) {
    const a = atomById(bond.a);
    const b = atomById(bond.b);
    const short = kindOf(a).el === 'H' || kindOf(b).el === 'H';
    const material = own(new THREE.MeshStandardMaterial({ color: short ? 0xe2e2e2 : 0x9c9c9c, roughness: 0.5 }));
    const curves = linkCurves(
      posOf(a), holeDir(a, bond.ha), radiusOf(a.kind),
      posOf(b), holeDir(b, bond.hb), radiusOf(b.kind),
      bond.order, bondNormal(a, bond.ha, b, bond.hb),
    );
    for (const curve of curves) {
      const tube = own(new THREE.TubeGeometry(curve, 20, bond.order > 1 ? 0.045 : 0.07, 10));
      const mesh = new THREE.Mesh(tube, material);
      mesh.userData = { type: 'bond', id: bond.id };
      root.add(mesh);
    }
    view.bonds.set(bond.id, material);
  }

  if (linkFrom !== null && !atomById(linkFrom)) linkFrom = null;
  showSelection();
  $('undo').disabled = !undoStack.length;
  refreshReadout();
  refreshHint();
  if (lastPointer) hover(lastPointer);
}

let ghostDisposables = [];
function clearGhost() {
  ghostDisposables.forEach(d => d.dispose());
  ghostDisposables = [];
  ghost.clear();
}

function showGhost(parent, hole, kindId, spot) {
  const el = ELEMENTS[KIND[kindId].el];
  const material = new THREE.MeshStandardMaterial({
    color: spot.blocked ? RED : el.color, transparent: true, opacity: 0.45, depthWrite: false,
  });
  const ball = new THREE.Mesh(SPHERE, material);
  ball.position.copy(spot.p);
  ball.scale.setScalar(el.radius);
  const [curve] = linkCurves(
    posOf(parent), holeDir(parent, hole), radiusOf(parent.kind),
    spot.p, KIND[kindId].holes[0].clone().applyQuaternion(spot.q), el.radius, 1,
  );
  const tube = new THREE.TubeGeometry(curve, 12, 0.07, 10);
  ghost.add(ball, new THREE.Mesh(tube, material));
  ghostDisposables.push(material, tube);
}

function placeHalo(halo, atom, color) {
  halo.position.fromArray(atom.p);
  halo.scale.setScalar(radiusOf(atom.kind) * 1.18);
  halo.material.color.setHex(color);
  halo.visible = true;
}

function showSelection() {
  selectHalo.visible = false;
  if (linkFrom !== null) placeHalo(selectHalo, atomById(linkFrom), BLUE);
}

function fitView() {
  if (!model.atoms.length) {
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 9);
    return;
  }
  const box = new THREE.Box3();
  model.atoms.forEach(a => box.expandByPoint(posOf(a)));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const fov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
  const distance = Math.max(sphere.radius + 1, 2) / Math.sin(fov);
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
}

// ---- Interaction ------------------------------------------------------------

let tool = 'add';
let kindId = 'C4';
let linkFrom = null;
let lastPointer = null;
let hoveredHole = null;
let hoveredBond = null;

const raycaster = new THREE.Raycaster();

function ndcOf(e) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

// Matrices normally refresh when a frame renders; refresh them here so a click
// straight after a change (or in a background tab) tests the current scene.
function aim(e) {
  scene.updateMatrixWorld();
  raycaster.setFromCamera(ndcOf(e), camera);
}

function pick(e) {
  aim(e);
  const hit = raycaster.intersectObjects(root.children, true).find(h => h.object.userData.type);
  return hit ? { ...hit.object.userData, point: hit.point } : null;
}

// Point under the pointer on the plane facing the camera through `through`.
function pointOnViewPlane(e, through = controls.target) {
  aim(e);
  const normal = camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, through);
  return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
}

const holeUnder = (atom, point) => nearestHole(atom, freeHoles(atom), point.clone().sub(posOf(atom)).normalize());

function clearHover() {
  hoverHalo.visible = false;
  if (hoveredHole) hoveredHole.material = hoveredHole.userData.base;
  if (hoveredBond) hoveredBond.emissive.setHex(0);
  hoveredHole = hoveredBond = null;
  clearGhost();
  canvas.style.cursor = '';
}

function glowBond(id, color) {
  hoveredBond = view.bonds.get(id);
  hoveredBond.emissive.setHex(color);
}

function hover(e) {
  lastPointer = e;
  clearHover();
  const hit = pick(e);
  if (!hit) return;
  const atom = hit.type === 'atom' ? atomById(hit.id) : null;
  if (tool === 'add' && atom) {
    const hole = holeUnder(atom, hit.point);
    if (hole === null) return;
    hoveredHole = view.holes.get(`${atom.id}:${hole}`);
    hoveredHole.material = HOLE_HOVER;
    showGhost(atom, hole, kindId, placement(atom, hole, kindId));
  } else if (tool === 'link' && atom) {
    placeHalo(hoverHalo, atom, BLUE);
  } else if (tool === 'order' && hit.type === 'bond') {
    glowBond(hit.id, 0x2a4a99);
  } else if (tool === 'delete') {
    if (atom) placeHalo(hoverHalo, atom, RED);
    else glowBond(hit.id, 0x991a14);
  } else {
    canvas.style.cursor = 'grab';
    return;
  }
  canvas.style.cursor = 'pointer';
}

// Put the selected atom where the pointer is: into the nearest free hole of
// the atom under it, or (when `anywhere`, or the table is empty) loose.
function attachAt(e, anywhere) {
  const hit = pick(e);
  const atom = hit?.type === 'atom' ? atomById(hit.id) : null;
  if (atom) {
    const hole = holeUnder(atom, hit.point);
    if (hole === null) return flash(`That ${ELEMENTS[kindOf(atom).el].name.toLowerCase()} has no free holes`);
    const spot = placement(atom, hole, kindId);
    if (spot.blocked) return flash('No room there: another atom is in the way');
    change(() => {
      const added = addAtom(kindId, spot.p, spot.q);
      addBond(atom, hole, added, 0);
      closeRings(added);
    });
  } else if (!hit && (anywhere || !model.atoms.length || e.shiftKey)) {
    const p = pointOnViewPlane(e);
    if (!p || overlaps(p, kindId)) return flash('No room there: another atom is in the way');
    change(() => addAtom(kindId, p, new THREE.Quaternion()));
  } else if (!hit) {
    flash('Click an atom to attach to it, or Shift-click empty space to start a new piece');
  }
}

function click(e) {
  const hit = pick(e);
  const atom = hit?.type === 'atom' ? atomById(hit.id) : null;

  if (tool === 'add') {
    attachAt(e, false);
  } else if (tool === 'link') {
    if (!atom || linkFrom === atom.id) linkFrom = null;
    else if (linkFrom === null) linkFrom = atom.id;
    else {
      const from = atomById(linkFrom);
      linkFrom = null;
      link(from, atom);
    }
    showSelection();
    refreshHint();
  } else if (tool === 'order' && hit?.type === 'bond') {
    change(() => {
      const bond = model.bonds.find(b => b.id === hit.id);
      bond.order = (bond.order % 3) + 1;
    });
  } else if (tool === 'delete' && hit) {
    change(() => {
      if (atom) deleteAtom(atom.id);
      else model.bonds = model.bonds.filter(b => b.id !== hit.id);
    });
  }
}

// ---- Turning pieces and twisting bonds ----
// Dragging an atom turns the whole piece it belongs to about its centre;
// dragging a bond twists the smaller side about the bond, as with the real kit.

// Atom ids reachable from `id` without crossing `skip`.
function pieceOf(id, skip = null) {
  const ids = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const at = queue.pop();
    for (const b of bondsOf(at)) {
      if (b === skip) continue;
      const next = b.a === at ? b.b : b.a;
      if (!ids.has(next)) {
        ids.add(next);
        queue.push(next);
      }
    }
  }
  return ids;
}

function startDrag(hit) {
  let ids;
  let pivot;
  let axis = null;
  let crank = null;
  if (hit.type === 'atom') {
    ids = pieceOf(hit.id);
    pivot = new THREE.Vector3();
    ids.forEach(id => pivot.add(posOf(atomById(id))));
    pivot.divideScalar(ids.size);
  } else {
    const bond = model.bonds.find(b => b.id === hit.id);
    const sideB = pieceOf(bond.b, bond);
    if (sideB.has(bond.a)) {
      flash("Bonds in a ring can't twist");
      return null;
    }
    const sideA = pieceOf(bond.a, bond);
    const [fixedEnd, movingEnd] = sideB.size <= sideA.size ? [bond.a, bond.b] : [bond.b, bond.a];
    ids = sideB.size <= sideA.size ? sideB : sideA;
    pivot = posOf(atomById(fixedEnd));
    axis = posOf(atomById(movingEnd)).sub(pivot).normalize();
    // Dragging across the bond on screen turns it, like a crank handle.
    const a = pivot.clone().project(camera);
    const b = pivot.clone().add(axis).project(camera);
    const sx = (b.x - a.x) * canvas.clientWidth;
    const sy = -(b.y - a.y) * canvas.clientHeight;
    const length = Math.hypot(sx, sy);
    crank = length < 1e-3 ? { x: 1, y: 0 } : { x: -sy / length, y: sx / length };
  }
  return {
    before: JSON.stringify(model),
    start: [...ids].map(id => {
      const atom = atomById(id);
      return { atom, p: posOf(atom), q: quatOf(atom) };
    }),
    pivot,
    axis,
    crank,
    up: Y.clone().applyQuaternion(camera.quaternion),
    right: X.clone().applyQuaternion(camera.quaternion),
  };
}

function turn(drag, dx, dy) {
  const k = 0.01;
  const rotation = drag.axis
    ? new THREE.Quaternion().setFromAxisAngle(drag.axis, (dx * drag.crank.x + dy * drag.crank.y) * k)
    : new THREE.Quaternion().setFromAxisAngle(drag.up, dx * k)
      .multiply(new THREE.Quaternion().setFromAxisAngle(drag.right, dy * k));
  for (const { atom, p, q } of drag.start) {
    atom.p = p.clone().sub(drag.pivot).applyQuaternion(rotation).add(drag.pivot).toArray();
    atom.q = rotation.clone().multiply(q).toArray();
  }
  rebuild();
}

function endDrag(drag) {
  if (!drag || JSON.stringify(model) === drag.before) return;
  undoStack.push(drag.before);
  $('undo').disabled = false;
}

// In the Link tool, dragging out of an atom pulls a link from the hole facing
// the pointer, to the atom under the pointer or to the pointer itself.
function stretchLink(fromId, e) {
  clearGhost();
  hoverHalo.visible = false;
  const from = atomById(fromId);
  const hit = pick(e);
  const to = hit?.type === 'atom' && hit.id !== fromId ? atomById(hit.id) : null;
  if (to) placeHalo(hoverHalo, to, BLUE);
  if (to && bonded(from.id, to.id)) return;
  const end = to ? posOf(to) : pointOnViewPlane(e, posOf(from));
  if (!end) return;
  const toward = end.clone().sub(posOf(from)).normalize();
  const ha = nearestHole(from, freeHoles(from), toward);
  const hb = to ? nearestHole(to, freeHoles(to), toward.clone().negate()) : null;
  if (ha === null || (to && hb === null)) return;
  const [curve] = linkCurves(
    posOf(from), holeDir(from, ha), radiusOf(from.kind),
    end, to ? holeDir(to, hb) : toward.clone().negate(), to ? radiusOf(to.kind) : 0, 1,
  );
  const material = new THREE.MeshStandardMaterial({ color: 0x9c9c9c, transparent: true, opacity: 0.6, depthWrite: false });
  const tube = new THREE.TubeGeometry(curve, 20, 0.07, 10);
  ghost.add(new THREE.Mesh(tube, material));
  ghostDisposables.push(material, tube);
}

function dropLink(fromId, e) {
  const hit = pick(e);
  if (hit?.type === 'atom' && hit.id !== fromId) link(atomById(fromId), atomById(hit.id));
}

// A press on an atom or bond belongs to us, not the orbit controls, so this
// listens in the capture phase on the canvas's parent, ahead of OrbitControls.
let grab = null;
canvas.parentElement.addEventListener('pointerdown', e => {
  if (e.target !== canvas || e.button !== 0) return;
  const hit = pick(e);
  grab = { x: e.clientX, y: e.clientY, hit, drag: undefined };
  if (hit) {
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  }
}, { capture: true });

canvas.addEventListener('pointermove', e => {
  if (grab?.hit) {
    const dx = e.clientX - grab.x;
    const dy = e.clientY - grab.y;
    if (grab.drag === undefined) {
      if (Math.hypot(dx, dy) < 6) return;
      lastPointer = null;
      clearHover();
      if (tool === 'link' && grab.hit.type === 'atom') {
        linkFrom = null;
        showSelection();
        grab.drag = { linkFrom: grab.hit.id };
      } else {
        grab.drag = startDrag(grab.hit);
      }
    }
    if (grab.drag?.linkFrom) stretchLink(grab.drag.linkFrom, e);
    else if (grab.drag) turn(grab.drag, dx, dy);
    canvas.style.cursor = 'grabbing';
  } else if (e.buttons) {
    lastPointer = null;
    clearHover();
  } else {
    hover(e);
  }
});

function release(e, cancelled) {
  if (!grab) return;
  const { x, y, drag } = grab;
  grab = null;
  controls.enabled = true;
  if (drag?.linkFrom) {
    clearHover();
    if (!cancelled) dropLink(drag.linkFrom, e);
  } else if (drag !== undefined) {
    endDrag(drag);
  } else if (!cancelled && Math.hypot(e.clientX - x, e.clientY - y) < 6) click(e);
}
canvas.addEventListener('pointerup', e => release(e, false));
canvas.addEventListener('pointercancel', e => release(e, true));
canvas.addEventListener('pointerleave', () => {
  lastPointer = null;
  clearHover();
});

window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key === 'Escape' && linkFrom !== null) {
    linkFrom = null;
    showSelection();
    refreshHint();
  }
});

// ---- Panels -----------------------------------------------------------------

const holesText = n => `${n} hole${n === 1 ? '' : 's'}`;

const label = id => {
  const name = ELEMENTS[KIND[id].el].name.toLowerCase();
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} with ${holesText(KIND[id].holes.length)}`;
};

function refreshHint() {
  const hints = {
    add: model.atoms.length
      ? `Click an atom to snap ${label(kindId)} into its nearest free hole`
      : `Click anywhere to place ${label(kindId)}`,
    link: linkFrom === null
      ? 'Drag from one atom to another to join them, or click both. Join them again for a double or triple bond'
      : 'Now click the atom to join it to',
    order: 'Click a bond to cycle single, double, triple',
    delete: 'Click an atom or a bond to remove it',
  };
  $('hint').textContent = hints[tool];
}

function refreshReadout() {
  const counts = {};
  for (const a of model.atoms) counts[kindOf(a).el] = (counts[kindOf(a).el] || 0) + 1;
  // Hill order: carbon, then hydrogen, then the rest alphabetically.
  const rest = Object.keys(counts).filter(el => !(counts.C && (el === 'C' || el === 'H'))).sort();
  const order = counts.C ? ['C', ...(counts.H ? ['H'] : []), ...rest] : rest;
  $('formula').innerHTML = order.length
    ? order.map(el => el + (counts[el] > 1 ? `<sub>${counts[el]}</sub>` : '')).join('')
    : '&mdash;';
  const mass = model.atoms.reduce((m, a) => m + ELEMENTS[kindOf(a).el].mass, 0);
  const open = model.atoms.reduce((n, a) => n + openHoles(a), 0);
  $('details').textContent = model.atoms.length
    ? `${mass.toFixed(2)} g/mol · ${model.atoms.length} atom${model.atoms.length > 1 ? 's' : ''} · ` +
      (open ? `${open} open hole${open > 1 ? 's' : ''}` : 'complete')
    : 'Pick an atom from the box to start';
  refreshName(open);
}

// The name comes from PubChem, looked up once the model is a whole molecule.
// `namedSmiles` skips the lookup when an edit (a twist, say) keeps the structure.
let namedSmiles = null;
let nameTimer;

function refreshName(open) {
  const result = !model.atoms.length ? { problem: '' }
    : open ? { problem: 'Fill the open holes to name it' }
    : toSmiles(model.atoms.map(a => ({ id: a.id, el: kindOf(a).el })), model.bonds);
  if (result.smiles === namedSmiles && namedSmiles) return;
  clearTimeout(nameTimer);
  namedSmiles = result.smiles ?? null;
  if (!namedSmiles) return showName(result.problem, { status: true });

  const smiles = namedSmiles;
  showName('Looking up the name…', { status: true });
  nameTimer = setTimeout(() => {
    lookUp(smiles).then(
      hit => {
        if (namedSmiles !== smiles) return;
        if (hit) showName(hit.title, { iupac: hit.iupac, cid: hit.cid });
        else showName('PubChem has no compound like this', { status: true, smiles });
      },
      () => {
        if (namedSmiles !== smiles) return;
        namedSmiles = null;
        showName("Couldn't reach PubChem to name it", { status: true, smiles });
      },
    );
  }, 400);
}

function showName(text, { status = false, iupac = '', cid = null, smiles = '' } = {}) {
  const name = $('name');
  name.textContent = text;
  name.classList.toggle('status', status);
  name.hidden = !text;

  const parts = [];
  if (iupac && iupac.toLowerCase() !== text.toLowerCase()) parts.push(`IUPAC: ${iupac}`);
  if (cid) {
    const link = document.createElement('a');
    link.href = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'PubChem';
    parts.push(link);
  }
  if (smiles) parts.push(`SMILES ${smiles}`);
  const sub = $('subname');
  sub.replaceChildren(...parts.flatMap((part, i) => (i ? [' · ', part] : [part])));
  sub.hidden = !parts.length;
}

let toastTimer;
function flash(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function setTool(next) {
  tool = next;
  linkFrom = null;
  showSelection();
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool));
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', tool === 'add' && c.dataset.kind === kindId));
  clearHover();
  refreshHint();
}

for (const kind of KINDS) {
  const el = ELEMENTS[kind.el];
  const n = kind.holes.length;
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.dataset.kind = kind.id;
  chip.title = `${el.name}, ${holesText(n)}`;
  chip.innerHTML =
    `<span class="ball" style="--c:${el.color}" data-n="${n}"></span>` +
    `<span class="sym">${kind.el} <span class="el-name">${el.name}</span></span><span class="geo">${holesText(n)}</span>`;
  chip.addEventListener('click', () => {
    kindId = kind.id;
    setTool('add');
  });
  dragFromBox(chip, kind);
  $('chips').append(chip);
}

// Drag a chip out of the box: the preview follows the pointer over the model,
// and letting go drops the atom into that hole, or loose on empty space.
function dragFromBox(chip, kind) {
  let start = null;
  let floating = null;
  const overCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  chip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    chip.setPointerCapture(e.pointerId);
  });
  chip.addEventListener('pointermove', e => {
    if (!start) return;
    if (!floating) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      kindId = kind.id;
      setTool('add');
      floating = chip.querySelector('.ball').cloneNode();
      floating.classList.add('dragging');
      document.body.append(floating);
    }
    floating.style.left = `${e.clientX}px`;
    floating.style.top = `${e.clientY}px`;
    if (overCanvas(e)) {
      hover(e);
    } else {
      lastPointer = null;
      clearHover();
    }
  });
  const finish = (e, drop) => {
    if (floating && drop && overCanvas(e)) attachAt(e, true);
    floating?.remove();
    floating = start = null;
  };
  chip.addEventListener('pointerup', e => finish(e, true));
  chip.addEventListener('pointercancel', e => finish(e, false));
}

document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('fill').addEventListener('click', fillHydrogens);
$('undo').addEventListener('click', undo);
$('fit').addEventListener('click', fitView);
$('clear').addEventListener('click', () => change(() => { model = { atoms: [], bonds: [], nextId: model.nextId }; }));

setTool('add');
rebuild();
