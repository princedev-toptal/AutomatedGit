/**
 * Express server for auto-git UI
 */

const express = require('express');
const path = require('path');
const { getValidDates, formatDate } = require('./dateUtils');
const { initGit, processDate, getCommitHistory } = require('./gitOperations');
const { followAndStar } = require('./prOperations');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Handle static files for both development and packaged (pkg) environments
// pkg bundles files into the executable, so __dirname points to the snapshot directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get available countries
app.get('/api/countries', (req, res) => {
  const { getAvailableCountries } = require('./dateUtils');
  res.json({ success: true, countries: getAvailableCountries() });
});

// API endpoint to follow GitHub user and star repository
app.post('/api/github/follow-and-star', async (req, res) => {
  const requestId = Date.now();
  console.log(`[${requestId}] [FOLLOW-STAR] Request received at ${new Date().toISOString()}`);
  
  try {
    const { username, repoUrl, token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token is required'
      });
    }
    
    if (!username && !repoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either username or repoUrl (or both) must be provided'
      });
    }
    
    console.log(`[${requestId}] [FOLLOW-STAR] Following: ${username || 'N/A'}, Starring: ${repoUrl || 'N/A'}`);
    
    const result = await followAndStar(username, repoUrl, token);
    
    console.log(`[${requestId}] [FOLLOW-STAR] Result:`, result);
    
    res.json(result);
  } catch (error) {
    console.error(`[${requestId}] [FOLLOW-STAR] Error:`, error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// API endpoint to check/validate settings before processing
app.post('/api/check', async (req, res) => {
  const requestId = Date.now();
  console.log(`[${requestId}] [CHECK] Request received at ${new Date().toISOString()}`);
  
  // Set timeout for the request (30 seconds)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[${requestId}] [CHECK] Request timeout after 30 seconds`);
      res.status(504).json({ 
        success: false, 
        message: 'Request timeout: The check operation took too long. This might happen if cloning a large repository.' 
      });
    }
  }, 30000);
  
  try {
    const { 
      startDate, 
      endDate, 
      numBranches, 
      totalCommits,
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
    
    console.log(`[${requestId}] [CHECK] Processing request for repo: ${repoPath}`);
    
    // Validate inputs
    if (!startDate || !endDate || numBranches === undefined || totalCommits === undefined || !repoPath) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: startDate, endDate, numBranches, totalCommits, repoPath' 
      });
    }
    
    const numBranchesNum = parseInt(numBranches);
    const totalCommitsNum = parseInt(totalCommits);
    
    if (isNaN(numBranchesNum) || numBranchesNum < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Number of branches must be at least 1' 
      });
    }
    
    if (isNaN(totalCommitsNum) || totalCommitsNum < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Total commits must be at least 1' 
      });
    }
    
    if (totalCommitsNum < numBranchesNum) {
      return res.status(400).json({ 
        success: false, 
        message: 'Total commits must be at least equal to the number of branches (each branch needs at least 1 commit)' 
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
    
    // Automatically adjust number of branches if there aren't enough valid dates
    let actualNumBranches = numBranchesNum;
    let adjustedBranches = false;
    if (validDates.length < numBranchesNum) {
      actualNumBranches = validDates.length;
      adjustedBranches = true;
      console.log(`[${requestId}] [CHECK] Adjusted number of branches from ${numBranchesNum} to ${actualNumBranches} (only ${validDates.length} valid dates available)`);
    }
    
    // Randomly select dates (one per branch)
    const shuffledDates = [...validDates].sort(() => Math.random() - 0.5);
    const datesToProcess = shuffledDates.slice(0, actualNumBranches);
    const datesToProcessCount = datesToProcess.length;
    
    // Calculate commits per branch distribution
    const commitsPerBranch = new Array(actualNumBranches).fill(1); // Start with 1 commit per branch
    let remainingCommits = totalCommitsNum - actualNumBranches; // Remaining commits to distribute
    
    // Randomly distribute remaining commits
    for (let i = 0; i < remainingCommits; i++) {
      const randomBranch = Math.floor(Math.random() * actualNumBranches);
      commitsPerBranch[randomBranch]++;
    }
    
    // Shuffle the commits distribution to make it more random
    commitsPerBranch.sort(() => Math.random() - 0.5);
    
    // Get git user info
    let gitUser = { name: '', email: '' };
    let gitRepoInfo = { exists: false, isRepo: false, remotes: [] };
    let commitHistory = { commits: [], commitsByDate: {}, totalCommits: 0 }; // Initialize outside try-catch
    let git = null; // Declare git variable outside try-catch
    
    // Handle URLs and initialize/clone repository (same logic as process endpoint)
    const { initGit, isRepoUrl, extractRepoName } = require('./gitOperations');
    const path = require('path');
    const fs = require('fs');
    
    // Use /tmp directory on Vercel (only writable location), otherwise use process.cwd()
    const isVercel = process.env.VERCEL || process.env.NOW_REGION;
    const baseDir = isVercel ? '/tmp' : process.cwd();
    
    let actualRepoPath = repoPath;
    let isUrl = false;
    
    // Check if it's a URL
    if (isRepoUrl(repoPath)) {
      isUrl = true;
      const repoName = extractRepoName(repoPath);
      actualRepoPath = path.join(baseDir, repoName);
    }
    
    // Initialize/clone repository if needed (this will clone if URL, or init if local)
    try {
      console.log(`[${requestId}] [CHECK] Initializing/cloning repository: ${repoPath}`);
      
      // Add timeout wrapper for initGit
      const initGitPromise = initGit(repoPath);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Repository initialization/cloning timeout after 25 seconds. The repository might be too large or there might be network issues.')), 25000)
      );
      
      const gitInitResult = await Promise.race([initGitPromise, timeoutPromise]);
      actualRepoPath = gitInitResult.actualPath;
      git = gitInitResult.git;
      console.log(`[${requestId}] [CHECK] Repository initialized at: ${actualRepoPath}`);
      
      // Now check repository status
      gitRepoInfo.exists = fs.existsSync(actualRepoPath);
      gitRepoInfo.isRepo = await git.checkIsRepo();
      console.log(`[CHECK] Repository exists: ${gitRepoInfo.exists}, Is repo: ${gitRepoInfo.isRepo}`);
      
      // Get git user name and email (try global first, then local)
      // On Vercel, git might not be available, so handle gracefully
      try {
        const simpleGit = require('simple-git');
        const globalGit = simpleGit();
        gitUser.name = (await globalGit.getConfig('user.name')).value || 'Not configured';
        gitUser.email = (await globalGit.getConfig('user.email')).value || 'Not configured';
      } catch (e) {
        // Git not available (e.g., on Vercel) - use defaults
        gitUser.name = 'Not configured';
        gitUser.email = 'Not configured';
        if (isVercel) {
          console.log(`[${requestId}] [CHECK] Git not available on Vercel - using defaults`);
        }
      }
      
      // Get existing commit history for the date range
      if (gitRepoInfo.isRepo && git) {
        try {
          console.log(`[${requestId}] [CHECK] Fetching existing commit history`);
          const historyResult = await getCommitHistory(git, start, end, baseBranch || 'main');
          if (historyResult.success) {
            commitHistory = {
              commits: historyResult.commits || [],
              commitsByDate: historyResult.commitsByDate || {},
              totalCommits: historyResult.totalCommits || 0,
              branch: historyResult.branch || 'unknown'
            };
            console.log(`[${requestId}] [CHECK] Found ${commitHistory.commits.length} existing commits in date range`);
          }
        } catch (error) {
          console.warn(`[${requestId}] [CHECK] Could not fetch commit history:`, error.message);
        }
      }
      
      // If repo exists, get repo-specific info
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
      console.error(`[CHECK] Error during initialization: ${error.message}`, error);
      // If initialization fails, still try to check basic info
      gitRepoInfo.exists = fs.existsSync(actualRepoPath);
      if (gitRepoInfo.exists) {
        try {
          const simpleGit = require('simple-git');
          git = simpleGit(actualRepoPath); // Assign to outer scope variable
          gitRepoInfo.isRepo = await git.checkIsRepo();
          
          if (gitRepoInfo.isRepo && git) {
            try {
              const remotes = await git.getRemotes();
              gitRepoInfo.remotes = remotes.map(r => ({ name: r.name, refs: r.refs }));
            } catch (err) {
              console.error(`[CHECK] Error getting remotes: ${err.message}`);
              gitRepoInfo.remotes = [];
            }
            
            // Try to get commit history even if initialization failed
            try {
              console.log(`[${requestId}] [CHECK] Fetching existing commit history (fallback)`);
              const historyResult = await getCommitHistory(git, start, end, baseBranch || 'main');
              if (historyResult.success) {
                commitHistory = {
                  commits: historyResult.commits || [],
                  commitsByDate: historyResult.commitsByDate || {},
                  totalCommits: historyResult.totalCommits || 0,
                  branch: historyResult.branch || 'unknown'
                };
                console.log(`[${requestId}] [CHECK] Found ${commitHistory.commits.length} existing commits in date range`);
              }
            } catch (historyError) {
              console.warn(`[${requestId}] [CHECK] Could not fetch commit history:`, historyError.message);
            }
          }
        } catch (e) {
          console.error(`[CHECK] Error checking repo status: ${e.message}`);
          // Repository might not be initialized yet, that's okay
        }
      }
      
      // Get git user name and email (global)
      try {
        const simpleGit = require('simple-git');
        const globalGit = simpleGit();
        gitUser.name = (await globalGit.getConfig('user.name')).value || 'Not configured';
        gitUser.email = (await globalGit.getConfig('user.email')).value || 'Not configured';
      } catch (e) {
        gitUser.name = 'Not configured';
        gitUser.email = 'Not configured';
      }
    }
    
    gitRepoInfo.isUrl = isUrl;
    gitRepoInfo.actualPath = actualRepoPath;
    
    // Get country name
    const { getAvailableCountries } = require('./dateUtils');
    const countries = getAvailableCountries();
    const selectedCountry = countries.find(c => c.code === countryCode) || { name: countryCode };
    
    console.log(`[${requestId}] [CHECK] Sending response. Repo exists: ${gitRepoInfo.exists}, Is repo: ${gitRepoInfo.isRepo}, Remotes: ${gitRepoInfo.remotes.length}`);
    
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      res.json({
        success: true,
        settings: {
          startDate,
          endDate,
          country: selectedCountry.name,
          countryCode,
          numBranches: actualNumBranches,
          requestedBranches: numBranchesNum,
          totalCommits: totalCommitsNum,
          commitsPerBranch: commitsPerBranch,
          adjustedBranches: adjustedBranches,
          repoPath,
          actualRepoPath: actualRepoPath,
          remote: remote || 'origin',
          totalValidDates: validDates.length,
          datesToProcess: datesToProcessCount,
          validDatesPreview: datesToProcess.slice(0, 10).map(d => formatDate(d)),
          createPR: createPR || false,
          autoMerge: autoMerge || false,
          platform: platform || null,
          baseBranch: baseBranch || 'main',
          mergeMethod: mergeMethod || 'merge'
        },
        gitUser,
        gitRepoInfo,
        commitHistory: commitHistory || { commits: [], commitsByDate: {}, totalCommits: 0 }
      });
      console.log(`[${requestId}] [CHECK] Response sent successfully`);
    } else {
      console.log(`[${requestId}] [CHECK] Response already sent, skipping`);
    }
    
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[${requestId}] [CHECK] Error checking settings:`, error);
    console.error(`[${requestId}] [CHECK] Error stack:`, error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: `Error checking settings: ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error(`[${requestId}] [CHECK] Cannot send error response - headers already sent`);
    }
  }
});

// API endpoint to process git operations with Server-Sent Events (SSE)
app.get('/api/process-stream', async (req, res) => {
  const requestId = Date.now();
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Parse form data from query parameter
  let formData;
  try {
    formData = JSON.parse(decodeURIComponent(req.query.data));
  } catch (e) {
    sendSSE(res, 'error', { message: 'Invalid request data' });
    res.end();
    return;
  }
  
  // Remove server-side timeout - let the operation complete naturally
  // The heartbeat will keep the connection alive and show progress
  // If there's a real issue, it will be caught in the error handler
  
  let heartbeatInterval; // Declare outside try block so it can be cleared in catch
  let keepAliveInterval; // Keep-alive comment interval
  
  try {
    const { 
      startDate, 
      endDate, 
      numBranches, 
      totalCommits,
      repoPath, 
      remote, 
      country,
      coAuthors,
      coAuthorRate,
      createPR,
      autoMerge,
      prToken,
      baseBranch,
      platform,
      mergeMethod
    } = formData;
    
    sendSSE(res, 'progress', { message: `🚀 Starting processing for ${startDate} to ${endDate}...`, level: 'info' });
    
    // Log co-author settings for debugging
    if (coAuthors && coAuthors.length > 0) {
      console.log(`[${requestId}] [PROCESS-STREAM] Co-authors: ${coAuthors.join(', ')}, Rate: ${coAuthorRate}%`);
    } else {
      console.log(`[${requestId}] [PROCESS-STREAM] No co-authors provided`);
    }
    
    // Validate inputs
    if (!startDate || !endDate || numBranches === undefined || totalCommits === undefined || !repoPath) {
      sendSSE(res, 'error', { message: 'Missing required fields: startDate, endDate, numBranches, totalCommits, repoPath' });
      res.end();
      return;
    }
    
    const numBranchesNum = parseInt(numBranches);
    const totalCommitsNum = parseInt(totalCommits);
    
    if (isNaN(numBranchesNum) || numBranchesNum < 1) {
      sendSSE(res, 'error', { message: 'Number of branches must be at least 1' });
      res.end();
      return;
    }
    
    if (isNaN(totalCommitsNum) || totalCommitsNum < 1) {
      sendSSE(res, 'error', { message: 'Total commits must be at least 1' });
      res.end();
      return;
    }
    
    if (totalCommitsNum < numBranchesNum) {
      sendSSE(res, 'error', { message: 'Total commits must be at least equal to the number of branches (each branch needs at least 1 commit)' });
      res.end();
      return;
    }
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      sendSSE(res, 'error', { message: 'Invalid date format' });
      res.end();
      return;
    }
    
    if (start > end) {
      sendSSE(res, 'error', { message: 'Start date must be before end date' });
      res.end();
      return;
    }
    
    // Get valid dates (excluding Sundays and holidays)
    const countryCode = country || 'US';
    const validDates = getValidDates(start, end, countryCode);
    
    if (validDates.length === 0) {
      sendSSE(res, 'error', { message: 'No valid dates found in the specified range (all dates are Sundays or holidays)' });
      res.end();
      return;
    }
    
    // Automatically adjust number of branches if there aren't enough valid dates
    let actualNumBranches = numBranchesNum;
    let adjustedBranches = false;
    if (validDates.length < numBranchesNum) {
      actualNumBranches = validDates.length;
      adjustedBranches = true;
      sendSSE(res, 'progress', { message: `⚠️ Adjusted number of branches from ${numBranchesNum} to ${actualNumBranches} (only ${validDates.length} valid dates available)`, level: 'warning' });
    }
    
    // Randomly select dates (one per branch)
    const shuffledDates = [...validDates].sort(() => Math.random() - 0.5);
    const datesToProcess = shuffledDates.slice(0, actualNumBranches);
    const datesToProcessCount = datesToProcess.length;
    
    // Randomly distribute commits across branches
    // Each branch gets at least 1 commit, then distribute the rest randomly
    const commitsPerBranch = new Array(actualNumBranches).fill(1); // Start with 1 commit per branch
    let remainingCommits = totalCommitsNum - actualNumBranches; // Remaining commits to distribute
    
    // Randomly distribute remaining commits
    for (let i = 0; i < remainingCommits; i++) {
      const randomBranch = Math.floor(Math.random() * actualNumBranches);
      commitsPerBranch[randomBranch]++;
    }
    
    // Shuffle the commits distribution to make it more random
    commitsPerBranch.sort(() => Math.random() - 0.5);
    
    sendSSE(res, 'progress', { message: `📅 Found ${validDates.length} valid dates, creating ${datesToProcessCount} branches with ${totalCommitsNum} total commits (distribution: ${commitsPerBranch.join(', ')})`, level: 'info' });
    
    // Initialize git (handles both local paths and URLs)
    sendSSE(res, 'progress', { message: `🔧 Initializing Git repository...`, level: 'info' });
    const gitInitResult = await initGit(repoPath);
    const git = gitInitResult.git;
    const actualRepoPath = gitInitResult.actualPath;
    sendSSE(res, 'progress', { message: `✅ Git repository initialized`, level: 'success' });
    
    // Prepare PR options if PR creation is requested
    const prOptions = createPR ? {
      createPR: true,
      autoMerge: autoMerge || false,
      token: prToken,
      baseBranch: baseBranch || 'main',
      platform: platform,
      mergeMethod: mergeMethod || 'merge'
    } : null;
    
    if (prOptions) {
      sendSSE(res, 'progress', { message: `🔀 PR creation enabled (${platform || 'GitHub'})`, level: 'info' });
    }
    
    // Process each selected date (1 commit per date)
    const results = [];
    const totalDates = datesToProcess.length;
    const startProcessingTime = Date.now();
    
    // Set up a heartbeat interval to keep connection alive and show progress
    heartbeatInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startProcessingTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const completed = results.length;
      const successCount = results.filter(r => r.success).length;
      sendSSE(res, 'progress', { message: `⏱️ Still processing... (${minutes}m ${seconds}s elapsed, ${completed}/${totalDates} completed, ${successCount} succeeded)`, level: 'info' });
    }, 30000); // Send heartbeat every 30 seconds
    
    // Set up keep-alive comment interval (SSE comments keep connection alive)
    // Send every 15 seconds to prevent proxy/load balancer timeouts
    keepAliveInterval = setInterval(() => {
      sendSSEKeepAlive(res);
    }, 15000); // Send keep-alive comment every 15 seconds
    
    for (let i = 0; i < datesToProcess.length; i++) {
      const date = datesToProcess[i];
      const dateStr = formatDate(date);
      const progress = `[${i + 1}/${totalDates}]`;
      
      const commitsForThisBranch = commitsPerBranch[i];
      sendSSE(res, 'progress', { message: `${progress} 🌿 Creating branch for ${dateStr} with ${commitsForThisBranch} commit(s)...`, level: 'progress' });
      
      try {
        const startTime = Date.now();
        const result = await processDate(git, date, commitsForThisBranch, remote || 'origin', prOptions, actualRepoPath, coAuthors || [], coAuthorRate || 0);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        results.push(result);
        
        if (result.success) {
          let successMsg = `${progress} ✅ ${dateStr} completed in ${duration}s`;
          if (result.results && result.results.commits && result.results.commits.success) {
            successMsg += ` | Commits: ${result.results.commits.commitCount || 1}`;
          }
          if (result.results && result.results.pr && result.results.pr.success) {
            successMsg += ` | PR: #${result.results.pr.prNumber || 'created'}`;
            if (result.results.pr.merged) {
              successMsg += ' (merged)';
            }
          }
          sendSSE(res, 'progress', { message: successMsg, level: 'success' });
        } else {
          sendSSE(res, 'progress', { message: `${progress} ❌ ${dateStr} failed: ${result.message}`, level: 'error' });
        }
      } catch (error) {
        sendSSE(res, 'progress', { message: `${progress} ❌ Exception processing ${dateStr}: ${error.message}`, level: 'error' });
        results.push({
          success: false,
          results: { date: dateStr },
          message: `Exception: ${error.message}`
        });
      }
      
      // Log progress every 5 dates
      if ((i + 1) % 5 === 0 || i === datesToProcess.length - 1) {
        const completed = i + 1;
        const successCount = results.filter(r => r.success).length;
        const elapsed = Math.floor((Date.now() - startProcessingTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        sendSSE(res, 'progress', { message: `📊 Progress: ${completed}/${totalDates} completed (${successCount} succeeded) - ${minutes}m ${seconds}s elapsed`, level: 'info' });
      }
    }
    
    // Clear intervals when done
    clearInterval(heartbeatInterval);
    clearInterval(keepAliveInterval);
    
    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    // Count PR statistics
    const prResults = results.filter(r => r.results && r.results.pr);
    const prsCreated = prResults.filter(r => r.results.pr.success).length;
    const prsFailed = prResults.filter(r => !r.results.pr.success).length;
    const prsMerged = prResults.filter(r => r.results.pr.merged).length;
    
    // Count other statistics
    // Sum up actual commits created from results
    let commitsCreated = 0;
    results.forEach((r, idx) => {
      if (r.results && r.results.commits && r.results.commits.success) {
        commitsCreated += commitsPerBranch[idx] || (r.results.commits.commitCount || 1);
      }
    });
    const branchesCreated = results.filter(r => r.results && r.results.branchResult && r.results.branchResult.success).length;
    const branchesPushed = results.filter(r => r.results && r.results.push && r.results.push.success).length;
    
    // Clear keep-alive interval before sending final message
    clearInterval(keepAliveInterval);
    
    sendSSE(res, 'complete', {
      success: true,
      message: `Processed ${results.length} branches (${successCount} succeeded, ${failureCount} failed). Created ${commitsCreated} commits total.`,
      numBranches: actualNumBranches,
      requestedBranches: numBranchesNum,
      totalCommits: totalCommitsNum,
      commitsCreated: commitsCreated,
      commitsPerBranch: commitsPerBranch,
      totalDates: validDates.length,
      datesToProcess: datesToProcessCount,
      adjustedBranches: adjustedBranches,
      successCount,
      failureCount,
      stats: {
        commitsCreated,
        branchesCreated,
        branchesPushed,
        prsCreated,
        prsFailed,
        prsMerged
      },
      results
    });
    
    res.end();
    
  } catch (error) {
    if (typeof heartbeatInterval !== 'undefined') {
      clearInterval(heartbeatInterval);
    }
    if (typeof keepAliveInterval !== 'undefined') {
      clearInterval(keepAliveInterval);
    }
    sendSSE(res, 'error', { message: `Server error: ${error.message}` });
    res.end();
  }
});

// Helper function to send SSE messages
function sendSSE(res, type, data) {
  try {
    const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
    res.write(message);
    // Force flush to ensure message is sent immediately
    if (typeof res.flush === 'function') {
      res.flush();
    }
  } catch (error) {
    console.error('Error sending SSE message:', error);
  }
}

// Helper function to send SSE keep-alive comment
function sendSSEKeepAlive(res) {
  try {
    res.write(': keep-alive\n\n');
    if (typeof res.flush === 'function') {
      res.flush();
    }
  } catch (error) {
    console.error('Error sending SSE keep-alive:', error);
  }
}

// API endpoint to process git operations (legacy - kept for compatibility)
app.post('/api/process', async (req, res) => {
  const requestId = Date.now();
  console.log(`[${requestId}] [PROCESS] Request received at ${new Date().toISOString()}`);
  
  // Set timeout for the request (5 minutes for processing)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[${requestId}] [PROCESS] Request timeout after 5 minutes`);
      res.status(504).json({ 
        success: false, 
        message: 'Request timeout: Processing took too long. Please try with a smaller date range.' 
      });
    }
  }, 300000); // 5 minutes
  
  try {
    const { 
      startDate, 
      endDate, 
      percentage, 
      repoPath, 
      remote, 
      country,
      coAuthors,
      coAuthorRate,
      createPR,
      autoMerge,
      prToken,
      baseBranch,
      platform,
      mergeMethod
    } = req.body;
    
    console.log(`[${requestId}] [PROCESS] Processing request for repo: ${repoPath}, dates: ${startDate} to ${endDate}`);
    
    // Validate inputs
    if (!startDate || !endDate || percentage === undefined || !repoPath) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: startDate, endDate, percentage, repoPath' 
      });
    }
    
    const percentageNum = parseFloat(percentage);
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        success: false, 
        message: 'Percentage must be a number between 0 and 100' 
      });
    }
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    if (start > end) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        success: false, 
        message: 'Start date must be before end date' 
      });
    }
    
    // Get valid dates (excluding Sundays and holidays)
    const countryCode = country || 'US';
    const validDates = getValidDates(start, end, countryCode);
    
    if (validDates.length === 0) {
      clearTimeout(timeout);
      return res.status(400).json({ 
        success: false, 
        message: 'No valid dates found in the specified range (all dates are Sundays or holidays)' 
      });
    }
    
    // Automatically adjust number of branches if there aren't enough valid dates
    let actualNumBranches = numBranchesNum;
    let adjustedBranches = false;
    if (validDates.length < numBranchesNum) {
      actualNumBranches = validDates.length;
      adjustedBranches = true;
      console.log(`[${requestId}] [PROCESS] Adjusted number of branches from ${numBranchesNum} to ${actualNumBranches} (only ${validDates.length} valid dates available)`);
    }
    
    // Randomly select dates (one per branch)
    const shuffledDates = [...validDates].sort(() => Math.random() - 0.5);
    const datesToProcess = shuffledDates.slice(0, actualNumBranches);
    const datesToProcessCount = datesToProcess.length;
    
    // Randomly distribute commits across branches
    // Each branch gets at least 1 commit, then distribute the rest randomly
    const commitsPerBranch = new Array(actualNumBranches).fill(1); // Start with 1 commit per branch
    let remainingCommits = totalCommitsNum - actualNumBranches; // Remaining commits to distribute
    
    // Randomly distribute remaining commits
    for (let i = 0; i < remainingCommits; i++) {
      const randomBranch = Math.floor(Math.random() * actualNumBranches);
      commitsPerBranch[randomBranch]++;
    }
    
    // Shuffle the commits distribution to make it more random
    commitsPerBranch.sort(() => Math.random() - 0.5);
    
    // Log selected dates for verification
    console.log(`[${requestId}] [PROCESS] Total valid dates: ${validDates.length}`);
    console.log(`[${requestId}] [PROCESS] Number of branches: ${actualNumBranches}${adjustedBranches ? ` (adjusted from ${numBranchesNum})` : ''}`);
    console.log(`[${requestId}] [PROCESS] Total commits: ${totalCommitsNum}`);
    console.log(`[${requestId}] [PROCESS] Commits distribution: ${commitsPerBranch.join(', ')}`);
    console.log(`[${requestId}] [PROCESS] Dates to process: ${datesToProcessCount}`);
    console.log(`[${requestId}] [PROCESS] Selected dates:`, datesToProcess.map(d => formatDate(d)).join(', '));
    
    // Initialize git (handles both local paths and URLs)
    const gitInitResult = await initGit(repoPath);
    const git = gitInitResult.git;
    const actualRepoPath = gitInitResult.actualPath;
    
    // Prepare PR options if PR creation is requested
    const prOptions = createPR ? {
      createPR: true,
      autoMerge: autoMerge || false,
      token: prToken,
      baseBranch: baseBranch || 'main',
      platform: platform,
      mergeMethod: mergeMethod || 'merge'
    } : null;
    
    // Process each selected date (N commits per branch)
    const results = [];
    const totalDates = datesToProcess.length;
    console.log(`[${requestId}] [PROCESS] Starting to process ${totalDates} branches with ${totalCommitsNum} total commits`);
    
    for (let i = 0; i < datesToProcess.length; i++) {
      const date = datesToProcess[i];
      const dateStr = formatDate(date);
      const progress = `[${i + 1}/${totalDates}]`;
      const commitsForThisBranch = commitsPerBranch[i];
      
      console.log(`[${requestId}] [PROCESS] ${progress} Processing branch for date: ${dateStr} with ${commitsForThisBranch} commits`);
      
      try {
        const startTime = Date.now();
        const result = await processDate(git, date, commitsForThisBranch, remote || 'origin', prOptions, actualRepoPath, coAuthors || [], coAuthorRate || 0);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        results.push(result);
        
        if (result.success) {
          console.log(`[${requestId}] [PROCESS] ${progress} ✅ Completed ${dateStr} in ${duration}s`);
        } else {
          console.error(`[${requestId}] [PROCESS] ${progress} ❌ Failed ${dateStr}: ${result.message}`);
        }
      } catch (error) {
        console.error(`[${requestId}] [PROCESS] ${progress} ❌ Exception processing ${dateStr}:`, error.message);
        results.push({
          success: false,
          results: { date: dateStr },
          message: `Exception: ${error.message}`
        });
      }
      
      // Log progress every 10 branches
      if ((i + 1) % 10 === 0 || i === datesToProcess.length - 1) {
        const completed = i + 1;
        const successCount = results.filter(r => r.success).length;
        console.log(`[${requestId}] [PROCESS] Progress: ${completed}/${totalDates} branches completed, ${successCount} succeeded`);
      }
    }
    
    console.log(`[${requestId}] [PROCESS] Finished processing all ${totalDates} branches`);
    
    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    // Count PR statistics
    const prResults = results.filter(r => r.results && r.results.pr);
    const prsCreated = prResults.filter(r => r.results.pr.success).length;
    const prsFailed = prResults.filter(r => !r.results.pr.success).length;
    const prsMerged = prResults.filter(r => r.results.pr.merged).length;
    
    // Count other statistics
    // Sum up actual commits created from results
    let commitsCreated = 0;
    results.forEach((r, idx) => {
      if (r.results && r.results.commits && r.results.commits.success) {
        commitsCreated += commitsPerBranch[idx] || (r.results.commits.commitCount || 1);
      }
    });
    const branchesCreated = results.filter(r => r.results && r.results.branchResult && r.results.branchResult.success).length;
    const branchesPushed = results.filter(r => r.results && r.results.push && r.results.push.success).length;
    
    clearTimeout(timeout);
    console.log(`[${requestId}] [PROCESS] Completed: ${successCount} succeeded, ${failureCount} failed`);
    console.log(`[${requestId}] [PROCESS] Stats: ${commitsCreated} commits created, ${branchesCreated} branches, ${branchesPushed} pushed, ${prsCreated} PRs created, ${prsMerged} PRs merged`);
    
    if (!res.headersSent) {
      res.json({
        success: true,
        message: `Processed ${results.length} branches (${successCount} succeeded, ${failureCount} failed). Created ${commitsCreated} commits total.`,
        numBranches: actualNumBranches,
        requestedBranches: numBranchesNum,
        totalCommits: totalCommitsNum,
        commitsCreated: commitsCreated,
        commitsPerBranch: commitsPerBranch,
        totalDates: validDates.length,
        datesToProcess: datesToProcessCount,
        adjustedBranches: adjustedBranches,
        successCount,
        failureCount,
        stats: {
          commitsCreated,
          branchesCreated,
          branchesPushed,
          prsCreated,
          prsFailed,
          prsMerged
        },
        results
      });
      console.log(`[${requestId}] [PROCESS] Response sent successfully`);
    }
    
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[${requestId}] [PROCESS] Error processing request:`, error);
    console.error(`[${requestId}] [PROCESS] Error stack:`, error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: `Server error: ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${err.message}` 
    });
  }
});

// Start server (only if not in Vercel serverless environment and not in Electron)
if (process.env.VERCEL !== '1' && process.env.ELECTRON !== '1') {
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`Auto-Git server running at http://localhost:${PORT}`);
    console.log(`Open your browser and navigate to the URL above to use the interface.`);
    console.log(`========================================`);
    console.log(`Server started at ${new Date().toISOString()}`);
    console.log(`Ready to accept requests...`);
  });
}

// Export for Vercel serverless and Electron
module.exports = app;

