/* eslint-disable no-console */
const camelcase = require("camelcase");
const {getItems} = require("./lib/items");

(async () => {
  const items = await getItems();
  console.log([...new Set(items.map(i => i.type))].filter(Boolean).map(n => camelcase(n)));
})();
