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
    calcItem,
    // calcFinalDamage,
    overpower,
    stack,
    calcScore
  };
  
  function stack(a, b) {
    a.mastery += b.mastery;
    a.criticalHit += b.criticalHit;
    a.criticalMastery += b.criticalMastery;
    a.damageInflicted += b.damageInflicted;
    a.ap += b.ap;
  }
  
  // function sum(a, b) {
    // return a + b;
  // }
  
  function overpower(a, b) {
    return a.criticalHit >= b.criticalHit &&
      a.mastery >= b.mastery &&
      a.criticalMastery >= b.criticalMastery &&
      a.ap >= b.ap &&
      a.damageInflicted >= b.damageInflicted;
  }
  
  function calcItem(item) {
    const factors = {
      mastery: 0,
      criticalHit: 0,
      criticalMastery: 0,
      damageInflicted: 0,
      ap: 0
    };
    
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
  
  // function calcFinalDamage(factorList) {
    // const mastery = 100 + baseMastery + factorList.map(p => p.mastery).reduce(sum);
    // const criticalMastery = 100 + baseMastery + baseCriticalMastery + factorList.map(p => p.criticalMastery).reduce(sum);
    // const criticalHit = Math.min(Math.max(baseCriticalHit + factorList.map(p => p.criticalHit).reduce(sum), 0), 100);
    // const ap = baseAp + factorList.map(p => p.ap).reduce(sum);
    // const damageInflicted = 100 + baseDamageInflicted + factorList.map(p => p.damageInflicted).reduce(sum);
    
    // return (mastery * (100 - criticalHit) + criticalMastery * criticalHit * 1.25) / 100 * ap / baseAp * damageInflicted / 100;
  // }
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
  // onResultUpdate = () => {},
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
    
    const p = {
      id: item.id,
      contributeDamage: damageContributor.calcItem(item),
      contribute: requires.map(([name]) => {
        const effect = item.effects.find(e => e[0] === name);
        return effect ? effect[1][0] : 0;
      }),
      color: 0,
      epic: item.rarity === 7,
      relic: item.rarity === 5,
      item,
      covered: 0
    };
    
    for (const item of list) {
      if (overpower(item, p)) {
        p.covered++;
      } else if (overpower(p, item)) {
        item.covered++;
      }
    }
    list.push(p);
    
    const maxCover = item.type === "RING" ? 1 : 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].covered > maxCover) {
        list.splice(i, 1);
        i--;
      }
    }
  }
  
  onPieceGenerated(types);
  
  for (const [key, list] of types) {
    types.set(key, list.map(p => buildSet(p, [p])));
  }
  
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
    if (set.contribute.some((value, i) => value < requires[i])) continue;
    const newScore = damageContributor.calcScore(set.contributeDamage);
    if (newScore > score) {
      score = newScore;
      result = set;
    }
  }
  
  return {
    score,
    items: result.pieces.map(p => p.item)
  };
  
  function concatSet(aList, bList) {
    const result = aList.slice();
    
    NEXT_SET: for (const newSet of bList) {
      for (let i = 0; i < result.length; i++) {
        if (overpower(newSet, result[i])) {
          result.splice(i, 1);
          i--;
          continue;
        }
        
        if (overpower(result[i], newSet)) {
          continue NEXT_SET;
        }
      }
      result.push(newSet);
    }
    
    return result;
  }
  
  function mergeSet(aList, bList) {
    const result = [];
    
    for (const a of aList) {
      a.color++;
      
      NEXT_SET: for (const b of bList) {
        if (b.color) {
          // prevent duplicate rings
          // FIXME: no output if there is only one ring?
          continue;
        }
        if (a.relic && b.relic || a.epic && b.epic) {
          // FIXME: no output (no merge) if there is no common items?
          continue;
        }
        const newSet = buildSet(a, a.pieces.concat(b.pieces));
        if (!newSet.relic) newSet.relic = b.relic;
        if (!newSet.epic) newSet.epic = b.epic;
        
        for (let i = 0; i < newSet.contribute.length; i++) {
          newSet.contribute[i] += b.contribute[i];
        }
        
        damageContributor.stack(newSet.contributeDamage, b.contributeDamage);
        
        for (let i = 0; i < result.length; i++) {
          if (overpower(newSet, result[i])) {
            result.splice(i, 1);
            i--;
            continue;
          }
          
          if (overpower(result[i], newSet)) {
            continue NEXT_SET;
          }
        }
        
        result.push(newSet);
      }
    }
    // for (const a of aList) {
      // a.color--;
    // }
    
    return result.filter(s => !s.covered);
  }
  
  function buildSet(base, pieces) {
    return {
      contributeDamage: Object.assign({}, base.contributeDamage),
      contribute: base.contribute.slice(),
      heavy: base.heavy,
      dagger: base.dagger,
      relic: base.relic,
      epic: base.epic,
      pieces,
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
