// Dolymod: a point-and-click ball-and-stick model kit.
// The model is plain data (atoms with a position and orientation, bonds
// between numbered holes); every change rebuilds the 3D scene from it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ELEMENTS, KINDS, KIND } from './kit.js';
import { toSmiles, lookUp } from './naming.js';
import { EXAMPLES } from './examples.js';

const $ = id => document.getElementById(id);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

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
controls.zoomToCursor = true;
controls.minDistance = 2;
controls.maxDistance = 80;

function fitCanvas() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(fitCanvas).observe(canvas);
fitCanvas();

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

// Each bond record is one flexible link between a hole on each atom. A double
// bond is two links between the same pair of atoms, a triple bond three.
function addBond(a, ha, b, hb) {
  model.bonds.push({ id: model.nextId++, a: a.id, ha, b: b.id, hb });
}

const linksBetween = (a, b) =>
  model.bonds.filter(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id));
const holeAt = (l, atom) => (l.a === atom.id ? l.ha : l.hb);

// Removing an atom also removes anything that only hung off it (its hydrogens).
function doomedBy(id) {
  const loose = bondsOf(id).map(b => (b.a === id ? b.b : b.a)).filter(n => bondsOf(n).length === 1);
  return new Set([id, ...loose]);
}

function deleteAtom(id) {
  const doomed = doomedBy(id);
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

// How far to spin a new atom about its bond: as far from clashing with the
// parent's other holes as it will go, which gives the staggered conformation.
// Salt-crystal atoms instead line their holes up square, to build a lattice.
function twistAngle(parent, hole, kind, q1, axis) {
  const parentDirs = kindOf(parent).holes
    .filter((_, i) => i !== hole)
    .map(d => d.clone().applyQuaternion(quatOf(parent)));
  const alphas = anglesAround(parentDirs, axis);
  const betas = anglesAround(kind.holes.slice(1).map(d => d.clone().applyQuaternion(q1)), axis);
  if (!alphas.length || !betas.length) return 0;
  if (kindOf(parent).crystal && kind.crystal) return alphas[0] - betas[0];
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

// Join two atoms with a link. Joining them again plugs another link into
// another hole on each, as with the real kit: two links make a double bond,
// three a triple.
function link(a, b) {
  if (linksBetween(a, b).length === 3) return flash('Those atoms already have three links');
  if (!freeHoles(a).length || !freeHoles(b).length) return flash('Both atoms need a free hole');
  change(() => addLink(a, b));
}

function addLink(a, b) {
  const already = linksBetween(a, b).length;
  const toB = posOf(b).sub(posOf(a)).normalize();
  addBond(a, nearestHole(a, freeHoles(a), toB), b, nearestHole(b, freeHoles(b), toB.clone().negate()));
  if (already) settle(a, b);
}

// When two atoms share two or three links, turn the lighter side of the
// molecule so the links sit evenly around the line between the atoms and bend
// like the kit's flexible links. In a ring nothing can turn, so the links just
// bend further.
function settle(a, b) {
  const links = linksBetween(a, b);
  const skip = new Set(links);
  const sideB = pieceOf(b.id, skip);
  if (sideB.has(a.id)) return;
  const sideA = pieceOf(a.id, skip);
  const [fixed, moving, side] = sideB.size <= sideA.size ? [a, b, sideB] : [b, a, sideA];

  // Point the middle of each atom's link holes at the other atom...
  const middle = (atom, dir) => links.reduce((sum, l) => sum.add(dir(holeAt(l, atom))), new THREE.Vector3()).normalize();
  const axis = middle(fixed, i => holeDir(fixed, i));
  const local = middle(moving, i => kindOf(moving).holes[i].clone());
  const q1 = new THREE.Quaternion().setFromUnitVectors(local, axis.clone().negate());
  // ...and spin the moving atom so its first link hole faces the fixed one's.
  const [alpha] = anglesAround([holeDir(fixed, holeAt(links[0], fixed))], axis);
  const [beta] = anglesAround([kindOf(moving).holes[holeAt(links[0], moving)].clone().applyQuaternion(q1)], axis);
  const q = new THREE.Quaternion().setFromAxisAngle(axis, alpha - beta).multiply(q1);

  const turn = q.multiply(quatOf(moving).invert());
  const from = posOf(moving);
  const to = posOf(fixed).addScaledVector(axis, bondLength(fixed.kind, moving.kind));
  for (const id of side) {
    const atom = atomById(id);
    atom.p = posOf(atom).sub(from).applyQuaternion(turn).add(to).toArray();
    atom.q = turn.clone().multiply(quatOf(atom)).toArray();
  }

  pairUp(fixed, moving);
}

// Re-pair the holes of two atoms joined by several links so no two cross.
function pairUp(fixed, moving) {
  const links = linksBetween(fixed, moving);
  const spare = links.map(l => holeAt(l, moving));
  for (const l of links) {
    const facing = holeDir(fixed, holeAt(l, fixed));
    const best = spare.reduce((x, y) => (holeDir(moving, y).dot(facing) > holeDir(moving, x).dot(facing) ? y : x));
    spare.splice(spare.indexOf(best), 1);
    if (l.a === moving.id) l.ha = best;
    else l.hb = best;
  }
}

function fillHoles() {
  for (const atom of [...model.atoms]) {
    if (kindOf(atom).el === 'H' || kindOf(atom).crystal) continue;
    for (const h of freeHoles(atom)) {
      const spot = placement(atom, h, 'H');
      if (!spot.blocked) addBond(atom, h, addAtom('H', spot.p, spot.q), 0);
    }
  }
}

function fillHydrogens() {
  if (change(fillHoles)) return;
  const salty = model.atoms.some(a => kindOf(a).crystal && freeHoles(a).length);
  flash(salty ? "Salt crystal atoms don't take hydrogen" : 'No free holes to fill');
}

// ---- Saving -----------------------------------------------------------------
// The model is kept in this browser as you build, so a refresh brings it back.
// Save writes it to a file and Load opens one.

const STORE = 'dolymod-model';
let saveTimer;

function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(model));
    } catch {
      // Storage can be full or switched off; the model just won't come back.
    }
  }, 300);
}

// A model from storage or a file, checked before it is trusted; null if not.
function readModel(data) {
  const saved = data?.model ?? data;
  if (!Array.isArray(saved?.atoms) || !Array.isArray(saved?.bonds)) return null;
  const atoms = new Map();
  for (const a of saved.atoms) {
    if (!KIND[a?.kind] || a.p?.length !== 3 || a.q?.length !== 4 || ![...a.p, ...a.q].every(Number.isFinite)) return null;
    atoms.set(a.id, a);
  }
  const used = new Set();
  for (const b of saved.bonds) {
    for (const [id, hole] of [[b?.a, b?.ha], [b?.b, b?.hb]]) {
      const atom = atoms.get(id);
      if (!atom || !(hole in KIND[atom.kind].holes) || used.has(`${id}:${hole}`)) return null;
      used.add(`${id}:${hole}`);
    }
  }
  const ids = [...atoms.keys(), ...saved.bonds.map(b => b.id)];
  return {
    atoms: saved.atoms.map(({ id, kind, p, q }) => ({ id, kind, p, q })),
    bonds: saved.bonds.map(({ id, a, ha, b, hb }) => ({ id, a, ha, b, hb })),
    nextId: Math.max(0, ...ids) + 1,
  };
}

// What to call the model: its name if it has one, else its formula.
const modelName = () => (!$('name').classList.contains('status') && $('name').textContent) || $('formula').textContent;

// Save to a file. Where the browser allows it (Chrome, Edge, Chromebooks) this
// opens the computer's own Save box to choose a folder and name; elsewhere
// the file goes to the Downloads folder.
async function saveFile() {
  if (!model.atoms.length) return flash('Build something first');
  const slug = modelName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'molecule';
  const name = `${slug}.json`;
  const text = JSON.stringify({ app: 'dolymod', version: 1, model });
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Molecule model', accept: { 'application/json': ['.json'] } }],
      });
      const writer = await handle.createWritable();
      await writer.write(text);
      await writer.close();
      flash(`Saved ${handle.name}`);
    } catch (error) {
      if (error.name !== 'AbortError') flash("Couldn't save the file");
    }
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  flash(`Saved ${name} to your Downloads folder`);
}

async function openFile(file) {
  let opened = null;
  try {
    opened = readModel(JSON.parse(await file.text()));
  } catch {
    // Not JSON: handled below.
  }
  if (!opened) return flash("That file isn't a Dolymod model");
  change(() => { model = opened; });
  fitView();
}

// ---- Examples ---------------------------------------------------------------

// An example PubChem can't name (a cut-off piece of crystal, say) keeps its
// label for as long as its atoms and links are as loaded.
let labelled = null;
const structure = () => model.atoms.map(a => a.id + a.kind).join() + '|' + model.bonds.map(b => `${b.a}-${b.b}`).join();

function loadExample(example) {
  change(() => {
    model = { atoms: [], bonds: [], nextId: model.nextId };
    if (example.tree) grow(example.tree, null);
    else assemble(example.build(bondLength));
    if (example.tree || example.fill) fillHoles();
    labelled = example.label ? { label: example.label, structure: structure() } : null;
  });
  // Show it face on, or from the example's own angle.
  camera.position.copy(controls.target).add(example.view ? new THREE.Vector3(...example.view).normalize() : Z);
  fitView();
}

// Build a tree from examples.js: each child goes into its parent's next free
// hole, with extra links for "=" (double) and "#" (triple).
function grow(node, parent) {
  const [head, ...children] = Array.isArray(node) ? node : [node];
  const links = { '=': 2, '#': 3 }[head[0]] ?? 1;
  const kindId = links > 1 ? head.slice(1) : head;
  let atom;
  if (!parent) {
    atom = addAtom(kindId, new THREE.Vector3(), new THREE.Quaternion());
  } else {
    const hole = freeHoles(parent)[0];
    const spot = placement(parent, hole, kindId);
    atom = addAtom(kindId, spot.p, spot.q);
    addBond(parent, hole, atom, 0);
    for (let k = 1; k < links; k++) addLink(parent, atom);
  }
  children.forEach(child => grow(child, atom));
}

// Put generated atoms in place, turn each so its holes face its links, and
// plug every link into the holes it was matched with.
function assemble({ atoms, links }) {
  const ends = atoms.map(() => []);
  links.forEach(([i, j], n) => {
    const dir = atoms[j].p.clone().sub(atoms[i].p).normalize();
    ends[i].push({ n, dir });
    ends[j].push({ n, dir: dir.clone().negate() });
  });
  const holeFor = new Map();
  const made = atoms.map(({ kind, p }, i) => {
    const { q, holes } = orient(KIND[kind], ends[i].map(e => e.dir));
    ends[i].forEach((e, k) => holeFor.set(`${e.n}:${i}`, holes[k]));
    return addAtom(kind, p, q);
  });
  links.forEach(([i, j], n) => addBond(made[i], holeFor.get(`${n}:${i}`), made[j], holeFor.get(`${n}:${j}`)));
  const seen = new Set();
  for (const [i, j] of links) {
    if (seen.has(`${i}-${j}`)) pairUp(made[i], made[j]);
    seen.add(`${i}-${j}`);
  }
}

// The turn that points a ball's holes along `dirs` as closely as it can, and
// which hole serves each direction. Tries each way of matching directions to
// holes (at most 720, for six holes) unless the ball already fits unturned.
function orient(kind, dirs) {
  const unturned = dirs.map(d => kind.holes.findIndex(h => h.dot(d) > 0.999));
  if (!unturned.includes(-1) && new Set(unturned).size === dirs.length) {
    return { q: new THREE.Quaternion(), holes: unturned };
  }
  let best = { q: new THREE.Quaternion(), holes: [], error: Infinity };
  for (const holes of matchings(kind.holes.length, dirs.length)) {
    const from = holes.map(h => kind.holes[h]);
    for (const q of bestTurns(from, dirs)) {
      const error = from.reduce((sum, h, k) => sum + 1 - h.clone().applyQuaternion(q).dot(dirs[k]), 0);
      if (error < best.error - 1e-9) best = { q, holes, error };
    }
  }
  return best;
}

function* matchings(holes, wanted, used = []) {
  if (used.length === wanted) {
    yield [...used];
    return;
  }
  for (let h = 0; h < holes; h++) {
    if (used.includes(h)) continue;
    used.push(h);
    yield* matchings(holes, wanted, used);
    used.pop();
  }
}

// Horn's method: the rotation taking each `from` vector closest to its `to`
// vector is the top eigenvector of a 4 x 4 matrix, found here by power
// iteration. Returns it and its inverse; the caller keeps whichever fits.
function bestTurns(from, to) {
  if (!from.length) return [new THREE.Quaternion()];
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  from.forEach((h, k) => {
    const a = h.toArray();
    const b = to[k].toArray();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += a[r] * b[c];
  });
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const shift = from.length + 1;
  let v = [1, 0.3, 0.2, 0.1];
  for (let step = 0; step < 200; step++) {
    const next = N.map((row, r) => row.reduce((sum, x, c) => sum + x * v[c], 0) + shift * v[r]);
    const size = Math.hypot(...next);
    v = next.map(x => x / size);
  }
  const q = new THREE.Quaternion(v[1], v[2], v[3], v[0]).normalize();
  return [q, q.clone().invert()];
}

// ---- Rendering --------------------------------------------------------------

const root = new THREE.Group();
const ghost = new THREE.Group();
scene.add(root, ghost);

const SPHERE = new THREE.SphereGeometry(1, 48, 32);
const HOLE_HOVER = new THREE.MeshBasicMaterial({ color: 0xffb000, side: THREE.DoubleSide });
const BLUE = 0x2f6bff;
const RED = 0xff3b30;
const DOT = new THREE.SphereGeometry(0.035, 8, 6);
const DOT_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x6fa8ff });

// Hydrogen bonds: a hydrogen on an oxygen, nitrogen or fluorine pointing
// at another of those, in a different molecule, at hydrogen-bond distance
// (about twice the hydrogen's own link). They hold ice together. Returns
// the two ends of each, at the surfaces of the balls.
function hydrogenBonds() {
  const strong = el => el === 'O' || el === 'N' || el === 'F';
  const piece = new Map();
  for (const atom of model.atoms) {
    if (piece.has(atom.id)) continue;
    for (const id of pieceOf(atom.id)) piece.set(id, atom.id);
  }
  const ends = [];
  for (const h of model.atoms) {
    const [bond] = bondsOf(h.id);
    if (kindOf(h).el !== 'H' || !bond) continue;
    const donor = atomById(bond.a === h.id ? bond.b : bond.a);
    if (!strong(kindOf(donor).el)) continue;
    const pointing = posOf(h).sub(posOf(donor)).normalize();
    for (const other of model.atoms) {
      if (!strong(kindOf(other).el) || piece.get(other.id) === piece.get(h.id)) continue;
      const gap = posOf(other).sub(posOf(h));
      const distance = gap.length();
      if (distance < 1.6 || distance > 2.9 || gap.normalize().dot(pointing) < 0.7) continue;
      ends.push([
        posOf(h).addScaledVector(gap, radiusOf(h.kind)),
        posOf(other).addScaledVector(gap, -radiusOf(other.kind)),
      ]);
    }
  }
  return ends;
}

const makeHalo = () => {
  const halo = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
  halo.visible = false;
  scene.add(halo);
  return halo;
};
const hoverHalo = makeHalo();
const selectHalo = makeHalo();

const view = { holes: new Map(), bonds: new Map(), paths: new Map() };

// Delete mode marks everything a click would remove in red.
const marks = new THREE.Group();
scene.add(marks);
const MARK_MATERIAL = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.45, depthWrite: false });
const MARK_RIM = new THREE.MeshBasicMaterial({ color: RED, side: THREE.BackSide });
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

// A link leaves each ball along its hole and bends to meet the other, like
// the kit's flexible links: straight for a plain bond, curved side by side for
// a double or triple bond, and curved further in a strained ring.
function linkCurve(pA, dA, rA, pB, dB, rB) {
  const p0 = pA.clone().addScaledVector(dA, rA * 0.8);
  const p3 = pB.clone().addScaledVector(dB, rB * 0.8);
  const reach = p0.distanceTo(p3) / 3;
  const p1 = p0.clone().addScaledVector(dA, reach);
  const p2 = p3.clone().addScaledVector(dB, reach);
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
}

function rebuild() {
  clearHover();
  disposables.forEach(d => d.dispose());
  disposables = [];
  root.clear();
  view.holes.clear();
  view.bonds.clear();
  view.paths.clear();

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
    const curve = linkCurve(
      posOf(a), holeDir(a, bond.ha), radiusOf(a.kind),
      posOf(b), holeDir(b, bond.hb), radiusOf(b.kind),
    );
    const mesh = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 20, 0.07, 10)), material);
    mesh.userData = { type: 'bond', id: bond.id };
    root.add(mesh);
    view.bonds.set(bond.id, material);
    view.paths.set(bond.id, curve.getPoints(8));
  }

  for (const [from, to] of hydrogenBonds()) {
    const gap = to.clone().sub(from);
    const dots = Math.max(2, Math.round(gap.length() / 0.22));
    for (let k = 1; k < dots; k++) {
      const dot = new THREE.Mesh(DOT, DOT_MATERIAL);
      dot.position.copy(from).addScaledVector(gap, k / dots);
      dot.raycast = () => {};
      root.add(dot);
    }
  }

  if (linkFrom !== null && !atomById(linkFrom)) linkFrom = null;
  showSelection();
  $('undo').disabled = !undoStack.length;
  refreshReadout();
  refreshHint();
  if (lastPointer) hover(lastPointer);
  autosave();
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
  const curve = linkCurve(
    posOf(parent), holeDir(parent, hole), radiusOf(parent.kind),
    spot.p, KIND[kindId].holes[0].clone().applyQuaternion(spot.q), el.radius,
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

// For the + and - buttons and keys: move the camera in or out by `factor`.
function zoomBy(factor) {
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(distance));
}

// ---- Interaction ------------------------------------------------------------

let tool = 'add';
let kindId = 'C';
let linkFrom = null;
let lastPointer = null;
let hoveredHole = null;
let hoveredBond = null;

const raycaster = new THREE.Raycaster();

function ndcOf(e) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

// Matrices and the canvas size normally refresh when a frame renders; refresh
// them here so a tap straight after a change, a resize or a phone rotation (or
// in a background tab) tests the current scene.
function aim(e) {
  if (Math.abs(camera.aspect - canvas.clientWidth / canvas.clientHeight) > 1e-3) fitCanvas();
  scene.updateMatrixWorld();
  raycaster.setFromCamera(ndcOf(e), camera);
}

// What's under the pointer. Links are thin, so a miss that passes close to
// one still counts as that link.
function pick(e) {
  aim(e);
  const hit = raycaster.intersectObjects(root.children, true).find(h => h.object.userData.type);
  if (hit) return { ...hit.object.userData, point: hit.point };
  let near = null;
  for (const [id, points] of view.paths) {
    for (let k = 1; k < points.length; k++) {
      const point = new THREE.Vector3();
      const gap = raycaster.ray.distanceSqToSegment(points[k - 1], points[k], null, point);
      if (gap < 0.2 * 0.2 && (!near || gap < near.gap)) near = { type: 'bond', id, point, gap };
    }
  }
  return near && { type: near.type, id: near.id, point: near.point };
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
  marks.clear();
  if (hoveredHole) hoveredHole.material = hoveredHole.userData.base;
  for (const material of [hoveredBond ?? []].flat()) material.emissive.setHex(0);
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
  } else if (tool === 'delete') {
    markDoomed(hit);
  } else {
    canvas.style.cursor = 'grab';
    return;
  }
  canvas.style.cursor = 'pointer';
}

// Show in red what deleting `hit` would remove: an atom with its hydrogens and
// links, or a single link.
function markDoomed(hit) {
  if (hit.type === 'bond') return glowBond(hit.id, RED);
  const doomed = doomedBy(hit.id);
  for (const id of doomed) {
    const atom = atomById(id);
    const r = radiusOf(atom.kind);
    const tint = new THREE.Mesh(SPHERE, MARK_MATERIAL);
    const rim = new THREE.Mesh(SPHERE, MARK_RIM);
    tint.scale.setScalar(r * 1.04);
    rim.scale.setScalar(r * 1.16);
    tint.position.fromArray(atom.p);
    rim.position.fromArray(atom.p);
    marks.add(tint, rim);
  }
  hoveredBond = [];
  for (const bond of model.bonds) {
    if (!doomed.has(bond.a) && !doomed.has(bond.b)) continue;
    const material = view.bonds.get(bond.id);
    material.emissive.setHex(RED);
    hoveredBond.push(material);
  }
}

// Put the selected atom where the pointer is: into the nearest free hole of
// the atom under it, or (when `anywhere`, or the table is empty) loose.
function attachAt(e, anywhere) {
  const hit = pick(e);
  const atom = hit?.type === 'atom' ? atomById(hit.id) : null;
  if (atom) {
    const hole = holeUnder(atom, hit.point);
    if (hole === null) return flash(`That ${nameOf(kindOf(atom)).toLowerCase()} has no free holes`);
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

// Atom ids reachable from `id` without crossing any link in `skip`.
function pieceOf(id, skip = new Set()) {
  const ids = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const at = queue.pop();
    for (const b of bondsOf(at)) {
      if (skip.has(b)) continue;
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
    const skip = new Set([bond]);
    const sideB = pieceOf(bond.b, skip);
    if (sideB.has(bond.a)) {
      const double = linksBetween(atomById(bond.a), atomById(bond.b)).length > 1;
      flash(double ? "Double and triple bonds can't twist" : "Bonds in a ring can't twist");
      return null;
    }
    const sideA = pieceOf(bond.a, skip);
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
  const end = to ? posOf(to) : pointOnViewPlane(e, posOf(from));
  if (!end) return;
  const toward = end.clone().sub(posOf(from)).normalize();
  const ha = nearestHole(from, freeHoles(from), toward);
  const hb = to ? nearestHole(to, freeHoles(to), toward.clone().negate()) : null;
  if (ha === null || (to && hb === null)) return;
  const curve = linkCurve(
    posOf(from), holeDir(from, ha), radiusOf(from.kind),
    end, to ? holeDir(to, hb) : toward.clone().negate(), to ? radiusOf(to.kind) : 0,
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

// A press on an atom or bond is ours: it turns, twists or links instead of
// turning the view. This listens in the capture phase on the canvas's parent,
// ahead of OrbitControls, and only switches off the controls' rotation, so
// they still see every finger and a second finger can pinch or pan.
let grab = null;
const fingers = new Set();
const slop = touch => (touch ? 12 : 6);

function letGo() {
  grab = null;
  controls.enableRotate = true;
}

canvas.parentElement.addEventListener('pointerdown', e => {
  if (e.target !== canvas) return;
  if (e.isPrimary) fingers.clear();
  fingers.add(e.pointerId);
  if (fingers.size > 1) {
    // Two fingers pinch or pan: finish whatever the first one started.
    if (grab?.drag && !grab.drag.linkFrom) endDrag(grab.drag);
    clearHover();
    letGo();
    return;
  }
  if (e.button !== 0) return;
  const touch = e.pointerType === 'touch';
  // Shift, Ctrl or Cmd with a drag pans the view, even from an atom.
  const hit = e.shiftKey || e.ctrlKey || e.metaKey ? null : pick(e);
  grab = { id: e.pointerId, x: e.clientX, y: e.clientY, hit, touch, drag: undefined };
  if (hit) controls.enableRotate = false;
  // A touchscreen has no hover, so show the preview under the finger instead.
  if (touch && hit) hover(e);
}, { capture: true });

canvas.addEventListener('pointermove', e => {
  if (grab?.hit && e.pointerId === grab.id) {
    const dx = e.clientX - grab.x;
    const dy = e.clientY - grab.y;
    if (grab.drag === undefined) {
      if (Math.hypot(dx, dy) < slop(grab.touch)) return;
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
  } else if (e.pointerType === 'touch') {
    // Fingers only hover while pressing, handled above.
  } else if (e.buttons) {
    lastPointer = null;
    clearHover();
  } else {
    hover(e);
  }
});

function release(e, cancelled) {
  fingers.delete(e.pointerId);
  if (!grab || e.pointerId !== grab.id) return;
  const { x, y, drag, touch } = grab;
  letGo();
  if (touch) {
    lastPointer = null;
    clearHover();
  }
  if (drag?.linkFrom) {
    clearHover();
    if (!cancelled) dropLink(drag.linkFrom, e);
  } else if (drag !== undefined) {
    endDrag(drag);
  } else if (!cancelled && Math.hypot(e.clientX - x, e.clientY - y) < slop(touch)) click(e);
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
  } else if (e.key === '+' || e.key === '=') {
    zoomBy(0.8);
  } else if (e.key === '-') {
    zoomBy(1.25);
  } else if (e.key === 'Escape' && linkFrom !== null) {
    linkFrom = null;
    showSelection();
    refreshHint();
  }
});

// ---- Panels -----------------------------------------------------------------

const holesText = n => `${n} hole${n === 1 ? '' : 's'}`;

const nameOf = kind => kind.name ?? ELEMENTS[kind.el].name;

const label = id => {
  const name = nameOf(KIND[id]).toLowerCase();
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} with ${holesText(KIND[id].holes.length)}`;
};

function refreshHint() {
  const hints = {
    add: model.atoms.length
      ? `Click an atom to snap ${label(kindId)} into its nearest free hole`
      : `Click anywhere to place ${label(kindId)}`,
    link: linkFrom === null
      ? 'Drag from one atom to another to link them. Link the same two again for a double bond, and again for a triple'
      : 'Now click the atom to link it to (linking two atoms again makes a double or triple bond)',
    delete: 'Delete mode: click an atom or a link to remove it (red shows what goes). Undo puts it back',
  };
  $('hint').textContent = hints[tool];
}

function refreshReadout() {
  const counts = {};
  for (const a of model.atoms) counts[kindOf(a).el] = (counts[kindOf(a).el] || 0) + 1;
  // Many copies of one molecule (ice is all waters) read as 21 × H2O.
  const copies = sameMolecules();
  if (copies > 1) for (const el in counts) counts[el] /= copies;
  let order;
  if (isSalt()) {
    // A crystal is written as its simplest ratio, sodium first: NaCl.
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    const g = gcd(counts.Na, counts.Cl);
    counts.Na /= g;
    counts.Cl /= g;
    order = ['Na', 'Cl'];
  } else if (counts.C) {
    // Hill order: carbon, then hydrogen, then the rest alphabetically.
    const rest = Object.keys(counts).filter(el => el !== 'C' && el !== 'H').sort();
    order = ['C', ...(counts.H ? ['H'] : []), ...rest];
  } else {
    // Without carbon, IUPAC's element sequence gives the familiar NH3, H2O, HCl;
    // acids with oxygen put their hydrogen first, as in H2SO4 and H3PO4.
    const sequence = ['Na', 'B', 'Si', 'P', 'N', 'H', 'S', 'I', 'Br', 'Cl', 'O', 'F'];
    if (counts.H && counts.O) sequence.unshift('H');
    order = Object.keys(counts).sort((x, y) => sequence.indexOf(x) - sequence.indexOf(y));
  }
  $('formula').innerHTML = order.length
    ? (copies > 1 ? `${copies} × ` : '') + order.map(el => el + (counts[el] > 1 ? `<sub>${counts[el]}</sub>` : '')).join('')
    : '&mdash;';
  const mass = model.atoms.reduce((m, a) => m + ELEMENTS[kindOf(a).el].mass, 0);
  const open = model.atoms.reduce((n, a) => n + freeHoles(a).length, 0);
  $('details').textContent = model.atoms.length
    ? `${mass.toFixed(2)} g/mol · ${model.atoms.length} atom${model.atoms.length > 1 ? 's' : ''} · ` +
      (open ? `${open} open hole${open > 1 ? 's' : ''}` : 'complete')
    : 'Pick an atom from the box to start';
  refreshName(open);
}

// The name comes from PubChem, looked up once the model is a whole molecule.
// `namedSmiles` skips the lookup when an edit (a twist, say) keeps the structure.
let namedSmiles = null;
let namedLabel = null;
let nameTimer;

// How many separate molecules the model is, if they are all the same formula
// (and there is more than one); otherwise 1.
function sameMolecules() {
  const seen = new Set();
  const formulas = [];
  for (const atom of model.atoms) {
    if (seen.has(atom.id)) continue;
    const piece = [...pieceOf(atom.id)];
    piece.forEach(id => seen.add(id));
    formulas.push(piece.map(id => kindOf(atomById(id)).el).sort().join());
  }
  return formulas.length > 1 && formulas.every(f => f === formulas[0]) ? formulas.length : 1;
}

// A model made only of salt-crystal atoms, with both sodium and chloride in it.
function isSalt() {
  const kinds = model.atoms.map(kindOf);
  return kinds.length > 0 && kinds.every(k => k.crystal) && kinds.some(k => k.el === 'Na') && kinds.some(k => k.el === 'Cl');
}

function refreshName(open) {
  // A loaded example's own name wins while it is as loaded; PubChem's details
  // still show underneath when PubChem knows it.
  const label = labelled?.structure === structure() ? labelled.label : null;
  if (isSalt()) {
    clearTimeout(nameTimer);
    namedSmiles = null;
    return showName('Sodium chloride (salt) crystal');
  }
  const result = !model.atoms.length ? { problem: '' }
    : open ? { problem: 'Fill the open holes to name it' }
    : toSmiles(model.atoms.map(a => ({ id: a.id, el: kindOf(a).el })), model.bonds);
  if (result.smiles === namedSmiles && namedSmiles && label === namedLabel) return;
  clearTimeout(nameTimer);
  namedSmiles = result.smiles ?? null;
  namedLabel = label;
  if (!namedSmiles) return label ? showName(label) : showName(result.problem, { status: true });

  const smiles = namedSmiles;
  showName(label ?? 'Looking up the name…', { status: !label });
  nameTimer = setTimeout(() => {
    lookUp(smiles).then(
      hit => {
        if (namedSmiles !== smiles) return;
        if (hit) showName(label ?? displayName(hit), { iupac: hit.iupac, cid: hit.cid });
        else if (!label) showName('PubChem has no compound like this', { status: true, smiles });
      },
      () => {
        if (namedSmiles !== smiles) return;
        namedSmiles = null;
        if (!label) showName("Couldn't reach PubChem to name it", { status: true, smiles });
      },
    );
  }, 400);
}

// PubChem's title is usually the everyday name ("Ethanol"), but for less common
// compounds it is a catalogue name like "Propane, 2-fluoro-2-methyl-". Show the
// IUPAC name ("2-fluoro-2-methylpropane") instead of those.
function displayName({ title, iupac }) {
  if (!iupac || !/, |-$/.test(title)) return title;
  return iupac.charAt(0).toUpperCase() + iupac.slice(1);
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
  canvas.parentElement.classList.toggle('deleting', tool === 'delete');
  linkFrom = null;
  showSelection();
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool));
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', tool === 'add' && c.dataset.kind === kindId));
  clearHover();
  refreshHint();
}

const sections = new Map();
for (const kind of KINDS) {
  const group = kind.group ?? 'Atoms';
  if (!sections.has(group)) {
    const section = document.createElement('section');
    section.className = 'box-group';
    const heading = document.createElement('h2');
    heading.textContent = group;
    const chips = document.createElement('div');
    chips.className = 'chips';
    section.append(heading, chips);
    $('box').append(section);
    sections.set(group, chips);
  }
  const el = ELEMENTS[kind.el];
  const n = kind.holes.length;
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.dataset.kind = kind.id;
  chip.title = `${nameOf(kind)}, ${holesText(n)}`;
  chip.innerHTML =
    `<span class="ball" style="--c:${el.color}" data-n="${n}"></span>` +
    `<span class="sym">${kind.el} <span class="el-name">${nameOf(kind)}</span></span><span class="geo">${holesText(n)}</span>`;
  chip.addEventListener('click', () => {
    kindId = kind.id;
    setTool('add');
  });
  dragFromBox(chip, kind);
  sections.get(group).append(chip);
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
    if (floating && e.pointerType === 'touch') {
      // A lifted finger leaves no pointer to keep a preview under.
      lastPointer = null;
      clearHover();
    }
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

for (const group of new Set(EXAMPLES.map(x => x.group))) {
  const options = document.createElement('optgroup');
  options.label = group;
  EXAMPLES.forEach((x, i) => { if (x.group === group) options.append(new Option(x.name, i)); });
  $('examples').append(options);
}
$('examples').addEventListener('change', e => {
  loadExample(EXAMPLES[e.target.value]);
  e.target.selectedIndex = 0;
});
$('zoom-in').addEventListener('click', () => zoomBy(0.8));
$('zoom-out').addEventListener('click', () => zoomBy(1.25));
$('clear').addEventListener('click', () => change(() => { model = { atoms: [], bonds: [], nextId: model.nextId }; }));

$('save').addEventListener('click', saveFile);
$('open').addEventListener('click', () => $('open-file').click());
$('open-file').addEventListener('change', e => {
  if (e.target.files[0]) openFile(e.target.files[0]);
  e.target.value = '';
});

try {
  model = readModel(JSON.parse(localStorage.getItem(STORE))) ?? model;
} catch {
  // Nothing saved, or storage switched off: start with an empty table.
}
setTool('add');
rebuild();
fitView();
