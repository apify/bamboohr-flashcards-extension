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
      pendingRetryHashes: (gameState.pendingRetries || []).map(emp => generateNameHash(emp.name)),
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
      pendingRetries: (hashBasedState.pendingRetryHashes || [])
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
  if (document.getElementById('flashcards-btn')) return;
  
  const headerRight = document.querySelector('.EmployeeDirectory__headerRight');
  if (!headerRight) return;
  
  // Create container div similar to AnytimeDirectoryLink
  const flashcardsContainer = document.createElement('div');
  flashcardsContainer.className = 'FlashcardsLink';
  flashcardsContainer.style.cssText = `
    margin-left: 12px;
    display: inline-block;
  `;
  
  // Create button with similar structure to Quick access button
  const flashcardsBtn = document.createElement('button');
  flashcardsBtn.id = 'flashcards-btn';
  flashcardsBtn.className = 'fab-TextButton fab-link';
  flashcardsBtn.type = 'button';
  
  flashcardsBtn.innerHTML = `
    <ba-icon class="" name="flashcards-icon" encore-name="square-arrow-up-right-regular" encore-size="16">
      <svg class="fabric-1extfaq-svg" data-fabric-component="IconV2" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
        <path xmlns="http://www.w3.org/2000/svg" d="M0 96C0 60.7 28.7 32 64 32H384c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM48 368v48c0 8.8 7.2 16 16 16H384c8.8 0 16-7.2 16-16V368H48zM48 256H400V96c0-8.8-7.2-16-16-16H64c-8.8 0-16 7.2-16 16V256zM144 144a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM304 192a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"></path>
      </svg>
    </ba-icon>
    <span class="FlashcardsLink__label" style="margin-left: 6px; font-size: 15px; line-height: 22px;">
      Start Flashcards
    </span>
  `;
  
  flashcardsBtn.addEventListener('click', startFlashcards);
  
  flashcardsContainer.appendChild(flashcardsBtn);
  
  // Insert the flashcards button before the Quick access button
  const anytimeDirectoryLink = headerRight.querySelector('.AnytimeDirectoryLink');
  if (anytimeDirectoryLink) {
    headerRight.insertBefore(flashcardsContainer, anytimeDirectoryLink);
  } else {
    headerRight.appendChild(flashcardsContainer);
  }
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
          </div>
          
          <div id="game-container">
            <div id="loading-state">
              <p>Loading flashcards...</p>
            </div>
          </div>
          
                      <div class="game-controls">
              <button id="restart-btn" style="display: none;">🔄 Restart Game</button>
              <button id="reset-btn" style="display: none;">🔄 Reset Progress</button>
              <button id="clear-memory-btn" style="display: none;">🗑️ Clear Memory</button>
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
    if (confirm('Reset your current game progress? This will start over with all employees but keep your long-term memory.')) {
      clearGameSession();
      initializeFlashcardsGame();
    }
  });
  
  document.getElementById('clear-memory-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved progress? This will reset both your current game and long-term memory.')) {
      clearMasteredEmployees();
      clearGameSession();
      alert('All progress cleared! The game will restart fresh.');
      document.getElementById('flashcards-modal').remove();
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
  if (savedGameState && savedGameState.gameEmployees.length > 0) {
    // Resume existing game
    gameState = savedGameState;
  } else {
    // Start new game with all employees
    gameState = {
      currentIndex: 0,
      correctAnswers: 0,
      seenEmployees: new Set(), // Track employees we've already shown
      pendingRetries: [], // Employees to retry later
      gameEmployees: shuffleArray([...recentEmployees]),
      isGameOver: false
    };
  }
  
  // Don't shuffle if resuming a game
  if (!savedGameState) {
    gameState.gameEmployees = shuffleArray(gameState.gameEmployees);
  }
  
  // Store game state globally for restart functionality
  window.flashcardsGameState = gameState;
  
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
  
  // First, check if we have pending retries and should randomly show one
  if (gameState.pendingRetries.length > 0 && Math.random() < 0.3) {
    // 30% chance to show a retry employee
    const retryIndex = Math.floor(Math.random() * gameState.pendingRetries.length);
    employee = gameState.pendingRetries[retryIndex];
    // Remove from retries since we're showing it now
    gameState.pendingRetries.splice(retryIndex, 1);
    gameState.currentEmployee = employee;
    gameState.isRetry = true;
  } else {
    // Show next unseen employee
    let nextEmployee = null;
    
    // Find the next employee we haven't seen yet
    for (let i = gameState.currentIndex; i < gameState.gameEmployees.length; i++) {
      const emp = gameState.gameEmployees[i];
      const empHash = generateNameHash(emp.name);
      if (!gameState.seenEmployees.has(empHash)) {
        nextEmployee = emp;
        gameState.currentIndex = i + 1;
        break;
      }
    }
    
    if (!nextEmployee) {
      // No more unseen employees, check if we have retries left
      if (gameState.pendingRetries.length > 0) {
        const retryIndex = Math.floor(Math.random() * gameState.pendingRetries.length);
        nextEmployee = gameState.pendingRetries[retryIndex];
        gameState.pendingRetries.splice(retryIndex, 1);
        gameState.isRetry = true;
      } else {
        // Game complete - no more employees and no retries
        showGameComplete();
        return;
      }
    } else {
      // Mark this employee as seen (using hash)
      gameState.seenEmployees.add(generateNameHash(nextEmployee.name));
      gameState.isRetry = false;
    }
    
    employee = nextEmployee;
    gameState.currentEmployee = employee;
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
    
    // Add to pending retries if not already there and if it's not already a retry
    const currentEmpHash = generateNameHash(currentEmployee.name);
    if (!gameState.isRetry && !gameState.pendingRetries.find(emp => generateNameHash(emp.name) === currentEmpHash)) {
      gameState.pendingRetries.push(currentEmployee);
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
  
  // Calculate remaining: unseen employees + pending retries
  const unseenCount = gameState.gameEmployees.length - gameState.seenEmployees.size;
  const totalRemaining = unseenCount + gameState.pendingRetries.length;
  
  document.getElementById('remaining-count').textContent = totalRemaining;
  document.getElementById('correct-count').textContent = gameState.correctAnswers;
  document.getElementById('missed-count').textContent = gameState.pendingRetries.length;
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
  document.getElementById('reset-btn').style.display = 'inline-block';
  document.getElementById('clear-memory-btn').style.display = 'inline-block';
}

// Restart the game
function restartGame() {
  document.getElementById('restart-btn').style.display = 'none';
  document.getElementById('reset-btn').style.display = 'none';
  document.getElementById('clear-memory-btn').style.display = 'none';
  
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  
  // Wait a bit for dynamic content to load
  setTimeout(() => {
    addFlashcardsButton();
  }, 2000);
}

init(); 