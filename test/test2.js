const {getItems} = require("../lib/items");

(async () => {
  const items = await getItems();
  for (const item of items) {
    if (item.type === "COSTUME" && item.effects.length > 1) {
      console.log(item);
    }
  }
})();