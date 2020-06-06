const camelcase = require("camelcase");
const {getItems} = require("./items.js");

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
  requires = [],
  baseAp = 7,
  baseMastery = 0,
  baseCriticalHit = 0,
  baseCriticalMastery = 0,
  baseDamageInflicted = 0,
  secondMasteries = [],
  level = 1,
  disableCategories = [],
  onPieceGenerated = () => {},
  apToDamage = false,
  rangeToDamage = false
} = {}) {
  secondMasteries = secondMasteries.map(s => `${s}Mastery`);
  
  const items = await getItems();
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
    // console.log(list);
    types.set(key, concatSet(new Set, list, key === "RING" ? 1 : 0));
    // console.log(types.get(key));
  }
  
  onPieceGenerated(types);
  
  const queue = [];
  
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
    queue.push(weapon);
  }
  
  if (types.has("RING")) {
    queue.push(mergeSet(types.get("RING"), types.get("RING")));
    types.delete("RING");
  }
  
  queue.push(...types.values());
  
  while (queue.length > 1) {
    queue.push(mergeSet(queue.pop(), queue.pop()));
  }
  
  let score = 0;
  let result;
  for (const set of queue[0]) {
    if (set.contribute.some((value, i) => value < requires[i][1])) continue;
    const newScore = damageContributor.calcScore(set.contributeDamage);
    if (newScore > score) {
      score = newScore;
      result = set;
    }
  }
  
  return {
    score,
    items: result.pieces
  };
  
  function addSet(target, newSet, maxCovered = 0) {
    for (const oldSet of target) {
      if (overpower(newSet, oldSet)) {
        oldSet.covered++;
        if (oldSet.covered > maxCovered) {
          target.delete(oldSet);
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
        newSet.pieces = a.pieces.concat(b.pieces);
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
      covered: 0
    };
  }
  
  function overpower(a, b) {
    if (a.epic && !b.epic || a.relic && !b.relic) {
      return false;
    }
    if (!damageContributor.overpower(a.contributeDamage, b.contributeDamage)) {
      return false;
    }
    return a.contribute.every((value, i) => value >= requires[i][1] || value >= b.contribute[i]);
  }
}

module.exports = {solve};
