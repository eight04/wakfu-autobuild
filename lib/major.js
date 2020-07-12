function getMajorItems() {
  const items = [
    {
      name: "Major - AP",
      effects: [
        ["ap", [1]]
      ]
    },
    {
      name: "Major - MP",
      effects: [
        ["mp", [1]],
        ["elementalMastery", [20]],
      ]
    },
    {
      name: "Major - Range",
      effects: [
        ["range", [1]],
        ["elementalMastery", [40]],
      ]
    },
    {
      name: "Major - WP",
      effects: [
        ["wp", [2]]
      ]
    },
    {
      name: "Major - Control",
      effects: [
        ["control", [2]],
        ["elementalMastery", [40]]
      ]
    },
    {
      name: "Major - Damage inflicted",
      effects: [
        ["damageInflicted", [10]],
      ]
    },
    {
      name: "Major - Resistance",
      effects: [
        ["elementalResistance", [50]]
      ]
    }
  ];
  
  let id = 1;
  for (const item of items) {
    item.id = id++;
    item.type = "MAJOR";
    item.level = 1;
  }
  return items;
}

module.exports = {getMajorItems};
