// CONFIGURATION
const TEXT_MODEL = "HuggingFaceH4/zephyr-7b-beta";
const IMAGE_MODEL = "stabilityai/stable-diffusion-2-1";
const MAX_HISTORY = 10; // Keep last 10 turns to avoid token limits

// STATE
let state = {
    apiKey: null,
    style: "",
    goal: "",
    history: [], // Array of { role: 'user'|'assistant'|'system', content: string }
    currentImageBlob: null
};

// DOM ELEMENTS
const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    apiKey: document.getElementById('api-key'),
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
    // Load persisted API key if available
    const savedKey = localStorage.getItem('hf_api_key');
    if (savedKey) inputs.apiKey.value = savedKey;

    // Event Listeners
    ui.btnStart.addEventListener('click', startGame);
    ui.btnSend.addEventListener('click', handleUserTurn);
    inputs.chat.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUserTurn();
    });
});

function startGame() {
    const key = inputs.apiKey.value.trim();
    const style = inputs.style.value;
    const goal = inputs.goal.value.trim();

    if (!key) {
        alert("Please enter a Hugging Face API Key.");
        return;
    }
    if (!goal) {
        alert("Please describe what you want to experience.");
        return;
    }

    // Save key locally
    localStorage.setItem('hf_api_key', key);

    // Update State
    state.apiKey = key;
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
    inputs.chat.disabled = true; // Prevent double submit

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

    // Prune history to MAX_HISTORY to save tokens (keep System prompt at index 0)
    if (state.history.length > MAX_HISTORY + 1) {
        // Keep system prompt (index 0) + last MAX_HISTORY items
        const systemMsg = state.history[0];
        const recentHistory = state.history.slice(-MAX_HISTORY);
        state.history = [systemMsg, ...recentHistory];
    }

    // 2. Call Text API
    addMessage('system', 'Thinking...');
    const loadingMsg = ui.chatLog.lastElementChild; // Keep ref to remove later

    try {
        let aiResponse = await callTextAPI(state.history);

        // Remove "Thinking..."
        loadingMsg.remove();

        // 3. Process Response (Check for [IMAGE])
        let shouldGenImage = false;
        if (aiResponse.includes('[IMAGE]')) {
            shouldGenImage = true;
            aiResponse = aiResponse.replace('[IMAGE]', '').trim();
        }

        // Add to history (cleaned)
        state.history.push({ role: 'assistant', content: aiResponse });

        // Show Text
        addMessage('ai', aiResponse);

        // 4. Generate Image if needed (or if it's the start)
        if (shouldGenImage || state.history.length <= 2) {
            triggerImageGeneration(aiResponse);
        }

    } catch (error) {
        loadingMsg.remove();
        addMessage('system', `Error: ${error.message}`);
        console.error(error);
    }
}

async function triggerImageGeneration(sceneText) {
    ui.loadingImage.classList.remove('hidden');

    // Create prompt: Style + Truncated Text
    // Truncate text to ~200 chars to avoid very long prompts
    const shortText = sceneText.length > 200 ? sceneText.substring(0, 200) + "..." : sceneText;
    const prompt = `${state.style}, ${shortText}, high quality, masterpiece`;

    try {
        const blob = await callImageAPI(prompt);
        const url = URL.createObjectURL(blob);

        // Cross-fade
        const img = new Image();
        img.onload = () => {
            ui.imageLayer.style.backgroundImage = `url('${url}')`;
            ui.loadingImage.classList.add('hidden');
        };
        img.src = url;

    } catch (error) {
        console.error("Image generation failed:", error);
        ui.loadingImage.classList.add('hidden');
        // Silent fail for image is okay, text is primary
    }
}

// --- UI HELPERS ---

function addMessage(role, text) {
    const div = document.createElement('div');
    div.classList.add('msg', role);
    div.innerText = text;
    ui.chatLog.appendChild(div);

    // Auto scroll to bottom
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

// --- API CLIENT ---

async function callTextAPI(messages) {
    // Zephyr format: <|system|>...</s><|user|>...</s><|assistant|>...
    // We need to format the history for the model manually if not using the chat endpoint,
    // but HF Inference API for Zephyr often accepts the list of messages in 'inputs' if structured correctly
    // or we construct a prompt string.
    // Let's use the standard "chat template" string construction for safety with raw inference API.

    let prompt = "";
    messages.forEach(msg => {
        prompt += `<|${msg.role}|>\n${msg.content}</s>\n`;
    });
    prompt += `<|assistant|>\n`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${TEXT_MODEL}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${state.apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 256,
                temperature: 0.7,
                top_p: 0.9,
                return_full_text: false
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Text API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Result is usually [{ generated_text: "..." }]
    let text = result[0]?.generated_text || "";
    return text.trim();
}

async function callImageAPI(prompt) {
    const response = await fetch(`https://api-inference.huggingface.co/models/${IMAGE_MODEL}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${state.apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: prompt
        })
    });

    if (!response.ok) {
        throw new Error(`Image API Error: ${response.status}`);
    }

    return await response.blob();
}
