const assert = require('assert');

// Mocking State and Functions for Logic Testing
const state = {
    pollen: 0,
    honey: 0,
    backpackCapacity: 100,
    bees: [],
    flowers: [] // Needed for findFlower logic if we were testing that, but we'll stick to simple logic
};

// Mocking collectPollen
function collectPollen(amount) {
    if (state.pollen < state.backpackCapacity) {
        state.pollen = Math.min(state.pollen + amount, state.backpackCapacity);
    }
}

// Mocking convertPollen
function convertPollen() {
    if (state.pollen > 0) {
        const amount = state.pollen;
        state.pollen = 0;
        state.honey += amount;
    }
}

// Mocking Shop Logic
let eggCost = 25;
function buyEgg() {
    if (state.honey >= eggCost) {
        state.honey -= eggCost;
        state.bees.push({ id: state.bees.length }); // Mock Bee
        eggCost = Math.floor(eggCost * 1.5);
        return true;
    }
    return false;
}

console.log("Running Logic Tests...");

// Test 1: Pollen Collection & Cap
state.pollen = 0;
collectPollen(50);
assert.strictEqual(state.pollen, 50, "Pollen should be 50");
collectPollen(60); // Should cap at 100
assert.strictEqual(state.pollen, 100, "Pollen should cap at 100");
console.log("Test 1 Passed: Pollen Collection & Cap");

// Test 2: Conversion
convertPollen();
assert.strictEqual(state.pollen, 0, "Pollen should be drained");
assert.strictEqual(state.honey, 100, "Honey should be 100");
console.log("Test 2 Passed: Conversion");

// Test 3: Shop & Cost Scaling
state.honey = 30;
eggCost = 25;
state.bees = [];

const bought1 = buyEgg();
assert.strictEqual(bought1, true, "Should be able to buy first egg");
assert.strictEqual(state.honey, 5, "Honey should be 5 (30-25)");
assert.strictEqual(state.bees.length, 1, "Should have 1 bee");
assert.strictEqual(eggCost, 37, "New cost should be 37 (25 * 1.5 floor)"); // 25*1.5 = 37.5 -> 37

const bought2 = buyEgg();
assert.strictEqual(bought2, false, "Should not be able to buy second egg (cost 37, have 5)");

console.log("Test 3 Passed: Shop & Cost Scaling");

console.log("All Logic Tests Passed!");
