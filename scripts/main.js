document.addEventListener('DOMContentLoaded', () => {
    fetch('games.json')
        .then(response => response.json())
        .then(data => {
            const gameGrid = document.getElementById('game-grid');
            data.games.forEach(game => {
                const tile = document.createElement('a');
                tile.href = game.url;
                tile.classList.add('game-tile');

                const title = document.createElement('h2');
                title.textContent = game.title;
                tile.appendChild(title);

                const description = document.createElement('p');
                description.textContent = game.description;
                tile.appendChild(description);

                gameGrid.appendChild(tile);
            });
        })
        .catch(error => console.error('Error loading game data:', error));
});