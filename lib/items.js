const path = require("path");
const tempDir = require("temp-dir");
const cacache = require("cacache");
const camelCase = require("camelcase");

const ROOT = path.join(tempDir, "wakfu-autobuild");

const fetch = require("make-fetch-happen").defaults({
  cacheManager: ROOT
});

const ZERO_VALUE_EFFECT = {
  2001: "harvestQuantity",
  400: "nullEffect",
  1020: "makabrakfire",
  304: "makabraktion",
  39: "furnaceEye"
};

const DOUBLE_VALUE_EFFECT = [
  {
    range: [1068, 1068],
    name: "elementalMastery",
    negative: false
  },
  {
    range: [122, 125],
    name: "elementalMastery",
    negative: false
  },
  {
    range: [130, 132],
    name: "elementalMastery",
    negative: true
  },
  {
    range: [1069, 1069],
    name: "elementalResistance",
    negative: false
  },
  {
    range: [82, 85],
    name: "elementalResistance",
    negative: false
  },
  {
    range: [96, 98],
    name: "elementalResistance",
    negative: true
  },
  {
    range: [832, 832],
    name: "spellLevel",
    negative: false
  }
];

const SINGLE_VALUE_EFFECT = [
  {
    id: 21,
    name: "hp",
    negative: true
  },
  {
    id: 32,
    name: "ap",
    negative: true
  },
  {
    id: 39,
    name: "armorReceived",
    negative: false
  },
  {
    id: 40,
    name: "armorReceived",
    negative: true
  },
  {
    id: 42,
    name: "mp",
    negative: true
  },
];

async function getItems() {
  const {version} = await (await fetch("https://wakfu.cdn.ankama.com/gamedata/config.json")).json();
  if (!version) {
    throw new Error("Unknown version");
  }
  const JSON_KEY = `${version}/normalized-items.json`;
  let data;
  try {
    data = await cacache.get(ROOT, JSON_KEY);
  } catch (err) {
    // pass
  }
  if (data) {
    return JSON.parse(data.data.toString("utf8"));
  }
  
  const itemTypes = await (await fetch(`https://wakfu.cdn.ankama.com/gamedata/${version}/equipmentItemTypes.json`)).json();
  const typeMap = new Map;
  
  const itemTypeKey = type => {
    const pos = type.definition.equipmentPositions[0];
    if (pos === "LEFT_HAND" || pos === "RIGHT_HAND") {
      return "RING";
    }
    if (pos === "FIRST_WEAPON" && type.definition.equipmentDisabledPositions[0] === "SECOND_WEAPON") {
      return "HEAVY_WEAPON";
    }
    if (pos) {
      return pos;
    }
    return type.title.en.toUpperCase();
  };
  
  for (const type of itemTypes) {
    const props = {
      id: type.definition.id,
      name: type.title.en,
      positions: type.definition.equipmentPositions,
      disable: type.definition.equipmentDisabledPositions,
      key: itemTypeKey(type)
    };
    typeMap.set(props.id, props);
    typeMap.set(props.key, props);
  }
  
  const actions = await (await fetch(`https://wakfu.cdn.ankama.com/gamedata/${version}/actions.json`)).json();
  const actionMap = new Map;
  
  NEXT_ACTION: for (const action of actions) {
    const id = action.definition.id;
    const text = action.description ? action.description.en : action.definition.effect; // beta effect?
    
    if (ZERO_VALUE_EFFECT[id]) {
      actionMap.set(id, {
        source: text,
        type: "ZERO_VALUE_EFFECT",
        name: ZERO_VALUE_EFFECT[id],
        negative: false,
      });
      continue;
    }
    
    const match = text.match(/^(-)?\[#1\]%? ([^[\]]+)$/);
    if (match) {
      let name = camelCase(match[2]);
      if (/^max.p$/.test(name)) {
        name = name.slice(-2).toLowerCase();
      }
      actionMap.set(id, {
        source: text,
        type: "SINGLE_VALUE_EFFECT",
        name,
        negative: match[1] ? true : false,
      });
      continue;
    }
    
    for (const el of DOUBLE_VALUE_EFFECT) {
      if (id >= el.range[0] && id <= el.range[1]) {
        actionMap.set(id, {
          source: text,
          type: "DOUBLE_VALUE_EFFECT",
          name: el.name,
          negative: el.negative,
        });
        continue NEXT_ACTION;
      }
    }
    
    for (const el of SINGLE_VALUE_EFFECT) {
      if (id === el.id) {
        actionMap.set(id, {
          source: text,
          type: "SINGLE_VALUE_EFFECT",
          name: el.name,
          negative: el.negative,
        });
        continue NEXT_ACTION;
      }
    }
    
    actionMap.set(action.definition.id, {
      source: text,
      type: "UNKNOWN",
      name: undefined,
      negative: false
    });
  }
  
  const items = await (await fetch(`https://wakfu.cdn.ankama.com/gamedata/${version}/items.json`)).json();
  const result = [];
  
  for (const item of items) {
    const type = typeMap.get(item.definition.item.baseParameters.itemTypeId);
    const props = {
      id: item.definition.item.id,
      name: item.title ? item.title.en :
        `Unkown ${type ? type.key : 'item'} #${item.definition.item.id}`, // beta item?
      description: item.description && item.description.en, // description can be null
      level: item.definition.item.level,
      type: type && type.key, // unknown type e.g. sublimation
      rarity: item.definition.item.baseParameters.rarity,
      effects: item.definition.equipEffects ? 
        item.definition.equipEffects.map(effect => {
          const {actionId: id, params} = effect.effect.definition;
          const def = actionMap.get(id);
          if (!def) {
            throw new Error(`Undefined actionId ${id}`);
          }
          if (def.type === "UNKNOWN") {
            console.warn(`Unknown effect`, def, item);
            return null;
          }
          if (def.type === "ZERO_VALUE_EFFECT") {
            return [def.name, []];
          }
          if (def.type === "SINGLE_VALUE_EFFECT") {
            let value = params[0];
            if (type && (type.key === "PET" || type.key === "MOUNTS") && params[1]) {
              value += 50 * params[1];
            }
            return [def.name, [value * (def.negative ? -1 : 1)]];
          }
          if (def.type === "DOUBLE_VALUE_EFFECT") {
            let value = params[0];
            if (type && (type.key === "PET" || type.key === "MOUNTS") && params[1]) {
              value += 50 * params[1];
            }
            return [def.name, [value * (def.negative ? -1 : 1), params[2] || 1]];
          }
          throw new Error(`Unknown action type ${def.type}`);
        }).filter(Boolean) :
        []
    };

    props.effects = mergeMastery(props.effects);

    result.push(props);
  }
  
  cacache.put(ROOT, JSON_KEY, JSON.stringify(result));
  
  return result;
}

function mergeMastery(effects) {
  const mastery = [];
  const resistance = [];
  const result = [];
  for (const e of effects) {
    if (e[0] === "elementalMastery" && e[1][1] === 1) {
      mastery.push(e);
      if (mastery.length === 1) {
        result.push(() => merge(mastery));
      }
    } else if (e[0] === "elementalResistance" && e[1][1] === 1) {
      resistance.push(e);
      if (resistance.length === 1) {
        result.push(() => merge(resistance));
      }
    } else {
      result.push(e);
    }
  }
  return result.map(r => typeof r === "function" ? r() : r);

  function merge(arr) {
    const name = arr[0][0];
    let value = 0;
    let count = 0;
    for (const e of arr) {
      value += e[1][0];
      count += e[1][1];
    }
    return [name, [value / count, count]];
  }
}

module.exports = {
  getItems
};
