/* eslint-env mocha */

const assert = require("assert");

const {solve} = require("../lib/solver");

it("solve with negative effects", async () => {
  const {items} = await solve({
    requires: [["wp", 0]],
    items: [
      {
        type: "HEAD",
        name: "A",
        effects: [
          ["wp", [0]],
          ["elementalMastery", [200]]
        ]
      },
      {
        type: "HEAD",
        name: "B",
        effects: [
          ["wp", [1]],
          ["elementalMastery", [100]]
        ]
      },
      {
        type: "NECK",
        name: "C",
        effects: [
          ["wp", [0]],
          ["elementalMastery", [100]]
        ]
      },
      {
        type: "NECK",
        name: "D",
        effects: [
          ["wp", [-1]],
          ["elementalMastery", [300]]
        ]
      },
    ]
  });
  
  const result = Object.fromEntries(items.map(i => [i.type, i.name]));
  
  assert.deepStrictEqual(result, {
    HEAD: "B",
    NECK: "D"
  });
});
