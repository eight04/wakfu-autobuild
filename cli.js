#!/usr/bin/env node

/* eslint-disable no-console */

const neodoc = require("neodoc");

const args = neodoc.run(`
Usage:
  wakfu-autobuild [options]

Options:
  --level=<number>                  character level. [default: 1]
  --element=<number>                number of elements that the character uses. [default: 1]
  
  --require=<constrains>            a comma separated constrain list. Each constrain is composed by a property name,
                                    the "=" symbol, and a value. Example: "ap=5,control=3"
              
  --base-ap=<number>                base ap. [default: 7]
  --base-mastery=<number>           base mastery given by passive or buff. [default: 0]
  --base-critical-hit=<number>      base critical hit % given by passive or buff. [default: 0]
  --base-critical-mastery=<number>  base critical mastery given by passive or buff. [default: 0]
  --base-damage-inflicted=<number>  base damage inflicted %. [default: 0]
  
  --second-mastery=<masteries>      a comma separated secondary mastery list. Example: "singleTarget,melee".
  
  --disable-category=<types>        a comma separated category list. Example: "costume,accessory"
  --disable-item=<ids>              a comma separated list of item id. Example: "24674,22609"
  
  --ap-to-damage                    calculate ap as a damage modifier.
  --range-to-damage                 calculate range as a damage modifier. This adds 3 damage inflicted for each
                                    range.
`);

const camelcase = require("camelcase");
const {solve} = require("./lib/solver");

const CAST_OPTION = {
  element: ["elements"],
  require: ["requires", commaPairs],
  secondMastery: ["secondMasteries", commaList],
  disableCategory: ["disableCategories", commaList],
  disableItem: ["disableItems", commaListNumber]
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
  
  console.log("Input: %O\n", options);
  
  const startTime = Date.now();
  // let screenSize = 0;
  
  const {items, score} = await solve({
    ...options,
    onProgress,
    onPieceGenerated,
  });
  console.log(`\nFinished in ${(Date.now() - startTime) / 1000}s`);
  console.log("Score: %O\n", score);
  console.dir(items.map(itemToDetail), {depth: null});
  return;
  
  function itemToDetail(item) {
    if (Array.isArray(item)) {
      return item.map(itemToDetail);
    }
    return {
      name: item.name,
      url: ` https://www.wakfu.com/en/mmorpg/encyclopedia/weapons/${item.id} `
    };
  }
  
  function onPieceGenerated(categories) {
    console.log("Number of equipments in each category: %O\n\nProgressing...", Object.fromEntries([...categories].map(c => [camelcase(c[0]), c[1].size])));
  }
  
  function onProgress(left, right) {
    console.log(`${left[0]}/${right[0]} (${left[1].size} x ${right[1].size})`);
  }
}
