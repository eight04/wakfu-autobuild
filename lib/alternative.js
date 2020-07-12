class Alternative extends Array {
  *reduce() {
    let touched;
    do {
      touched = false;
      
      // reduce common static?
      if (this.every(i => Array.isArray(i))) {
        const firstArray = this[0];
        for (const item of firstArray) {
          if (this.slice(1).every(arr => arr.includes(item))) {
            yield item;
            touched = true;
            
            for (const arr of this) {
              const index = arr.indexOf(item); // FIXME: this won't work if item is an alternative?
              arr.splice(index, 1);
            }
          }
        }
      }
      
      // flatten
      for (let i = 0; i < this.length; i++) {
        if (this[i].length === 1) {
          this[i] = this[i][0];
          touched = true;
        }
      }
      
      // extract sub alternative
      for (let i = 0; i < this.length; i++) {
        if (this[i] instanceof Alternative) {
          this.push(...this[i]);
          this.splice(i, 1);
          i--;
          touched = true;
        }
      }
      
      // remove dup
      const dup = new Set;
      for (let i = 0; i < this.length; i++) {
        if (dup.has(this[i])) {
          this.splice(i, 1);
          i--;
          touched = true;
        } else {
          dup.add(this[i]);
        }
      }
    } while (touched);
  }
}

module.exports = {Alternative};
