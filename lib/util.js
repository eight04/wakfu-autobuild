function *product(a, b) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (i & j) continue;
      
      for (const ia of a[i]) {
        for (const ib of b[j]) {
          yield [ia, ib];
        }
      }
    }
  }
}

function *flat(list) {
  for (const subList of list) {
    yield *subList;
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

module.exports = {product, combination, filterSet, count, flat};
