/* eslint-disable no-console */
const {getItems} = require("./lib/items");

(async () => {
  const items = await getItems();
  console.log([...new Set(singleValueEffects())]);
  
  function *singleValueEffects() {
    for (const item of items) {
      for (const [name, params] of item.effects) {
        if (/elemental/i.test(name)) continue;
        if (params.length === 1) {
          yield name;
        }
      }
    }
  }
})();
