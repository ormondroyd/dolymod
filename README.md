# Dolymod

A point-and-click ball-and-stick molecular model kit that runs in the browser.
It works like the plastic kits used in chemistry classes: each atom is a coloured
ball with holes drilled at its bond angles, and you build molecules by plugging
atoms into free holes.

## Run it

It is a static page with no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then go to <http://localhost:8000>. (Opening `index.html` straight from disk won't
work, because browsers block ES modules on `file://`.)

## How to use it

- **Build**: pick an atom from the box, then click an atom in the model. The new atom
  snaps into the nearest free hole (it's highlighted, with a preview, before you click).
  Or drag an atom out of the box and drop it onto a hole. On an empty table, click
  anywhere to place the first atom. To start a second piece, drop an atom on empty
  space or Shift-click there.
- **Turn and twist**: drag an atom to turn the whole piece it belongs to. Drag a bond to
  twist one side of the molecule around it, for staggered and eclipsed forms (bonds in
  a ring can't twist). Drag empty space to turn the view.
- **Link**: click two atoms to join them with a flexible link. Use it to close strained
  rings such as cyclopropane. Rings that fit exactly, such as benzene or chair
  cyclohexane, close on their own when the last atom goes in.
- **Bond order**: click a bond to cycle single, double, triple.
- **Delete**: click an atom or a bond. Deleting an atom also removes the hydrogens on it.
- **Fill with H** puts a hydrogen in every free hole.
- **Naming**: once every hole is filled, the panel names the molecule. The model is
  written as a SMILES string and looked up in [PubChem](https://pubchem.ncbi.nlm.nih.gov),
  so this needs an internet connection. If an atom has the wrong number of bonds (a
  trigonal carbon with three single bonds, say), it tells you instead. Cis/trans and
  mirror-image forms aren't told apart yet.
- Right-drag to pan, scroll to zoom. Ctrl/⌘ Z undoes.

## The parts box

| Atom | Holes |
| --- | --- |
| H, F, Cl, Br, I | 1 |
| C | 4 tetrahedral, 3 trigonal, 2 linear |
| N | 3 pyramidal, 2 bent (120°), 4 tetrahedral, 1 |
| O | 2 bent, 1 |
| S | 2 bent, 4 tetrahedral, 6 octahedral |
| P | 4 tetrahedral, 5 trigonal bipyramidal |

## Code

- `index.html`, `style.css`: the page.
- `src/kit.js`: element colours and sizes, and the hole directions for each kind of atom.
- `src/main.js`: the model, the placement rules, rendering and interaction.
- `src/naming.js`: the valence check, SMILES writer and PubChem lookup.

Uses [three.js](https://threejs.org) 0.160 from a CDN.

Inspired by physical ball-and-stick kits such as Molymod. Not affiliated with them.
