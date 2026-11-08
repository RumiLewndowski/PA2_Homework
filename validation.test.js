const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePurchase} = require('./validation');
test('valid purchase and trimmed name',()=> {
  assert.deepEqual(validatePurchase({name:' Fund ',quantity:5,unitPriceCents:2000,categoryId:1},[1,2,3]),
    {value:{name:'Fund',quantity:5,unitPriceCents:2000,categoryId:1}});
});
test('invalid quantity and unchanged input',()=> {
  for (const quantity of [0,1.5,10001,'5',true,null,NaN,Infinity]) {
    const body={name:'Fund',quantity,unitPriceCents:2000,categoryId:1};
    assert.ok(validatePurchase(body,[1,2,3]).error);
    assert.ok(Object.is(body.quantity,quantity));
  }
});
test('invalid price and category',()=> {
  for (const cents of [0,1.5,100000001,'100',true]) {
    assert.ok(validatePurchase({name:'Fund',quantity:1,unitPriceCents:cents,categoryId:1},[1,2,3]).error);
  }
  assert.ok(validatePurchase({name:'Fund',quantity:1,unitPriceCents:100,categoryId:99},[1,2,3]).error);
});
// TODO: Add tests for body/name boundaries and at least one valid upper boundary.
