#!/usr/bin/env node

/* eslint-disable no-console */
const Events = require("events");
const neodoc = require("neodoc");

const args = neodoc.run(`
Usage:
  wakfu-autobuild [options]

Options:
  --level=<number>                  character level. [default: 1]
  --min-level=<number>              minimum item level. [default: 1]
  --element=<number>                number of elements that the character uses. [default: 1]
  
  --require=<constrains>            a comma separated constrain list. Each constrain is composed by a property name,
                                    the "=" symbol, and a value. Example: "ap=5,control=3"
              
  --base-ap=<number>                base ap. [default: 6]
  --base-mastery=<number>           base mastery given by passive or buff. [default: 0]
  --base-critical-hit=<number>      base critical hit % given by passive or buff. [default: 0]
  --base-critical-mastery=<number>  base critical mastery given by passive or buff. [default: 0]
  --base-damage-inflicted=<number>  base damage inflicted %. [default: 0]
  
  --second-mastery=<masteries>      a comma separated secondary mastery list. Example: "singleTarget,melee".
  
  --major=<number>                  calculate major points. [default: 0]
  
  --disable-category=<types>        a comma separated category list. Example: "costume,accessory"
  --disable-item=<ids>              a comma separated list of item id. Example: "24674,22609"
  --use-item=<ids>                  a comma separated list of item id. Example: "26581,17543"
  
  --ap-to-damage                    calculate ap as a damage modifier.
  --range-to-damage                 calculate range as a damage modifier. This adds 3 damage inflicted for each
                                    range.
                                    
  --score-only                      do not search for items but only calculate the score of the current stat given
                                    by --base-xxx options.
`);

const camelcase = require("camelcase");
const {solve, calcScore} = require("./lib/solver");

const CAST_OPTION = {
  element: ["elements"],
  require: ["requires", commaPairs],
  secondMastery: ["secondMasteries", commaList],
  disableCategory: ["disableCategories", commaList],
  disableItem: ["disableItems", commaListNumber],
  useItem: ["useItems", commaListNumber]
};

main(args).catch(err => {
  console.error(err);
  process.exit(1);
});

function commaPairs(input) {
  if (!input) return [];
  
  return input.split(",").map(c => {
    const [p, value] = c.split("=");
    return [p.trim(), Number(value)];
  });
}

function commaList(input) {
  if (!input) return [];
  if (typeof input !== "string") return [input];
  return input.split(",").map(t => t.trim());
}

function commaListNumber(input) {
  return commaList(input).map(Number);
}

async function main(args) {
  const options = {};
  
  for (const key in args) {
    const lowKey = camelcase(key);
    if (CAST_OPTION[lowKey]) {
      const [newKey, cast] = CAST_OPTION[lowKey];
      options[newKey] = cast ? cast(args[key]) : args[key];
    } else {
      options[lowKey] = args[key];
    }
  }
  
  if (options.scoreOnly) {
    console.log("Score: %O\n", calcScore(options));
    return;
  }
  
  console.log("Input: %O\n", options);
  
  const startTime = Date.now();
  const events = new Events;
  
  events.on("pieceGenerated", categories => {
    console.log("Number of equipments in each category: %O\n\nProgressing...", Object.fromEntries(
      [...categories].map(c => [camelcase(c[0]), getSize(c[1])])
    ));
  });
  events.on("mergeStart", ([left, right]) => {
    console.log(`\nMerge two categories: ${left.tag}/${right.tag} (${getSize(left.sets)} x ${getSize(right.sets)})`);
  });
  events.on("mergeEnd", ({elapse, sets}) => {
    console.log("Finished in %Os, got %O combinations", elapse / 1000, getSize(sets));
  });
  events.on("searchStart", pending => {
    console.log(`\nStart searching: ${pending.map(p => `${p.tag} (${getSize(p.sets)})`).join(" x ")}`);
  });
  
  const {items, score} = await solve({
    ...options,
    events
  });
  console.log(`\nFinished in ${(Date.now() - startTime) / 1000}s`);
  console.log("Score: %O\n", score);
  console.dir(items.map(itemToDetail), {depth: null});
  return;
  
  function itemToDetail(item) {
    if (Array.isArray(item)) {
      return item.map(itemToDetail);
    }
    if (item.type === "MAJOR") {
      return {
        name: item.name
      };
    }
    return {
      name: item.name,
      url: ` https://www.wakfu.com/en/mmorpg/encyclopedia/weapons/${item.id} `
    };
  }
  
  function getSize(cates) {
    return cates.reduce((n, s) => n + s.size, 0);
  }
}
