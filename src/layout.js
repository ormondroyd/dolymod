// Molecules from SMILES, for the Examples menu: read the structure, add the
// hydrogens its holes need, and lay it out in 3D.
//
// Only plain SMILES is read: the kit's elements (B C N O P S F Cl Br I Si),
// "-", "=" and "#" bonds, branches and ring numbers, written with explicit
// double bonds (PubChem's style). No charges, stereo or bracket atoms.
//
// The layout starts the atoms at random, first spreads them out so atoms many
// bonds apart are far apart (which untangles rings), then nudges them, over
// and over, until
// bonded atoms sit one link apart and each atom's neighbours sit at its bond
// angle (109.5° for four bonds, 120° beside a double bond, 180° for a triple),
// while atoms that aren't neighbours keep their distance, and double bonds
// stay flat instead of twisting. A few seeded tries
// are made and the best kept, so an example always comes out the same.
import * as THREE from 'three';
import { KIND } from './kit.js';

// For an example's `build`: `length(a, b)` is the kit's link length.
export function fromSmiles(smiles) {
  return length => layOut(parse(smiles), length);
}

function parse(smiles) {
  const atoms = [];
  const links = [];
  const join = (i, j, order) => {
    for (let k = 0; k < order; k++) links.push([i, j]);
  };
  const branches = [];
  const rings = new Map();
  let previous = null;
  let order = 1;
  for (const token of smiles.match(/Cl|Br|Si|%\d\d|[BCNOPSFI]|[-=#()]|\d/g)) {
    if (token === '(') {
      branches.push(previous);
    } else if (token === ')') {
      previous = branches.pop();
    } else if ('-=#'.includes(token)) {
      order = '-=#'.indexOf(token) + 1;
    } else if (/\d/.test(token)) {
      if (rings.has(token)) {
        const [other, opened] = rings.get(token);
        join(other, previous, Math.max(opened, order));
        rings.delete(token);
      } else {
        rings.set(token, [previous, order]);
      }
      order = 1;
    } else {
      atoms.push(token);
      if (previous !== null) join(previous, atoms.length - 1, order);
      previous = atoms.length - 1;
      order = 1;
    }
  }
  // Hydrogens fill the holes left over.
  const used = atoms.map(() => 0);
  links.forEach(([i, j]) => {
    used[i]++;
    used[j]++;
  });
  const heavy = atoms.length;
  for (let i = 0; i < heavy; i++) {
    for (let h = used[i]; h < KIND[atoms[i]].holes.length; h++) {
      atoms.push('H');
      links.push([i, atoms.length - 1]);
    }
  }
  return { atoms, links };
}

function layOut({ atoms, links }, length) {
  const orders = new Map();
  const key = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  links.forEach(([i, j]) => orders.set(key(i, j), (orders.get(key(i, j)) ?? 0) + 1));
  const neighbours = atoms.map(() => []);
  for (const pair of orders.keys()) {
    const [i, j] = pair.split(',').map(Number);
    neighbours[i].push(j);
    neighbours[j].push(i);
  }

  // Distances to hold: links, and across each bond angle.
  const rules = new Map();
  for (const pair of orders.keys()) {
    const [i, j] = pair.split(',').map(Number);
    rules.set(pair, { i, j, d: length(atoms[i], atoms[j]), w: 1 });
  }
  atoms.forEach((_, c) => {
    const bonds = neighbours[c].map(n => orders.get(key(c, n)));
    const angle = bonds.includes(3) || bonds.filter(o => o === 2).length > 1 ? Math.PI
      : bonds.includes(2) ? (2 * Math.PI) / 3
      : Math.acos(-1 / 3);
    neighbours[c].forEach((a, x) => neighbours[c].slice(x + 1).forEach(b => {
      if (rules.has(key(a, b))) return;
      const la = length(atoms[c], atoms[a]);
      const lb = length(atoms[c], atoms[b]);
      rules.set(key(a, b), { i: a, j: b, d: Math.sqrt(la * la + lb * lb - 2 * la * lb * Math.cos(angle)), w: 0.5 });
    }));
  });
  const held = [...rules.values()];
  // A double bond doesn't twist: the atoms on both ends of it lie flat. The
  // two on one end are on opposite sides; the unfolded shape decides which
  // side of those each atom on the other end goes. Each pair across the bond
  // is then held at the distance flat would give.
  const doubles = [];
  for (const [pair, order] of orders) {
    if (order !== 2) continue;
    const [a, b] = pair.split(',').map(Number);
    const xs = neighbours[a].filter(n => n !== b);
    const ys = neighbours[b].filter(n => n !== a);
    if (xs.length && ys.length) doubles.push({ a, b, xs, ys });
  }
  const across = (a, b, x, y, together) => {
    const ab = length(atoms[a], atoms[b]);
    const ax = length(atoms[a], atoms[x]);
    const by = length(atoms[b], atoms[y]);
    const reach = ab + (ax + by) / 2;
    const rise = (Math.sqrt(3) / 2) * (together ? ax - by : ax + by);
    return Math.hypot(reach, rise);
  };
  const apart = [];
  atoms.forEach((a, i) => atoms.forEach((b, j) => {
    if (j > i && !rules.has(key(i, j))) apart.push({ i, j, d: a === 'H' && b === 'H' ? 1.8 : a === 'H' || b === 'H' ? 2.2 : 2.6 });
  }));

  // Rough distances for unfolding: about 0.8 of a link per bond along the
  // shortest path between two atoms.
  const rough = [];
  atoms.forEach((_, i) => {
    const hops = new Map([[i, 0]]);
    const queue = [i];
    while (queue.length) {
      const at = queue.shift();
      for (const n of neighbours[at]) {
        if (!hops.has(n)) {
          hops.set(n, hops.get(at) + 1);
          queue.push(n);
        }
      }
    }
    for (const [j, g] of hops) if (j > i) rough.push({ i, j, d: 1.3 * Math.max(1.2, 0.8 * g), w: 0.5 / (g * g) });
  });

  let best = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const random = seeded(attempt);
    const spread = 3 * Math.cbrt(atoms.length);
    const p = atoms.map(() => new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(spread));
    for (let step = 0; step < 300; step++) {
      for (const { i, j, d, w } of rough) pull(p[i], p[j], d, w);
    }
    const flat = [];
    for (const { a, b, xs, ys } of doubles) {
      const axis = p[b].clone().sub(p[a]).normalize();
      const side = v => v.addScaledVector(axis, -v.dot(axis));
      const up = side(p[xs[0]].clone().sub(p[a]));
      const first = side(p[ys[0]].clone().sub(p[b])).dot(up) > 0 ? 1 : -1;
      xs.forEach((x, i) => ys.forEach((y, j) => {
        if (x === y || rules.has(key(x, y))) return;
        const together = (i ? -1 : 1) * (j ? -first : first) > 0;
        flat.push({ i: x, j: y, d: across(a, b, x, y, together), w: 0.5 });
      }));
    }
    for (let step = 0; step < 1500; step++) {
      for (const { i, j, d, w } of held) pull(p[i], p[j], d, w);
      for (const { i, j, d, w } of flat) pull(p[i], p[j], d, w);
      for (const { i, j, d } of apart) if (p[i].distanceToSquared(p[j]) < d * d) pull(p[i], p[j], d, 0.5);
    }
    const error = held.reduce((sum, { i, j, d }) => sum + (p[i].distanceTo(p[j]) - d) ** 2, 0)
      + apart.reduce((sum, { i, j, d }) => sum + Math.max(0, d - p[i].distanceTo(p[j])) ** 2, 0);
    if (!best || error < best.error) best = { p, error };
  }

  const middle = best.p.reduce((sum, v) => sum.add(v), new THREE.Vector3()).divideScalar(atoms.length);
  const points = best.p.map(v => v.sub(middle));
  // Turn it to face the viewer: longest way across left to right, flattest
  // side towards the screen.
  const widest = direction(points);
  const upright = direction(points.map(v => v.clone().addScaledVector(widest, -v.dot(widest))));
  upright.addScaledVector(widest, -upright.dot(widest)).normalize();
  const facing = new THREE.Vector3().crossVectors(widest, upright);
  const turn = new THREE.Matrix4().makeBasis(widest, upright, facing).invert();
  return { atoms: atoms.map((kind, i) => ({ kind, p: points[i].applyMatrix4(turn) })), links };
}

// The direction the points are most spread along (power iteration).
function direction(points) {
  let axis = new THREE.Vector3(1, 0.7, 0.4).normalize();
  for (let step = 0; step < 50; step++) {
    const next = points.reduce((sum, v) => sum.addScaledVector(v, v.dot(axis)), new THREE.Vector3());
    if (next.lengthSq() < 1e-12) break;
    axis = next.normalize();
  }
  return axis;
}

// Move two atoms towards (or apart to) distance d; `w` is how much of the
// error to fix in one go.
function pull(a, b, d, w) {
  const between = b.clone().sub(a);
  const r = between.length() || 1e-6;
  between.multiplyScalar((w * (r - d)) / (2 * r));
  a.add(between);
  b.sub(between);
}

// A small seeded random number generator (mulberry32).
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
