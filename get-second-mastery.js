/* eslint-disable no-console */

const {getItems} = require("./lib/items");

(async () => {
  const items = await getItems();
  console.log([...new Set(secondMasteries())]);
  
  function *secondMasteries() {
    for (const item of items) {
      for (const [name] of item.effects) {
        const match = name.match(/^(.+)Mastery$/);
        if (match && match[1] !== "critical" && match[1] !== "elemental") {
          yield match[1];
        }
      }
    }
  }
})();
