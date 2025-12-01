// CONFIGURATION
const PROXY_URL = "https://hf-proxy.alfa.pidak.cz"; // Assuming HTTPS for production compatibility
const TEXT_MODEL = "deepseek-ai/DeepSeek-V3.2-Exp";
const IMAGE_MODEL = "black-forest-labs/FLUX.1-dev";
const MAX_HISTORY = 10;

// STATE
let state = {
    style: "",
    goal: "",
    history: [], // Array of { role: 'user'|'assistant'|'system', content: string }
};

// DOM ELEMENTS
const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    style: document.getElementById('visual-style'),
    goal: document.getElementById('user-goal'),
    chat: document.getElementById('user-input')
};

const ui = {
    imageLayer: document.getElementById('scene-image'),
    loadingImage: document.getElementById('loading-image'),
    chatLog: document.getElementById('chat-log'),
    btnStart: document.getElementById('btn-start'),
    btnSend: document.getElementById('btn-send')
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    ui.btnStart.addEventListener('click', startGame);
    ui.btnSend.addEventListener('click', handleUserTurn);
    inputs.chat.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUserTurn();
    });
});

function startGame() {
    const style = inputs.style.value;
    const goal = inputs.goal.value.trim();

    if (!goal) {
        alert("Please describe what you want to experience.");
        return;
    }

    // Update State
    state.style = style;
    state.goal = goal;

    // Switch Screen
    screens.setup.classList.remove('active');
    screens.game.classList.add('active');

    // Initialize Story
    startStory();
}

// --- GAME LOGIC ---

async function startStory() {
    addMessage('system', 'Initializing neural link...');

    // Construct System Prompt
    const systemPrompt = `You are an AI Game Master for a text adventure.
    Current Visual Style: ${state.style}
    Player's Goal: ${state.goal}
    Language: Czech (The player speaks Czech, you answer in Czech).

    Instructions:
    1. Act as a narrator. Be descriptive but concise (max 3 sentences per turn).
    2. Always move the story forward based on player input.
    3. IMPORTANT: If the visual scene changes significantly (new location, new monster, important item), append the tag [IMAGE] at the very end of your response.
    4. Start the adventure now by setting the scene based on the player's goal.`;

    state.history.push({ role: 'system', content: systemPrompt });

    // Initial call (simulating user saying "Start")
    await processTurn("Začít příběh.");
}

async function handleUserTurn() {
    const text = inputs.chat.value.trim();
    if (!text) return;

    inputs.chat.value = '';
    inputs.chat.disabled = true;

    await processTurn(text);

    inputs.chat.disabled = false;
    inputs.chat.focus();
}

async function processTurn(userText) {
    // 1. Show User Input
    if (userText !== "Začít příběh.") {
        addMessage('user', userText);
        state.history.push({ role: 'user', content: userText });
    }

    // Prune history
    if (state.history.length > MAX_HISTORY + 1) {
        const systemMsg = state.history[0];
        const recentHistory = state.history.slice(-MAX_HISTORY);
        state.history = [systemMsg, ...recentHistory];
    }

    // 2. Call Text API
    addMessage('system', 'Thinking...');
    const loadingMsg = ui.chatLog.lastElementChild;

    try {
        // Construct prompt from history for the API
        // Since we are using chatCompletion on the proxy, we send the messages array or just the last prompt?
        // The user's proxy seems to accept `inputs` as a string (prompt) OR `messages` if supported.
        // Looking at the proxy code: `messages: [{ role: "user", content: prompt }]` inside `chatCompletion`.
        // WAIT: The proxy code creates a SINGLE user message from `inputs`. It does NOT take a full history array in `inputs`.
        // To maintain history context with this specific proxy implementation, we must concatenate the history into a single string prompt.

        let fullContextPrompt = "";
        state.history.forEach(msg => {
            if(msg.role === 'system') fullContextPrompt += `System: ${msg.content}\n`;
            if(msg.role === 'user') fullContextPrompt += `User: ${msg.content}\n`;
            if(msg.role === 'assistant') fullContextPrompt += `Assistant: ${msg.content}\n`;
        });
        // The proxy wraps `inputs` into `[{role: "user", content: inputs}]`.
        // So we send the full conversation transcript as the "user input" to the model.
        // This is a workaround because the proxy doesn't seem to expose the `messages` array directly in the request body.

        let aiResponse = await callTextAPI(fullContextPrompt);

        if (loadingMsg && loadingMsg.parentNode) loadingMsg.remove();

        // 3. Process Response
        let shouldGenImage = false;
        if (aiResponse.includes('[IMAGE]')) {
            shouldGenImage = true;
            aiResponse = aiResponse.replace('[IMAGE]', '').trim();
        }

        state.history.push({ role: 'assistant', content: aiResponse });
        addMessage('ai', aiResponse);

        // 4. Generate Image
        if (shouldGenImage || state.history.length <= 2) {
            triggerImageGeneration(aiResponse);
        }

    } catch (error) {
        if (loadingMsg && loadingMsg.parentNode) loadingMsg.remove();
        addMessage('system', `Error: ${error.message}`);
        console.error(error);
    }
}

async function triggerImageGeneration(sceneText) {
    ui.loadingImage.classList.remove('hidden');

    const shortText = sceneText.length > 200 ? sceneText.substring(0, 200) + "..." : sceneText;
    const prompt = `${state.style}, ${shortText}, high quality, cinematic lighting, detailed`;

    try {
        const blob = await callImageAPI(prompt);
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            ui.imageLayer.style.backgroundImage = `url('${url}')`;
            ui.loadingImage.classList.add('hidden');
        };
        img.src = url;

    } catch (error) {
        console.error("Image generation failed:", error);
        ui.loadingImage.classList.add('hidden');
    }
}

function addMessage(role, text) {
    const div = document.createElement('div');
    div.classList.add('msg', role);
    div.innerText = text;
    ui.chatLog.appendChild(div);
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

// --- API CLIENT ---

async function callTextAPI(prompt) {
    const response = await fetch(`${PROXY_URL}/api/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: TEXT_MODEL,
            inputs: prompt, // The proxy wraps this as the user message
            parameters: {
                max_new_tokens: 300,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Text API (${response.status}): ${err}`);
    }

    const data = await response.json();
    // Expected format from proxy: { choices: [ { message: { content: "..." } } ] }
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
    }
    // Fallback if proxy returns standard generation format
    else if (Array.isArray(data) && data[0].generated_text) {
        return data[0].generated_text;
    }
    else if (data.generated_text) {
        return data.generated_text;
    }

    return JSON.stringify(data);
}

async function callImageAPI(prompt) {
    const response = await fetch(`${PROXY_URL}/api/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: IMAGE_MODEL,
            inputs: prompt
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Image API (${response.status}): ${err}`);
    }

    return await response.blob();
}
