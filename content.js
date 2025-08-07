// BambooHR Flashcards Extension
let employees = [];
let recentEmployees = [];

// Function to extract employee data from the directory
function extractEmployeeData() {
  const employeeCards = document.querySelectorAll('.EmployeeCardContainer__card');
  const extractedEmployees = [];
  
  employeeCards.forEach(card => {
    try {
      // Get profile image
      const profileImg = card.querySelector('img[alt="profile"]');
      const profileSrc = profileImg ? profileImg.src : null;
      
      // Get name - try multiple selectors
      let name = '';
      const nameLink = card.querySelector('h5 a');
      const nameButton = card.querySelector('h5');
      const nameSpan = card.querySelector('.fabric-16szsoy-Button-content h5');
      
      if (nameLink) {
        name = nameLink.textContent.trim();
      } else if (nameSpan) {
        name = nameSpan.textContent.trim();
      } else if (nameButton) {
        name = nameButton.textContent.trim();
      }
      
      // Get job title/role - usually in the first BodyText after the name
      const roleElement = card.querySelector('p[data-fabric-component="BodyText"]');
      const role = roleElement ? roleElement.textContent.trim() : '';
      
      // Get location - usually in the second BodyText
      const bodyTexts = card.querySelectorAll('p[data-fabric-component="BodyText"]');
      let location = '';
      if (bodyTexts.length > 1) {
        location = bodyTexts[1].textContent.replace(/\s*\|\s*\d+:\d+\s+local\s+time/i, '').trim();
      }
      
      if (name && role && profileSrc) {
        extractedEmployees.push({
          name,
          role,
          location,
          profileSrc,
          id: generateEmployeeId(name)
        });
      }
    } catch (error) {
      console.warn('Error extracting employee data:', error);
    }
  });
  
  return extractedEmployees;
}

// Generate a simple ID for an employee
function generateEmployeeId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Memory system using localStorage with name hashes
function generateNameHash(name) {
  // Simple hash function to avoid storing PII
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function getMasteredEmployees() {
  try {
    const stored = localStorage.getItem('bamboohr-flashcards-mastered');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Error reading mastered employees from localStorage:', error);
    return {};
  }
}

function markEmployeeAsMastered(employeeName) {
  try {
    const mastered = getMasteredEmployees();
    const nameHash = generateNameHash(employeeName);
    const now = Date.now();
    
    // Store hash with timestamp and increment correct count
    if (mastered[nameHash]) {
      mastered[nameHash].correctCount++;
      mastered[nameHash].lastCorrect = now;
    } else {
      mastered[nameHash] = {
        correctCount: 1,
        firstCorrect: now,
        lastCorrect: now
      };
    }
    
    localStorage.setItem('bamboohr-flashcards-mastered', JSON.stringify(mastered));
    return mastered[nameHash].correctCount;
  } catch (error) {
    console.warn('Error saving mastered employee to localStorage:', error);
    return 1;
  }
}

function isEmployeeMastered(employeeName, threshold = 3) {
  try {
    const mastered = getMasteredEmployees();
    const nameHash = generateNameHash(employeeName);
    const record = mastered[nameHash];
    
    if (!record) return false;
    
    // Consider mastered if correctly answered at least 'threshold' times
    // and the last correct answer was recent (within 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return record.correctCount >= threshold && record.lastCorrect > thirtyDaysAgo;
  } catch (error) {
    console.warn('Error checking mastered employee:', error);
    return false;
  }
}

function clearMasteredEmployees() {
  try {
    localStorage.removeItem('bamboohr-flashcards-mastered');
  } catch (error) {
    console.warn('Error clearing mastered employees:', error);
  }
}

// Game session persistence - stores only hashes, no PII
function saveGameState(gameState) {
  try {
    // Create PII-free version with only hashes
    const hashBasedState = {
      currentIndex: gameState.currentIndex,
      correctAnswers: gameState.correctAnswers,
      isGameOver: gameState.isGameOver,
      // Store only employee hashes, not full objects
      seenEmployeeHashes: Array.from(gameState.seenEmployees || []),
      mainQueueHashes: (gameState.mainQueue || []).map(emp => generateNameHash(emp.name)),
      gameEmployeeHashes: (gameState.gameEmployees || []).map(emp => generateNameHash(emp.name))
    };
    localStorage.setItem('bamboohr-flashcards-session', JSON.stringify(hashBasedState));
  } catch (error) {
    console.warn('Error saving game state:', error);
  }
}

function getSavedGameState() {
  try {
    const saved = localStorage.getItem('bamboohr-flashcards-session');
    if (!saved) return null;
    
    const hashBasedState = JSON.parse(saved);
    
    // We need to reconstruct the game state from current employee data
    // This requires the current employee data to be available
    if (!recentEmployees || recentEmployees.length === 0) {
      return null; // Can't restore without current employee data
    }
    
    // Create hash-to-employee mapping for current employees
    const hashToEmployee = {};
    recentEmployees.forEach(emp => {
      hashToEmployee[generateNameHash(emp.name)] = emp;
    });
    
    // Reconstruct game state with current employee objects
    const gameState = {
      currentIndex: hashBasedState.currentIndex || 0,
      correctAnswers: hashBasedState.correctAnswers || 0,
      isGameOver: hashBasedState.isGameOver || false,
      seenEmployees: new Set(hashBasedState.seenEmployeeHashes || []),
      mainQueue: (hashBasedState.mainQueueHashes || [])
        .map(hash => hashToEmployee[hash])
        .filter(emp => emp), // Remove any employees no longer in directory
      gameEmployees: (hashBasedState.gameEmployeeHashes || [])
        .map(hash => hashToEmployee[hash])
        .filter(emp => emp), // Remove any employees no longer in directory
      missedEmployees: [] // Reset missed employees for new session
    };
    
    return gameState;
  } catch (error) {
    console.warn('Error loading game state:', error);
  }
  return null;
}

function clearGameSession() {
  try {
    localStorage.removeItem('bamboohr-flashcards-session');
  } catch (error) {
    console.warn('Error clearing game session:', error);
  }
}

// Filter employees who joined in the last 3 months
function filterRecentEmployees(employees) {
  // Since we don't have hire date from the DOM, we'll use all employees for now
  // In a real implementation, you might need to access additional data or 
  // modify this to work with available information
  return employees;
}

// Add flashcards button to the page
function addFlashcardsButton() {
  // Check if button already exists
  if (document.getElementById('flashcards-btn')) {
    console.log('Flashcards button already exists');
    return;
  }
  
  // Look for the Directory heading
  const directoryTitle = document.querySelector('.PageHeader__title');
  if (!directoryTitle || !directoryTitle.textContent.includes('Directory')) {
    console.log('Directory title not found, trying alternative selectors...');
    
    // Try alternative selectors for Directory heading
    const alternatives = [
      'h2:contains("Directory")',
      '[class*="PageHeader__title"]',
      '.PageHeader h2',
      'h1, h2, h3'
    ];
    
    let foundTitle = null;
    for (const selector of alternatives) {
      if (selector.includes('contains')) {
        // For contains selector, manually check
        const elements = document.querySelectorAll('h2');
        for (const el of elements) {
          if (el.textContent.includes('Directory')) {
            foundTitle = el;
            break;
          }
        }
      } else {
        foundTitle = document.querySelector(selector);
        if (foundTitle && foundTitle.textContent.includes('Directory')) {
          break;
        }
        foundTitle = null;
      }
      
      if (foundTitle) {
        console.log('Found Directory title with selector:', selector);
        break;
      }
    }
    
    if (!foundTitle) {
      console.log('No Directory title found for flashcards button');
      return;
    }
    
    insertButtonNextToTitle(foundTitle);
    return;
  }
  
  insertButtonNextToTitle(directoryTitle);
}

function insertButtonNextToTitle(titleElement) {
  console.log('Inserting flashcards button next to title:', titleElement);
  
  // Create a wrapper span for the title and icon
  const titleWrapper = document.createElement('span');
  titleWrapper.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 12px;
  `;
  
  // Create the flashcards icon button
  const flashcardsBtn = document.createElement('button');
  flashcardsBtn.id = 'flashcards-btn';
  flashcardsBtn.type = 'button';
  flashcardsBtn.title = 'Start Flashcards Game';
  flashcardsBtn.style.cssText = `
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;
  
  flashcardsBtn.innerHTML = `
    <svg class="flashcards-icon-large" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; fill: #0061ff;">
      <path d="M0 96C0 60.7 28.7 32 64 32H384c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM48 368v48c0 8.8 7.2 16 16 16H384c8.8 0 16-7.2 16-16V368H48zM48 256H400V96c0-8.8-7.2-16-16-16H64c-8.8 0-16 7.2-16 16V256zM144 144a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM304 192a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"></path>
    </svg>
  `;
  
  // Add hover effects
  flashcardsBtn.addEventListener('mouseenter', () => {
    flashcardsBtn.style.transform = 'scale(1.1)';
    flashcardsBtn.style.backgroundColor = 'rgba(0, 97, 255, 0.1)';
    flashcardsBtn.querySelector('svg').style.fill = '#0056e0';
  });
  
  flashcardsBtn.addEventListener('mouseleave', () => {
    flashcardsBtn.style.transform = 'scale(1)';
    flashcardsBtn.style.backgroundColor = 'transparent';
    flashcardsBtn.querySelector('svg').style.fill = '#0061ff';
  });
  
  flashcardsBtn.addEventListener('click', startFlashcards);
  
  // Get the current title text
  const titleText = titleElement.textContent;
  
  // Replace the title content with our wrapper
  titleElement.textContent = '';
  
  // Add the title text back
  const titleSpan = document.createElement('span');
  titleSpan.textContent = titleText;
  
  // Add both to the wrapper
  titleWrapper.appendChild(titleSpan);
  titleWrapper.appendChild(flashcardsBtn);
  
  // Add wrapper to the title element
  titleElement.appendChild(titleWrapper);
  
  console.log('Flashcards button successfully added next to Directory title');
}

// Start the flashcards game
function startFlashcards() {
  employees = extractEmployeeData();
  recentEmployees = filterRecentEmployees(employees);
  
  if (recentEmployees.length === 0) {
    alert('No employee data found. Make sure you\'re on the BambooHR directory page.');
    return;
  }
  
  console.log(`Found ${recentEmployees.length} employees for flashcards`);
  
  // Create and show flashcards modal
  createFlashcardsModal();
}

// Create the flashcards game modal
function createFlashcardsModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('flashcards-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'flashcards-modal';
  modal.innerHTML = `
    <div class="flashcards-overlay">
      <div class="flashcards-container">
        <div class="flashcards-header">
          <h2 class="flashcards-title">🎴 Colleague Flashcards</h2>
          <button class="close-btn" id="close-modal-btn">×</button>
        </div>
        <div class="flashcards-content">
          <div class="game-stats">
            <div class="stat">
              <span class="stat-label">Remaining:</span>
              <span id="remaining-count">0</span>
            </div>
            <div class="stat">
              <span class="stat-label">Correct:</span>
              <span id="correct-count">0</span>
            </div>
            <div class="stat">
              <span class="stat-label">To Retry:</span>
              <span id="missed-count">0</span>
            </div>
            <div class="stat-reset">
              <button id="reset-btn" class="reset-btn-icon">
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M142.9 142.9c-17.5 17.5-30.1 38-37.8 59.8c-5.9 16.7-24.2 25.4-40.8 19.5s-25.4-24.2-19.5-40.8C55.6 150.7 73.2 122 97.6 97.6c87.2-87.2 228.3-87.5 315.8-1L455 55c6.9-6.9 17.2-8.9 26.2-5.2s14.8 12.5 14.8 22.2l0 128c0 13.3-10.7 24-24 24l-8.4 0c0 0 0 0 0 0L335.4 224c-9.7 0-18.5-5.8-22.2-14.8s-1.7-19.3 5.2-26.2l41.1-41.1c-62.6-61.5-163.1-61.2-225.4 1.1z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div id="game-container">
            <div id="loading-state">
              <p>Loading flashcards...</p>
            </div>
          </div>
          
                      <div class="game-controls">
              <button id="restart-btn" style="display: none;">🔄 Restart Game</button>
            </div>
            
            <div class="flashcards-disclaimer">
              Vibecoded by <a href="https://www.linkedin.com/in/marektrunkat/" target="_blank" rel="noopener">Marek Trunkát</a> @ <a href="https://apify.com" target="_blank" rel="noopener">Apify</a>
            </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners for modal controls
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('flashcards-modal').remove();
  });
  
  document.getElementById('restart-btn').addEventListener('click', () => {
    restartGame();
  });
  
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all progress? This will clear your game and learning memory, starting completely fresh.')) {
      clearMasteredEmployees();
      clearGameSession();
      initializeFlashcardsGame();
    }
  });
  
  // Initialize the game
  initializeFlashcardsGame();
}

// Initialize the flashcards game
function initializeFlashcardsGame() {
  // Check if there's an existing game session
  const savedGameState = getSavedGameState();
  
  let gameState;
  if (savedGameState && savedGameState.gameEmployees.length > 0 && savedGameState.mainQueue) {
    // Resume existing game (only if it has the new mainQueue structure)
    gameState = savedGameState;
  } else {
    // Clear any old incompatible saved state
    if (savedGameState) {
      console.log('Clearing old incompatible saved game state');
      clearGameSession();
    }
    // Start new game with all employees
    const shuffledEmployees = shuffleArray([...recentEmployees]);
    gameState = {
      currentIndex: 0,
      correctAnswers: 0,
      seenEmployees: new Set(), // Track employees we've already shown
      mainQueue: [...shuffledEmployees], // Initialize main queue with all employees
      gameEmployees: shuffledEmployees,
      missedEmployees: [], // Track employees that were answered incorrectly
      isGameOver: false
    };
  }
  
  // Don't shuffle if resuming a game
  if (!savedGameState) {
    gameState.gameEmployees = shuffleArray(gameState.gameEmployees);
  }
  
  // Store game state globally for restart functionality
  window.flashcardsGameState = gameState;
  
  // Debug logging
  console.log('Game initialized with:', {
    totalEmployees: gameState.gameEmployees.length,
    mainQueueLength: gameState.mainQueue ? gameState.mainQueue.length : 0,
    seenEmployees: gameState.seenEmployees.size
  });
  
  // Save initial game state
  saveGameState(gameState);
  
  updateStats();
  showNextEmployee();
}

// Show the next employee flashcard
function showNextEmployee() {
  const gameState = window.flashcardsGameState;
  const gameContainer = document.getElementById('game-container');
  
  let employee = null;
  
  // Initialize the main queue if it doesn't exist
  if (!gameState.mainQueue) {
    // Create main queue with all unseen employees
    gameState.mainQueue = [];
    for (let i = gameState.currentIndex; i < gameState.gameEmployees.length; i++) {
      const emp = gameState.gameEmployees[i];
      const empHash = generateNameHash(emp.name);
      if (!gameState.seenEmployees.has(empHash)) {
        gameState.mainQueue.push(emp);
      }
    }
    // Add any existing pending retries to the end
    if (gameState.pendingRetries && gameState.pendingRetries.length > 0) {
      gameState.mainQueue.push(...gameState.pendingRetries);
      gameState.pendingRetries = []; // Clear the old retry queue
    }
  }
  
  // Take the next employee from the front of the main queue
  if (gameState.mainQueue.length > 0) {
    const nextEmployee = gameState.mainQueue.shift();
    const empHash = generateNameHash(nextEmployee.name);
    
    // Check if this is a retry (already seen before)
    gameState.isRetry = gameState.seenEmployees.has(empHash);
    
    // Mark as seen if it's not already
    if (!gameState.isRetry) {
      gameState.seenEmployees.add(empHash);
    }
    
    employee = nextEmployee;
    gameState.currentEmployee = employee;
  } else {
    // Game complete - no more employees in queue
    showGameComplete();
    return;
  }
  
  if (!employee) {
    showGameComplete();
    return;
  }
  
  // Create answer options (correct answer + 3 random incorrect answers)
  const options = generateAnswerOptions(employee, gameState.gameEmployees);
  
  gameContainer.innerHTML = `
    <div class="flashcard">
      <div class="employee-photo">
        <img src="${employee.profileSrc}" alt="Employee photo" />
      </div>
      
      <div class="question-section">
        <h3>Who is this person?</h3>
        <div class="answer-options">
          ${options.map((option, index) => `
            <button class="answer-btn" data-option-index="${index}" data-option-id="${option.id}">
              <div class="answer-name">${option.name}</div>
              <div class="answer-role">${option.role}</div>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Store correct answer for checking
  gameContainer.dataset.correctId = employee.id;
  
  // Add event listeners to answer buttons
  const answerButtons = gameContainer.querySelectorAll('.answer-btn');
  answerButtons.forEach(button => {
    button.addEventListener('click', () => {
      const optionIndex = parseInt(button.dataset.optionIndex);
      const optionId = button.dataset.optionId;
      selectAnswer(optionIndex, optionId);
    });
  });
}

// Generate answer options for the current employee
function generateAnswerOptions(correctEmployee, allEmployees) {
  const options = [{
    id: correctEmployee.id,
    name: correctEmployee.name,
    role: correctEmployee.role
  }];
  
  // Add 3 random incorrect options
  const otherEmployees = allEmployees.filter(emp => emp.id !== correctEmployee.id);
  const shuffledOthers = shuffleArray(otherEmployees);
  
  for (let i = 0; i < 3 && i < shuffledOthers.length; i++) {
    const emp = shuffledOthers[i];
    options.push({
      id: emp.id,
      name: emp.name,
      role: emp.role
    });
  }
  
  return shuffleArray(options);
}

// Handle answer selection
function selectAnswer(optionIndex, selectedId) {
  const gameState = window.flashcardsGameState;
  const gameContainer = document.getElementById('game-container');
  const correctId = gameContainer.dataset.correctId;
  const currentEmployee = gameState.currentEmployee;
  
  const answerButtons = document.querySelectorAll('.answer-btn');
  answerButtons.forEach(btn => btn.disabled = true);
  
  if (selectedId === correctId) {
    // Correct answer
    answerButtons[optionIndex].classList.add('correct');
    gameState.correctAnswers++;
    
    // Mark employee as correctly answered in memory
    markEmployeeAsMastered(currentEmployee.name);
    
    // Show simple success feedback
    answerButtons[optionIndex].innerHTML += '<div style="font-size: 11px; color: #28a745; margin-top: 4px;">✓ Correct!</div>';
    
    setTimeout(() => {
      // Save game state and continue
      saveGameState(gameState);
      updateStats();
      showNextEmployee();
    }, 1500);
  } else {
    // Incorrect answer
    answerButtons[optionIndex].classList.add('incorrect');
    
    // Highlight correct answer
    answerButtons.forEach((btn, idx) => {
      if (btn.dataset.optionId === correctId) {
        btn.classList.add('correct');
      }
    });
    
    // Add to the end of the main queue if not already there
    const currentEmpHash = generateNameHash(currentEmployee.name);
    
    // Initialize main queue if it doesn't exist
    if (!gameState.mainQueue) {
      gameState.mainQueue = [];
    }
    
    // Check if employee is not already in the main queue
    if (!gameState.mainQueue.find(emp => generateNameHash(emp.name) === currentEmpHash)) {
      gameState.mainQueue.push(currentEmployee);
    }
    
    // Track missed for statistics
    if (!gameState.missedEmployees) {
      gameState.missedEmployees = [];
    }
    if (!gameState.missedEmployees.find(emp => generateNameHash(emp.name) === currentEmpHash)) {
      gameState.missedEmployees.push(currentEmployee);
    }
    
    setTimeout(() => {
      // Save game state and continue
      saveGameState(gameState);
      updateStats();
      showNextEmployee();
    }, 2500);
  }
}

// Update game statistics
function updateStats() {
  const gameState = window.flashcardsGameState;
  
  // Calculate remaining: all employees left in the main queue
  const totalRemaining = (gameState.mainQueue || []).length;
  
  // Calculate missed count: total people ever added to retry queue
  const missedCount = (gameState.missedEmployees || []).length;
  
  // Debug logging
  console.log('Stats updated:', {
    totalRemaining,
    correctAnswers: gameState.correctAnswers,
    missedCount,
    mainQueueLength: gameState.mainQueue ? gameState.mainQueue.length : 'undefined'
  });
  
  document.getElementById('remaining-count').textContent = totalRemaining;
  document.getElementById('correct-count').textContent = gameState.correctAnswers;
  document.getElementById('missed-count').textContent = missedCount;
}

// Show game completion screen
function showGameComplete() {
  const gameState = window.flashcardsGameState;
  const gameContainer = document.getElementById('game-container');
  
  const accuracy = Math.round((gameState.correctAnswers / gameState.gameEmployees.length) * 100);
  
  gameContainer.innerHTML = `
    <div class="game-complete">
      <h3>🎉 Game Complete!</h3>
      <div class="final-stats">
        <p><strong>Total Employees:</strong> ${gameState.gameEmployees.length}</p>
        <p><strong>Correct Answers:</strong> ${gameState.correctAnswers}</p>
        <p><strong>Accuracy:</strong> ${accuracy}%</p>
        ${gameState.missedEmployees && gameState.missedEmployees.length > 0 ? 
          `<p><strong>Employees to Review:</strong> ${gameState.missedEmployees.length}</p>` : 
          '<p class="perfect-score">Perfect score! All employees recognized correctly! 🌟</p>'
        }
      </div>
      
      ${gameState.missedEmployees.length > 0 ? `
        <div class="missed-employees">
          <h4>Review These Colleagues:</h4>
          <div class="missed-list">
            ${gameState.missedEmployees.map(emp => `
              <div class="missed-employee">
                <img src="${emp.profileSrc}" alt="${emp.name}" />
                <div>
                  <strong>${emp.name}</strong><br>
                  <small>${emp.role}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<p class="perfect-score">Perfect score! 🌟</p>'}
    </div>
  `;
  
  document.getElementById('restart-btn').style.display = 'inline-block';
}

// Restart the game
function restartGame() {
  document.getElementById('restart-btn').style.display = 'none';
  
  // Clear current game session
  clearGameSession();
  
  // Start fresh game
  initializeFlashcardsGame();
}

// Utility function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Make functions globally available
window.selectAnswer = selectAnswer;
window.restartGame = restartGame;

// Wait for page load and add button
function init() {
  console.log('Initializing BambooHR Flashcards Extension');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  
  // Try multiple times with increasing delays
  const tryAddButton = (attempt = 1, maxAttempts = 5) => {
    console.log(`Attempt ${attempt} to add flashcards button`);
    
    addFlashcardsButton();
    
    // Check if button was added successfully
    if (document.getElementById('flashcards-btn')) {
      console.log('Flashcards button added successfully');
      return;
    }
    
    // If not successful and we have more attempts, try again
    if (attempt < maxAttempts) {
      const delay = attempt * 1000; // Increasing delay: 1s, 2s, 3s, 4s
      console.log(`Retrying in ${delay}ms...`);
      setTimeout(() => tryAddButton(attempt + 1, maxAttempts), delay);
    } else {
      console.log('Failed to add flashcards button after all attempts');
    }
  };
  
  // Start trying immediately, then with delays
  tryAddButton();
}

init(); 