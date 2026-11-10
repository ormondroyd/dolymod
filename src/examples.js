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
// `label` names a model PubChem can't, such as a piece of crystal, and `view`
// is the direction to look from when it loads (face on by default). Molecules
// with rings are written as SMILES (from PubChem) and laid out by layout.js.
import * as THREE from 'three';
import { fromSmiles } from './layout.js';

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
  { group: 'Everyday', name: 'Indigo (blue jeans dye)', build: fromSmiles('C1=CC=C2C(=C1)C(=C(N2)C3=NC4=CC=CC=C4C3=O)O') },

  { group: 'Food and flavours', name: 'Caffeine (coffee)', build: fromSmiles('CN1C=NC2=C1C(=O)N(C(=O)N2C)C') },
  { group: 'Food and flavours', name: 'Theobromine (chocolate)', build: fromSmiles('CN1C=NC2=C1C(=O)NC(=O)N2C') },
  { group: 'Food and flavours', name: 'Vanillin (vanilla)', build: fromSmiles('COC1=C(C=CC(=C1)C=O)O') },
  { group: 'Food and flavours', name: 'Capsaicin (chilli heat)', build: fromSmiles('CC(C)C=CCCCCC(=O)NCC1=CC(=C(C=C1)O)OC'), label: 'Capsaicin' },
  { group: 'Food and flavours', name: 'Menthol (mint)', build: fromSmiles('CC1CCC(C(C1)O)C(C)C') },
  { group: 'Food and flavours', name: 'Limonene (oranges)', build: fromSmiles('CC1=CCC(CC1)C(=C)C'), label: 'Limonene' },
  { group: 'Food and flavours', name: 'Glucose (sugar)', build: fromSmiles('C(C1C(C(C(C(O1)O)O)O)O)O'), label: 'Glucose' },
  { group: 'Food and flavours', name: 'Citric acid (lemons)', build: fromSmiles('C(C(=O)O)C(CC(=O)O)(C(=O)O)O') },

  { group: 'Medicines', name: 'Aspirin', build: fromSmiles('CC(=O)OC1=CC=CC=C1C(=O)O') },
  { group: 'Medicines', name: 'Paracetamol', build: fromSmiles('CC(=O)NC1=CC=C(C=C1)O'), label: 'Paracetamol' },
  { group: 'Medicines', name: 'Ibuprofen', build: fromSmiles('CC(C)CC1=CC=C(C=C1)C(C)C(=O)O'), label: 'Ibuprofen' },

  { group: 'Body chemicals', name: 'Dopamine (reward)', build: fromSmiles('C1=CC(=C(C=C1CCN)O)O') },
  { group: 'Body chemicals', name: 'Serotonin (mood)', build: fromSmiles('C1=CC2=C(C=C1O)C(=CN2)CCN') },
  { group: 'Body chemicals', name: 'Adrenaline (fight or flight)', build: fromSmiles('CNCC(C1=CC(=C(C=C1)O)O)O'), label: 'Adrenaline' },

  { group: 'Acids', name: 'Hydrogen chloride (hydrochloric acid)', tree: ['Cl'] },
  { group: 'Acids', name: 'Sulfuric acid (car batteries)', tree: ['S6', '=O', '=O', 'O', 'O'] },
  { group: 'Acids', name: 'Phosphoric acid (in cola)', tree: ['P5', '=O', 'O', 'O', 'O'] },
  { group: 'Acids', name: 'Formic acid (ant stings)', tree: ['C', '=O', 'O'] },

  { group: 'Poisons', name: 'Nicotine (tobacco)', build: fromSmiles('CN1CCCC1C2=CN=CC=C2'), label: 'Nicotine' },
  { group: 'Poisons', name: 'Tetrodotoxin (pufferfish)', build: fromSmiles('C(C1(C2C3C(N=C(NC34C(C1OC(C4O)(O2)O)O)N)O)O)O'), label: 'Tetrodotoxin' },
  { group: 'Poisons', name: 'Hydrogen cyanide', tree: ['C', '#N'] },

  { group: 'Rings', name: 'Cyclopropane', build: cage(ring(3, 0)), fill: true },
  { group: 'Rings', name: 'Cyclohexane', build: cage(ring(6, 1 / 6)), fill: true },
  { group: 'Rings', name: 'Benzene', build: benzene },
  { group: 'Rings', name: 'Naphthalene (mothballs)', build: fromSmiles('C1=CC=C2C=CC=CC2=C1') },

  { group: 'Weird and wonderful', name: 'Cubane (a cube)', build: cage(cube()), fill: true },
  { group: 'Weird and wonderful', name: 'Tetrahedrane (never made!)', build: cage(tetrahedron()), fill: true },
  { group: 'Weird and wonderful', name: 'Prismane (a prism)', build: cage(prism()), fill: true },
  { group: 'Weird and wonderful', name: 'Propellane (inside-out carbons)', build: cage(propeller()), fill: true },
  { group: 'Weird and wonderful', name: 'Dodecahedrane (12 pentagons)', build: cage(dodecahedron()), fill: true },
  { group: 'Weird and wonderful', name: 'Adamantane (a tiny diamond)', build: cage(adamantane()), fill: true },
  { group: 'Weird and wonderful', name: 'Sulfur hexafluoride', tree: ['S6', 'F', 'F', 'F', 'F', 'F', 'F'] },
  { group: 'Weird and wonderful', name: 'Phosphorus pentachloride', tree: ['P5', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'] },

  { group: 'Crystals and cages', name: 'Salt crystal (cubic)', build: salt },
  { group: 'Crystals and cages', name: 'Diamond chunk (cubic)', build: cage(diamond()), label: 'Diamond (a chunk of the crystal)' },
  { group: 'Crystals and cages', name: 'Hexagonal diamond (from meteorites)', build: lonsdaleite, label: 'Hexagonal diamond (lonsdaleite)' },
  { group: 'Crystals and cages', name: 'Graphite (pencil lead, layers)', build: graphite, label: 'Graphite (three layers)', view: [0, -1, 0.5] },
  { group: 'Crystals and cages', name: 'Boron nitride (white graphite)', build: boronNitride, label: 'Boron nitride (two layers)', view: [0, -1, 0.5] },
  { group: 'Crystals and cages', name: 'Ice (hexagonal, like snowflakes)', build: ice, label: 'Ice (water molecules held by hydrogen bonds)' },
  { group: 'Crystals and cages', name: 'Silica (sand and glass)', build: silica, label: 'Silica, SiO₂ (tridymite crystal)' },
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

// ---- Non-cubic crystals ----

// Link every pair of atoms that sits one kit link apart.
function connect(atoms, length) {
  const links = [];
  atoms.forEach((a, i) => atoms.forEach((b, j) => {
    if (j > i && Math.abs(a.p.distanceTo(b.p) - length(a.kind, b.kind)) < 0.05) links.push([i, j]);
  }));
  return { atoms, links };
}

// Wurtzite: the hexagonal cousin of the diamond lattice. Every site has four
// neighbours `bond` apart, at the tetrahedral angle. Returns the sites within
// `radius` of the middle, each with the directions to all four neighbours
// (including any cut off at the edge).
function wurtzite(bond, radius) {
  const a = bond * Math.sqrt(8 / 3);
  const c = a * Math.sqrt(8 / 3);
  const cell = (f1, f2, f3) => new THREE.Vector3(a * f1 - (a / 2) * f2, ((a * Math.sqrt(3)) / 2) * f2, c * f3);
  const sites = [];
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      for (let k = -3; k <= 3; k++) {
        for (const [f1, f2, f3] of [[0, 0, 0], [1 / 3, 2 / 3, 1 / 2], [0, 0, 3 / 8], [1 / 3, 2 / 3, 7 / 8]]) {
          sites.push(cell(i + f1, j + f2, k + f3 - 7 / 16));
        }
      }
    }
  }
  return sites
    .filter(p => p.length() < radius)
    .map(p => ({
      p,
      out: sites.filter(q => Math.abs(q.distanceTo(p) - bond) < 1e-6).map(q => q.clone().sub(p).normalize()),
    }));
}

// Honeycomb sheets, `layers` of them `gap` apart, each shifted by one bond
// from the one below (or, with `swap`, stacked with the two kinds swapped).
function honeycomb(bond, radius, layers, gap, kinds, swap = false) {
  const a1 = new THREE.Vector3(Math.sqrt(3) * bond, 0, 0);
  const a2 = new THREE.Vector3((Math.sqrt(3) / 2) * bond, 1.5 * bond, 0);
  const atoms = [];
  for (let layer = 0; layer < layers; layer++) {
    const z = (layer - (layers - 1) / 2) * gap;
    const shift = swap ? 0 : layer % 2;
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        [0, 1].forEach(b => {
          const p = a1.clone().multiplyScalar(i).addScaledVector(a2, j).add(new THREE.Vector3(0, (b + shift) * bond - bond / 2, z));
          if (Math.hypot(p.x, p.y) < radius) atoms.push({ kind: kinds[swap ? (b + layer) % 2 : b], p });
        });
      }
    }
  }
  return atoms;
}

function lonsdaleite(length) {
  const bond = length('C', 'C');
  return connect(wurtzite(bond, 2.3 * bond).map(({ p }) => ({ kind: 'C', p })), length);
}

// Graphite: carbon sheets. Each carbon links to three others in its sheet;
// its fourth hole stays free, and the sheets slide over each other.
function graphite(length) {
  const bond = length('C', 'C');
  return connect(honeycomb(bond, 2.6 * bond, 3, 2.36 * bond, ['C', 'C']), length);
}

function boronNitride(length) {
  const bond = length('B', 'N');
  return connect(honeycomb(bond, 2.6 * bond, 2, 2.3 * bond, ['B', 'N'], true), length);
}

// Silica (tridymite): silicon atoms on the wurtzite lattice, each joined to
// four others through an oxygen.
function silica(length) {
  const reach = length('Si', 'O');
  const silicons = wurtzite(2 * reach, 4.6 * reach).map(({ p }) => ({ kind: 'Si', p }));
  const oxygens = [];
  silicons.forEach((a, i) => silicons.forEach((b, j) => {
    if (j > i && Math.abs(a.p.distanceTo(b.p) - 2 * reach) < 1e-6) {
      oxygens.push({ kind: 'O', p: a.p.clone().add(b.p).multiplyScalar(0.5) });
    }
  }));
  return connect([...silicons, ...oxygens], length);
}

// Ice: each oxygen sits on the wurtzite lattice with its two hydrogens
// pointing at two of its four neighbours. No oxygen takes more than two
// hydrogens from its neighbours, so every water keeps two of its own; at the
// edge they may point outwards. The hydrogen bonds themselves aren't links:
// the kit draws them as dots.
function ice(length) {
  const oh = length('O', 'H');
  const spacing = oh * (2.76 / 0.96); // O...O over O-H, in real ice
  const waters = wurtzite(spacing, 1.9 * spacing);
  const neighbour = (i, d) => waters.findIndex(w => w.p.distanceTo(waters[i].p.clone().addScaledVector(d, spacing)) < 1e-6);
  const taken = new Set();
  const received = waters.map(() => 0);
  const atoms = waters.map(({ p }) => ({ kind: 'O', p }));
  const links = [];
  waters.forEach(({ p, out }, i) => {
    const options = out.map(d => ({ d, j: neighbour(i, d) })).filter(({ j }) => !taken.has(`${i}-${j}`));
    const rank = ({ j }) => (j < 0 ? 1 : received[j] < 2 ? 0 : 2);
    options.sort((x, y) => rank(x) - rank(y));
    for (const { d, j } of options.slice(0, 2)) {
      if (j >= 0) {
        taken.add(`${i}-${j}`).add(`${j}-${i}`);
        received[j]++;
      }
      links.push([i, atoms.push({ kind: 'H', p: p.clone().addScaledVector(d, oh) }) - 1]);
    }
  });
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
