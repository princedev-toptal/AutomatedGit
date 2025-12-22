# How to Use Auto Git - Complete Guide

## Prerequisites

Before you start, make sure you have:

1. **Node.js** installed (version 12 or higher)
   - Check if installed: `node --version`
   - Download from: https://nodejs.org/

2. **Git** installed and configured
   - Check if installed: `git --version`
   - Download from: https://git-scm.com/
   - Configure your git identity:
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

3. **A Git remote repository** (GitHub, GitLab, Bitbucket, etc.)
   - You'll need the repository URL to add as a remote

## Step-by-Step Installation

### 1. Install Dependencies

Open your terminal/command prompt in the project directory and run:

```bash
npm install
```

This will install all required packages (Express and simple-git).

### 2. Start the Server

```bash
npm start
```

You should see:
```
Auto-Git server running at http://localhost:3000
Open your browser and navigate to the URL above to use the interface.
```

### 3. Open the Web Interface

Open your web browser and go to:
```
http://localhost:3000
```

## Using the Web Interface

### Step 1: Fill in the Form

The interface has the following fields:

#### **Start Date**
- Select the first date you want to process
- Format: YYYY-MM-DD
- Example: 2024-01-01

#### **End Date**
- Select the last date you want to process
- Format: YYYY-MM-DD
- Example: 2024-01-31
- Must be after the start date

#### **Country**
- Select your country from the dropdown menu
- Countries are organized by region (North America, Europe, Asia-Pacific, etc.)
- The program will exclude this country's holidays
- Sundays are always excluded regardless of country selection

#### **Commit Percentage**
- Enter the percentage of available dates you want to commit (0-100)
- The program will randomly select that percentage of available dates
- Example: 
  - If there are 20 available dates and you enter 50%, it will randomly select 10 dates and create commits for those 10 dates
  - If you enter 100%, it will commit for all available dates
  - If you enter 25%, it will commit for 25% of the available dates

#### **Repository Path**
- Enter the path where you want the git repository
- Can be relative (e.g., `./repo`) or absolute (e.g., `C:\projects\my-repo`)
- The repository will be created automatically if it doesn't exist
- Default: `./repo`

#### **Remote Name** (Optional)
- Enter your git remote name
- Default: `origin`
- You'll need to add the remote URL before pushing (see Setup section below)

### Step 2: Setup Git Remote (First Time Only)

Before the first run, you need to add your remote repository:

1. **Option A: Using Git Commands**
   ```bash
   cd ./repo  # or your repository path
   git remote add origin https://github.com/yourusername/your-repo.git
   ```
   Replace with your actual repository URL.

2. **Option B: The program will warn you** if the remote doesn't exist, and you can add it manually later.

### Step 3: Click "Start Processing"

Click the **"Start Processing"** button. The program will:

1. Calculate all valid dates (excluding Sundays and holidays)
2. Randomly select the specified percentage of available dates
3. For each selected date:
   - Create a branch named `auto-YYYY-MM-DD`
   - Create 1 commit
   - Push the branch to the remote repository

### Step 4: View Results

After processing, you'll see:
- Total number of dates processed
- Success/failure count
- Detailed results for each date showing:
  - Branch creation status
  - Commit creation status
  - Push status

## Example Scenarios

### Example 1: Basic Usage (100% of dates)

**Goal**: Create commits for all weekdays in January 2024 (excluding Sundays and US holidays)

**Settings**:
- Start Date: 2024-01-01
- End Date: 2024-01-31
- Country: United States
- Commit Percentage: 100
- Repository Path: ./repo
- Remote: origin

**Result**: Creates branches and commits for all valid dates, skipping:
- Sundays (Jan 7, 14, 21, 28)
- New Year's Day (Jan 1)
- Martin Luther King Jr. Day (Jan 15)
- Any other US holidays in January

### Example 2: Partial Percentage (50% of dates)

**Goal**: Create commits for 50% of available dates in a week

**Settings**:
- Start Date: 2024-03-04 (Monday)
- End Date: 2024-03-10 (Sunday)
- Country: United Kingdom
- Commit Percentage: 50
- Repository Path: ./my-project

**Result**: Randomly selects 50% of weekdays (e.g., 2-3 days out of 5 weekdays), skipping Sunday. Creates 1 commit per selected date.

### Example 3: International Holidays with Percentage

**Goal**: Create commits for 30% of available dates in a month, excluding Japanese holidays

**Settings**:
- Start Date: 2024-04-01
- End Date: 2024-04-30
- Country: Japan
- Commit Percentage: 30

**Result**: Randomly selects 30% of valid dates (excluding Japanese holidays and Sundays), creates 1 commit per selected date.

## How It Works Internally

1. **Date Calculation**: The program calculates all dates between start and end dates
2. **Filtering**: Excludes:
   - All Sundays
   - Country-specific holidays based on your selection
3. **Git Operations** (for each valid date):
   - Creates/checks out branch: `auto-YYYY-MM-DD`
   - Creates commits: Adds/updates a file (`commits.txt`) with commit messages
   - Pushes branch: Pushes to your remote repository

## Troubleshooting

### Problem: "Remote 'origin' does not exist"

**Solution**: Add your remote repository:
```bash
cd ./repo  # or your repository path
git remote add origin <your-repository-url>
```

### Problem: "Error pushing branch"

**Possible causes**:
- No internet connection
- Remote repository doesn't exist
- Authentication issues (need to set up SSH keys or credentials)
- Branch already exists on remote

**Solutions**:
- Check your internet connection
- Verify the remote URL is correct
- Set up authentication:
  - For HTTPS: Use a personal access token
  - For SSH: Set up SSH keys

### Problem: "No valid dates found"

**Cause**: All dates in your range are Sundays or holidays

**Solution**: Choose a date range that includes weekdays

### Problem: Server won't start

**Possible causes**:
- Port 3000 is already in use
- Node.js not installed
- Dependencies not installed

**Solutions**:
- Check if port 3000 is free: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (Mac/Linux)
- Install Node.js if missing
- Run `npm install` again

### Problem: Git operations fail

**Check**:
- Git is installed: `git --version`
- Git is configured: `git config --list`
- You have write permissions to the repository path

## Tips and Best Practices

1. **Start Small**: Test with a small date range first (e.g., 3-5 days) before processing large ranges

2. **Check Your Remote**: Make sure your remote repository exists and you have push access

3. **Use a Test Repository**: Consider using a test repository first to verify everything works

4. **Monitor Progress**: Watch the results section to see which dates succeeded or failed

5. **Backup**: The program modifies your git repository, so make sure you're okay with the changes

6. **Custom Holidays**: You can edit `dateUtils.js` to add or modify holidays for any country

## Command Line Alternative

If you prefer using the command line, you can also use the API directly:

```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "country": "US",
    "percentage": 100,
    "repoPath": "./repo",
    "remote": "origin"
  }'
```

## Stopping the Server

Press `Ctrl + C` in the terminal where the server is running.

## Need Help?

- Check the console output for detailed error messages
- Review the README.md for more information
- Check that all prerequisites are installed correctly

