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

it("scarafly", async () => {
  const items = await getItems();
  const cat = items.find(i => i.name === "Scarafly");
  assert.equal(cat.type, "PET");
  assert.deepStrictEqual(Object.fromEntries(cat.effects), {
    elementalMastery: [100, 1]
  });
}).timeout(20 * 1000);

it("armor received", async () => {
  const items = await getItems();
  const cat = items.find(i => i.name === "Henryng");
  assert.equal(cat.type, "RING");
  assert.deepStrictEqual(Object.fromEntries(cat.effects), {
    range: [1],
    hp: [217],
    dodge: [50],
    elementalMastery: [67, 3],
    armorReceived: [-40],
    elementalResistance: [30, 2]
  });
}).timeout(20 * 1000);
