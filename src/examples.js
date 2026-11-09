// Ready-made models for the Examples menu.
//
// Small molecules are a `tree`, grown the way you would build them by hand:
// the first atom, then atoms plugged into its free holes in turn, then Fill
// with H. A child is a kind id, or [kind id, ...its children]; "=" or "#" in
// front joins it with a double or triple bond.
//
// Bigger shapes `build` a list of atom positions and links (a pair of atom
// indexes per link, listed twice for a double bond); the kit then turns each
// ball so its holes face its links.
import * as THREE from 'three';

export const EXAMPLES = [
  { group: 'Basics', name: 'Water', tree: ['O'] },
  { group: 'Basics', name: 'Oxygen gas', tree: ['O', '=O'] },
  { group: 'Basics', name: 'Carbon dioxide', tree: ['C', '=O', '=O'] },
  { group: 'Basics', name: 'Ammonia', tree: ['N'] },
  { group: 'Basics', name: 'Methane', tree: ['C'] },
  { group: 'Basics', name: 'Ethanol', tree: ['C', ['C', 'O']] },
  { group: 'Basics', name: 'Ethene', tree: ['C', '=C'] },
  { group: 'Basics', name: 'Vinegar (acetic acid)', tree: ['C', ['C', '=O', 'O']] },
  { group: 'Shapes', name: 'Benzene ring', build: benzene },
  { group: 'Shapes', name: 'Salt crystal', build: salt },
  { group: 'Shapes', name: 'Buckyball (C₆₀)', build: buckyball },
];

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
