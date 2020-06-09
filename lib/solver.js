const camelcase = require("camelcase");
const {getItems} = require("./items.js");

class Alternative extends Array {
  *reduce() {
    let touched;
    do {
      touched = false;
      
      // reduce common static?
      if (this.every(i => Array.isArray(i))) {
        const firstArray = this[0];
        for (const item of firstArray) {
          if (this.slice(1).every(arr => arr.includes(item))) {
            yield item;
            touched = true;
            
            for (const arr of this) {
              const index = arr.indexOf(item); // FIXME: this won't work if item is an alternative?
              arr.splice(index, 1);
            }
          }
        }
      }
      
      // flatten
      for (let i = 0; i < this.length; i++) {
        if (this[i].length === 1) {
          this[i] = this[i][0];
          touched = true;
        }
      }
      
      // extract sub alternative
      for (let i = 0; i < this.length; i++) {
        if (this[i] instanceof Alternative) {
          this.push(...this[i]);
          this.splice(i, 1);
          i--;
          touched = true;
        }
      }
      
      // remove dup
      const dup = new Set;
      for (let i = 0; i < this.length; i++) {
        if (dup.has(this[i])) {
          this.splice(i, 1);
          i--;
          touched = true;
        } else {
          dup.add(this[i]);
        }
      }
    } while (touched);
  }
}

function createDamageContributor({
  elements = 1,
  baseAp = 7,
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
      
      if (name === "criticalHit" || name === "criticalMastery") {
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
    
    return (mastery * (100 - criticalHit) + criticalMastery * criticalHit * 1.25) / 100 * ap / baseAp * damageInflicted / 100;
  }
}

async function solve({
  elements = 1,
  level = 1,
  
  requires = [],
  secondMasteries = [],
  
  apToDamage = false,
  rangeToDamage = false,

  baseAp = 7,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  
  disableCategories = [],
  disableItems = [],
  
  onPieceGenerated = () => {},
  onProgress = () => {},
  
  items = null
} = {}) {
  secondMasteries = secondMasteries.map(s => `${s}Mastery`);
  items = items || await getItems();
  
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
  
  for (const item of items) {
    if (item.level > level) {
      continue;
    }
    if (item.type === "PET") {
      // data doesn't contain useful stat for pets
      continue;
    }
    if (!item.type) continue; // sublimation?
    
    if (disableCategories.includes(camelcase(item.type))) {
      continue;
    }
    if (disableItems.includes(item.id)) {
      continue;
    }
    
    let list = types.get(item.type);
    if (!list) {
      list = [];
      types.set(item.type, list);
    }
    
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
    
    list.push(set);
  }
  
  for (const [key, list] of types) {
    types.set(key, concatSet(new Set, list, key === "RING" ? 1 : 0));
  }
  
  onPieceGenerated(types);
  
  let weapon = types.get("FIRST_WEAPON");
  types.delete("FIRST_WEAPON");
  
  if (types.has("SECOND_WEAPON")) {
    if (weapon) {
      weapon = mergeSet(weapon, types.get("SECOND_WEAPON"));
    } else {
      weapon = types.get("SECOND_WEAPON");
    }
    types.delete("SECOND_WEAPON");
  }
  
  if (types.has("HEAVY_WEAPON")) {
    if (weapon) {
      weapon = concatSet(weapon, types.get("HEAVY_WEAPON"));
    } else {
      weapon = types.get("HEAVY_WEAPON");
    }
    types.delete("HEAVY_WEAPON");
  }
  
  if (weapon) {
    types.set("WEAPON", weapon);
  }
  
  if (types.has("RING")) {
    types.set("RING", mergeSet(types.get("RING"), types.get("RING")));
  }
  
  // NOTE: by processing high stat items first, we can keep left side as small as possible.
  // there is a higher chance that a set will be covered by another.
  const queue = ["WEAPON", "HEAD", "BACK", "SHOULDERS", "CHEST", "BELT", "NECK", "LEGS", "RING", "ACCESSORY", "COSTUME"]
    .map(name => [name, types.get(name)])
    .filter(c => c[1]);
  
  const contributeTable = createContributeTable(queue.map(c => c[1]), requires.length);
  
  for (let i = 0; i < queue.length - 1; i++) {
    const newTag = `${queue[i][0]}/${queue[i + 1][0]}`;
    
    onProgress(queue[i], queue[i + 1]);
    
    const result = mergeSet((function*(){
      for (const set of queue[i][1]) {
        const futureContribute = contributeTable.lookup(i + 1, set.relic, set.epic);
        if (futureContribute.some((value, i) => value + set.contribute[i] < requires[i][1])) {
          continue;
        }
        yield set;
      }
    })(), queue[i + 1][1]);
    
    queue[i + 1] = [newTag, result];
  }
    
  let score = 0;
  let result;
  for (const set of queue.pop()[1]) {
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
    for (const oldSet of target) {
      if (overpower(newSet, oldSet)) {
        oldSet.covered++;
        if (oldSet.covered > maxCovered) {
          target.delete(oldSet);
        }
        if (overpower(oldSet, newSet)) {
          newSet.alter.push(oldSet);
        }
      } else if (overpower(oldSet, newSet)) {
        newSet.covered++;
        if (newSet.covered > maxCovered) {
          return;
        }
      }
    }
    target.add(newSet);
  }
  
  function concatSet(target, pending, maxCovered = 0) {
    for (const newSet of pending) {
      addSet(target, newSet, maxCovered);
    }
    return target;
  }
  
  function mergeSet(left, right) {
    const result = new Set;
    
    for (const a of left) {
      a.color++;
      for (const alter of a.alter) {
        alter.color++;
      }
      
      for (const b of right) {
        if (b.color) {
          // prevent duplicate rings
          // FIXME: no output if there is only one ring?
          continue;
        }
        if (a.relic && b.relic || a.epic && b.epic) {
          // FIXME: no output (no merge) if there is no common items?
          continue;
        }
        const newSet = createSet();
        newSet.contributeDamage = damageContributor.createFactor();
        newSet.contribute = a.contribute.slice();
        newSet.pieces = [a, b];
        newSet.relic = a.relic || b.relic;
        newSet.epic = a.epic || b.epic;
        
        for (let i = 0; i < newSet.contribute.length; i++) {
          newSet.contribute[i] += b.contribute[i];
        }
        
        damageContributor.stackFactor(newSet.contributeDamage, a.contributeDamage);
        damageContributor.stackFactor(newSet.contributeDamage, b.contributeDamage);
        
        addSet(result, newSet);
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
      alter: []
    };
  }
  
  function overpower(a, b) {
    if (a.epic && !b.epic || a.relic && !b.relic) {
      return false;
    }
    if (!damageContributor.overpower(a.contributeDamage, b.contributeDamage)) {
      return false;
    }
    return a.contribute.every((value, i) => value >= b.contribute[i]);
  }
}

function createContributeTable(queue, size) {
  const contributeTable = new Map; // index > relic > epic
  const DEFAULT_CONTRIBUTE = Array(size).fill(0);
  
  for (let i = 0; i < queue.length; i++) {
    for (const piece of queue[i]) {
      fillTable(i, piece);
    }
  }
  
  for (let i = queue.length - 1; i > 0; i--) {
    for (const hasRelic of [true, false]) {
      for (const hasEpic of [true, false]) {
        const left = lookup(i - 1, hasRelic, hasEpic);
        const right = lookup(i, hasRelic, hasEpic);
        stackContribute(left, right);
      }
    }
  }
  
  return {lookup};
  
  function stackContribute(base, extra) {
    for (let i = 0; i < base.length; i++) {
      base[i] += extra[i];
    }
  }
  
  function createContribute(keys) {
    let target = contributeTable;
    while (keys.length) {
      const key = keys.shift();
      if (!target.has(key)) {
        target.set(key, keys.length ? new Map : DEFAULT_CONTRIBUTE.slice());
      }
      target = target.get(key);
    }
    return target;
  }
  
  function fillTable(index, piece) {
    for (const hasRelic of [true, false]) {
      for (const hasEpic of [true, false]) {
        if (hasRelic && piece.relic || hasEpic && piece.epic) continue;
        
        const contribute = createContribute([index, hasRelic, hasEpic]);
        for (let j = 0; j < contribute.length; j++) {
          contribute[j] = Math.max(contribute[j], piece.contribute[j]);
        }
      }
    }
  }
  
  function lookup(index, relic, epic) {
    return contributeTable.get(index).get(relic).get(epic);
  }
}

module.exports = {solve};
