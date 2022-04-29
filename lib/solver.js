const camelcase = require("camelcase");
const {getItems} = require("./items.js");
const {getMajorItems} = require("./major.js");
const {product, combination, count, flat} = require("./util.js");
const {Alternative} = require("./alternative.js");

function createDamageContributor({
  elements = 1,
  baseAp = 6,
  baseMp = 3,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  secondMasteries = [],
  mpToAp = false,
  apToDamage = false,
  rangeToDamage = false
} = {}) {
  if (mpToAp) {
    baseAp += baseMp;
  }
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

      if (name === "mp" && mpToAp && apToDamage) {
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
  minLevel = 0,
  
  requires = [],
  secondMasteries = [],
  
  mpToAp = false,
  apToDamage = false,
  rangeToDamage = false,

  baseAp = 6,
  baseMp = 3,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  
  disableCategories = [],
  disableItems = [],
  useItems = [],
  
  events,
  
  items = null,
  major = 0
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
    baseMp,
    baseMastery,
    baseCriticalHit,
    baseCriticalMastery,
    baseDamageInflicted,
    secondMasteries,
    mpToAp,
    apToDamage,
    rangeToDamage
  });
  
  const includedItems = [];
  
  for (const item of items) {
    if ((item.level < minLevel || item.level > level) && item.type !== "PET" && item.type !== "MOUNTS") {
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
  
  if (events) {
    events.emit("pieceGenerated", types);
  }
  
  let weapon;
  if (!includedItems.find(i => i.type === "HEAVY_WEAPON")) {
    weapon = types.get("FIRST_WEAPON");
  }
  types.delete("FIRST_WEAPON");
  
  if (types.has("SECOND_WEAPON") && !includedItems.find(i => i.type === "HEAVY_WEAPON")) {
    if (weapon) {
      weapon = createNewSetList(product([weapon, types.get("SECOND_WEAPON")]));
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
  const queue = ["INCLUDED", "WEAPON", "HEAD", "BACK", "SHOULDERS", "CHEST", "BELT", "LEGS", "NECK", "RING", "ACCESSORY", "MAJOR", "PET", "MOUNTS"]
    .map(tag => ({
      tag,
      index: [],
      sets: types.get(tag)
    }))
    .filter(c => c.sets);
    
  // setup index
  queue.forEach((target, i) => {
    target.index.push(i);
  });
  
  const contributeTable = createContributeTable(queue.map(c => c.sets), DEFAULT_CONTRIBUTE);
  
  queue.forEach(removeNoFutureSets);
  
  for (let i = 0; i < queue.length - 1; i++) {
    if (events) {
      events.emit("mergeStart", [queue[i], queue[i + 1]]);
    }
    
    const newTag = `${queue[i].tag}/${queue[i + 1].tag}`;
    const startTime = Date.now();
    const result = createNewSetList(product([queue[i].sets, queue[i + 1].sets]));
    const elapse = Date.now() - startTime;
    
    const newTarget = {
      index: queue[i].index.concat(queue[i + 1].index),
      tag: newTag,
      sets: result
    };
    removeNoFutureSets(newTarget);
    
    if (events) {
      events.emit("mergeEnd", {
        ...newTarget,
        elapse
      });
    }
    
    queue[i] = null;
    queue[i + 1] = newTarget;
    
    if (newTarget.sets.reduce((sum, i) => sum + i.size, 0) > 12000) {
      i++;
      // NOTE: it seems that refilling the table doesn't really improve the performance.
      contributeTable.refillTable(newTarget.index, newTarget.sets);
    }
  }
  
  
  let score = 0;
  let result;
  const finalQueue = queue.filter(Boolean);
  
  if (events) {
    events.emit("searchStart", finalQueue);
  }
  
  for (const pieces of product(finalQueue.map(t => t.sets))) {
    const set = makeSetFromPieces(pieces);
    
    // FIXME: product() won't generate invalid combination. Should we remove next line?
    if (!set) continue;
    
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
  
  function removeNoFutureSets(target) {
    for (let cateIndex = 0; cateIndex < 4; cateIndex++) {
      const cate = target.sets[cateIndex];
      const futureContribute = contributeTable.lookup(target.index, cateIndex);
      for (const set of cate) {
        if (futureContribute.some((value, i) => value + set.contribute[i] < requires[i][1])) {
          cate.delete(set);
        }
      }
    }
  }
  
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
  
  function addSet(target, newSet, maxCovered = 0) {
    const cateIndex = newSet.relic + newSet.epic * 2;
    if (maybeDropSet(target[cateIndex])) {
      return;
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
  
  function createNewSetList(listOfPieces) {
    const result = [new Set, new Set, new Set, new Set];
    // FIXME: no output (result.size === 0) if there is no valid new set?
    for (const pieces of listOfPieces) {
      const newSet = makeSetFromPieces(pieces);
      if (newSet) {
        addSet(result, newSet, 0);
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
  
  return {lookup, refillTable};
  
  function refillTable(index, cate) {
    for (const i of index) {
      resetTable(i);
    }
    for (const piece of flat(cate)) {
      fillTable(index[0], piece);
    }
  }
  
  function stackContribute(base, extra) {
    for (let i = 0; i < base.length; i++) {
      base[i] += extra[i];
    }
  }
  
  function createContribute(index, cateIndex) {
    if (!contributeTable[index]) {
      resetTable(index);
    }
    return contributeTable[index][cateIndex];
  }
  
  function resetTable(index) {
    contributeTable[index] = [
      DEFAULT_CONTRIBUTE.slice(),
      DEFAULT_CONTRIBUTE.slice(),
      DEFAULT_CONTRIBUTE.slice(),
      DEFAULT_CONTRIBUTE.slice()
    ];
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
    const base = DEFAULT_CONTRIBUTE.slice();
    for (let i = 0; i < contributeTable.length; i++) {
      if (index.includes(i)) continue;
      const extra = contributeTable[i][cateIndex];
      stackContribute(base, extra);
    }
    return base;
  }
}

function calcScore(options) {
  const contributor = createDamageContributor(options);
  const factor = contributor.createFactor();
  return contributor.calcScore(factor);
}

module.exports = {solve, calcScore};
