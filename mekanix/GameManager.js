import Matter from 'matter-js';

export class GameManager {
    constructor(physics, levelManager) {
        this.physics = physics;
        this.levelManager = levelManager;
        this.editor = null; // Will be assigned

        this.state = 'PLAY'; // PLAY | EDIT
        this.workingLevelData = null;

        // Bind methods
        this.toggleMode = this.toggleMode.bind(this);
    }

    setEditor(editor) {
        this.editor = editor;
    }

    toggleMode() {
        if (this.state === 'PLAY') {
            this.enterEditMode();
        } else {
            this.enterPlayMode();
        }
    }

    enterEditMode() {
        this.state = 'EDIT';
        Matter.Runner.stop(this.physics.runner);

        // If we have working data (from just before playing), restore it.
        // Otherwise reset to loaded level.
        if (this.workingLevelData) {
            this.levelManager.loadLevel(this.workingLevelData);
        } else {
            this.levelManager.resetLevel();
        }

        // Show Editor UI
        document.body.classList.add('edit-mode');
        if (this.editor) this.editor.onEnter();
    }

    enterPlayMode() {
        this.state = 'PLAY';

        // Snapshot the editor state!
        // The editor modifies live objects, so we need to export them back to data
        // so we can restore them later or use them as the "Initial State" for this run.
        this.workingLevelData = this.levelManager.exportLevel();

        // Now reload the level from this snapshot to ensure physics state is fresh/clean
        this.levelManager.loadLevel(this.workingLevelData);

        if (this.editor) this.editor.onExit();

        Matter.Runner.run(this.physics.runner, this.physics.engine);
        document.body.classList.remove('edit-mode');
    }

    update(dt) {
        if (this.state === 'PLAY') {
            this.levelManager.update(dt);
        } else {
            if (this.editor) this.editor.update(dt);
        }
    }

    draw(ctx) {
        if (this.state === 'EDIT' && this.editor) {
            this.editor.draw(ctx);
        }
    }
}
