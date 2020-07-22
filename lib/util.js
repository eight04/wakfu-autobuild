function *product(list) {
  const result = [];
  yield *find(0, 0);
  
  function *find(index, cateIndex) {
    if (result.length >= list.length) {
      yield result.slice();
      return;
    }
    
    for (let i = 0; i < 4; i++) {
      if (cateIndex & i) continue;
      
      for (const item of list[index][i]) {
        result.push(item);
        yield *find(index + 1, cateIndex | i);
        result.pop();
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
