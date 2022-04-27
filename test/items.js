/* eslint-env mocha */
const assert = require("assert");
const {getItems} = require("../lib/items");

it("snow bow meow", async () => {
  const items = await getItems();
  const cat = items.find(i => i.name === "Snow Bow Meow");
  assert.equal(cat.type, "PET");
  assert.deepStrictEqual(Object.fromEntries(cat.effects), {
    hp: [60],
    healingMastery: [100]
  });
}).timeout(20 * 1000);

it("melee dragosteed", async () => {
  const items = await getItems();
  const cat = items.find(i => i.name === "Melee Dragosteed");
  assert.equal(cat.type, "MOUNTS");
  assert.deepStrictEqual(Object.fromEntries(cat.effects), {
    meleeMastery: [40],
    nullEffect: []
  });
}).timeout(20 * 1000);

