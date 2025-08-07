# BambooHR Flashcards Extension 🎴

A Chrome extension that helps you memorize your new colleagues' names and roles through an interactive flashcard game. Perfect for onboarding and getting to know your team!

## Features

✨ **Smart Employee Detection** - Automatically extracts employee data from BambooHR directory  
🎮 **Interactive Flashcard Game** - Multiple choice quiz with employee photos  
📊 **Progress Tracking** - Real-time statistics during the game  
🔄 **Memory System** - Employees you miss are shown again for review  
📱 **Responsive Design** - Works on both desktop and mobile  
🎯 **Restart Functionality** - Play multiple rounds to improve your memory  

## How It Works

1. **Visit BambooHR Directory** - Navigate to your company's BambooHR employee directory
2. **Click "Start Flashcards"** - A new button appears in the directory header
3. **Play the Game** - See an employee photo and choose their name and role from 4 options
4. **Learn from Mistakes** - Missed employees are highlighted for review at the end
5. **Track Progress** - See your accuracy and completion stats

## Installation

### Option 1: Load as Unpacked Extension (Development)

1. **Download or Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by clicking the toggle in the top right
4. **Click "Load unpacked"** and select the extension folder
5. **Done!** The extension is now installed

### Option 2: Install from Chrome Web Store (Coming Soon)

*This extension will be published to the Chrome Web Store soon.*

## Usage

1. **Navigate** to your BambooHR directory page:
   ```
   https://[your-company].bamboohr.com/employees/directory.php
   ```

2. **Look for the Flashcards Button** - You'll see a "🎴 Start Flashcards" button in the directory header

3. **Start Playing** - Click the button to begin the flashcard game

4. **Game Flow**:
   - See an employee's profile photo
   - Choose the correct name and role from 4 options
   - Get immediate feedback (green for correct, red for incorrect)
   - Continue through all employees
   - Review missed employees at the end

5. **Restart** - Use the restart button to play again and improve your score

## Game Features

### Statistics Tracking
- **Remaining**: Number of employees left to review
- **Correct**: Number of correct answers
- **Missed**: Number of employees you got wrong

### Smart Review System
- Employees you answer incorrectly are collected for review
- At the end, see photos and details of missed colleagues
- Perfect for focused learning on challenging names

### Adaptive Difficulty
- Questions include the correct answer plus 3 random incorrect options
- Each game shuffles the order for varied practice
- Multiple choice format makes it approachable for beginners

## Technical Details

### Compatibility
- **Chrome Version**: 88+ (Manifest V3)
- **BambooHR**: Works with current BambooHR directory layout
- **Permissions**: Only requires access to BambooHR pages

### Privacy
- **No Data Collection**: All processing happens locally in your browser
- **No External Servers**: No employee data is sent anywhere
- **Local Storage**: Only stores game preferences locally

### File Structure
```
bamboohr-flashcards-extension/
├── manifest.json          # Extension configuration
├── content.js             # Main functionality
├── flashcards.css         # Game styling
├── README.md              # This file
└── bamboo-directory-example.html  # Reference HTML
```

## Development

### Prerequisites
- Chrome browser with Developer Mode enabled
- Basic knowledge of Chrome extension development

### Local Development
1. Clone the repository
2. Make changes to the files
3. Reload the extension in `chrome://extensions/`
4. Test on your BambooHR directory page

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Customization

### Filtering Recent Employees
Currently, the extension uses all employees. To filter for recent hires, modify the `filterRecentEmployees` function in `content.js`:

```javascript
function filterRecentEmployees(employees) {
  // Add logic to filter by hire date if available
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  // Return filtered employees based on your criteria
  return employees.filter(emp => {
    // Add your filtering logic here
    return true; // Currently returns all employees
  });
}
```

### Styling Customization
Modify `flashcards.css` to customize the appearance:
- Colors: Update the CSS color variables
- Layout: Adjust container sizes and spacing
- Animations: Add or modify transition effects

## Troubleshooting

### Extension Not Loading
- Ensure you're on the correct BambooHR URL pattern
- Check that the extension is enabled in `chrome://extensions/`
- Refresh the page after installing the extension

### Button Not Appearing
- Wait 2-3 seconds for the page to fully load
- Make sure you're on the directory page, not the employee list
- Check browser console for any JavaScript errors

### No Employee Data Found
- Ensure employees are visible on the directory page
- Try scrolling down to load more employees
- Check that employee cards have profile images

### Game Not Starting
- Verify that employee data was extracted successfully
- Check browser console for error messages
- Ensure the page has finished loading completely

## Future Enhancements

🔮 **Planned Features**:
- Hire date filtering for truly recent employees
- Difficulty levels (easy/medium/hard)
- Team-based filtering
- Leaderboard and progress tracking
- Import/export of progress data
- Dark mode support

## Support

If you encounter issues or have suggestions:

1. **Check the Console** - Open Developer Tools and check for error messages
2. **Verify Page Structure** - BambooHR may update their layout occasionally
3. **Create an Issue** - Report bugs or request features in the repository

## License

This extension is provided as-is for educational and productivity purposes. Please ensure compliance with your company's policies regarding browser extensions and employee data access.

---

**Happy Learning!** 🎉 Master those colleague names and build stronger workplace connections. 