function *product(a, b) {
  for (const ia of a) {
    for (const ib of b) {
      yield [ia, ib];
    }
  }
}

function *combination(list, size) {
  list = [...list];
  const result = [];
  
  yield *find(0);
  
  function *find(index) {
    if (result.length >= size) {
      yield result.slice();
      return;
    }
    
    for (let i = index; i <= list.length - (size - result.length); i++) {
      result.push(list[i]);
      yield *find(i + 1);
      result.pop();
    }
  }
}

function *filterSet(list, valid) {
  for (const item of list) {
    if (valid(item)) {
      yield item;
    }
  }
}

function count(list, valid) {
  let n = 0;
  for (const item of list) {
    if (valid(item)) {
      n++;
    }
  }
  return n;
}

module.exports = {product, combination, filterSet, count};
