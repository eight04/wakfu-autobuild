const camelcase = require("camelcase");
const {getItems} = require("./items.js");
const {getMajorItems} = require("./major.js");
const {product, combination, count, flat} = require("./util.js");
const {Alternative} = require("./alternative.js");

function createDamageContributor({
  elements = 1,
  baseAp = 6,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  secondMasteries = [],
  apToDamage = false,
  rangeToDamage = false
} = {}) {
  return {
    calcItemFactor,
    overpower,
    calcScore,
    createFactor,
    stackFactor,
  };
  
  function stackFactor(a, b) {
    a.mastery += b.mastery;
    a.criticalHit += b.criticalHit;
    a.criticalMastery += b.criticalMastery;
    a.damageInflicted += b.damageInflicted;
    a.ap += b.ap;
  }
  
  function overpower(a, b) {
    return a.criticalHit >= b.criticalHit &&
      a.mastery >= b.mastery &&
      a.criticalMastery >= b.criticalMastery &&
      a.ap >= b.ap &&
      a.damageInflicted >= b.damageInflicted;
  }
  
  function createFactor() {
    return {
      mastery: 0,
      criticalHit: 0,
      criticalMastery: 0,
      damageInflicted: 0,
      ap: 0
    };
  }
  
  function calcItemFactor(item) {
    const factors = createFactor();
    
    for (const [name, params] of item.effects) {
      if (name === "elementalMastery") {
        if (params.length === 1) {
          params.push(4);
        }
        factors.mastery += params[1] >= elements ? params[0] : Math.floor(params[0] * params[1] / elements);
        continue;
      }
      
      if (secondMasteries.includes(name)) {
        factors.mastery += params[0];
        continue;
      }
      
      if (name === "criticalHit" || name === "criticalMastery" || name === "damageInflicted") {
        factors[name] += params[0];
        continue;
      }
      
      if (name === "ap" && apToDamage) {
        factors.ap += params[0];
        continue;
      }
      
      if (name === "range" && rangeToDamage) {
        factors.damageInflicted += params[0] * 3;
        continue;
      }
    }
    
    factors.criticalMastery += factors.mastery;
    return factors;
  }
  
  function calcScore(factor) {
    const mastery = 100 + baseMastery + factor.mastery;
    const criticalMastery = 100 + baseMastery + baseCriticalMastery + factor.criticalMastery;
    const criticalHit = Math.min(Math.max(baseCriticalHit + factor.criticalHit, 0), 100);
    const ap = baseAp + factor.ap;
    const damageInflicted = 100 + baseDamageInflicted + factor.damageInflicted;
    
    return (mastery * (100 - criticalHit) + criticalMastery * criticalHit * 1.25) / 100 * ap / 6 * damageInflicted / 100;
  }
}

async function solve({
  elements = 1,
  level = 1,
  
  requires = [],
  secondMasteries = [],
  
  apToDamage = false,
  rangeToDamage = false,

  baseAp = 6,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  
  disableCategories = [],
  disableItems = [],
  useItems = [],
  
  onPieceGenerated = () => {},
  onProgress = () => {},
  
  items = null,
  major = 0,
  poolSize = 5000
} = {}) {
  const DEFAULT_CONTRIBUTE = Array(requires.length).fill(0);
  
  secondMasteries = secondMasteries.map(s => `${s}Mastery`);
  items = items || await getItems();
  
  if (major) {
    items = items.concat(getMajorItems());
  }
  
  const types = new Map;
  
  const damageContributor = createDamageContributor({
    elements,
    baseAp,
    baseMastery,
    baseCriticalHit,
    baseCriticalMastery,
    baseDamageInflicted,
    secondMasteries,
    apToDamage,
    rangeToDamage
  });
  
  const includedItems = [];
  
  for (const item of items) {
    if (item.level > level) {
      continue;
    }
    if (item.type === "PET") {
      // data doesn't contain useful stat for pets
      continue;
    }
    if (item.type === "COSTUME") {
      continue;
    }
    if (!item.type) continue; // sublimation?
    
    if (disableCategories.includes(camelcase(item.type))) {
      continue;
    }
    if (disableItems.includes(item.id)) {
      continue;
    }
    if (useItems.includes(item.id)) {
      includedItems.push(item);
      continue;
    }
    
    let list = types.get(item.type);
    if (!list) {
      list = [];
      types.set(item.type, list);
    }
    
    list.push(itemToSet(item));
  }
  
  for (const [key, list] of types) {
    let count = key === "RING" ? 2 :
      key === "MAJOR" ? major :
      1;
      
    count -= includedItems.filter(i => i.type === key).length;
    
    if (count <= 0) {
      types.delete(key);
      continue;
    }

    types.set(key, concatSet(
      [new Set, new Set, new Set, new Set],
      list,
      count - 1
    ));
  }
  
  onPieceGenerated(types);
  
  let weapon;
  if (!includedItems.find(i => i.type === "HEAVY_WEAPON")) {
    weapon = types.get("FIRST_WEAPON");
  }
  types.delete("FIRST_WEAPON");
  
  if (types.has("SECOND_WEAPON") && !includedItems.find(i => i.type === "HEAVY_WEAPON")) {
    if (weapon) {
      weapon = createNewSetList(product(weapon, types.get("SECOND_WEAPON")));
    } else {
      weapon = types.get("SECOND_WEAPON");
    }
  }
  types.delete("SECOND_WEAPON");
  
  if (types.has("HEAVY_WEAPON") && !includedItems.find(i => i.type === "FIRST_WEAPON" || i.type === "SECOND_WEAPON")) {
    if (weapon) {
      weapon = concatSet(weapon, flat(types.get("HEAVY_WEAPON")));
    } else {
      weapon = types.get("HEAVY_WEAPON");
    }
  }
  types.delete("HEAVY_WEAPON");
  
  if (weapon) {
    types.set("WEAPON", weapon);
  }
  
  if (types.has("RING")) {
    const count = 2 - includedItems.filter(i => i.type === "RING").length;
    types.set("RING", createNewSetList(combination(flat(types.get("RING")), count)));
  }
  
  if (types.has("MAJOR")) {
    const count = major - includedItems.filter(i => i.type === "MAJOR").length;
    types.set("MAJOR", createNewSetList(combination(flat(types.get("MAJOR")), count)));
  }
  
  if (includedItems.length) {
    types.set("INCLUDED", createNewSetList([includedItems.map(itemToSet)]));
  }
  
  // NOTE: by processing high stat items first, we can keep left side as small as possible.
  // there is a higher chance that a set will be covered by another.
  const queue = ["INCLUDED", "WEAPON", "HEAD", "BACK", "SHOULDERS", "CHEST", "BELT", "LEGS", "NECK", "RING", "ACCESSORY", "MAJOR"]
    .map(name => [name, types.get(name)])
    .filter(c => c[1]);
  
  const contributeTable = createContributeTable(queue.map(c => c[1]), DEFAULT_CONTRIBUTE);
  
  for (let i = 0; i < queue.length - 1; i++) {
    // console.log(queue[i][1].map(c => c.size));
    // remove no future sets
    for (let cateIndex = 0; cateIndex < queue[i][1].length; cateIndex++) {
      const cate = queue[i][1][cateIndex];
      const futureContribute = contributeTable.lookup(i + 1, cateIndex);
      for (const set of cate) {
        if (futureContribute.some((value, i) => value + set.contribute[i] < requires[i][1])) {
          cate.delete(set);
        }
      }
    }
    
    const newTag = `${queue[i][0]}/${queue[i + 1][0]}`;
    
    onProgress(queue[i], queue[i + 1]);
    
    const result = createNewSetList(product(queue[i][1], queue[i + 1][1]), i >= queue.length - 2);
    queue[i + 1] = [newTag, result];
  }
    
  let score = 0;
  let result;
  for (const set of flat(queue.pop()[1])) {
    // console.log(set);
    if (set.contribute.some((value, i) => value < requires[i][1])) continue;
    const newScore = damageContributor.calcScore(set.contributeDamage);
    if (newScore > score) {
      score = newScore;
      result = set;
    }
  }
  
  return {
    score,
    items: [...collectItems(result)]
  };
  
  function itemToSet(item) {
    const set = createSet();
    set.contributeDamage = damageContributor.calcItemFactor(item),
    set.contribute = requires.map(([name]) => {
      let value = 0;
      for (const [effectName, params] of item.effects) {
        if (effectName === name) value += params[0];
      }
      return value;
    });
    set.pieces = [item];
    set.epic = item.rarity === 7;
    set.relic = item.rarity === 5;
    return set;
  }
  
  function *collectItems(set, ignoreAlter = false) {
    if (!set.alter) {
      yield set;
      return;
    }
    
    if (!set.alter.length || ignoreAlter) {
      for (const subSet of set.pieces) {
        yield* collectItems(subSet);
      }
      return;
    }
    
    const alterGroup = Alternative.from([
      [...collectItems(set, true)],
      ...set.alter.map(alterSet => [...collectItems(alterSet)])
    ]);
    yield* alterGroup.reduce();
    if (alterGroup.length) {
      yield alterGroup;
    }
  }
  
  function addSet(target, newSet, maxCovered = 0, simpleAdd = false) {
    const cateIndex = newSet.relic + newSet.epic * 2;
    if (target[cateIndex].size < poolSize && !simpleAdd) {
      if (maybeDropSet(target[cateIndex])) {
        return;
      }
    }
    target[cateIndex].add(newSet);
    
    function maybeDropSet(list) {
      for (const oldSet of list) {
        if (overpower(newSet, oldSet)) {
          oldSet.covered++;
          if (oldSet.covered > maxCovered) {
            list.delete(oldSet);
          }
          if (overpower(oldSet, newSet)) {
            newSet.alter.push(oldSet);
          }
        } else if (overpower(oldSet, newSet)) {
          newSet.covered++;
          if (newSet.covered > maxCovered) {
            return true;
          }
        }
      }
      return false;
    }
  }
  
  function concatSet(target, pending, maxCovered = 0) {
    for (const newSet of pending) {
      addSet(target, newSet, maxCovered);
    }
    return target;
  }
  
  function makeSetFromPieces(pieces) {
    const relicCount = count(pieces, p => p.relic);
    const epicCount = count(pieces, p => p.epic);
    if (relicCount > 1 || epicCount > 1) return null;
    
    const newSet = createSet();
    
    newSet.contributeDamage = pieces.reduce((f, p) => {
      damageContributor.stackFactor(f, p.contributeDamage);
      return f;
    }, damageContributor.createFactor());
    
    newSet.contribute = pieces.reduce((c, p) => {
      for (let i = 0; i < c.length; i++) {
        c[i] += p.contribute[i];
      }
      return c;
    }, DEFAULT_CONTRIBUTE.slice());
    
    newSet.pieces = pieces;
    newSet.relic = Boolean(relicCount);
    newSet.epic = Boolean(epicCount);
    
    return newSet;
  }
  
  function createNewSetList(listOfPieces, simpleAdd = false) {
    const result = [new Set, new Set, new Set, new Set];
    // FIXME: no output (result.size === 0) if there is no valid new set?
    for (const pieces of listOfPieces) {
      const newSet = makeSetFromPieces(pieces);
      if (newSet) {
        addSet(result, newSet, 0, simpleAdd);
      }
    }
    return result;
  }
  
  function createSet() {
    return {
      contributeDamage: null,
      contribute: null,
      color: 0,
      relic: false,
      epic: false,
      pieces: null,
      covered: 0,
      alter: [],
    };
  }
  
  function overpower(a, b) {
    if (!damageContributor.overpower(a.contributeDamage, b.contributeDamage)) {
      return false;
    }
    return a.contribute.every((value, i) => value >= b.contribute[i]);
  }
}

function createContributeTable(queue, DEFAULT_CONTRIBUTE) {
  const contributeTable = Array(queue.length); // index > relic > epic
  
  for (let i = 0; i < queue.length; i++) {
    for (const piece of flat(queue[i])) {
      fillTable(i, piece);
    }
  }
  
  for (let i = queue.length - 1; i > 0; i--) {
    for (let j = 0; j < 4; j++) {
      const left = lookup(i - 1, j);
      const right = lookup(i, j);
      stackContribute(left, right);
    }
  }
  
  return {lookup};
  
  function stackContribute(base, extra) {
    for (let i = 0; i < base.length; i++) {
      base[i] += extra[i];
    }
  }
  
  function createContribute(index, cateIndex) {
    if (!contributeTable[index]) {
      contributeTable[index] = [
        DEFAULT_CONTRIBUTE.slice(),
        DEFAULT_CONTRIBUTE.slice(),
        DEFAULT_CONTRIBUTE.slice(),
        DEFAULT_CONTRIBUTE.slice()
      ];
    }
    return contributeTable[index][cateIndex];
  }
  
  function fillTable(index, piece) {
    for (const hasRelic of [true, false]) {
      for (const hasEpic of [true, false]) {
        if (hasRelic && piece.relic || hasEpic && piece.epic) continue;
        const contribute = createContribute(index, hasRelic + hasEpic * 2);
        for (let j = 0; j < contribute.length; j++) {
          contribute[j] = Math.max(contribute[j], piece.contribute[j]);
        }
      }
    }
  }
  
  function lookup(index, cateIndex) {
    return contributeTable[index][cateIndex];
  }
}

function calcScore(options) {
  const contributor = createDamageContributor(options);
  const factor = contributor.createFactor();
  return contributor.calcScore(factor);
}

module.exports = {solve, calcScore};
