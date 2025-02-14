const startScreen = document.getElementById('startScreen');
const gameContainer = document.getElementById('gameContainer');
const startButton = document.getElementById('startGame');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');

// إضافة في بداية الملف بعد التعريفات الأساسية
document.addEventListener('contextmenu', (e) => e.preventDefault());

// تحديث إعدادات اللعبة
const config = {
    mazeSize: 51,             // Fixed size for all devices
    cellSize: 12,             // Smaller cell size for better fit
    playerColor: '#f1c40f',
    wallColor: '#2980b9',
    pathColor: '#34495e',
    goalColor: '#2ecc71',
    playerSpeed: 0.2,        // Slower movement speed
    moveThreshold: 0.95,     // Threshold for completing a move
    playerSize: 0.8,
    outlineColor: 'rgba(255, 255, 255, 0.1)',
    boundaryColor: '#2ecc71',
    boundaryWidth: 3,
    totalLevels: 30,
    currentLevel: 1,
    difficulty: 1.0
};

// Make sure maze size is odd
config.mazeSize = config.mazeSize % 2 === 0 ? config.mazeSize + 1 : config.mazeSize;

// Set canvas size to be square and centered
const size = config.mazeSize * config.cellSize;
canvas.width = size;
canvas.height = size;

// تعديل تهيئة الأصوات لتجنب الأخطاء
const sounds = {
    move: {
        play: () => {}, // دالة فارغة
        currentTime: 0
    },
    collect: {
        play: () => {}
    },
    win: {
        play: () => {}
    },
    background: {
        play: () => {},
        loop: false,
        volume: 0
    }
};

// Add particle system
function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.backgroundColor = color;
        particle.style.setProperty('--dx', (Math.random() - 0.5) * 100 + 'px');
        particle.style.setProperty('--dy', (Math.random() - 0.5) * 100 + 'px');
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
    }
}

// Game state
let maze = [];
let player = {
    x: 1,
    y: 1
};
let score = 0;
let startTime = Date.now();
let gameActive = false;
let keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false
};

// Add high score management
let highScores = JSON.parse(localStorage.getItem('mazeHighScores')) || [];

function updateHighScore() {
    const currentScore = {
        level: config.currentLevel,
        time: parseInt(timeElement.textContent),
        date: new Date().toISOString()
    };
    
    highScores.push(currentScore);
    highScores.sort((a, b) => a.time - b.time);
    highScores = highScores.slice(0, 10); // Keep top 10 scores
    
    localStorage.setItem('mazeHighScores', JSON.stringify(highScores));
}

// Add a global goal variable for dynamic assignment
let goal = { x: 1, y: 1 };

// New: Compute the farthest (and thus longest) path from start using BFS
function computeLongestPath() {
    let dist = Array.from({ length: config.mazeSize }, () => Array(config.mazeSize).fill(-1));
    let queue = [];
    dist[1][1] = 0;
    queue.push([1, 1]);
    let farthest = { x: 1, y: 1, d: 0 };
    while (queue.length) {
        const [x, y] = queue.shift();
        const d = dist[y][x];
        if (d > farthest.d) {
            farthest = { x, y, d };
        }
        for (let [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < config.mazeSize && ny >= 0 && ny < config.mazeSize &&
                maze[ny][nx] === 0 && dist[ny][nx] === -1) {
                dist[ny][nx] = d + 1;
                queue.push([nx, ny]);
            }
        }
    }
    return farthest;
}

// Initialize maze
function initMaze() {
    maze = Array(config.mazeSize).fill().map(() => Array(config.mazeSize).fill(1));
    generateMaze(1, 1);
    respawnPlayer();
    
    // Set goal to the farthest reachable cell from the start
    const farthest = computeLongestPath();
    goal.x = farthest.x;
    goal.y = farthest.y;
    
    // Force an open corridor along the longest path from player's start to goal
    const longestPath = findPath(player.x, player.y, goal.x, goal.y);
    if (longestPath) {
        longestPath.forEach(([px, py]) => {
            maze[py][px] = 0;
        });
    }
    
    score = 0;
    startTime = Date.now();
    gameActive = true;
}

// New: Respawn player function (searches for a valid cell starting from top-left)
function respawnPlayer() {
    // Check the (1,1) cell first; if not valid, scan for the first available path cell
    if (maze[1] && maze[1][1] === 0) {
        player = { x: 1, y: 1 };
    } else {
        for (let y = 0; y < config.mazeSize; y++) {
            for (let x = 0; x < config.mazeSize; x++) {
                if (maze[y][x] === 0) {
                    player = { x, y };
                    return;
                }
            }
        }
    }
}

// تحديث دالة توليد المتاهة
function generateMaze(startX, startY) {
    // تهيئة المتاهة بالجدران
    maze = Array(config.mazeSize).fill().map(() => Array(config.mazeSize).fill(1));
    
    // ضمان وجود مسار رئيسي
    function carveMainPath() {
        let x = 1;
        let y = 1;
        maze[y][x] = 0; // نقطة البداية
        
        while (x < config.mazeSize - 2 || y < config.mazeSize - 2) {
            // اختيار الاتجاه بشكل عشوائي مع تفضيل التقدم نحو الهدف
            if (Math.random() < 0.7) {
                // التحرك نحو الهدف
                if (x < config.mazeSize - 2 && Math.random() < 0.5) {
                    maze[y][x + 1] = 0;
                    x += 2;
                } else if (y < config.mazeSize - 2) {
                    maze[y + 1][x] = 0;
                    y += 2;
                }
            } else {
                // إضافة تنوع للمسار
                if (Math.random() < 0.5 && x > 2) {
                    maze[y][x - 1] = 0;
                    x -= 2;
                } else if (y > 2) {
                    maze[y - 1][x] = 0;
                    y -= 2;
                }
            }
            maze[y][x] = 0;
        }
        
        // تأكد من وصول المسار للهدف
        maze[config.mazeSize - 2][config.mazeSize - 2] = 0;
        maze[config.mazeSize - 2][config.mazeSize - 3] = 0;
        maze[config.mazeSize - 3][config.mazeSize - 2] = 0;
    }

    // حفر المسار الرئيسي أولاً
    carveMainPath();
    
    // إضافة المسارات الفرعية
    for (let y = 1; y < config.mazeSize - 1; y += 2) {
        for (let x = 1; x < config.mazeSize - 1; x += 2) {
            if (maze[y][x] === 1 && Math.random() < 0.3) {
                recursiveCarve(x, y);
            }
        }
    }
    
    return maze;
}

// دالة حفر المسارات الفرعية
function recursiveCarve(x, y) {
    const directions = shuffleArray([[0, 2], [2, 0], [0, -2], [-2, 0]]);
    maze[y][x] = 0;
    
    for (const [dx, dy] of directions) {
        const newX = x + dx;
        const newY = y + dy;
        
        if (newX > 0 && newX < config.mazeSize - 1 && 
            newY > 0 && newY < config.mazeSize - 1 && 
            maze[newY][newX] === 1) {
            maze[y + dy/2][x + dx/2] = 0;
            recursiveCarve(newX, newY);
        }
    }
}

// دالة للتأكد من وجود مسار للنهاية
function ensurePathToEnd(startX, startY, endX, endY) {
    const path = findPath(startX, startY, endX, endY);
    if (!path) {
        // إذا لم يوجد مسار، نقوم بإنشاء واحد
        createDirectPath(startX, startY, endX, endY);
    }
}

// دالة لإيجاد المسار باستخدام خوارزمية البحث العميق
function findPath(startX, startY, endX, endY) {
    const visited = new Set();
    const path = [];
    
    function dfs(x, y) {
        const key = `${x},${y}`;
        if (x === endX && y === endY) return true;
        if (x < 0 || x >= config.mazeSize || y < 0 || y >= config.mazeSize ||
            maze[y][x] === 1 || visited.has(key)) return false;
            
        visited.add(key);
        path.push([x, y]);
        
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (let [dx, dy] of directions) {
            if (dfs(x + dx, y + dy)) return true;
        }
        
        path.pop();
        return false;
    }
    
    return dfs(startX, startY) ? path : null;
}

// دالة لإنشاء مسار مباشر
function createDirectPath(startX, startY, endX, endY) {
    let x = startX;
    let y = startY;
    
    // حفر مسار أفقي ثم رأسي
    while (x !== endX) {
        maze[y][x] = 0;
        x += Math.sign(endX - x);
    }
    while (y !== endY) {
        maze[y][x] = 0;
        y += Math.sign(endY - y);
    }
}

// دالة لإضافة مسارات عشوائية إضافية
function addRandomPaths() {
    const extraPaths = Math.floor(config.mazeSize * 0.2); // 20% مسارات إضافية
    
    for (let i = 0; i < extraPaths; i++) {
        const x = Math.floor(Math.random() * (config.mazeSize - 2)) + 1;
        const y = Math.floor(Math.random() * (config.mazeSize - 2)) + 1;
        
        if (maze[y][x] === 1) {
            // فحص الجيران قبل حفر المسار
            const neighbors = countPathNeighbors(x, y);
            if (neighbors <= 2) { // تجنب إنشاء دوائر كثيرة
                maze[y][x] = 0;
            }
        }
    }
}

// دالة لحساب عدد المسارات المجاورة
function countPathNeighbors(x, y) {
    let count = 0;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (let [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < config.mazeSize && ny >= 0 && ny < config.mazeSize && maze[ny][nx] === 0) {
            count++;
        }
    }
    
    return count;
}

// Helper functions
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

function isValidCell(x, y) {
    return x > 0 && x < config.mazeSize - 1 && y > 0 && y < config.mazeSize - 1;
}

// Draw game
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw maze
    maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            ctx.fillStyle = cell ? config.wallColor : config.pathColor;
            ctx.fillRect(x * config.cellSize, y * config.cellSize, config.cellSize, config.cellSize);
        });
    });
    
    // Draw goal
    ctx.fillStyle = config.goalColor;
    ctx.fillRect(
        (config.mazeSize-2) * config.cellSize,
        (config.mazeSize-2) * config.cellSize,
        config.cellSize,
        config.cellSize
    );
}

// Enhanced player drawing
function drawPlayer() {
    ctx.save();
    const centerX = player.x * config.cellSize + config.cellSize/2;
    const centerY = player.y * config.cellSize + config.cellSize/2;
    
    // Add bobbing animation
    const bobAmount = Math.sin(Date.now() / 200) * 2;
    ctx.translate(centerX, centerY + bobAmount);
    
    // Draw cat emoji
    const fontSize = config.cellSize * 1.2; // حجم مناسب للقطة
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐱', 0, 0);
    
    // إضافة تأثير توهج حول القطة
    const glowRadius = config.cellSize * 3;
    const catGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    catGlow.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    catGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = catGlow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawGoal() {
    const goalX = goal.x * config.cellSize + config.cellSize / 2;
    const goalY = goal.y * config.cellSize + config.cellSize / 2;
    
    ctx.save();
    ctx.translate(goalX, goalY);
    
    // رسم تأثير توهج للهدف
    const goalGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, config.cellSize * 2);
    goalGlow.addColorStop(0, 'rgba(46, 204, 113, 0.3)');
    goalGlow.addColorStop(1, 'rgba(46, 204, 113, 0)');
    
    ctx.fillStyle = goalGlow;
    ctx.beginPath();
    ctx.arc(0, 0, config.cellSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // رسم نقطة الهدف
    ctx.fillStyle = config.goalColor;
    ctx.font = `${config.cellSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁', 0, 0);
    
    ctx.restore();
}

// تحديث دالة رسم المتاهة لتحسين الأداء
function drawMaze() {
    const pathPattern = ctx.createPattern(createPathTexture(), 'repeat');
    const wallPattern = ctx.createPattern(createWallTexture(), 'repeat');

    maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellX = x * config.cellSize;
            const cellY = y * config.cellSize;

            ctx.fillStyle = cell ? wallPattern : pathPattern;
            ctx.fillRect(cellX, cellY, config.cellSize, config.cellSize);
        });
    });
}

// دالة لإنشاء نمط الممرات
function createPathTexture() {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = config.cellSize;
    textureCanvas.height = config.cellSize;
    const textureCtx = textureCanvas.getContext('2d');
    
    textureCtx.fillStyle = config.pathColor;
    textureCtx.fillRect(0, 0, config.cellSize, config.cellSize);
    
    return textureCanvas;
}

// دالة لإنشاء نمط الجدران
function createWallTexture() {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = config.cellSize;
    textureCanvas.height = config.cellSize;
    const textureCtx = textureCanvas.getContext('2d');
    
    textureCtx.fillStyle = config.wallColor;
    textureCtx.fillRect(0, 0, config.cellSize, config.cellSize);
    
    return textureCanvas;
}

// Handle player movement
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        e.preventDefault(); // منع تمرير المفاتيح للمتصفح
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        keys[e.key] = false;
    }
});

// New: Update player movement using keyboard controls
function updatePlayer() {
    const oldX = player.x, oldY = player.y;
    // Check one move per key press then reset flag
    if (keys.ArrowUp || keys.w) {
        if (player.y > 0 && maze[player.y - 1][player.x] === 0) player.y--;
        keys.ArrowUp = keys.w = false;
    }
    if (keys.ArrowDown || keys.s) {
        if (player.y < config.mazeSize - 1 && maze[player.y + 1][player.x] === 0) player.y++;
        keys.ArrowDown = keys.s = false;
    }
    if (keys.ArrowLeft || keys.a) {
        if (player.x > 0 && maze[player.y][player.x - 1] === 0) player.x--;
        keys.ArrowLeft = keys.a = false;
    }
    if (keys.ArrowRight || keys.d) {
        if (player.x < config.mazeSize - 1 && maze[player.y][player.x + 1] === 0) player.x++;
        keys.ArrowRight = keys.d = false;
    }
    // If the move would collide with a wall, you could optionally call respawnPlayer();
    // if (maze[player.y][player.x] === 1) { respawnPlayer(); }
}

// Add touch controls for mobile devices
let touchStartX = null, touchStartY = null;
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
});
canvas.addEventListener('touchend', (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    // Determine dominant swipe direction (threshold set to 30px)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx > 0 && player.x < config.mazeSize - 1 && maze[player.y][player.x + 1] === 0) {
            player.x++;
        } else if (dx < 0 && player.x > 0 && maze[player.y][player.x - 1] === 0) {
            player.x--;
        }
    } else if (Math.abs(dy) > 30) {
        if (dy > 0 && player.y < config.mazeSize - 1 && maze[player.y + 1][player.x] === 0) {
            player.y++;
        } else if (dy < 0 && player.y > 0 && maze[player.y - 1][player.x] === 0) {
            player.y--;
        }
    }
    touchStartX = touchStartY = null;
});

// New: Attach event listeners to mobile control buttons
function attachMobileControls() {
    const btnUp = document.getElementById('up');
    const btnDown = document.getElementById('down');
    const btnLeft = document.getElementById('left');
    const btnRight = document.getElementById('right');
    
    btnUp.addEventListener('click', () => {
        if (player.y > 0 && maze[player.y - 1][player.x] === 0) {
            player.y--;
        }
    });
    btnDown.addEventListener('click', () => {
        if (player.y < config.mazeSize - 1 && maze[player.y + 1][player.x] === 0) {
            player.y++;
        }
    });
    btnLeft.addEventListener('click', () => {
        if (player.x > 0 && maze[player.y][player.x - 1] === 0) {
            player.x--;
        }
    });
    btnRight.addEventListener('click', () => {
        if (player.x < config.mazeSize - 1 && maze[player.y][player.x + 1] === 0) {
            player.x++;
        }
    });
}

// Update time
setInterval(() => {
    if (gameActive) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeElement.textContent = elapsed;
    }
}, 1000);

// Remove or modify the window resize handler to preserve maze size
window.addEventListener('resize', () => {
    // Only adjust cell size if needed for extremely small screens
    const maxSize = Math.min(window.innerWidth, window.innerHeight) * 0.95;
    const newCellSize = Math.floor(maxSize / config.mazeSize);
    
    if (newCellSize < config.cellSize) {
        config.cellSize = newCellSize;
        canvas.width = config.mazeSize * config.cellSize;
        canvas.height = config.mazeSize * config.cellSize;
        initMaze();
    }
});

// Modify win condition
function checkWin() {
    if (player.x === goal.x && player.y === goal.y) {
        updateHighScore();
        
        if (config.currentLevel === config.totalLevels) {
            showFinalVictory();
        } else {
            config.currentLevel++;
            config.difficulty += 0.1; // Make each level slightly harder
            initMaze();
        }
    }
}

// Add victory celebration
function showFinalVictory() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000); // elapsed time in seconds
    const message = `تم انهاء اللعبه في خلال ${elapsed} ثانية!`; // Final message with elapsed time
    
    const victoryDiv = document.createElement('div');
    victoryDiv.className = 'victory-screen';
    victoryDiv.innerHTML = `
        <h1>${message}</h1>
        <button onclick="shareOnWhatsApp()">شارك على واتساب</button>
    `;
    
    document.body.appendChild(victoryDiv);
}

// Add WhatsApp sharing
function shareOnWhatsApp() {
    const message = encodeURIComponent(
        "أنا الفاجر! أنا الجامد! أنا أبو جلابية اللي مبيشفش! خلصت ال30 مرحلة أول واحد! يلا منك ليه 😎"
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
}

// Update level display
function updateLevelDisplay() {
    document.getElementById('level').textContent = config.currentLevel;
}

// تحديث حلقة اللعبة
function gameLoop() {
    if (gameActive) {
        updatePlayer();
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawMaze();
    drawGoal();
    drawPlayer();
    checkWin();
    updateLevelDisplay();
    
    requestAnimationFrame(gameLoop);
}

function initCanvas() {
    // Calculate the optimal cell size based on screen size
    const screenMin = Math.min(window.innerWidth, window.innerHeight) * 0.9; // Use 90% of screen
    const idealCellSize = Math.floor(screenMin / config.mazeSize);
    
    // Update cell size but keep it between 8 and 16 pixels
    config.cellSize = Math.max(8, Math.min(16, idealCellSize));
    
    // Calculate canvas size
    const canvasSize = config.mazeSize * config.cellSize;
    
    // Update canvas dimensions
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Update canvas CSS size to match actual size
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
}

// Update the resize handler
window.addEventListener('resize', () => {
    initCanvas();
    // No need to regenerate maze, just redraw it
    draw();
});

// Initialize game only after clicking start
startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    attachMobileControls();
    startGame();
});

// Update the initial game start
function startGame() {
    initCanvas();
    initMaze();
    gameLoop();
}

