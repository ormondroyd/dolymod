// The parts box: element colours and sizes, and the holes drilled into each
// ball (unit vectors in the atom's own frame of reference). As in the real
// kit, every ball has one hole per bond it makes; double and triple bonds are
// two or three flexible links side by side, each in its own hole.
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

const TETRAHEDRAL = [v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)];
const TRIGONAL = [0, 120, 240].map(deg => {
  const r = THREE.MathUtils.degToRad(deg);
  return v(Math.cos(r), Math.sin(r), 0);
});
const BIPYRAMIDAL = [...TRIGONAL, v(0, 0, 1), v(0, 0, -1)];
const OCTAHEDRAL = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)];
const SINGLE = [v(1, 0, 0)];

export const ELEMENTS = {
  H: { name: 'Hydrogen', color: '#f3f3ef', radius: 0.36, mass: 1.008 },
  B: { name: 'Boron', color: '#f2a7a0', radius: 0.45, mass: 10.81 },
  C: { name: 'Carbon', color: '#262626', radius: 0.5, mass: 12.011 },
  N: { name: 'Nitrogen', color: '#2f5fd0', radius: 0.5, mass: 14.007 },
  O: { name: 'Oxygen', color: '#d42a2a', radius: 0.5, mass: 15.999 },
  F: { name: 'Fluorine', color: '#a8dc5c', radius: 0.44, mass: 18.998 },
  Na: { name: 'Sodium', color: '#a7adb5', radius: 0.42, mass: 22.99 },
  Si: { name: 'Silicon', color: '#d9b48f', radius: 0.55, mass: 28.085 },
  P: { name: 'Phosphorus', color: '#9a5bd1', radius: 0.55, mass: 30.974 },
  S: { name: 'Sulfur', color: '#f2c318', radius: 0.55, mass: 32.06 },
  Cl: { name: 'Chlorine', color: '#2e9e4a', radius: 0.5, mass: 35.45 },
  Br: { name: 'Bromine', color: '#8a2b1c', radius: 0.56, mass: 79.904 },
  I: { name: 'Iodine', color: '#4a2370', radius: 0.6, mass: 126.904 },
};

// A new atom always attaches by its first hole. `group` puts it in a section
// of the box; `crystal` atoms line up square to build a salt lattice, and
// `name` overrides the element name on its chip.
export const KINDS = [
  { id: 'H', el: 'H', holes: SINGLE },
  { id: 'C', el: 'C', holes: TETRAHEDRAL },
  { id: 'N', el: 'N', holes: TETRAHEDRAL.slice(0, 3) },
  { id: 'O', el: 'O', holes: TETRAHEDRAL.slice(0, 2) },
  { id: 'S', el: 'S', holes: TETRAHEDRAL.slice(0, 2) },
  { id: 'P', el: 'P', holes: TETRAHEDRAL.slice(0, 3) },
  { id: 'F', el: 'F', holes: SINGLE },
  { id: 'Cl', el: 'Cl', holes: SINGLE },
  { id: 'Br', el: 'Br', holes: SINGLE },
  { id: 'I', el: 'I', holes: SINGLE },
  { id: 'Si', el: 'Si', holes: TETRAHEDRAL },
  { id: 'B', el: 'B', holes: TRIGONAL },
  { id: 'S6', el: 'S', holes: OCTAHEDRAL, group: 'More holes' },
  { id: 'P5', el: 'P', holes: BIPYRAMIDAL, group: 'More holes' },
  { id: 'Na', el: 'Na', holes: OCTAHEDRAL, group: 'Salt crystal', crystal: true },
  { id: 'Cl6', el: 'Cl', holes: OCTAHEDRAL, group: 'Salt crystal', crystal: true, name: 'Chloride' },
];

export const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
