/* Registers keyboard events. Uses a velocity object for movement.
   Contains drawing functions: drawCat, drawMaze, drawGoal.
   Implements collision detection and puzzle completion handling.
   Uses requestAnimationFrame for continuous game update loop. */

function drawCat() {
    ctx.fillStyle = 'orange';
    ctx.fillRect(cat.x, cat.y, cat.width, cat.height);
}

function drawMaze() {
    ctx.fillStyle = 'red';
    for (let y = 0; y < mazeHeight; y++) {
        for (let x = 0; x < mazeWidth; x++) {
            if (maze[y][x] === 1) {
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

function drawGoal() {
    ctx.fillStyle = goal.color;
    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
}

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect2.height > rect2.y
    );
}

function checkPuzzleCompletion() {
    if (checkCollision(cat, goal)) {
        alert('You win!');
        resetGame();
    }
}

function resetGame() {
    let validPosition = false;
    while (!validPosition) {
        cat.x = Math.floor(Math.random() * (mazeWidth - 2) + 1) * cellSize;
        cat.y = Math.floor(Math.random() * (mazeHeight - 2) + 1) * cellSize;
        validPosition = maze[cat.y / cellSize][cat.x / cellSize] === 0;
    }
}

function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    drawCat();
    drawMaze();
    drawGoal();
    checkPuzzleCompletion();

    requestAnimationFrame(updateGame);
}

updateGame();
