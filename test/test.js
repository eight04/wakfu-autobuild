/* eslint-env mocha */

const assert = require("assert");

const {solve} = require("../lib/solver");
const {combination, product} = require("../lib/util");

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


it("combination", () => {
  assert.deepStrictEqual([...combination([1, 2, 3, 4, 5], 3)], [
    [1, 2, 3],
    [1, 2, 4],
    [1, 2, 5],
    [1, 3, 4],
    [1, 3, 5],
    [1, 4, 5],
    [2, 3, 4],
    [2, 3, 5],
    [2, 4, 5],
    [3, 4, 5]
  ]);
});

it("product", () => {
  const list = [
    [[1, 2], [], [], []],
    [[3, 4], [], [], []]
  ];
  assert.deepStrictEqual([...product(list)], [
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4]
  ]);
});

it("product conflict", () => {
  const list = [
    [[], [1, 2], [], []],
    [[], [5, 6], [], [7, 8]]
  ];
  assert.deepStrictEqual([...product(list)], []);
});
