// Naming: check the model is one molecule, write it as SMILES, and ask
// PubChem what it is called. Hydrogens are written as counts on the atom they
// hang off ([CH3]), so no implicit-valence rules come into it. Every atom has
// one hole per bond, so a model with every hole filled has the right valences.

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/Title,IUPACName/JSON';

const BOND_SYMBOL = ['', '', '=', '#'];
const ringLabel = n => (n < 10 ? String(n) : `%${n}`);

// atoms: [{ id, el }], links: [{ a, b }], with two or three links between the
// same atoms for a double or triple bond. Returns { smiles } or { problem }
// with a sentence saying why the model can't be named yet.
export function toSmiles(atoms, links) {
  const byId = new Map(atoms.map(a => [a.id, a]));
  const pairs = new Map();
  for (const l of links) {
    const key = l.a < l.b ? `${l.a}-${l.b}` : `${l.b}-${l.a}`;
    if (pairs.has(key)) pairs.get(key).order += 1;
    else pairs.set(key, { a: l.a, b: l.b, order: 1 });
  }
  const bonds = [...pairs.values()];
  const bondsOf = new Map(atoms.map(a => [a.id, []]));
  for (const b of bonds) {
    bondsOf.get(b.a).push(b);
    bondsOf.get(b.b).push(b);
  }
  const other = (b, id) => (b.a === id ? b.b : b.a);

  const reached = new Set([atoms[0].id]);
  const queue = [atoms[0].id];
  while (queue.length) {
    const id = queue.pop();
    for (const b of bondsOf.get(id)) {
      const n = other(b, id);
      if (!reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    }
  }
  if (reached.size < atoms.length) return { problem: 'Join the pieces into one molecule to name it' };

  const heavy = atoms.filter(a => a.el !== 'H');
  if (!heavy.length) return { smiles: '[H][H]' };
  const isH = id => byId.get(id).el === 'H';
  const heavyBonds = id => bondsOf.get(id).filter(b => !isH(other(b, id)));

  // Pass 1: a spanning tree over the heavy atoms; any other bond closes a ring.
  const children = new Map();
  const treeBonds = new Set();
  const ringBonds = new Set();
  (function visit(id, via) {
    children.set(id, []);
    for (const b of heavyBonds(id)) {
      if (b === via || treeBonds.has(b)) continue;
      const n = other(b, id);
      if (children.has(n)) {
        ringBonds.add(b);
      } else {
        treeBonds.add(b);
        children.get(id).push([n, b]);
        visit(n, b);
      }
    }
  })(heavy[0].id, null);

  // Pass 2: write the tree in the same order, numbering ring closures.
  const openRings = new Map();
  const closedRings = new Set();
  const spare = [];
  let nextLabel = 1;

  // Close any rings opened earlier, then open the rest. Labels freed here
  // are only reused from the next atom on.
  function ringLabels(id) {
    const mine = heavyBonds(id).filter(b => ringBonds.has(b));
    const freed = [];
    let text = '';
    for (const b of mine) {
      if (!openRings.has(b)) continue;
      text += ringLabel(openRings.get(b));
      freed.push(openRings.get(b));
      openRings.delete(b);
      closedRings.add(b);
    }
    for (const b of mine) {
      if (closedRings.has(b) || openRings.has(b)) continue;
      spare.sort((x, y) => x - y);
      const n = spare.length ? spare.shift() : nextLabel++;
      openRings.set(b, n);
      text += BOND_SYMBOL[b.order] + ringLabel(n);
    }
    spare.push(...freed);
    return text;
  }

  function write(id, via) {
    const h = bondsOf.get(id).filter(b => isH(other(b, id))).length;
    let text = `${via ? BOND_SYMBOL[via.order] : ''}[${byId.get(id).el}${h ? `H${h > 1 ? h : ''}` : ''}]`;
    text += ringLabels(id);
    const kids = children.get(id);
    kids.forEach(([n, b], i) => {
      const branch = write(n, b);
      text += i < kids.length - 1 ? `(${branch})` : branch;
    });
    return text;
  }

  return { smiles: write(heavy[0].id, null) };
}

const cache = new Map();

// Resolves to { cid, title, iupac }, or null when PubChem has no such compound.
export function lookUp(smiles) {
  if (!cache.has(smiles)) {
    const request = fetch(PUBCHEM, { method: 'POST', body: new URLSearchParams({ smiles }) })
      .then(async res => {
        if (res.status === 400 || res.status === 404) return null;
        if (!res.ok) throw new Error(`PubChem answered ${res.status}`);
        const [hit] = (await res.json()).PropertyTable?.Properties ?? [];
        return hit?.CID ? { cid: hit.CID, title: hit.Title, iupac: hit.IUPACName } : null;
      });
    request.catch(() => cache.delete(smiles));
    cache.set(smiles, request);
  }
  return cache.get(smiles);
}
