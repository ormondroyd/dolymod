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
  twist one side of the molecule around it, for staggered and eclipsed forms. Bonds in a
  ring, and double or triple bonds, can't twist. Drag empty space to turn the view.
- **Link**: drag from one atom to another (or click both) to join them with a flexible
  link. Use it to close strained rings such as cyclopropane. Join the same two atoms
  again to make the bond double, then triple. A ring that fits exactly, such as chair
  cyclohexane, closes on its own when the last atom goes in.
- **Bond type**: click a bond to add another link: double, then triple, then back to single.
- **Delete**: click an atom or a bond. Deleting an atom also removes the hydrogens on it.
- **Fill with H** puts a hydrogen in every free hole.
- **Naming**: once every hole is filled, the panel names the molecule. The model is
  written as a SMILES string and looked up in [PubChem](https://pubchem.ncbi.nlm.nih.gov),
  so this needs an internet connection. Cis/trans and mirror-image forms aren't told
  apart yet.
- Right-drag to pan, scroll to zoom. Ctrl/⌘ Z undoes.

## The parts box

Every ball has one hole for each bond its element makes, as in the real kit.

| Atom | Holes |
| --- | --- |
| Carbon | 4 |
| Nitrogen, phosphorus | 3 |
| Oxygen, sulfur | 2 |
| Hydrogen, fluorine, chlorine, bromine, iodine | 1 |

A double bond is two flexible links between the same two atoms, each in its own hole,
and a triple bond is three. The atoms turn so the links bend evenly side by side.

## Code

- `index.html`, `style.css`: the page.
- `src/kit.js`: element colours and sizes, and the hole directions for each atom.
- `src/main.js`: the model, the placement rules, rendering and interaction.
- `src/naming.js`: the SMILES writer and PubChem lookup.

Uses [three.js](https://threejs.org) 0.160 from a CDN.

Inspired by physical ball-and-stick kits such as Molymod. Not affiliated with them.
