const { test, expect } = require('@playwright/test');

let shared = { value: 0 };

test.describe('A', () => {
  test('a1 sets value', () => { shared.value = 42; });
});

test.describe('B', () => {
  test('b1 reads value', () => {
    console.log('shared.value =', shared.value);
    expect(shared.value).toBe(42);
  });
});
