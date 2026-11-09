// Ready-made models for the Examples menu.
//
// Small molecules are a `tree`, grown the way you would build them by hand:
// the first atom, then atoms plugged into its free holes in turn, then Fill
// with H. A child is a kind id, or [kind id, ...its children]; "=" or "#" in
// front joins it with a double or triple bond.
//
// Bigger shapes `build` a list of atom positions and links (a pair of atom
// indexes per link, listed twice for a double bond); the kit then turns each
// ball so its holes face its links, and fills the rest with H if `fill` is set.
// `label` names a model PubChem can't, such as a piece of crystal.
import * as THREE from 'three';

const phi = (1 + Math.sqrt(5)) / 2;

export const EXAMPLES = [
  { group: 'Gases', name: 'Hydrogen', tree: ['H', 'H'] },
  { group: 'Gases', name: 'Oxygen', tree: ['O', '=O'] },
  { group: 'Gases', name: 'Nitrogen', tree: ['N', '#N'] },
  { group: 'Gases', name: 'Chlorine', tree: ['Cl', 'Cl'] },
  { group: 'Gases', name: 'Carbon dioxide', tree: ['C', '=O', '=O'] },
  { group: 'Gases', name: 'Methane (natural gas)', tree: ['C'] },
  { group: 'Gases', name: 'Ammonia', tree: ['N'] },
  { group: 'Gases', name: 'Acetylene (welding gas)', tree: ['C', '#C'] },
  { group: 'Gases', name: 'Hydrogen sulfide (rotten eggs)', tree: ['S'] },

  { group: 'Everyday', name: 'Water', tree: ['O'] },
  { group: 'Everyday', name: 'Hydrogen peroxide (hair bleach)', tree: ['O', 'O'] },
  { group: 'Everyday', name: 'Ethanol (alcohol)', tree: ['C', ['C', 'O']] },
  { group: 'Everyday', name: 'Vinegar (acetic acid)', tree: ['C', ['C', '=O', 'O']] },
  { group: 'Everyday', name: 'Acetone (nail polish remover)', tree: ['C', ['C', '=O', 'C']] },
  { group: 'Everyday', name: 'Urea (in urine)', tree: ['C', '=O', 'N', 'N'] },
  { group: 'Everyday', name: 'Propane (gas barbecues)', tree: ['C', ['C', 'C']] },
  { group: 'Everyday', name: 'Butane (lighter fuel)', tree: ['C', ['C', ['C', 'C']]] },
  { group: 'Everyday', name: 'Ethene (ripens fruit)', tree: ['C', '=C'] },
  { group: 'Everyday', name: 'Glycine (an amino acid)', tree: ['N', ['C', ['C', '=O', 'O']]] },

  { group: 'Acids', name: 'Hydrogen chloride (hydrochloric acid)', tree: ['Cl'] },
  { group: 'Acids', name: 'Sulfuric acid (car batteries)', tree: ['S6', '=O', '=O', 'O', 'O'] },
  { group: 'Acids', name: 'Phosphoric acid (in cola)', tree: ['P5', '=O', 'O', 'O', 'O'] },
  { group: 'Acids', name: 'Formic acid (ant stings)', tree: ['C', '=O', 'O'] },

  { group: 'Rings', name: 'Cyclopropane', build: cage(ring(3, 0)), fill: true },
  { group: 'Rings', name: 'Cyclohexane', build: cage(ring(6, 1 / 6)), fill: true },
  { group: 'Rings', name: 'Benzene', build: benzene },

  { group: 'Weird and wonderful', name: 'Cubane (a cube)', build: cage(cube()), fill: true },
  { group: 'Weird and wonderful', name: 'Tetrahedrane (never made!)', build: cage(tetrahedron()), fill: true },
  { group: 'Weird and wonderful', name: 'Prismane (a prism)', build: cage(prism()), fill: true },
  { group: 'Weird and wonderful', name: 'Propellane (inside-out carbons)', build: cage(propeller()), fill: true },
  { group: 'Weird and wonderful', name: 'Dodecahedrane (12 pentagons)', build: cage(dodecahedron()), fill: true },
  { group: 'Weird and wonderful', name: 'Adamantane (a tiny diamond)', build: cage(adamantane()), fill: true },
  { group: 'Weird and wonderful', name: 'Sulfur hexafluoride', tree: ['S6', 'F', 'F', 'F', 'F', 'F', 'F'] },
  { group: 'Weird and wonderful', name: 'Phosphorus pentachloride', tree: ['P5', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'] },
  { group: 'Weird and wonderful', name: 'Hydrogen cyanide (poison)', tree: ['C', '#N'] },

  { group: 'Crystals and cages', name: 'Salt crystal', build: salt },
  { group: 'Crystals and cages', name: 'Diamond chunk', build: cage(diamond()), label: 'Diamond (a chunk of the crystal)' },
  { group: 'Crystals and cages', name: 'Buckyball (C₆₀)', build: buckyball },
];

// Carbon frameworks: points one unit apart are linked, and the whole shape is
// scaled so that a unit is one carbon-carbon link.
function cage(points) {
  return length => {
    const scale = length('C', 'C');
    const atoms = points.map(p => ({ kind: 'C', p: new THREE.Vector3(...p).multiplyScalar(scale) }));
    const links = [];
    points.forEach((p, i) => points.forEach((q, j) => {
      if (j > i && Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - 1) < 1e-6) links.push([i, j]);
    }));
    return { atoms, links };
  };
}

// The points of a shape whose edges are `edge` long, rescaled to edges of 1.
function unit(points, edge) {
  return points.map(p => p.map(x => x / edge));
}

// A ring of n carbons with unit sides; `pucker` lifts alternate atoms up and
// down (1/6 gives the strain-free chair shape of cyclohexane).
function ring(n, pucker) {
  const radius = Math.sqrt(1 - 4 * pucker * pucker) / (2 * Math.sin(Math.PI / n));
  return Array.from({ length: n }, (_, k) => {
    const angle = (2 * Math.PI * k) / n;
    return [radius * Math.cos(angle), radius * Math.sin(angle), k % 2 ? -pucker : pucker];
  });
}

function cube() {
  const points = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push([x, y, z]);
  return unit(points, 2);
}

function tetrahedron() {
  return unit([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 2 * Math.SQRT2);
}

// Two triangles, one above the other.
function prism() {
  const triangle = ring(3, 0);
  return [...triangle.map(([x, y]) => [x, y, 0.5]), ...triangle.map(([x, y]) => [x, y, -0.5])];
}

// [1.1.1]Propellane: two carbons joined straight through the middle of a
// three-bladed cage, so all four of their links point to one side.
function propeller() {
  const r = Math.sqrt(3) / 2;
  const blades = [0, 1, 2].map(k => [r * Math.cos((2 * Math.PI * k) / 3), r * Math.sin((2 * Math.PI * k) / 3), 0]);
  return [[0, 0, 0.5], [0, 0, -0.5], ...blades];
}

function dodecahedron() {
  const points = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push([x, y, z]);
  for (const a of [-1 / phi, 1 / phi]) {
    for (const b of [-phi, phi]) points.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  return unit(points, 2 / phi);
}

// Adamantane: four CH corners of a tetrahedron, bridged by six CH2 groups.
function adamantane() {
  const corners = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const bridges = [[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]];
  return unit([...corners, ...bridges], Math.sqrt(3));
}

// A ball of diamond: every carbon within about two links of the middle one,
// cut from the diamond lattice. Its outside holes are left open.
function diamond() {
  const cell = 4 / Math.sqrt(3);
  const sites = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
  const points = [];
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) {
        for (const [a, b, c] of sites) {
          for (const shift of [0, 0.25]) {
            const p = [x + a + shift, y + b + shift, z + c + shift].map(v => v * cell);
            if (Math.hypot(...p) < 2.1) points.push(p);
          }
        }
      }
    }
  }
  return points;
}

// `length(a, b)` is the kit's centre-to-centre distance for two kinds of atom.

function benzene(length) {
  const ring = length('C', 'C');
  const reach = ring + length('C', 'H');
  const atoms = [];
  const links = [];
  for (let k = 0; k < 6; k++) {
    const angle = (k * Math.PI) / 3;
    const out = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    atoms[k] = { kind: 'C', p: out.clone().multiplyScalar(ring) };
    atoms[6 + k] = { kind: 'H', p: out.clone().multiplyScalar(reach) };
    links.push([k, (k + 1) % 6], [k, 6 + k]);
    if (k % 2 === 0) links.push([k, (k + 1) % 6]);
  }
  return { atoms, links };
}

// A 4 x 4 x 4 cube of alternating sodium and chloride: 32 of each.
function salt(length) {
  const n = 4;
  const step = length('Na', 'Cl6');
  const middle = ((n - 1) * step) / 2;
  const index = (x, y, z) => (x * n + y) * n + z;
  const atoms = [];
  const links = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        const p = new THREE.Vector3(x, y, z).multiplyScalar(step).subScalar(middle);
        atoms[index(x, y, z)] = { kind: (x + y + z) % 2 ? 'Cl6' : 'Na', p };
        if (x + 1 < n) links.push([index(x, y, z), index(x + 1, y, z)]);
        if (y + 1 < n) links.push([index(x, y, z), index(x, y + 1, z)]);
        if (z + 1 < n) links.push([index(x, y, z), index(x, y, z + 1)]);
      }
    }
  }
  return { atoms, links };
}

// Buckminsterfullerene: 60 carbons at the corners of a truncated icosahedron
// (12 pentagons, 20 hexagons). Each carbon has two single bonds and one double,
// so all four holes are used. The double bonds are the 30 edges shared by two
// hexagons: at each carbon, the two bonds meeting at the narrower pentagon
// angle are the single ones.
function buckyball(length) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const edge = length('C', 'C');
  const points = [];
  // The corners are the even permutations of these, with every sign, for an
  // edge of 2; scaled to the kit's carbon-carbon length.
  for (const [a, b, c] of [[0, 1, 3 * phi], [1, 2 + phi, 2 * phi], [phi, 2, phi ** 3]]) {
    for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]]) {
      for (const sx of x ? [1, -1] : [1]) {
        for (const sy of y ? [1, -1] : [1]) {
          for (const sz of z ? [1, -1] : [1]) {
            points.push(new THREE.Vector3(sx * x, sy * y, sz * z).multiplyScalar(edge / 2));
          }
        }
      }
    }
  }
  const neighbours = points.map((p, i) =>
    points.flatMap((q, j) => (j !== i && Math.abs(p.distanceTo(q) - edge) < 1e-6 ? [j] : [])));
  const doubleTo = points.map((p, i) => {
    const [a, b, c] = neighbours[i];
    const angle = (j, k) => points[j].clone().sub(p).angleTo(points[k].clone().sub(p));
    const pairs = [[angle(a, b), c], [angle(a, c), b], [angle(b, c), a]];
    return pairs.sort((x, y) => x[0] - y[0])[0][1];
  });
  const links = [];
  neighbours.forEach((list, i) => list.forEach(j => {
    if (j < i) return;
    links.push([i, j]);
    if (doubleTo[i] === j) links.push([i, j]);
  }));
  return { atoms: points.map(p => ({ kind: 'C', p })), links };
}
