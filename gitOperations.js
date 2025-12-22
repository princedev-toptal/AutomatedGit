/**
 * Git operations module
 */

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

/**
 * Check if a string is a GitHub/GitLab/Bitbucket URL
 */
function isRepoUrl(path) {
  if (!path) return false;
  const urlPattern = /^(https?:\/\/|git@)(github\.com|gitlab\.com|bitbucket\.org)/i;
  return urlPattern.test(path.trim());
}

/**
 * Extract repository name from URL
 */
function extractRepoName(repoUrl) {
  try {
    // Remove .git suffix
    repoUrl = repoUrl.replace(/\.git$/, '');
    
    // Handle SSH format: git@github.com:owner/repo
    if (repoUrl.includes('@')) {
      const match = repoUrl.match(/[:/]([^/:]+)\/([^/]+)$/);
      if (match) return match[2];
    }
    
    // Handle HTTPS format: https://github.com/owner/repo
    const url = new URL(repoUrl);
    const parts = url.pathname.split('/').filter(p => p);
    return parts[parts.length - 1] || 'repo';
  } catch (e) {
    return 'repo';
  }
}

/**
 * Clone repository from URL
 */
async function cloneRepository(repoUrl, localPath) {
  try {
    // Remove directory if it exists but is not a git repo
    if (fs.existsSync(localPath)) {
      const testGit = simpleGit(localPath);
      const isRepo = await testGit.checkIsRepo().catch(() => false);
      if (!isRepo) {
        // Remove non-git directory
        fs.rmSync(localPath, { recursive: true, force: true });
      } else {
        // Already a git repo, no need to clone
        return { success: true, message: `Repository already exists at ${localPath}`, alreadyExists: true };
      }
    }
    
    const git = simpleGit();
    console.log(`[CLONE] Cloning ${repoUrl} to ${localPath}`);
    await git.clone(repoUrl, localPath, ['--depth', '1']); // Shallow clone for speed
    console.log(`[CLONE] Successfully cloned to ${localPath}`);
    return { success: true, message: `Repository cloned successfully to ${localPath}` };
  } catch (error) {
    console.error(`[CLONE] Error cloning repository: ${error.message}`);
    return { success: false, message: `Failed to clone repository: ${error.message}` };
  }
}

/**
 * Initialize git operations
 * @param {string} repoPath - Path to the git repository or GitHub URL
 * @returns {Promise<Object>} - Git instance and actual local path
 */
async function initGit(repoPath) {
  let actualPath = repoPath;
  let cloned = false;
  
  // If it's a URL, clone it first
  if (isRepoUrl(repoPath)) {
    const repoName = extractRepoName(repoPath);
    // Use a local directory name based on repo name
    actualPath = path.join(process.cwd(), repoName);
    
    // Check if already cloned
    let needsClone = true;
    if (fs.existsSync(actualPath)) {
      try {
        const testGit = simpleGit(actualPath);
        const isRepo = await testGit.checkIsRepo();
        if (isRepo) {
          needsClone = false;
          console.log(`[INIT] Repository already exists at ${actualPath}`);
        }
      } catch (e) {
        // Not a repo, need to clone
        needsClone = true;
      }
    }
    
    if (needsClone) {
      console.log(`[INIT] Cloning repository from ${repoPath}`);
      const cloneResult = await cloneRepository(repoPath, actualPath);
      if (!cloneResult.success && !cloneResult.alreadyExists) {
        throw new Error(cloneResult.message);
      }
      if (!cloneResult.alreadyExists) {
        cloned = true;
      }
    }
  }
  
  const git = simpleGit(actualPath);
  
  // Check if directory exists, if not create it (for local paths)
  if (!fs.existsSync(actualPath)) {
    fs.mkdirSync(actualPath, { recursive: true });
  }
  
  // Initialize git repo if not already initialized
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    
    // If it was a URL and we just cloned, remote should already be set
    // But if we initialized a new repo, set up the remote if URL was provided
    if (isRepoUrl(repoPath) && !cloned) {
      try {
        await git.addRemote('origin', repoPath);
      } catch (e) {
        // Remote might already exist, that's okay
      }
    }
  } else if (isRepoUrl(repoPath) && cloned) {
    // Ensure remote is set correctly after cloning
    try {
      const remotes = await git.getRemotes();
      if (!remotes.some(r => r.name === 'origin')) {
        await git.addRemote('origin', repoPath);
      }
    } catch (e) {
      // Remote already exists or error, that's okay
    }
  }
  
  return { git, actualPath, cloned };
}

/**
 * Check if branch exists on remote
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch
 * @param {string} remote - Remote name (default: 'origin')
 * @returns {Promise<boolean>}
 */
async function branchExistsOnRemote(git, branchName, remote = 'origin') {
  try {
    // Fetch to get latest remote branch info
    await git.fetch(remote);
    const remoteBranches = await git.branch(['-r']);
    const remoteBranchRef = `${remote}/${branchName}`;
    return remoteBranches.all.includes(remoteBranchRef);
  } catch (error) {
    // If fetch fails, assume branch doesn't exist
    console.log(`[BRANCH] Could not check remote branches: ${error.message}`);
    return false;
  }
}

/**
 * Delete branch from remote
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch
 * @param {string} remote - Remote name (default: 'origin')
 * @returns {Promise<Object>}
 */
async function deleteRemoteBranch(git, branchName, remote = 'origin') {
  try {
    console.log(`[BRANCH] Deleting remote branch ${remote}/${branchName}`);
    // Use git push with :branchName syntax to delete remote branch
    await git.push(remote, `:${branchName}`);
    return { success: true, message: `Remote branch '${branchName}' deleted` };
  } catch (error) {
    return { success: false, message: `Error deleting remote branch: ${error.message}` };
  }
}

/**
 * Create a branch with the given name
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch
 * @param {string} remote - Remote name (default: 'origin')
 * @param {boolean} forcePush - Whether to force push if branch exists remotely
 * @returns {Promise<Object>}
 */
async function createBranch(git, branchName, remote = 'origin', forcePush = false) {
  try {
    console.log(`[BRANCH] Creating branch: ${branchName}`);
    
    // Check if branch already exists locally
    const branches = await git.branchLocal();
    const existsLocally = branches.all.includes(branchName);
    console.log(`[BRANCH] Branch ${branchName} exists locally: ${existsLocally}`);
    
    // Check if branch exists on remote (only for the specific branch we're creating)
    const existsRemotely = await branchExistsOnRemote(git, branchName, remote);
    console.log(`[BRANCH] Branch ${branchName} exists remotely: ${existsRemotely}`);
    
    if (existsRemotely && !forcePush) {
      // Delete remote branch if it exists (to avoid push conflicts)
      // NOTE: We only delete the branch for the date we're currently processing
      console.log(`[BRANCH] Branch ${branchName} exists on remote, deleting it first`);
      const deleteResult = await deleteRemoteBranch(git, branchName, remote);
      if (!deleteResult.success) {
        console.warn(`[BRANCH] Warning: Could not delete remote branch: ${deleteResult.message}`);
        // Continue anyway, we'll try force push
      } else {
        console.log(`[BRANCH] Successfully deleted remote branch: ${branchName}`);
      }
    }
    
    // Checkout or create branch locally
    if (existsLocally) {
      console.log(`[BRANCH] Checking out existing local branch: ${branchName}`);
      await git.checkout(branchName);
    } else {
      console.log(`[BRANCH] Creating new local branch: ${branchName}`);
      await git.checkoutLocalBranch(branchName);
    }
    
    // Verify branch was created/checked out
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    if (currentBranch !== branchName) {
      throw new Error(`Failed to checkout branch. Current branch: ${currentBranch}, Expected: ${branchName}`);
    }
    
    console.log(`[BRANCH] Successfully created/checked out branch: ${branchName}`);
    
    return { 
      success: true, 
      message: `Branch '${branchName}' created/checked out`,
      existedRemotely: existsRemotely
    };
  } catch (error) {
    console.error(`[BRANCH] Error creating branch ${branchName}:`, error.message);
    return { success: false, message: `Error creating branch: ${error.message}` };
  }
}

/**
 * Create commits on the current branch
 * @param {Object} git - Git instance
 * @param {number} commitCount - Number of commits to create
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} repoPath - Repository path (optional, will try to get from git instance if not provided)
 * @returns {Promise<Object>}
 */
async function createCommits(git, commitCount, date, repoPath = null) {
  const results = [];
  
  try {
    // Get repository path
    let actualRepoPath = repoPath;
    if (!actualRepoPath) {
      try {
        // Try to get the working directory from git instance
        const cwd = git.cwd();
        actualRepoPath = typeof cwd === 'string' ? cwd : null;
      } catch (e) {
        actualRepoPath = null;
      }
    }
    
    if (!actualRepoPath) {
      return { success: false, message: 'Could not determine repository path' };
    }
    
    // Create a dummy file or update existing one
    const fileName = 'commits.txt';
    const filePath = path.join(actualRepoPath, fileName);
    
    // Read existing content or initialize
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }
    
    // Parse the date string (YYYY-MM-DD) to ensure correct date handling
    // Create date at noon to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const commitDate = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone issues
    
    console.log(`[COMMIT] Creating ${commitCount} commit(s) for date: ${date} (parsed as: ${commitDate.toISOString()})`);
    
    for (let i = 0; i < commitCount; i++) {
      // Append a line to the file
      const timestamp = commitDate.toISOString();
      content += `${date} - Commit ${i + 1} at ${timestamp}\n`;
      fs.writeFileSync(filePath, content);
      
      // Stage the file
      await git.add(fileName);
      
      // Commit with the specific date (not current date!)
      const commitMessage = `Auto commit ${i + 1} for ${date}`;
      const commitDateISO = commitDate.toISOString();
      
      console.log(`[COMMIT] Creating commit ${i + 1}/${commitCount} with date: ${commitDateISO}`);
      
      await git.commit(commitMessage, {
        '--date': commitDateISO
      });
      
      // Verify commit was created with correct date
      const logResult = await git.log(['-1']);
      let commitInfo = {
        hash: null,
        date: date,
        message: commitMessage,
        timestamp: commitDateISO
      };
      
      if (logResult.latest) {
        commitInfo.hash = logResult.latest.hash.substring(0, 7);
        commitInfo.fullHash = logResult.latest.hash;
        const commitDateStr = new Date(logResult.latest.date).toISOString().split('T')[0];
        commitInfo.actualDate = commitDateStr;
        console.log(`[COMMIT] ✅ Commit created: ${commitInfo.hash} - Date: ${commitDateStr} (Expected: ${date})`);
        
        if (commitDateStr !== date) {
          console.warn(`[COMMIT] ⚠️ Warning: Commit date mismatch! Expected: ${date}, Got: ${commitDateStr}`);
        }
      }
      
      results.push({ 
        success: true, 
        message: `Commit ${i + 1} created for ${date}`,
        commitDate: date,
        commitHash: commitInfo.hash,
        commitTimestamp: commitDateISO
      });
    }
    
    console.log(`[COMMIT] ✅ Successfully created ${commitCount} commit(s) for date: ${date}`);
    
    return { success: true, results, message: `Created ${commitCount} commits` };
  } catch (error) {
    return { success: false, message: `Error creating commits: ${error.message}` };
  }
}

/**
 * Push branch to remote
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch
 * @param {string} remote - Remote name (default: 'origin')
 * @returns {Promise<Object>}
 */
async function pushBranch(git, branchName, remote = 'origin', forcePush = false) {
  try {
    // Check if remote exists
    const remotes = await git.getRemotes();
    const remoteExists = remotes.some(r => r.name === remote);
    
    if (!remoteExists) {
      return { success: false, message: `Remote '${remote}' does not exist. Please add it first.` };
    }
    
    console.log(`[PUSH] Pushing branch ${branchName} to ${remote}${forcePush ? ' (force)' : ''}`);
    const startTime = Date.now();
    
    // Add timeout for push operation (30 seconds)
    const pushPromise = forcePush 
      ? git.push(remote, branchName, ['--force']) 
      : git.push(remote, branchName);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Push operation timeout after 30 seconds')), 30000)
    );
    
    await Promise.race([pushPromise, timeoutPromise]);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PUSH] Successfully pushed ${branchName} in ${duration}s`);
    
    return { success: true, message: `Branch '${branchName}' pushed to ${remote}` };
  } catch (error) {
    // If push fails due to non-fast-forward, try force push if not already tried
    if (!forcePush && (error.message.includes('non-fast-forward') || error.message.includes('fetch first'))) {
      console.log(`[PUSH] Push rejected, attempting force push for ${branchName}`);
      return await pushBranch(git, branchName, remote, true);
    }
    
    console.error(`[PUSH] Error pushing branch ${branchName}:`, error.message);
    return { success: false, message: `Error pushing branch: ${error.message}` };
  }
}

/**
 * Automatically resolve merge conflicts by combining both versions of files
 * @param {Object} git - Git instance
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch name (for logging)
 * @returns {Promise<Object>}
 */
async function resolveConflictsAutomatically(git, repoPath, branchName) {
  try {
    console.log(`[CONFLICT] Resolving conflicts automatically in ${repoPath}...`);
    
    // Get list of conflicted files
    const status = await git.status();
    const conflictedFiles = status.conflicted || [];
    
    if (conflictedFiles.length === 0) {
      console.log(`[CONFLICT] No conflicted files found, checking git status...`);
      // Try to get conflicted files from git status
      const rawStatus = await git.raw(['status', '--porcelain']);
      if (rawStatus) {
        const conflictMatches = rawStatus.match(/^UU\s+(.+)$/gm);
        if (conflictMatches) {
          conflictedFiles.push(...conflictMatches.map(m => m.replace(/^UU\s+/, '').trim()));
        }
      }
    }
    
    console.log(`[CONFLICT] Found ${conflictedFiles.length} conflicted file(s): ${conflictedFiles.join(', ')}`);
    
    if (conflictedFiles.length === 0) {
      return {
        success: false,
        message: 'No conflicted files detected'
      };
    }
    
    // Handle repoPath being an object or string
    let actualRepoPath = repoPath;
    if (typeof repoPath === 'object' && repoPath !== null) {
      if (repoPath.path) {
        actualRepoPath = repoPath.path;
      } else {
        console.error(`[CONFLICT] ⚠️ Invalid repo path object: ${repoPath}`);
        // Try to get it from git rev-parse
        try {
          const topLevel = await git.revparse(['--show-toplevel']);
          if (topLevel && typeof topLevel === 'string') {
            actualRepoPath = topLevel.trim();
            console.log(`[CONFLICT] Using git rev-parse result: ${actualRepoPath}`);
          } else {
            return {
              success: false,
              message: 'Could not determine repository path'
            };
          }
        } catch (e) {
          return {
            success: false,
            message: `Could not get repo path: ${e.message}`
          };
        }
      }
    }
    
    console.log(`[CONFLICT] Using repo path: ${actualRepoPath}`);
    
    // Resolve each conflicted file
    for (const file of conflictedFiles) {
      const filePath = path.join(actualRepoPath, file);
      console.log(`[CONFLICT] Checking file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`[CONFLICT] ⚠️ Conflicted file ${filePath} does not exist, trying alternatives...`);
        // Try relative to current working directory
        const altPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(altPath)) {
          console.log(`[CONFLICT] Found file at alternative path: ${altPath}`);
          const content = fs.readFileSync(altPath, 'utf8');
          const resolvedContent = resolveFileConflicts(git, file, content, altPath);
          if (resolvedContent) {
            fs.writeFileSync(altPath, resolvedContent, 'utf8');
            await git.add(file);
            console.log(`[CONFLICT] ✅ Resolved and staged ${file} from alternative path`);
          }
          continue;
        } else {
          console.warn(`[CONFLICT] ⚠️ Conflicted file ${file} does not exist at ${filePath} or ${altPath}, skipping...`);
          continue;
        }
      }
      
      console.log(`[CONFLICT] Resolving conflicts in ${file}...`);
      
      // Read the conflicted file
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Resolve the conflicts
      const resolvedContent = resolveFileConflicts(git, file, content, filePath);
      
      if (resolvedContent) {
        // Write resolved content
        fs.writeFileSync(filePath, resolvedContent, 'utf8');
        
        // Stage the resolved file
        await git.add(file);
        console.log(`[CONFLICT] ✅ Resolved and staged ${file}`);
      } else {
        console.warn(`[CONFLICT] ⚠️ Could not resolve ${file}, skipping...`);
      }
    }
    
    // Check if there are any remaining unmerged files
    const finalStatus = await git.status();
    const remainingConflicts = finalStatus.conflicted || [];
    if (remainingConflicts.length > 0) {
      console.warn(`[CONFLICT] ⚠️ Warning: ${remainingConflicts.length} file(s) still have conflicts: ${remainingConflicts.join(', ')}`);
      // Try to get conflicted files from git status
      const rawStatus = await git.raw(['status', '--porcelain']);
      if (rawStatus) {
        const conflictMatches = rawStatus.match(/^UU\s+(.+)$/gm);
        if (conflictMatches && conflictMatches.length > 0) {
          return {
            success: false,
            message: `Could not resolve all conflicts. Remaining conflicts in: ${conflictMatches.map(m => m.replace(/^UU\s+/, '')).join(', ')}`
          };
        }
      }
    }
    
    // Commit the resolution
    console.log(`[CONFLICT] Committing conflict resolution...`);
    await git.commit('Auto-resolve merge conflicts', {
      '--no-verify': true // Skip hooks if any
    });
    
    console.log(`[CONFLICT] ✅ Successfully resolved all conflicts`);
    return {
      success: true,
      message: `Resolved ${conflictedFiles.length} conflicted file(s)`
    };
  } catch (error) {
    console.error(`[CONFLICT] Error resolving conflicts: ${error.message}`);
    return {
      success: false,
      message: `Error resolving conflicts: ${error.message}`
    };
  }
}

/**
 * Resolve conflicts in a single file
 * @param {Object} git - Git instance
 * @param {string} file - File name
 * @param {string} content - File content with conflict markers
 * @param {string} filePath - Full path to the file
 * @returns {string|null} Resolved content or null if resolution failed
 */
function resolveFileConflicts(git, file, content, filePath) {
  try {
    // Check if it's commits.txt - for this file, we want to combine both versions
    // For other files, accept current change (ours)
    if (file === 'commits.txt' || file.endsWith('commits.txt')) {
        // For commits.txt, combine both versions to preserve all commits
        // This ensures commits from other merged PRs are not lost
        console.log(`[CONFLICT] Resolving ${file} by combining both versions (preserving all commits)...`);
        
        const lines = content.split('\n');
        const resolvedLines = [];
        const seenLines = new Set(); // To avoid duplicates
        
        let state = 'normal'; // 'normal', 'ours', 'theirs'
        let oursContent = [];
        let theirsContent = [];
        
        for (const line of lines) {
          if (line.startsWith('<<<<<<<')) {
            state = 'ours';
            oursContent = [];
            theirsContent = [];
            continue;
          } else if (line.startsWith('=======')) {
            state = 'theirs';
            continue;
          } else if (line.startsWith('>>>>>>>')) {
            state = 'normal';
            // Combine ours and theirs, avoiding duplicates
            const combined = [...oursContent, ...theirsContent];
            for (const combinedLine of combined) {
              const trimmed = combinedLine.trim();
              if (trimmed && !seenLines.has(trimmed)) {
                resolvedLines.push(combinedLine);
                seenLines.add(trimmed);
              }
            }
            oursContent = [];
            theirsContent = [];
            continue;
          }
          
          if (state === 'ours') {
            if (line.trim()) {
              oursContent.push(line);
            }
          } else if (state === 'theirs') {
            if (line.trim()) {
              theirsContent.push(line);
            }
          } else {
            // Normal line (not in conflict), add it
            const trimmed = line.trim();
            if (trimmed && !seenLines.has(trimmed)) {
              resolvedLines.push(line);
              seenLines.add(trimmed);
            }
          }
        }
        
        // Return resolved content
        const resolvedContent = resolvedLines.join('\n') + (resolvedLines.length > 0 ? '\n' : '');
        console.log(`[CONFLICT] ✅ Resolved ${file} by combining both versions (${resolvedLines.length} unique lines)`);
        return resolvedContent;
      } else {
        // For other files, accept current change (ours) - keep feature branch version
        console.log(`[CONFLICT] Resolving ${file} by accepting current change (ours)...`);
        
        const lines = content.split('\n');
        const resolvedLines = [];
        let inConflict = false;
        let keepOurs = true;
        
        for (const line of lines) {
          if (line.startsWith('<<<<<<<')) {
            inConflict = true;
            keepOurs = true; // Keep "ours" (current/feature branch)
            continue;
          } else if (line.startsWith('=======')) {
            keepOurs = false; // Skip "theirs" (base branch)
            continue;
          } else if (line.startsWith('>>>>>>>')) {
            inConflict = false;
            keepOurs = true;
            continue;
          }
          
          // Only add lines that are not in conflict, or are in "ours" section
          if (!inConflict || keepOurs) {
            resolvedLines.push(line);
          }
        }
        
        const resolvedContent = resolvedLines.join('\n');
        console.log(`[CONFLICT] ✅ Resolved ${file} by accepting current change (${resolvedLines.length} lines kept)`);
        return resolvedContent;
      }
  } catch (error) {
    console.error(`[CONFLICT] Error resolving conflicts in ${file}: ${error.message}`);
    return null;
  }
}

/**
 * Update branch by merging base branch into it to resolve conflicts
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch to update
 * @param {string} baseBranch - Base branch to merge from (usually 'main' or 'master')
 * @param {string} remote - Remote name
 * @param {string} repoPath - Repository path (optional, will try to get from git if not provided)
 * @returns {Promise<Object>}
 */
async function updateBranchWithBase(git, branchName, baseBranch, remote = 'origin', repoPath = null) {
  try {
    console.log(`[CONFLICT] Attempting to resolve conflicts by updating branch ${branchName} with ${baseBranch}...`);
    
    // Checkout the feature branch
    await git.checkout(branchName);
    console.log(`[CONFLICT] Checked out branch: ${branchName}`);
    
    // Fetch latest changes from remote
    console.log(`[CONFLICT] Fetching latest changes from ${remote}...`);
    await git.fetch(remote);
    
    // Pull latest base branch changes
    console.log(`[CONFLICT] Pulling latest changes from ${remote}/${baseBranch}...`);
    try {
      await git.checkout(baseBranch);
      await git.pull(remote, baseBranch);
      console.log(`[CONFLICT] ✅ Updated ${baseBranch} with latest changes`);
    } catch (pullError) {
      console.warn(`[CONFLICT] ⚠️ Could not pull ${baseBranch}: ${pullError.message}`);
    }
    
    // Checkout feature branch again
    await git.checkout(branchName);
    
    // Merge base branch into feature branch
    console.log(`[CONFLICT] Merging ${baseBranch} into ${branchName}...`);
    try {
      await git.merge([`${remote}/${baseBranch}`, '--no-edit']);
      console.log(`[CONFLICT] ✅ Successfully merged ${baseBranch} into ${branchName}`);
      
      // Push the updated branch
      console.log(`[CONFLICT] Pushing updated branch ${branchName}...`);
      const pushResult = await pushBranch(git, branchName, remote, true); // Force push since we rewrote history
      
      if (pushResult.success) {
        return {
          success: true,
          message: `Successfully updated branch ${branchName} with ${baseBranch} and resolved conflicts`
        };
      } else {
        return {
          success: false,
          message: `Updated branch locally but failed to push: ${pushResult.message}`
        };
      }
    } catch (mergeError) {
      // If merge fails due to conflicts, try to resolve automatically
      console.error(`[CONFLICT] Merge failed: ${mergeError.message}`);
      
      // Check if it's a conflict that we can resolve automatically
      if (mergeError.message.includes('conflict') || mergeError.message.includes('CONFLICT')) {
        console.log(`[CONFLICT] Detected merge conflicts, attempting automatic resolution...`);
        
        try {
          // Get repository path if not provided - try multiple methods
          let actualRepoPath = repoPath;
          if (!actualRepoPath) {
            console.log(`[CONFLICT] Repo path not provided, trying to get from git...`);
            try {
              const cwdResult = git.cwd();
              console.log(`[CONFLICT] git.cwd() returned: ${cwdResult} (type: ${typeof cwdResult})`);
              
              // Handle different return types from git.cwd()
              if (typeof cwdResult === 'string') {
                actualRepoPath = cwdResult;
              } else if (cwdResult && typeof cwdResult === 'object') {
                // If it's an object, try to extract the path
                // simple-git might return an object with a path property
                if (cwdResult.path) {
                  actualRepoPath = cwdResult.path;
                } else if (cwdResult.toString && cwdResult.toString() !== '[object Object]') {
                  actualRepoPath = cwdResult.toString();
                } else {
                  // Try to get it from the git instance directly
                  try {
                    const gitPath = await git.revparse(['--show-toplevel']);
                    if (gitPath && typeof gitPath === 'string') {
                      actualRepoPath = gitPath.trim();
                    }
                  } catch (e) {
                    actualRepoPath = null;
                  }
                }
              } else {
                actualRepoPath = null;
              }
            } catch (e) {
              console.warn(`[CONFLICT] git.cwd() failed: ${e.message}`);
              actualRepoPath = null;
            }
            
            // If still no path, try getting it from git rev-parse --show-toplevel
            if (!actualRepoPath) {
              try {
                const topLevel = await git.revparse(['--show-toplevel']);
                console.log(`[CONFLICT] git rev-parse --show-toplevel returned: ${topLevel}`);
                if (topLevel && typeof topLevel === 'string') {
                  actualRepoPath = topLevel.trim();
                }
              } catch (e2) {
                console.warn(`[CONFLICT] git rev-parse --show-toplevel failed: ${e2.message}`);
              }
            }
          } else {
            console.log(`[CONFLICT] Using provided repo path: ${actualRepoPath}`);
          }
          
          console.log(`[CONFLICT] Final repo path: ${actualRepoPath}`);
          
          if (actualRepoPath) {
            const resolveResult = await resolveConflictsAutomatically(git, actualRepoPath, branchName);
            if (resolveResult.success) {
              console.log(`[CONFLICT] ✅ Successfully resolved conflicts automatically`);
              
              // Push the resolved branch
              console.log(`[CONFLICT] Pushing resolved branch ${branchName}...`);
              const pushResult = await pushBranch(git, branchName, remote, true);
              
              if (pushResult.success) {
                return {
                  success: true,
                  message: `Successfully resolved conflicts and updated branch ${branchName}`
                };
              } else {
                return {
                  success: false,
                  message: `Resolved conflicts locally but failed to push: ${pushResult.message}`
                };
              }
            } else {
              // Auto-resolution failed, abort merge
              try {
                await git.merge(['--abort']);
                console.log(`[CONFLICT] Aborted merge after failed auto-resolution`);
              } catch (abortError) {
                console.warn(`[CONFLICT] Could not abort merge: ${abortError.message}`);
              }
              
              return {
                success: false,
                message: `Could not automatically resolve conflicts: ${resolveResult.message}`,
                requiresManualResolution: true
              };
            }
          } else {
            // Can't resolve without repo path - try one more time with process.cwd()
            console.warn(`[CONFLICT] ⚠️ Could not get repo path from git, trying process.cwd()...`);
            try {
              const processCwd = require('path').resolve(process.cwd());
              console.log(`[CONFLICT] process.cwd() returned: ${processCwd}`);
              // Check if this looks like a git repo (has .git directory)
              const fs = require('fs');
              if (fs.existsSync(require('path').join(processCwd, '.git'))) {
                actualRepoPath = processCwd;
                console.log(`[CONFLICT] ✅ Using process.cwd() as repo path`);
                
                // Try resolution with process.cwd()
                const resolveResult = await resolveConflictsAutomatically(git, actualRepoPath, branchName);
                if (resolveResult.success) {
                  console.log(`[CONFLICT] ✅ Successfully resolved conflicts automatically`);
                  
                  // Push the resolved branch
                  console.log(`[CONFLICT] Pushing resolved branch ${branchName}...`);
                  const pushResult = await pushBranch(git, branchName, remote, true);
                  
                  if (pushResult.success) {
                    return {
                      success: true,
                      message: `Successfully resolved conflicts and updated branch ${branchName}`
                    };
                  } else {
                    return {
                      success: false,
                      message: `Resolved conflicts locally but failed to push: ${pushResult.message}`
                    };
                  }
                }
              }
            } catch (cwdError) {
              console.warn(`[CONFLICT] process.cwd() approach also failed: ${cwdError.message}`);
            }
            
            // Can't resolve without repo path - abort merge
            try {
              await git.merge(['--abort']);
              console.log(`[CONFLICT] Aborted merge`);
            } catch (abortError) {
              console.warn(`[CONFLICT] Could not abort merge: ${abortError.message}`);
            }
            
            return {
              success: false,
              message: `Merge conflicts detected but cannot resolve automatically (no repo path). Please resolve conflicts in branch ${branchName} manually.`,
              requiresManualResolution: true
            };
          }
        } catch (resolveError) {
          console.error(`[CONFLICT] Error during automatic conflict resolution: ${resolveError.message}`);
          try {
            await git.merge(['--abort']);
            console.log(`[CONFLICT] Aborted merge`);
          } catch (abortError) {
            console.warn(`[CONFLICT] Could not abort merge: ${abortError.message}`);
          }
          
          return {
            success: false,
            message: `Failed to automatically resolve conflicts: ${resolveError.message}`,
            requiresManualResolution: true
          };
        }
      }
      
      // For non-conflict errors, abort and report
      try {
        await git.merge(['--abort']);
        console.log(`[CONFLICT] Aborted merge`);
      } catch (abortError) {
        console.warn(`[CONFLICT] Could not abort merge: ${abortError.message}`);
      }
      
      return {
        success: false,
        message: `Failed to merge ${baseBranch} into ${branchName}: ${mergeError.message}`
      };
    }
  } catch (error) {
    console.error(`[CONFLICT] Error updating branch ${branchName}:`, error.message);
    return {
      success: false,
      message: `Error updating branch: ${error.message}`
    };
  }
}

/**
 * Get remote URL
 * @param {Object} git - Git instance
 * @param {string} remote - Remote name
 * @returns {Promise<string>}
 */
async function getRemoteUrl(git, remote = 'origin') {
  try {
    console.log(`[REMOTE] Getting remote URL for: ${remote}`);
    const remotes = await git.getRemotes();
    console.log(`[REMOTE] Found ${remotes.length} remote(s):`, remotes.map(r => r.name).join(', '));
    
    const remoteInfo = remotes.find(r => r.name === remote);
    if (!remoteInfo) {
      console.error(`[REMOTE] Remote '${remote}' not found`);
      return null;
    }
    
    console.log(`[REMOTE] Remote info for '${remote}':`, JSON.stringify(remoteInfo, null, 2));
    
    // Try different ways to get the URL
    let url = null;
    
    // Method 1: Try refs.fetch
    if (remoteInfo.refs && remoteInfo.refs.fetch) {
      url = remoteInfo.refs.fetch;
      console.log(`[REMOTE] Found URL via refs.fetch: ${url}`);
    }
    
    // Method 2: Try refs.push
    if (!url && remoteInfo.refs && remoteInfo.refs.push) {
      url = remoteInfo.refs.push;
      console.log(`[REMOTE] Found URL via refs.push: ${url}`);
    }
    
    // Method 3: Try using git config
    if (!url) {
      try {
        const configUrl = await git.getConfig(`remote.${remote}.url`);
        if (configUrl && configUrl.value) {
          url = configUrl.value;
          console.log(`[REMOTE] Found URL via git config: ${url}`);
        }
      } catch (e) {
        console.warn(`[REMOTE] Could not get URL via git config: ${e.message}`);
      }
    }
    
    // Method 4: Try using git remote get-url command
    if (!url) {
      try {
        const remoteUrl = await git.raw(['remote', 'get-url', remote]);
        if (remoteUrl && remoteUrl.trim()) {
          url = remoteUrl.trim();
          console.log(`[REMOTE] Found URL via git remote get-url: ${url}`);
        }
      } catch (e) {
        console.warn(`[REMOTE] Could not get URL via git remote get-url: ${e.message}`);
      }
    }
    
    if (url) {
      // Normalize URL (remove .git suffix if present, convert SSH to HTTPS if needed)
      url = url.trim();
      if (url.endsWith('.git')) {
        url = url.slice(0, -4);
      }
      
      // Convert SSH URL to HTTPS if needed (for GitHub)
      if (url.startsWith('git@')) {
        // git@github.com:user/repo -> https://github.com/user/repo
        url = url.replace(/^git@([^:]+):/, 'https://$1/');
        console.log(`[REMOTE] Converted SSH to HTTPS: ${url}`);
      }
      
      console.log(`[REMOTE] ✅ Final remote URL: ${url}`);
      return url;
    }
    
    console.error(`[REMOTE] ❌ Could not determine remote URL for '${remote}'`);
    return null;
  } catch (error) {
    console.error(`[REMOTE] ❌ Error getting remote URL:`, error.message);
    return null;
  }
}

/**
 * Get commit history for a date range
 * @param {Object} git - Git instance
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} branch - Branch name (default: 'main' or 'master')
 * @returns {Promise<Object>}
 */
async function getCommitHistory(git, startDate, endDate, branch = null) {
  try {
    // Determine which branch to check
    let branchToCheck = branch;
    if (!branchToCheck) {
      try {
        // Try to get current branch
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        branchToCheck = currentBranch;
      } catch (e) {
        // Try main or master
        try {
          await git.checkout('main');
          branchToCheck = 'main';
        } catch (e2) {
          try {
            await git.checkout('master');
            branchToCheck = 'master';
          } catch (e3) {
            branchToCheck = null;
          }
        }
      }
    }
    
    if (!branchToCheck) {
      return { success: false, message: 'Could not determine branch to check' };
    }
    
    console.log(`[HISTORY] Fetching commit history for branch: ${branchToCheck}`);
    
    // Get all commits from the branch
    const logResult = await git.log({
      from: branchToCheck,
      to: branchToCheck
    });
    
    if (!logResult || !logResult.all || logResult.all.length === 0) {
      return { 
        success: true, 
        commits: [], 
        message: 'No commits found in repository',
        branch: branchToCheck
      };
    }
    
    // Filter commits by date range
    const startTime = startDate.getTime();
    const endTime = endDate.getTime() + 86400000; // Add 1 day to include end date
    
    const filteredCommits = logResult.all
      .map(commit => {
        // Parse commit date (can be Date object or string)
        const commitDate = commit.date instanceof Date ? commit.date : new Date(commit.date);
        const commitTime = commitDate.getTime();
        const dateStr = commitDate.toISOString().split('T')[0];
        
        return {
          hash: commit.hash,
          shortHash: commit.hash ? commit.hash.substring(0, 7) : 'unknown',
          date: dateStr,
          fullDate: commit.date,
          message: commit.message || 'No message',
          author: commit.author_name || commit.author || 'Unknown',
          timestamp: commitDate.toISOString()
        };
      })
      .filter(commit => {
        const commitDate = new Date(commit.date);
        const commitTime = commitDate.getTime();
        return commitTime >= startTime && commitTime <= endTime;
      });
    
    // Group commits by date
    const commitsByDate = {};
    filteredCommits.forEach(commit => {
      if (!commitsByDate[commit.date]) {
        commitsByDate[commit.date] = [];
      }
      commitsByDate[commit.date].push(commit);
    });
    
    console.log(`[HISTORY] Found ${filteredCommits.length} commits in date range (${filteredCommits.length} total commits in repo)`);
    
    return {
      success: true,
      commits: filteredCommits,
      commitsByDate: commitsByDate,
      totalCommits: logResult.all.length,
      branch: branchToCheck,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    };
  } catch (error) {
    console.error(`[HISTORY] Error fetching commit history:`, error.message);
    return { 
      success: false, 
      message: `Error fetching commit history: ${error.message}`,
      commits: [],
      commitsByDate: {}
    };
  }
}

/**
 * Process a single date: create branch, commit, push, and optionally create/merge PR
 * @param {Object} git - Git instance
 * @param {Date} date - Date to process
 * @param {number} commitCount - Number of commits per date
 * @param {string} remote - Remote name
 * @param {Object} prOptions - PR options (createPR, autoMerge, token, baseBranch, platform)
 * @param {string} repoPath - Repository path
 * @returns {Promise<Object>}
 */
async function processDate(git, date, commitCount, remote = 'origin', prOptions = null, repoPath = null) {
  const dateStr = require('./dateUtils').formatDate(date);
  const branchName = `auto-${dateStr}`;
  
  const results = {
    date: dateStr,
    branch: branchName,
    commits: [],
    push: null
  };
  
  try {
    // Verify we're processing the correct date
    console.log(`[PROCESS] Processing date: ${dateStr}, creating branch: ${branchName}`);
    
    // Ensure we're on the base branch first (usually 'main' or 'master')
    // Also pull latest changes to ensure branch is based on latest code
    let baseBranch = 'main';
    try {
      await git.checkout('main');
      baseBranch = 'main';
      // Pull latest changes from remote to ensure we're up to date
      console.log(`[PROCESS] Pulling latest changes from ${remote}/${baseBranch}...`);
      try {
        await git.pull(remote, baseBranch);
        console.log(`[PROCESS] ✅ Successfully pulled latest changes from ${baseBranch}`);
      } catch (pullError) {
        console.warn(`[PROCESS] ⚠️ Could not pull latest changes: ${pullError.message}. Continuing anyway...`);
      }
    } catch (e) {
      try {
        await git.checkout('master');
        baseBranch = 'master';
        // Pull latest changes from remote to ensure we're up to date
        console.log(`[PROCESS] Pulling latest changes from ${remote}/${baseBranch}...`);
        try {
          await git.pull(remote, baseBranch);
          console.log(`[PROCESS] ✅ Successfully pulled latest changes from ${baseBranch}`);
        } catch (pullError) {
          console.warn(`[PROCESS] ⚠️ Could not pull latest changes: ${pullError.message}. Continuing anyway...`);
        }
      } catch (e2) {
        // If neither exists, continue with current branch
        console.log(`[PROCESS] Could not checkout main/master, continuing with current branch`);
        // Get current branch name
        try {
          const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
          baseBranch = currentBranch;
        } catch (e3) {
          baseBranch = 'unknown';
        }
      }
    }
    
    console.log(`[PROCESS] On base branch: ${baseBranch}, creating branch: ${branchName} for date: ${dateStr}`);
    
    // Create branch (will handle remote branch deletion if needed)
    const branchResult = await createBranch(git, branchName, remote, false);
    results.branchResult = branchResult;
    
    if (!branchResult.success) {
      return { success: false, results, message: `Failed to create branch: ${branchResult.message}` };
    }
    
    // Create commits (pass repoPath if available)
    const commitResult = await createCommits(git, commitCount, dateStr, repoPath);
    results.commits = commitResult;
    
    if (!commitResult.success) {
      return { success: false, results, message: `Failed to create commits: ${commitResult.message}` };
    }
    
    // Push branch (will auto-retry with force if needed)
    const pushResult = await pushBranch(git, branchName, remote, false);
    results.push = pushResult;
    
    if (!pushResult.success) {
      return { success: false, results, message: `Failed to push: ${pushResult.message}` };
    }
    
    // Verify commits are on the branch
    try {
      const branchLog = await git.log([branchName, '-1']);
      if (branchLog.latest) {
        console.log(`[VERIFY] ✅ Branch ${branchName} has commit: ${branchLog.latest.hash.substring(0, 7)} - ${branchLog.latest.message}`);
      } else {
        console.warn(`[VERIFY] ⚠️ Warning: Branch ${branchName} has no commits!`);
      }
    } catch (error) {
      console.warn(`[VERIFY] Could not verify commits on branch: ${error.message}`);
    }
    
    // Create PR if requested
    if (prOptions && prOptions.createPR) {
      console.log(`[PR] PR creation enabled for ${dateStr}`);
      
      // Wait a moment for GitHub to sync the branch (GitHub needs time to see the pushed branch)
      // Increased wait time to ensure branch is fully synced
      console.log(`[PR] Waiting 5 seconds for GitHub to sync branch ${branchName}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const repoUrl = await getRemoteUrl(git, remote);
        if (!repoUrl) {
          console.error(`[PR] Could not get remote URL for PR creation`);
          results.pr = {
            success: false,
            message: 'Could not get remote URL for PR creation'
          };
        } else {
          console.log(`[PR] Remote URL: ${repoUrl}`);
          
          if (!prOptions.token) {
            console.error(`[PR] No API token provided for PR creation`);
            results.pr = {
              success: false,
              message: 'API token is required for PR creation'
            };
          } else {
            console.log(`[PR] Token provided: ${prOptions.token.substring(0, 10)}... (length: ${prOptions.token.length})`);
            console.log(`[PR] Platform: ${prOptions.platform || 'auto-detect'}`);
            console.log(`[PR] Base branch: ${prOptions.baseBranch || 'main'}`);
            console.log(`[PR] Auto-merge: ${prOptions.autoMerge || false}`);
            
            const { createAndMergePR } = require('./prOperations');
            console.log(`[PR] Creating PR: ${branchName} -> ${prOptions.baseBranch || baseBranch}`);
            const prResult = await createAndMergePR(
              repoUrl,
              branchName,
              prOptions.token,
              {
                baseBranch: prOptions.baseBranch || baseBranch,
                platform: prOptions.platform,
                autoMerge: prOptions.autoMerge || false,
                mergeMethod: prOptions.mergeMethod || 'merge',
                title: `Auto PR for ${dateStr}`,
                body: `Automated pull request for date ${dateStr}`,
                git: git,
                remote: remote,
                repoPath: repoPath
              }
            );
            results.pr = prResult;
            
            if (prResult.success) {
              console.log(`[PR] ✅ PR created successfully for ${dateStr}: ${prResult.message}`);
              if (prResult.prUrl) {
                console.log(`[PR] PR URL: ${prResult.prUrl}`);
              }
            } else {
              console.error(`[PR] ❌ Failed to create PR for ${dateStr}: ${prResult.message}`);
            }
          }
        }
      } catch (error) {
        console.error(`[PR] ❌ Exception creating PR for ${dateStr}:`, error.message);
        results.pr = {
          success: false,
          message: `Error creating PR: ${error.message}`
        };
      }
    } else {
      console.log(`[PR] PR creation not enabled for ${dateStr} (prOptions: ${prOptions ? 'exists but createPR=false' : 'null'})`);
    }
    
    return { success: true, results, message: `Successfully processed ${dateStr}` };
  } catch (error) {
    return { success: false, results, message: `Error processing date: ${error.message}` };
  }
}

module.exports = {
  initGit,
  createBranch,
  createCommits,
  pushBranch,
  processDate,
  getRemoteUrl,
  getCommitHistory,
  isRepoUrl,
  extractRepoName,
  updateBranchWithBase
};

