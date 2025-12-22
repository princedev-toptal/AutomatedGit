/**
 * Pull Request operations module
 * Supports GitHub, GitLab, and Bitbucket
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Parse repository URL to extract owner and repo
 * Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
 */
function parseRepoUrl(repoUrl) {
  if (!repoUrl) {
    console.error(`[PARSE] No repo URL provided`);
    return null;
  }
  
  console.log(`[PARSE] Parsing repo URL: ${repoUrl}`);
  
  // Remove .git suffix
  repoUrl = repoUrl.replace(/\.git$/, '');
  
  // Handle SSH format: git@github.com:owner/repo
  if (repoUrl.includes('@')) {
    const match = repoUrl.match(/@([^:]+):(.+)$/);
    if (match) {
      const result = {
        host: match[1],
        owner: match[2].split('/')[0],
        repo: match[2].split('/')[1]
      };
      console.log(`[PARSE] Parsed SSH URL:`, result);
      return result;
    }
  }
  
  // Handle HTTPS format: https://github.com/owner/repo
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split('/').filter(p => p);
    if (parts.length < 2) {
      console.error(`[PARSE] Invalid URL path - not enough parts: ${url.pathname}`);
      return null;
    }
    const result = {
      host: url.hostname,
      owner: parts[0],
      repo: parts[1]
    };
    console.log(`[PARSE] Parsed HTTPS URL:`, result);
    return result;
  } catch (e) {
    console.error(`[PARSE] Error parsing URL:`, e.message);
    return null;
  }
}

/**
 * Detect platform from repository URL
 */
function detectPlatform(repoUrl) {
  if (!repoUrl) return null;
  const url = repoUrl.toLowerCase();
  
  if (url.includes('github.com')) return 'github';
  if (url.includes('gitlab.com') || url.includes('gitlab')) return 'gitlab';
  if (url.includes('bitbucket.org') || url.includes('bitbucket')) return 'bitbucket';
  
  return null;
}

/**
 * Make HTTP request with timeout
 */
function makeRequest(options, data = null, timeoutMs = 30000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    // Prevent infinite redirect loops
    if (redirectCount >= 5) {
      reject(new Error('Too many redirects (max 5)'));
      return;
    }
    
    const protocol = options.protocol === 'https:' ? https : http;
    
    // Set request timeout
    const req = protocol.request(options, (res) => {
      // Handle redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        console.log(`[HTTP] Following redirect ${res.statusCode} to: ${res.headers.location} (redirect ${redirectCount + 1}/5)`);
        try {
          // Handle relative and absolute URLs
          let redirectUrl;
          if (res.headers.location.startsWith('http://') || res.headers.location.startsWith('https://')) {
            redirectUrl = new URL(res.headers.location);
          } else {
            // Relative URL - construct from current request
            const baseUrl = `${options.protocol || 'https:'}//${options.hostname}${options.path}`;
            redirectUrl = new URL(res.headers.location, baseUrl);
          }
          
          const redirectOptions = {
            ...options,
            hostname: redirectUrl.hostname,
            path: redirectUrl.pathname + redirectUrl.search,
            port: redirectUrl.port || (redirectUrl.protocol === 'https:' ? 443 : 80),
            protocol: redirectUrl.protocol
          };
          
          console.log(`[HTTP] Redirecting to: ${redirectUrl.href}`);
          // Recursively follow redirect
          return makeRequest(redirectOptions, data, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
        } catch (e) {
          console.error(`[HTTP] Error parsing redirect URL:`, e.message);
          reject(new Error(`Invalid redirect URL: ${res.headers.location} - ${e.message}`));
          return;
        }
      }
      
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    // Set socket timeout
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Create PR on GitHub
 */
async function createGitHubPR(repoInfo, branchName, baseBranch, token, title, body) {
  const { owner, repo } = repoInfo;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;
  
  // GitHub API accepts both "token" and "Bearer" for personal access tokens
  // Try token first (classic), fallback to Bearer if needed
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  const options = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${owner}/${repo}/pulls`,
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  console.log(`[PR] Request URL: https://${options.hostname}${options.path}`);
  
  console.log(`[PR] Using auth header format: ${authHeader.substring(0, 15)}...`);
  
  const prData = {
    title: title || `Auto PR for ${branchName}`,
    body: body || `Automated pull request for branch ${branchName}`,
    head: branchName,
    base: baseBranch || 'main'
  };
  
  try {
    console.log(`[PR] Creating PR for branch ${branchName} -> ${baseBranch}`);
    console.log(`[PR] Repository: ${owner}/${repo}`);
    console.log(`[PR] PR Data:`, JSON.stringify(prData, null, 2));
    const startTime = Date.now();
    const response = await makeRequest(options, prData, 30000); // 30 second timeout
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`[PR] API Response Status: ${response.status}`);
    console.log(`[PR] API Response Data:`, JSON.stringify(response.data, null, 2));
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`[PR] PR #${response.data.number} created successfully in ${duration}s`);
      return {
        success: true,
        prNumber: response.data.number,
        prUrl: response.data.html_url,
        message: `PR #${response.data.number} created successfully`
      };
    } else {
      // GitHub API error responses can have different formats
      let errorMessage = 'Unknown error';
      if (response.data) {
        if (response.data.message) {
          errorMessage = response.data.message;
        } else if (response.data.error) {
          errorMessage = response.data.error;
        } else if (Array.isArray(response.data.errors)) {
          errorMessage = response.data.errors.map(e => e.message || e).join(', ');
        } else if (typeof response.data === 'string') {
          errorMessage = response.data;
        } else {
          errorMessage = JSON.stringify(response.data);
        }
      }
      
      console.error(`[PR] Failed to create PR (Status ${response.status}):`, errorMessage);
      console.error(`[PR] Full response:`, JSON.stringify(response, null, 2));
      
      return {
        success: false,
        message: `Failed to create PR (HTTP ${response.status}): ${errorMessage}`
      };
    }
  } catch (error) {
    console.error(`[PR] Exception creating GitHub PR:`, error);
    console.error(`[PR] Error stack:`, error.stack);
    return {
      success: false,
      message: `Error creating GitHub PR: ${error.message}`
    };
  }
}

/**
 * Find existing PR for a branch
 */
async function findPRForBranch(repoInfo, branchName, baseBranch, token) {
  const { owner, repo } = repoInfo;
  
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  // Search for PRs with head branch matching our branch
  // Format: owner:branchName (e.g., "karimandu1025-dot:auto-2015-12-24")
  const head = `${owner}:${branchName}`;
  const options = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(head)}&state=open`,
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  try {
    console.log(`[PR] Searching for existing PR for branch: ${branchName} -> ${baseBranch}`);
    const response = await makeRequest(options, null, 30000);
    
    if (response.status >= 200 && response.status < 300) {
      const prs = Array.isArray(response.data) ? response.data : [];
      
      // Filter PRs that match both head and base branch
      const matchingPRs = prs.filter(pr => 
        pr.head.ref === branchName && 
        pr.base.ref === baseBranch &&
        pr.state === 'open'
      );
      
      if (matchingPRs.length > 0) {
        const pr = matchingPRs[0]; // Take the first matching PR
        console.log(`[PR] Found existing PR #${pr.number} for branch ${branchName}`);
        return {
          success: true,
          found: true,
          prNumber: pr.number,
          prUrl: pr.html_url,
          mergeable: pr.mergeable,
          mergeable_state: pr.mergeable_state,
          merged: pr.merged,
          state: pr.state
        };
      } else {
        console.log(`[PR] No existing PR found for branch ${branchName} -> ${baseBranch}`);
        return {
          success: true,
          found: false
        };
      }
    } else {
      console.warn(`[PR] Failed to search for existing PR: ${response.data.message || 'Unknown error'}`);
      return {
        success: false,
        found: false,
        message: `Failed to search for existing PR: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.warn(`[PR] Error searching for existing PR: ${error.message}`);
    return {
      success: false,
      found: false,
      message: `Error searching for existing PR: ${error.message}`
    };
  }
}

/**
 * Get PR status from GitHub API
 */
async function getPRStatus(repoInfo, prNumber, token) {
  const { owner, repo } = repoInfo;
  
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  const options = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  try {
    const response = await makeRequest(options, null, 30000);
    
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        mergeable: response.data.mergeable,
        mergeable_state: response.data.mergeable_state,
        merged: response.data.merged,
        state: response.data.state,
        title: response.data.title,
        number: response.data.number
      };
    } else {
      return {
        success: false,
        message: `Failed to get PR status: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error getting PR status: ${error.message}`
    };
  }
}

/**
 * Merge PR on GitHub with retry logic
 */
async function mergeGitHubPR(repoInfo, prNumber, token, mergeMethod = 'merge', maxRetries = 5, options = {}) {
  const { owner, repo } = repoInfo;
  
  // GitHub API accepts both "token" and "Bearer" for personal access tokens
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  const requestOptions = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  console.log(`[PR] Merge request URL: https://${requestOptions.hostname}${requestOptions.path}`);
  
  const mergeData = {
    merge_method: mergeMethod // 'merge', 'squash', or 'rebase'
  };
  
  // Check PR status first and wait if not mergeable
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[PR] Checking PR #${prNumber} status (attempt ${attempt}/${maxRetries})...`);
    const prStatus = await getPRStatus(repoInfo, prNumber, token);
    
    if (!prStatus.success) {
      console.warn(`[PR] Could not get PR status: ${prStatus.message}`);
      // Continue to try merge anyway
    } else {
      console.log(`[PR] PR #${prNumber} status: mergeable=${prStatus.mergeable}, state=${prStatus.state}, mergeable_state=${prStatus.mergeable_state}`);
      
      // If already merged, return success
      if (prStatus.merged) {
        console.log(`[PR] PR #${prNumber} is already merged`);
        return {
          success: true,
          message: `PR #${prNumber} was already merged`
        };
      }
      
      // If not mergeable, check the reason
      if (prStatus.mergeable === false) {
        // If mergeable_state is "dirty", it means there are merge conflicts that won't resolve by waiting
        if (prStatus.mergeable_state === 'dirty') {
          console.error(`[PR] PR #${prNumber} has merge conflicts (mergeable_state=dirty).`);
          
          // Try to resolve conflicts automatically if git instance and branch info are available
          if (options.git && options.branchName && options.baseBranch && options.remote) {
            console.log(`[PR] Attempting to automatically resolve conflicts by updating branch...`);
            const { updateBranchWithBase } = require('./gitOperations');
            const updateResult = await updateBranchWithBase(
              options.git,
              options.branchName,
              options.baseBranch,
              options.remote
            );
            
            if (updateResult.success) {
              console.log(`[PR] ✅ Successfully resolved conflicts by updating branch`);
              // Wait a moment for GitHub to recalculate mergeability
              console.log(`[PR] Waiting 5 seconds for GitHub to recalculate mergeability...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              // Continue to retry merge
              continue;
            } else {
              if (updateResult.requiresManualResolution) {
                return {
                  success: false,
                  message: `PR #${prNumber} has merge conflicts that require manual resolution. ${updateResult.message}`,
                  requiresManualResolution: true
                };
              }
              console.warn(`[PR] ⚠️ Could not automatically resolve conflicts: ${updateResult.message}`);
              // Continue to return error below
            }
          }
          
          return {
            success: false,
            message: `PR #${prNumber} has merge conflicts and cannot be merged automatically. The branch needs to be updated with the latest changes from the base branch to resolve conflicts.`,
            requiresManualResolution: true
          };
        }
        
        // For other states (blocked, unstable, etc.), wait and retry
        if (attempt < maxRetries) {
          const waitTime = Math.min(5000 * attempt, 30000); // Exponential backoff, max 30s
          console.log(`[PR] PR #${prNumber} is not mergeable yet. Waiting ${waitTime/1000}s before retry...`);
          console.log(`[PR] Reason: mergeable_state=${prStatus.mergeable_state}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        } else {
          return {
            success: false,
            message: `PR #${prNumber} is not mergeable (mergeable_state: ${prStatus.mergeable_state}). This may be due to required checks, branch protection rules, or other issues.`
          };
        }
      }
      
      // If mergeable is null, GitHub is still calculating - wait and retry
      if (prStatus.mergeable === null) {
        if (attempt < maxRetries) {
          const waitTime = Math.min(3000 * attempt, 20000); // Exponential backoff, max 20s
          console.log(`[PR] PR #${prNumber} mergeability is still being calculated. Waiting ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        } else {
          return {
            success: false,
            message: `PR #${prNumber} mergeability check timed out. GitHub may still be calculating mergeability.`
          };
        }
      }
    }
    
    // PR is mergeable, attempt merge
    try {
      console.log(`[PR] Attempting to merge PR #${prNumber} using ${mergeMethod} method`);
      const startTime = Date.now();
      const response = await makeRequest(requestOptions, mergeData, 30000); // 30 second timeout
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`[PR] PR #${prNumber} merged successfully in ${duration}s`);
        return {
          success: true,
          message: `PR #${prNumber} merged successfully`
        };
      } else {
        // GitHub API error responses can have different formats
        let errorMessage = 'Unknown error';
        if (response.data) {
          if (response.data.message) {
            errorMessage = response.data.message;
          } else if (response.data.error) {
            errorMessage = response.data.error;
          } else if (Array.isArray(response.data.errors)) {
            errorMessage = response.data.errors.map(e => e.message || e).join(', ');
          } else if (typeof response.data === 'string') {
            errorMessage = response.data;
          } else {
            errorMessage = JSON.stringify(response.data);
          }
        }
        
        // If error is "not mergeable" and we have retries left, retry
        if (errorMessage.includes('not mergeable') && attempt < maxRetries) {
          const waitTime = Math.min(5000 * attempt, 30000);
          console.warn(`[PR] Merge failed (Status ${response.status}): ${errorMessage}`);
          console.log(`[PR] Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        }
        
        console.error(`[PR] Failed to merge PR (Status ${response.status}):`, errorMessage);
        console.error(`[PR] Full response:`, JSON.stringify(response, null, 2));
        
        return {
          success: false,
          message: `Failed to merge PR (HTTP ${response.status}): ${errorMessage}`
        };
      }
    } catch (error) {
      if (attempt < maxRetries) {
        const waitTime = Math.min(3000 * attempt, 20000);
        console.warn(`[PR] Exception merging PR (attempt ${attempt}): ${error.message}`);
        console.log(`[PR] Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue; // Retry
      }
      
      console.error(`[PR] Exception merging GitHub PR:`, error);
      console.error(`[PR] Error stack:`, error.stack);
      return {
        success: false,
        message: `Error merging GitHub PR: ${error.message}`
      };
    }
  }
  
  return {
    success: false,
    message: `Failed to merge PR #${prNumber} after ${maxRetries} attempts`
  };
}

/**
 * Create and optionally merge PR
 */
async function createAndMergePR(repoUrl, branchName, token, options = {}) {
  const {
    baseBranch = 'main',
    platform = null,
    autoMerge = false,
    mergeMethod = 'merge',
    title = null,
    body = null,
    git = null,
    remote = 'origin'
  } = options;
  
  // Detect platform if not provided
  const detectedPlatform = platform || detectPlatform(repoUrl);
  
  if (!detectedPlatform) {
    return {
      success: false,
      message: 'Could not detect platform from repository URL. Please specify platform.'
    };
  }
  
  // Parse repository info
  const repoInfo = parseRepoUrl(repoUrl);
  if (!repoInfo) {
    return {
      success: false,
      message: 'Could not parse repository URL'
    };
  }
  
  // Check if PR already exists for this branch
  let prResult;
  let existingPR = null;
  
  if (detectedPlatform === 'github') {
    console.log(`[PR] Checking for existing PR for branch: ${branchName} -> ${baseBranch}`);
    const existingPRResult = await findPRForBranch(repoInfo, branchName, baseBranch, token);
    
    if (existingPRResult.success && existingPRResult.found) {
      // PR already exists, use it instead of creating a new one
      console.log(`[PR] ✅ Found existing PR #${existingPRResult.prNumber}, skipping creation`);
      existingPR = existingPRResult;
      prResult = {
        success: true,
        prNumber: existingPRResult.prNumber,
        prUrl: existingPRResult.prUrl,
        message: `Using existing PR #${existingPRResult.prNumber}`
      };
    } else {
      // No existing PR found, create a new one
      console.log(`[PR] No existing PR found, creating new PR for branch: ${branchName}`);
      prResult = await createGitHubPR(repoInfo, branchName, baseBranch, token, title, body);
    }
  } else {
    return {
      success: false,
      message: `Platform ${detectedPlatform} is not yet supported. Currently only GitHub is supported.`
    };
  }
  
  if (!prResult.success) {
    return prResult;
  }
  
  const result = {
    success: true,
    prCreated: !existingPR, // true if we created it, false if it already existed
    prNumber: prResult.prNumber,
    prUrl: prResult.prUrl,
    message: existingPR ? `Found existing PR #${prResult.prNumber}` : prResult.message
  };
  
  // Merge PR if requested
  if (autoMerge && detectedPlatform === 'github') {
    console.log(`[PR] Auto-merge enabled, merging PR #${prResult.prNumber}...`);
    
    // If we found an existing PR, check if it's already merged
    if (existingPR && existingPR.merged) {
      console.log(`[PR] ✅ PR #${prResult.prNumber} is already merged`);
      result.merged = true;
      result.mergeMessage = 'PR was already merged';
      result.message += ` | Already merged`;
    } else {
      // Wait a moment for PR to be fully created and GitHub to calculate mergeability
      // If PR already existed, wait less time since it's been around longer
      const waitTime = existingPR ? 2000 : 3000;
      console.log(`[PR] Waiting ${waitTime/1000} seconds for GitHub to calculate PR mergeability...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const mergeResult = await mergeGitHubPR(repoInfo, prResult.prNumber, token, mergeMethod, 5, {
        git: git,
        branchName: branchName,
        baseBranch: baseBranch,
        remote: remote,
        repoPath: options.repoPath || null
      });
      result.merged = mergeResult.success;
      result.mergeMessage = mergeResult.message;
      
      if (mergeResult.success) {
        console.log(`[PR] ✅ PR #${prResult.prNumber} merged successfully`);
        result.message += ` | Merged successfully`;
      } else {
        console.error(`[PR] ❌ Failed to merge PR #${prResult.prNumber}: ${mergeResult.message}`);
        result.message += ` | Merge failed: ${mergeResult.message}`;
        // Don't fail the whole operation if merge fails - PR was still created/found
      }
    }
  }
  
  return result;
}

/**
 * Follow a GitHub user
 */
async function followGitHubUser(username, token) {
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  const options = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/user/following/${username}`,
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Content-Length': 0,
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  try {
    console.log(`[FOLLOW] Following GitHub user: ${username}`);
    const response = await makeRequest(options, null, 30000);
    
    // 204 No Content means success for PUT /user/following/{username}
    if (response.status === 204 || response.status === 200) {
      console.log(`[FOLLOW] Successfully followed ${username}`);
      return {
        success: true,
        message: `Successfully followed ${username}`
      };
    } else {
      // Check if already following (204 is also success)
      if (response.status === 404) {
        return {
          success: false,
          message: `User ${username} not found`
        };
      }
      return {
        success: false,
        message: `Failed to follow user: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error(`[FOLLOW] Error following user:`, error);
    return {
      success: false,
      message: `Error following user: ${error.message}`
    };
  }
}

/**
 * Star a GitHub repository
 */
async function starGitHubRepository(owner, repo, token) {
  const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
    ? `Bearer ${token}` 
    : `token ${token}`;
  
  const options = {
    protocol: 'https:',
    hostname: 'api.github.com',
    port: 443,
    path: `/user/starred/${owner}/${repo}`,
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Auto-Git',
      'Content-Length': 0,
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  try {
    console.log(`[STAR] Starring GitHub repository: ${owner}/${repo}`);
    const response = await makeRequest(options, null, 30000);
    
    // 204 No Content means success for PUT /user/starred/{owner}/{repo}
    if (response.status === 204 || response.status === 200) {
      console.log(`[STAR] Successfully starred ${owner}/${repo}`);
      return {
        success: true,
        message: `Successfully starred ${owner}/${repo}`
      };
    } else {
      // Check if already starred (204 is also success)
      if (response.status === 404) {
        return {
          success: false,
          message: `Repository ${owner}/${repo} not found`
        };
      }
      return {
        success: false,
        message: `Failed to star repository: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error(`[STAR] Error starring repository:`, error);
    return {
      success: false,
      message: `Error starring repository: ${error.message}`
    };
  }
}

/**
 * Follow a user and star a repository
 */
async function followAndStar(username, repoUrl, token) {
  const results = {
    follow: null,
    star: null
  };
  
  // Follow user
  if (username) {
    results.follow = await followGitHubUser(username, token);
  }
  
  // Star repository
  if (repoUrl) {
    const repoInfo = parseRepoUrl(repoUrl);
    if (repoInfo && repoInfo.owner && repoInfo.repo) {
      // Only star if it's a GitHub repository
      if (detectPlatform(repoUrl) === 'github') {
        results.star = await starGitHubRepository(repoInfo.owner, repoInfo.repo, token);
      } else {
        results.star = {
          success: false,
          message: 'Repository is not a GitHub repository'
        };
      }
    } else {
      results.star = {
        success: false,
        message: 'Could not parse repository URL'
      };
    }
  }
  
  const allSuccess = (!username || results.follow?.success) && (!repoUrl || results.star?.success);
  
  return {
    success: allSuccess,
    results
  };
}

module.exports = {
  createAndMergePR,
  parseRepoUrl,
  detectPlatform,
  followGitHubUser,
  starGitHubRepository,
  followAndStar
};

