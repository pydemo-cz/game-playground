
class App {
    constructor() {
        this.data = null;
        this.chapters = {};
        this.storage = {
            unlocked: ['Zaklady_kresby'], // First chapter unlocked by default
            stars: {},
            history: {} // { "question_text_hash": error_count }
        };
        this.currentGame = null;

        this.screens = {
            menu: document.getElementById('menu-screen'),
            campaign: document.getElementById('campaign-screen'),
            game: document.getElementById('game-screen'),
            result: document.getElementById('result-screen')
        };

        this.init();
    }

    async init() {
        await this.loadData();
        this.loadStorage();

        // If no chapters unlocked (first run), unlock the first one found
        if (this.storage.unlocked.length === 0 && Object.keys(this.chapters).length > 0) {
            this.storage.unlocked.push(Object.keys(this.chapters)[0]);
            this.saveStorage();
        }

        this.showMenu();
    }

    async loadData() {
        try {
            const response = await fetch('data.json');
            const json = await response.json();

            // Handle structure: check if 'sample' exists or use root
            const root = json.sample || json;

            // Filter for valid chapters (objects with 'questions' array)
            for (const key in root) {
                if (root[key] && root[key].questions && Array.isArray(root[key].questions)) {
                    this.chapters[key] = root[key];
                }
            }
            console.log("Loaded chapters:", Object.keys(this.chapters));
        } catch (e) {
            console.error("Failed to load data", e);
            alert("Chyba při načítání dat!");
        }
    }

    loadStorage() {
        const saved = localStorage.getItem('gamedesign_quiz_save');
        if (saved) {
            this.storage = JSON.parse(saved);
        }
    }

    saveStorage() {
        localStorage.setItem('gamedesign_quiz_save', JSON.stringify(this.storage));
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(el => {
            el.classList.remove('active');
            el.classList.add('hidden');
        });
        const target = this.screens[screenName];
        target.classList.remove('hidden');
        // Small delay to allow display:none to unapply before opacity transition
        setTimeout(() => {
            target.classList.add('active');
        }, 10);
    }

    showMenu() {
        this.showScreen('menu');
    }

    // --- Campaign Mode ---
    startCampaign() {
        const list = document.getElementById('chapter-list');
        list.innerHTML = '';

        Object.keys(this.chapters).forEach(key => {
            const isUnlocked = this.storage.unlocked.includes(key);
            const stars = this.storage.stars[key] || 0;
            const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);

            // Format title: use title property or fallback to key
            let title = this.chapters[key].title || key.replace(/_/g, ' ');

            const card = document.createElement('div');
            card.className = `chapter-card ${isUnlocked ? '' : 'locked'}`;
            card.innerHTML = `
                <span class="chapter-title">${title}</span>
                <span class="chapter-stars">${isUnlocked ? starStr : '🔒'}</span>
            `;

            if (isUnlocked) {
                card.onclick = () => this.launchGame('campaign', key);
            }

            list.appendChild(card);
        });

        this.showScreen('campaign');
    }

    // --- Survival Mode ---
    startSurvival() {
        // Collect all questions
        let allQuestions = [];
        Object.values(this.chapters).forEach(chap => {
            allQuestions = allQuestions.concat(chap.questions);
        });

        if (allQuestions.length === 0) return alert("Žádné otázky k dispozici!");

        // Shuffle
        allQuestions.sort(() => Math.random() - 0.5);

        this.launchGame('survival', null, allQuestions);
    }

    // --- Training Mode ---
    startTraining() {
        // Collect questions weighted by errors
        let trainingSet = [];

        Object.values(this.chapters).forEach(chap => {
            chap.questions.forEach(q => {
                const id = this.getQuestionId(q);
                const errors = this.storage.history[id] || 0;
                if (errors > 0) {
                    trainingSet.push(q);
                }
            });
        });

        if (trainingSet.length === 0) {
            alert("Zatím nemáš žádné chyby k procvičování! Spouštím náhodný výběr.");
            this.startSurvival(); // Fallback
            return;
        }

        // Shuffle
        trainingSet.sort(() => Math.random() - 0.5);
        this.launchGame('training', null, trainingSet);
    }

    launchGame(mode, chapterId = null, customQuestions = null) {
        let questions = customQuestions;
        if (mode === 'campaign') {
            questions = [...this.chapters[chapterId].questions];
        }

        this.currentGame = new Game(this, mode, questions, chapterId);
        this.showScreen('game');
        this.currentGame.start();
    }

    // Helper to identify questions uniquely (using question text hash/string)
    getQuestionId(q) {
        return q.question; // Simple enough for this scale
    }

    recordResult(isCorrect, question) {
        const id = this.getQuestionId(question);
        if (!this.storage.history[id]) this.storage.history[id] = 0;

        if (isCorrect) {
            // If correct, reduce error count (gradually remove from training)
            if (this.storage.history[id] > 0) this.storage.history[id]--;
        } else {
            this.storage.history[id]++;
        }
        this.saveStorage();
    }

    completeLevel(score, total, stars) {
        const game = this.currentGame;

        if (game.mode === 'campaign') {
            // Save stars
            const oldStars = this.storage.stars[game.chapterId] || 0;
            if (stars > oldStars) {
                this.storage.stars[game.chapterId] = stars;
            }

            // Unlock next chapter if we have at least 1 star
            if (stars >= 1) {
                const chapterKeys = Object.keys(this.chapters);
                const idx = chapterKeys.indexOf(game.chapterId);
                if (idx > -1 && idx < chapterKeys.length - 1) {
                    const nextKey = chapterKeys[idx + 1];
                    if (!this.storage.unlocked.includes(nextKey)) {
                        this.storage.unlocked.push(nextKey);
                    }
                }
            }
            this.saveStorage();
        }

        // Show Results
        document.getElementById('result-title').innerText =
            game.mode === 'survival' ? 'KONEC HRY' : 'KAPITOLA DOKONČENA';

        document.getElementById('final-score').innerText = `${score} / ${total}`;

        let msg = "";
        let starDisplay = "";

        if (game.mode === 'survival') {
            msg = `Přežil jsi ${score} otázek!`;
            starDisplay = "💀";
            document.getElementById('next-level-btn').style.display = 'none';
        } else {
            starDisplay = '★'.repeat(stars) + '☆'.repeat(3 - stars);
            if (stars === 3) msg = "Perfektní!";
            else if (stars === 2) msg = "Dobrá práce!";
            else if (stars === 1) msg = "Splněno.";
            else msg = "Zkus to znovu.";

            // Show "Next Level" only if in campaign and passed
            const nextBtn = document.getElementById('next-level-btn');
            if (game.mode === 'campaign' && stars >= 1) {
                nextBtn.style.display = 'inline-block';
            } else {
                nextBtn.style.display = 'none';
            }
        }

        document.getElementById('result-message').innerText = msg;
        document.getElementById('result-stars').innerText = starDisplay;

        this.showScreen('result');
    }

    restartLevel() {
        if (this.currentGame) {
            if (this.currentGame.mode === 'campaign') {
                this.launchGame('campaign', this.currentGame.chapterId);
            } else if (this.currentGame.mode === 'survival') {
                this.startSurvival();
            } else {
                this.startTraining();
            }
        }
    }

    nextLevel() {
        if (this.currentGame && this.currentGame.mode === 'campaign') {
            const keys = Object.keys(this.chapters);
            const idx = keys.indexOf(this.currentGame.chapterId);
            if (idx > -1 && idx < keys.length - 1) {
                this.launchGame('campaign', keys[idx + 1]);
            } else {
                this.showMenu(); // No more levels
            }
        }
    }
}

class Game {
    constructor(app, mode, questions, chapterId) {
        this.app = app;
        this.mode = mode;
        this.questions = questions;
        this.chapterId = chapterId; // Only for campaign

        this.currentIndex = 0;
        this.score = 0;
        this.lives = 3;
        this.isBusy = false; // block input during transitions
    }

    start() {
        this.updateUIHeader();
        this.renderQuestion();
    }

    updateUIHeader() {
        let label = this.mode.toUpperCase();
        if (this.mode === 'campaign') {
             label = this.app.chapters[this.chapterId].title || this.chapterId.replace(/_/g, ' ');
        }
        document.getElementById('game-mode-label').innerText = label;

        const livesDisplay = document.getElementById('lives-display');
        if (this.mode === 'survival') {
            livesDisplay.style.display = 'block';
            livesDisplay.innerText = '❤️'.repeat(this.lives);
        } else {
            livesDisplay.style.display = 'none';
        }

        document.getElementById('score-display').innerText = `SKÓRE: ${this.score}`;

        // Update progress bar
        const progress = this.mode === 'survival' ? 100 : ((this.currentIndex / this.questions.length) * 100);
        document.getElementById('progress-bar').style.width = `${progress}%`;
    }

    renderQuestion() {
        if (this.currentIndex >= this.questions.length && this.mode !== 'survival') {
            this.finish();
            return;
        }

        const q = this.questions[this.currentIndex];
        document.getElementById('question-text').innerText = q.question;

        const grid = document.getElementById('answers-grid');
        grid.innerHTML = '';

        // Shuffle answers visually but keep track of text
        const answers = [...q.answers].sort(() => Math.random() - 0.5);

        answers.forEach(ans => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.innerText = ans;
            btn.onclick = () => this.selectAnswer(ans, btn);
            grid.appendChild(btn);
        });

        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('feedback-message').classList.add('hidden');
        this.isBusy = false;

        this.updateUIHeader();
    }

    selectAnswer(selectedText, btnElement) {
        if (this.isBusy) return;
        this.isBusy = true;

        const q = this.questions[this.currentIndex];
        const isCorrect = (selectedText === q.correct);

        // Visual feedback
        if (isCorrect) {
            btnElement.classList.add('correct');
            document.getElementById('feedback-message').innerText = "SPRÁVNĚ!";
            document.getElementById('feedback-message').style.color = "var(--success-color)";
            this.score++;
        } else {
            btnElement.classList.add('wrong');
            btnElement.classList.add('shake');
            document.getElementById('feedback-message').innerText = "ŠPATNĚ!";
            document.getElementById('feedback-message').style.color = "var(--error-color)";

            // Highlight correct one
            const buttons = document.querySelectorAll('.answer-btn');
            buttons.forEach(b => {
                if (b.innerText === q.correct) b.classList.add('correct');
            });

            if (this.mode === 'survival') {
                this.lives--;
            }
        }

        document.getElementById('feedback-message').classList.remove('hidden');

        // Record for training
        this.app.recordResult(isCorrect, q);

        // Logic flow
        if (this.mode === 'survival' && this.lives <= 0) {
            setTimeout(() => this.finish(), 1500);
        } else {
            document.getElementById('next-btn').classList.remove('hidden');
        }
    }

    nextQuestion() {
        this.currentIndex++;
        this.renderQuestion();
    }

    finish() {
        // Calculate stars
        let stars = 0;
        let total = this.mode === 'survival' ? this.currentIndex : this.questions.length; // In survival, total is attempts

        if (this.mode !== 'survival') {
            const percentage = this.score / total;
            if (percentage === 1) stars = 3;
            else if (percentage >= 0.7) stars = 2;
            else if (percentage >= 0.5) stars = 1;
        }

        this.app.completeLevel(this.score, total, stars);
    }
}

// Start App
const app = new App();
