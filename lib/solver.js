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
    calcFinalDamage,
    overpower,
  };
  
  function sum(a, b) {
    return a + b;
  }
  
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
  
  function calcFinalDamage(factorList) {
    const mastery = 100 + baseMastery + factorList.map(p => p.mastery).reduce(sum);
    const criticalMastery = 100 + baseMastery + baseCriticalMastery + factorList.map(p => p.criticalMastery).reduce(sum);
    const criticalHit = Math.min(Math.max(baseCriticalHit + factorList.map(p => p.criticalHit).reduce(sum), 0), 100);
    const ap = baseAp + factorList.map(p => p.ap).reduce(sum);
    const damageInflicted = 100 + baseDamageInflicted + factorList.map(p => p.damageInflicted).reduce(sum);
    
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
  onResultUpdate = () => {},
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
    
    const category = item.type === "HEAVY_WEAPON" ? "FIRST_WEAPON" : item.type;
    
    if (disableCategories.includes(camelcase(category))) {
      continue;
    }
    
    let list = types.get(category);
    if (!list) {
      list = [];
      types.set(category, list);
    }
    
    const p = {
      id: item.id,
      contributeDamage: damageContributor.calcItem(item),
      contribute: requires.map(([name]) => {
        const effect = item.effects.find(e => e[0] === name);
        return effect ? effect[1][0] : 0;
      }),
      color: 0,
      heavy: item.type === "HEAVY_WEAPON",
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
    
    const maxCover = category === "RING" ? 1 : 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].covered > maxCover) {
        list.splice(i, 1);
        i--;
      }
    }
  }
  
  const PIECES = [
    "FIRST_WEAPON", "SECOND_WEAPON", "HEAD", "NECK", "CHEST", "RING", "RING", "LEGS", "BACK", "SHOULDERS", "BELT",
    "ACCESSORY", "COSTUME"
  ].filter(c => types.has(c));
  
  onPieceGenerated(PIECES, types);
  
  // console.dir(types, {depth: null});
  // return;
  
  let epic = false;
  let relic = false;
  let heavyWeapon = false;
  let resultDamage = 0;
  let resultPieces = [];
  const currentPieces = [];
  const currentContribute = requires.map(() => 0);
  let tried = 0;
  let solved = 0;
  
  const contributeTable = new Map; // index > relic > epic
  for (let i = PIECES.length - 1; i >= 0; i--) {
    for (const relic of [true, false]) {
      for (const epic of [true, false]) {
        
        let target = contributeTable;
        for (const key of [i, relic]) {
          if (!target.has(key)) {
            target.set(key, new Map);
          }
          target = target.get(key);
        }
        
        const contribute = requires.map(() => 0);
        
        for (const piece of types.get(PIECES[i])) {
          if (piece.epic && !epic) continue;
          if (piece.relic && !relic) continue;
          
          for (let j = 0; j < contribute.length; j++) {
            contribute[j] = Math.max(contribute[j], piece.contribute[j]);
          }
        }
        
        if (contributeTable.has(i + 1)) {
          const futureContribute = contributeTable.get(i + 1).get(relic).get(epic);
          for (let j = 0; j < contribute.length; j++) {
            contribute[j] += futureContribute[j];
          }
        }
        
        target.set(epic, contribute);
      }
    }
  }
  
  digest(0);
  
  return {
    damageFactor: resultDamage,
    items: resultPieces.map(p => p.item)
  };
  
  function digest(index) {
    if (index >= PIECES.length) {
      tried++;
      
      if (currentContribute.some((value, i) => value < requires[i][1])) return;
      
      const damage = damageContributor.calcFinalDamage(currentPieces.map(p => p.contributeDamage));
      
      if (damage > resultDamage) {
        solved++;
        
        resultDamage = damage;
        resultPieces = currentPieces.slice();
        
        onResultUpdate(tried, solved, resultDamage, resultPieces);
      }
      return;
    }
    
    if (futureContribute(index).some((value, i) => value + currentContribute[i] < requires[i])) {
      tried++;
      return;
    }
    
    const category = PIECES[index];
    
    if (category === "SECOND_WEAPON" && heavyWeapon) {
      digest(index + 1);
      return;
    }
    
    for (const piece of types.get(category)) {
      if (piece.color) continue;
      
      if (piece.epic) {
        if (epic) continue;
        epic = true;
      }
      if (piece.relic) {
        if (relic) continue;
        relic = true;
      }
      if (piece.heavy) {
        heavyWeapon = true;
      }
      
      piece.color++;
      currentPieces.push(piece);
      for (let i = 0; i < currentContribute.length; i++) {
        currentContribute[i] += piece.contribute[i];
      }
      
      digest(index + 1);
      
      piece.color--;
      currentPieces.pop();
      for (let i = 0; i < currentContribute.length; i++) {
        currentContribute[i] -= piece.contribute[i];
      }
      
      if (piece.epic) epic = false;
      if (piece.relic) relic = false;
      if (piece.heavy) heavyWeapon = false;
    }
  }
  
  function futureContribute(index) {
    return contributeTable.get(index).get(relic).get(epic);
  }
  
  function overpower(a, b) {
    if (a.epic && !b.epic || a.relic && !b.relic) {
      return false;
    }
    if (a.heavy && !b.heavy) {
      return false;
    }
    if (!damageContributor.overpower(a.contributeDamage, b.contributeDamage)) {
      return false;
    }
    return a.contribute.every((value, i) => value >= requires[i][1] || value >= b.contribute[i]);
  }
}

module.exports = {solve};
