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
  if (!repoUrl) return null;
  
  // Remove .git suffix
  repoUrl = repoUrl.replace(/\.git$/, '');
  
  // Handle SSH format: git@github.com:owner/repo
  if (repoUrl.includes('@')) {
    const match = repoUrl.match(/@([^:]+):(.+)$/);
    if (match) {
      return {
        host: match[1],
        owner: match[2].split('/')[0],
        repo: match[2].split('/')[1]
      };
    }
  }
  
  // Handle HTTPS format: https://github.com/owner/repo
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split('/').filter(p => p);
    return {
      host: url.hostname,
      owner: parts[0],
      repo: parts[1]
    };
  } catch (e) {
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
 * Make HTTP request
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
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
  
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/pulls`,
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'Auto-Git',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  const prData = {
    title: title || `Auto PR for ${branchName}`,
    body: body || `Automated pull request for branch ${branchName}`,
    head: branchName,
    base: baseBranch || 'main'
  };
  
  try {
    const response = await makeRequest(options, prData);
    
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        prNumber: response.data.number,
        prUrl: response.data.html_url,
        message: `PR #${response.data.number} created successfully`
      };
    } else {
      return {
        success: false,
        message: `Failed to create PR: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error creating GitHub PR: ${error.message}`
    };
  }
}

/**
 * Merge PR on GitHub
 */
async function mergeGitHubPR(repoInfo, prNumber, token, mergeMethod = 'merge') {
  const { owner, repo } = repoInfo;
  
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'Auto-Git',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  const mergeData = {
    merge_method: mergeMethod // 'merge', 'squash', or 'rebase'
  };
  
  try {
    const response = await makeRequest(options, mergeData);
    
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        message: `PR #${prNumber} merged successfully`
      };
    } else {
      return {
        success: false,
        message: `Failed to merge PR: ${response.data.message || 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error merging GitHub PR: ${error.message}`
    };
  }
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
    body = null
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
  
  // Create PR
  let prResult;
  if (detectedPlatform === 'github') {
    prResult = await createGitHubPR(repoInfo, branchName, baseBranch, token, title, body);
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
    prCreated: true,
    prNumber: prResult.prNumber,
    prUrl: prResult.prUrl,
    message: prResult.message
  };
  
  // Merge PR if requested
  if (autoMerge && detectedPlatform === 'github') {
    const mergeResult = await mergeGitHubPR(repoInfo, prResult.prNumber, token, mergeMethod);
    result.merged = mergeResult.success;
    result.mergeMessage = mergeResult.message;
    
    if (!mergeResult.success) {
      result.message += `, but merge failed: ${mergeResult.message}`;
    } else {
      result.message += ` and merged successfully`;
    }
  }
  
  return result;
}

module.exports = {
  createAndMergePR,
  parseRepoUrl,
  detectPlatform
};

