/**
 * Express server for auto-git UI
 */

const express = require('express');
const path = require('path');
const { getValidDates, formatDate } = require('./dateUtils');
const { initGit, processDate } = require('./gitOperations');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get available countries
app.get('/api/countries', (req, res) => {
  const { getAvailableCountries } = require('./dateUtils');
  res.json({ success: true, countries: getAvailableCountries() });
});

// API endpoint to check/validate settings before processing
app.post('/api/check', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      percentage, 
      repoPath, 
      remote, 
      country,
      createPR,
      autoMerge,
      prToken,
      baseBranch,
      platform,
      mergeMethod
    } = req.body;
    
    // Validate inputs
    if (!startDate || !endDate || percentage === undefined || !repoPath) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: startDate, endDate, percentage, repoPath' 
      });
    }
    
    const percentageNum = parseFloat(percentage);
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Percentage must be a number between 0 and 100' 
      });
    }
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    if (start > end) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start date must be before end date' 
      });
    }
    
    // Get valid dates (excluding Sundays and holidays)
    const countryCode = country || 'US';
    const validDates = getValidDates(start, end, countryCode);
    
    if (validDates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid dates found in the specified range (all dates are Sundays or holidays)' 
      });
    }
    
    // Calculate how many dates will be processed
    const datesToProcessCount = Math.ceil(validDates.length * (percentageNum / 100));
    
    // Get git user info
    let gitUser = { name: '', email: '' };
    let gitRepoInfo = { exists: false, isRepo: false, remotes: [] };
    
    // Check if directory exists
    gitRepoInfo.exists = require('fs').existsSync(repoPath);
    
    // Get git user name and email (try global first, then local)
    const simpleGit = require('simple-git');
    const globalGit = simpleGit();
    
    try {
      gitUser.name = (await globalGit.getConfig('user.name')).value || 'Not configured';
      gitUser.email = (await globalGit.getConfig('user.email')).value || 'Not configured';
    } catch (e) {
      gitUser.name = 'Not configured';
      gitUser.email = 'Not configured';
    }
    
    // Try to get repo-specific info if repo exists
    if (gitRepoInfo.exists) {
      try {
        const git = simpleGit(repoPath);
        gitRepoInfo.isRepo = await git.checkIsRepo();
        
        if (gitRepoInfo.isRepo) {
          // Try local config first
          try {
            const localName = await git.getConfig('user.name');
            const localEmail = await git.getConfig('user.email');
            if (localName && localName.value) gitUser.name = localName.value;
            if (localEmail && localEmail.value) gitUser.email = localEmail.value;
          } catch (e) {
            // Use global config already set above
          }
          
          // Get remotes
          try {
            const remotes = await git.getRemotes();
            gitRepoInfo.remotes = remotes.map(r => ({ name: r.name, refs: r.refs }));
          } catch (err) {
            gitRepoInfo.remotes = [];
          }
        }
      } catch (error) {
        // Repository might not be initialized yet, that's okay
      }
    }
    
    // Get country name
    const { getAvailableCountries } = require('./dateUtils');
    const countries = getAvailableCountries();
    const selectedCountry = countries.find(c => c.code === countryCode) || { name: countryCode };
    
    res.json({
      success: true,
      settings: {
        startDate,
        endDate,
        country: selectedCountry.name,
        countryCode,
        percentage: percentageNum,
        repoPath,
        remote: remote || 'origin',
        totalValidDates: validDates.length,
        datesToProcess: datesToProcessCount,
        validDatesPreview: validDates.slice(0, 10).map(d => formatDate(d))
      },
      gitUser,
      gitRepoInfo
    });
    
  } catch (error) {
    console.error('Error checking settings:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error checking settings: ${error.message}` 
    });
  }
});

// API endpoint to process git operations
app.post('/api/process', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      percentage, 
      repoPath, 
      remote, 
      country,
      createPR,
      autoMerge,
      prToken,
      baseBranch,
      platform,
      mergeMethod
    } = req.body;
    
    // Validate inputs
    if (!startDate || !endDate || percentage === undefined || !repoPath) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: startDate, endDate, percentage, repoPath' 
      });
    }
    
    const percentageNum = parseFloat(percentage);
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Percentage must be a number between 0 and 100' 
      });
    }
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    if (start > end) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start date must be before end date' 
      });
    }
    
    // Get valid dates (excluding Sundays and holidays)
    const countryCode = country || 'US';
    const validDates = getValidDates(start, end, countryCode);
    
    if (validDates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid dates found in the specified range (all dates are Sundays or holidays)' 
      });
    }
    
    // Calculate how many dates to process based on percentage
    const datesToProcessCount = Math.ceil(validDates.length * (percentageNum / 100));
    
    // Randomly select dates to process (shuffle and take first N)
    const shuffledDates = [...validDates].sort(() => Math.random() - 0.5);
    const datesToProcess = shuffledDates.slice(0, datesToProcessCount);
    
    // Initialize git
    const git = await initGit(repoPath);
    
    // Prepare PR options if PR creation is requested
    const prOptions = createPR ? {
      createPR: true,
      autoMerge: autoMerge || false,
      token: prToken,
      baseBranch: baseBranch || 'main',
      platform: platform,
      mergeMethod: mergeMethod || 'merge'
    } : null;
    
    // Process each selected date (1 commit per date)
    const results = [];
    for (const date of datesToProcess) {
      const result = await processDate(git, date, 1, remote || 'origin', prOptions);
      results.push(result);
      
      // If there's an error, we can choose to continue or stop
      // For now, we'll continue but log the error
      if (!result.success) {
        console.error(`Error processing ${formatDate(date)}:`, result.message);
      }
    }
    
    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    res.json({
      success: true,
      message: `Processed ${results.length} of ${validDates.length} available dates (${percentageNum}%). ${successCount} succeeded, ${failureCount} failed.`,
      totalDates: validDates.length,
      datesToProcess: datesToProcessCount,
      percentage: percentageNum,
      successCount,
      failureCount,
      results
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Auto-Git server running at http://localhost:${PORT}`);
  console.log('Open your browser and navigate to the URL above to use the interface.');
});

