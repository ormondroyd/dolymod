// The parts box: element colours and sizes, and the holes drilled into each
// kind of ball (unit vectors in the atom's own frame of reference).
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

const TETRAHEDRAL = [v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)];
const TRIGONAL = [0, 120, 240].map(deg => {
  const r = THREE.MathUtils.degToRad(deg);
  return v(Math.cos(r), Math.sin(r), 0);
});
const LINEAR = [v(1, 0, 0), v(-1, 0, 0)];
const OCTAHEDRAL = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)];
const BIPYRAMIDAL = [...TRIGONAL, v(0, 0, 1), v(0, 0, -1)];
const SINGLE = [v(1, 0, 0)];

// `valence` lists the bond totals (double bonds count 2) that make a neutral
// atom; an atom with `cation` bonds is written as a +1 ion (ammonium).
export const ELEMENTS = {
  H: { name: 'Hydrogen', color: '#f3f3ef', radius: 0.36, mass: 1.008, valence: [1] },
  C: { name: 'Carbon', color: '#262626', radius: 0.5, mass: 12.011, valence: [4] },
  N: { name: 'Nitrogen', color: '#2f5fd0', radius: 0.5, mass: 14.007, valence: [3], cation: 4 },
  O: { name: 'Oxygen', color: '#d42a2a', radius: 0.5, mass: 15.999, valence: [2] },
  F: { name: 'Fluorine', color: '#a8dc5c', radius: 0.44, mass: 18.998, valence: [1] },
  P: { name: 'Phosphorus', color: '#9a5bd1', radius: 0.55, mass: 30.974, valence: [3, 5], cation: 4 },
  S: { name: 'Sulfur', color: '#f2c318', radius: 0.55, mass: 32.06, valence: [2, 4, 6] },
  Cl: { name: 'Chlorine', color: '#2e9e4a', radius: 0.5, mass: 35.45, valence: [1] },
  Br: { name: 'Bromine', color: '#8a2b1c', radius: 0.56, mass: 79.904, valence: [1] },
  I: { name: 'Iodine', color: '#4a2370', radius: 0.6, mass: 126.904, valence: [1] },
};

// A new atom always attaches by its first hole. `planar` kinds keep their
// neighbours in one plane (alkenes, aromatic rings) instead of staggering them.
export const KINDS = [
  { id: 'H', el: 'H', holes: SINGLE },
  { id: 'C4', el: 'C', holes: TETRAHEDRAL },
  { id: 'C3', el: 'C', holes: TRIGONAL, planar: true },
  { id: 'C2', el: 'C', holes: LINEAR },
  { id: 'N4', el: 'N', holes: TETRAHEDRAL },
  { id: 'N3', el: 'N', holes: TETRAHEDRAL.slice(0, 3) },
  { id: 'N2', el: 'N', holes: TRIGONAL.slice(0, 2), planar: true },
  { id: 'N1', el: 'N', holes: SINGLE },
  { id: 'O2', el: 'O', holes: TETRAHEDRAL.slice(0, 2) },
  { id: 'O1', el: 'O', holes: SINGLE },
  { id: 'S6', el: 'S', holes: OCTAHEDRAL },
  { id: 'S4', el: 'S', holes: TETRAHEDRAL },
  { id: 'S2', el: 'S', holes: TETRAHEDRAL.slice(0, 2) },
  { id: 'P5', el: 'P', holes: BIPYRAMIDAL },
  { id: 'P4', el: 'P', holes: TETRAHEDRAL },
  { id: 'F', el: 'F', holes: SINGLE },
  { id: 'Cl', el: 'Cl', holes: SINGLE },
  { id: 'Br', el: 'Br', holes: SINGLE },
  { id: 'I', el: 'I', holes: SINGLE },
];

export const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
