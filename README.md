# molecules.fyi

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
- **Delete**: a mode that turns the view's edge red. Hovering an atom or link (or pressing it on a
  touchscreen) shows in red everything a click would remove: an atom with its hydrogens and
  links, or one link. Deleting one link of a double bond leaves a single bond. Undo puts things back.
- **Fill with H** puts a hydrogen in every free hole.
- **Examples**: load one of 61 ready-made models, in ten groups: gases, everyday
  chemicals (water to indigo), food and flavours (caffeine, chocolate's theobromine,
  vanillin, chilli, mint, oranges, sugar, lemons), medicines (aspirin, paracetamol,
  ibuprofen), body chemicals (dopamine, serotonin, adrenaline), acids, poisons
  (nicotine, pufferfish tetrodotoxin, hydrogen cyanide), rings, weird and wonderful
  (cubane, tetrahedrane, propellane, dodecahedrane and more), and crystals and cages
  (cubic salt and diamond; hexagonal diamond, graphite, boron nitride, ice and silica;
  the buckyball). Loading one turns the view to face it; Undo takes you back to what
  you had.
- **Hydrogen bonds**: a hydrogen on an oxygen, nitrogen or fluorine that points at one
  of those in another molecule, at the right distance, shows a dotted line. They are
  what hold ice together. A model of several copies of one molecule shows its formula
  as, say, 21 × H₂O.
- **Saving**: your model is kept in the browser as you build, so it comes back after a
  refresh. **Save** writes it to a `.json` file named after the molecule: in Chrome, Edge
  and on Chromebooks you choose where; other browsers put it in Downloads. **Load** opens
  a saved file.
- **Naming**: once every hole is filled, the panel names the molecule. The model is
  written as a SMILES string and looked up in [PubChem](https://pubchem.ncbi.nlm.nih.gov),
  so this needs an internet connection. Cis/trans and mirror-image forms aren't told
  apart yet.
- **Moving the view**: drag empty space to turn it. Zoom with the mouse wheel, a pinch, the
  + and − buttons or keys. Pan with two fingers, a right-drag, or Shift-drag. Ctrl/⌘ Z
  undoes.
- **Touchscreens**: tap where you would click. While your finger is down on an atom, the
  preview shows where the new atom will go. Drag atoms out of the box with a finger too.

## The parts box

Every ball has one hole for each bond it makes, as in the real kit. The box has three
sections:

| Section | Atom | Holes |
| --- | --- | --- |
| Atoms | Carbon, silicon | 4 |
| | Nitrogen, phosphorus, boron | 3 |
| | Oxygen, sulfur | 2 |
| | Hydrogen, fluorine, chlorine, bromine, iodine | 1 |
| More holes | Sulfur | 6 |
| | Phosphorus | 5 |
| Salt crystal | Sodium, chloride | 6, set square |

Salt-crystal atoms line up square so they build a sodium chloride lattice. A model made
only of them is named as a salt crystal, with its formula as the simplest ratio (NaCl),
and Fill with H leaves them alone.

A double bond is two flexible links between the same two atoms, each in its own hole,
and a triple bond is three. The atoms turn so the links bend evenly side by side.

## Code

- `index.html`, `style.css`: the page. `teachers.html`: notes for teachers (curriculum
  links, activities, privacy).
- `src/kit.js`: element colours and sizes, and the hole directions for each atom.
- `src/main.js`: the model, the placement rules, rendering and interaction.
- `src/naming.js`: the SMILES writer and PubChem lookup.
- `src/examples.js`: the Examples menu: small molecules as build steps, generated
  shapes (cages, the salt crystal, the buckyball), and ring molecules as SMILES.
- `src/layout.js`: reads SMILES (from PubChem), adds the hydrogens, and lays the
  molecule out in 3D by nudging atoms until bond lengths and angles come out right.

Uses [three.js](https://threejs.org) 0.160.0 (MIT licence), kept in `vendor/three/` so
the site needs nothing from other servers except PubChem for naming. Those are three
files from the npm package: `build/three.module.min.js`, and from `examples/jsm/`,
`controls/OrbitControls.js` and `environments/RoomEnvironment.js`.

Inspired by physical ball-and-stick kits such as Molymod. Not affiliated with them.
