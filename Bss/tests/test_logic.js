const assert = require('assert');

// Mocking State and Functions for Logic Testing
const TOOLS = [
    { name: "Stick", cost: 0, power: 1 },
    { name: "Rake", cost: 100, power: 3 },
    { name: "Vacuum", cost: 500, power: 10 }
];

const BACKPACKS = [
    { name: "Pouch", cost: 0, capacity: 100 },
    { name: "Satchel", cost: 200, capacity: 300 },
    { name: "Canister", cost: 1000, capacity: 1000 }
];

const state = {
    pollen: 0,
    honey: 0,
    backpackCapacity: 100,
    currentToolIndex: 0,
    currentBackpackIndex: 0,
    bees: []
};

// Mocking collectPollen
function collectPollen(amount) {
    if (state.pollen < state.backpackCapacity) {
        state.pollen = Math.min(state.pollen + amount, state.backpackCapacity);
    }
}

// Mocking Shop Logic (Simplified for test)
function buyTool() {
    const nextIdx = state.currentToolIndex + 1;
    if (nextIdx < TOOLS.length) {
        const cost = TOOLS[nextIdx].cost;
        if (state.honey >= cost) {
            state.honey -= cost;
            state.currentToolIndex = nextIdx;
            return true;
        }
    }
    return false;
}

function buyBackpack() {
    const nextIdx = state.currentBackpackIndex + 1;
    if (nextIdx < BACKPACKS.length) {
        const cost = BACKPACKS[nextIdx].cost;
        if (state.honey >= cost) {
            state.honey -= cost;
            state.currentBackpackIndex = nextIdx;
            state.backpackCapacity = BACKPACKS[nextIdx].capacity;
            return true;
        }
    }
    return false;
}


console.log("Running Upgrade Logic Tests...");

// Reset State
state.pollen = 0;
state.honey = 200; // Give enough honey for upgrades
state.backpackCapacity = 100;
state.currentToolIndex = 0;
state.currentBackpackIndex = 0;

// Test 1: Buy Tool
const boughtTool = buyTool();
assert.strictEqual(boughtTool, true, "Should be able to buy Rake (Cost 100)");
assert.strictEqual(state.honey, 100, "Honey should be 100 (200-100)");
assert.strictEqual(state.currentToolIndex, 1, "Tool index should be 1");
assert.strictEqual(TOOLS[state.currentToolIndex].name, "Rake", "Tool should be Rake");

// Test 2: Tool Power Effect
// Power of Rake is 3
collectPollen(TOOLS[state.currentToolIndex].power);
assert.strictEqual(state.pollen, 3, "Should collect 3 pollen with Rake");

// Test 3: Buy Backpack
state.honey = 200; // Give honey back
const boughtPack = buyBackpack();
assert.strictEqual(boughtPack, true, "Should be able to buy Satchel (Cost 200)");
assert.strictEqual(state.honey, 0, "Honey should be 0");
assert.strictEqual(state.backpackCapacity, 300, "Capacity should be 300");

// Test 4: Capacity Check
state.pollen = 290;
collectPollen(20); // Add 20, total would be 310, capped at 300
assert.strictEqual(state.pollen, 300, "Pollen should be capped at 300");

console.log("All Upgrade Logic Tests Passed!");
