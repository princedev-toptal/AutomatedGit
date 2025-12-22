/**
 * Git operations module
 */

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

/**
 * Initialize git operations
 * @param {string} repoPath - Path to the git repository
 * @returns {Promise<Object>} - Git instance
 */
async function initGit(repoPath) {
  const git = simpleGit(repoPath);
  
  // Check if directory exists, if not create it
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath, { recursive: true });
  }
  
  // Initialize git repo if not already initialized
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
  }
  
  return git;
}

/**
 * Create a branch with the given name
 * @param {Object} git - Git instance
 * @param {string} branchName - Name of the branch
 * @returns {Promise<void>}
 */
async function createBranch(git, branchName) {
  try {
    // Check if branch already exists
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      await git.checkout(branchName);
    } else {
      await git.checkoutLocalBranch(branchName);
    }
    return { success: true, message: `Branch '${branchName}' created/checked out` };
  } catch (error) {
    return { success: false, message: `Error creating branch: ${error.message}` };
  }
}

/**
 * Create commits on the current branch
 * @param {Object} git - Git instance
 * @param {number} commitCount - Number of commits to create
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
async function createCommits(git, commitCount, date) {
  const results = [];
  
  try {
    // Create a dummy file or update existing one
    const fileName = 'commits.txt';
    const filePath = path.join(git.cwd(), fileName);
    
    // Read existing content or initialize
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }
    
    for (let i = 0; i < commitCount; i++) {
      // Append a line to the file
      const timestamp = new Date().toISOString();
      content += `${date} - Commit ${i + 1} at ${timestamp}\n`;
      fs.writeFileSync(filePath, content);
      
      // Stage the file
      await git.add(fileName);
      
      // Commit with date
      const commitMessage = `Auto commit ${i + 1} for ${date}`;
      await git.commit(commitMessage, {
        '--date': new Date(date).toISOString()
      });
      
      results.push({ success: true, message: `Commit ${i + 1} created` });
    }
    
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
async function pushBranch(git, branchName, remote = 'origin') {
  try {
    // Check if remote exists
    const remotes = await git.getRemotes();
    const remoteExists = remotes.some(r => r.name === remote);
    
    if (!remoteExists) {
      return { success: false, message: `Remote '${remote}' does not exist. Please add it first.` };
    }
    
    await git.push(remote, branchName);
    return { success: true, message: `Branch '${branchName}' pushed to ${remote}` };
  } catch (error) {
    return { success: false, message: `Error pushing branch: ${error.message}` };
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
    const remotes = await git.getRemotes();
    const remoteInfo = remotes.find(r => r.name === remote);
    if (remoteInfo && remoteInfo.refs && remoteInfo.refs.fetch) {
      return remoteInfo.refs.fetch;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Process a single date: create branch, commit, push, and optionally create/merge PR
 * @param {Object} git - Git instance
 * @param {Date} date - Date to process
 * @param {number} commitCount - Number of commits per date
 * @param {string} remote - Remote name
 * @param {Object} prOptions - PR options (createPR, autoMerge, token, baseBranch, platform)
 * @returns {Promise<Object>}
 */
async function processDate(git, date, commitCount, remote = 'origin', prOptions = null) {
  const dateStr = require('./dateUtils').formatDate(date);
  const branchName = `auto-${dateStr}`;
  
  const results = {
    date: dateStr,
    branch: branchName,
    commits: [],
    push: null
  };
  
  try {
    // Create branch
    const branchResult = await createBranch(git, branchName);
    results.branchResult = branchResult;
    
    if (!branchResult.success) {
      return { success: false, results, message: `Failed to create branch: ${branchResult.message}` };
    }
    
    // Create commits
    const commitResult = await createCommits(git, commitCount, dateStr);
    results.commits = commitResult;
    
    if (!commitResult.success) {
      return { success: false, results, message: `Failed to create commits: ${commitResult.message}` };
    }
    
    // Push branch
    const pushResult = await pushBranch(git, branchName, remote);
    results.push = pushResult;
    
    if (!pushResult.success) {
      return { success: false, results, message: `Failed to push: ${pushResult.message}` };
    }
    
    // Create PR if requested
    if (prOptions && prOptions.createPR) {
      try {
        const repoUrl = await getRemoteUrl(git, remote);
        if (!repoUrl) {
          results.pr = {
            success: false,
            message: 'Could not get remote URL for PR creation'
          };
        } else {
          const { createAndMergePR } = require('./prOperations');
          const prResult = await createAndMergePR(
            repoUrl,
            branchName,
            prOptions.token,
            {
              baseBranch: prOptions.baseBranch || 'main',
              platform: prOptions.platform,
              autoMerge: prOptions.autoMerge || false,
              mergeMethod: prOptions.mergeMethod || 'merge',
              title: `Auto PR for ${dateStr}`,
              body: `Automated pull request for date ${dateStr}`
            }
          );
          results.pr = prResult;
        }
      } catch (error) {
        results.pr = {
          success: false,
          message: `Error creating PR: ${error.message}`
        };
      }
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
  getRemoteUrl
};

