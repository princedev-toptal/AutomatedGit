# Auto Git

Automatically create branches, commit, and push for a date range while excluding Sundays and holidays. Available as both a **web application** and **desktop application** (Windows, macOS, Linux).

## 🚀 Features

- ✅ **Automatically creates branches** for each valid date
- ✅ **Creates specified number of commits** per date
- ✅ **Pushes branches to remote repository**
- ✅ **Excludes Sundays and country-specific holidays** (35+ countries supported)
- ✅ **Co-author support** - Add co-authors to commits with configurable rate
- ✅ **Auto-follow & star** - Automatically follow GitHub users and star repositories
- ✅ **Pull Request creation** - Optionally create and merge PRs automatically
- ✅ **Real-time progress tracking** with Server-Sent Events (SSE)
- ✅ **Desktop application** - Standalone .exe/.dmg/.AppImage (no Node.js required!)
- ✅ **Web interface** - Simple, intuitive UI
- ✅ **Multiple branches** - Create multiple branches per date with configurable commits

## 📦 Installation

### Option 1: Desktop Application (Recommended)

**For End Users:**
1. Download the latest release from the [Releases](https://github.com/princedev-toptal/AutomatedGit/releases) page
2. Run the installer (`Auto Git Setup X.X.X.exe`) or portable executable (`AutoGit-X.X.X-portable.exe`)
3. **No Node.js installation required!** The app is self-contained.

**For Developers:**
```bash
# Install dependencies
npm install

# Run in development mode
npm run electron

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

See [BUILD.md](BUILD.md) for detailed build instructions.

### Option 2: Web Application

1. Install Node.js (v14 or higher): https://nodejs.org/
2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## 💻 Usage

### Desktop Application

1. Launch the application (double-click the .exe file)
2. The application window will open automatically
3. Fill in the form with your settings (see below)
4. Click "Start Processing" and monitor progress in real-time

### Web Application

1. Start the server: `npm start`
2. Open `http://localhost:3000` in your browser
3. Fill in the form and click "Start Processing"

### Form Fields

- **Start Date**: First date to process
- **End Date**: Last date to process
- **Number of Branches**: How many branches to create per date
- **Total Commits**: Total number of commits to distribute across branches
- **Country**: Select your country to exclude its holidays (Sundays are always excluded)
- **Repository Path**: Path to your git repository (will be created if it doesn't exist)
- **Remote URL**: Git remote repository URL (e.g., `https://github.com/username/repo.git`)
- **GitHub Token** (Optional): Personal Access Token for PR operations, auto-follow, and auto-star
- **Co-Authors** (Optional): Comma or space-separated list of co-author emails
  - Format: `email1@example.com, email2@example.com` or `Name <email@example.com>`
- **Co-Author Rate** (%): Percentage of commits that will include co-authors (0-100)
- **Create PR**: Automatically create Pull Requests for each branch
- **Auto Merge**: Automatically merge PRs after creation
- **Base Branch**: Target branch for PRs (default: `main`)

### How It Works

1. The program calculates all valid dates between start and end dates (excluding Sundays and holidays)
2. For each valid date:
   - Creates the specified number of branches (e.g., `auto-YYYY-MM-DD-1`, `auto-YYYY-MM-DD-2`)
   - Distributes commits across branches
   - Optionally adds co-authors to commits based on the co-author rate
   - Pushes branches to the remote repository
   - Optionally creates and merges Pull Requests

**Example**: 
- Start: 2024-01-01, End: 2024-01-31
- 2 branches per date, 10 total commits
- 50% co-author rate
- Result: Creates 2 branches for each valid date, distributes 10 commits across them, adds co-authors to 50% of commits randomly

## 🌍 Holidays

The program supports country-specific holidays. Select your country from the dropdown to exclude its holidays. Sundays are always excluded regardless of country selection.

### Supported Countries (35+ countries)

**North America:**
- **United States (US)**: New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Memorial Day, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas Day
- **Canada (CA)**: New Year's Day, St. Patrick's Day, Easter Monday, Victoria Day, Canada Day, Labour Day, Thanksgiving, Remembrance Day, Christmas Day, Boxing Day
- **Mexico (MX)**: New Year's Day, Constitution Day, Benito Juárez Day, Labour Day, Independence Day, Day of the Dead, Revolution Day, Christmas Day

**Europe:**
- **United Kingdom (UK)**: New Year's Day, St. Patrick's Day, Easter Monday, Early May Bank Holiday, Spring Bank Holiday, Summer Bank Holiday, Christmas Day, Boxing Day
- **Germany (DE)**: New Year's Day, Labour Day, Day of German Unity, Reformation Day, Christmas Day, Boxing Day
- **France (FR)**: New Year's Day, Labour Day, Victory in Europe Day, Bastille Day, Assumption Day, All Saints' Day, Armistice Day, Christmas Day
- **Italy (IT)**: New Year's Day, Epiphany, Liberation Day, Labour Day, Republic Day, Assumption Day, All Saints' Day, Immaculate Conception, Christmas Day, St. Stephen's Day
- **Spain (ES)**: New Year's Day, Epiphany, St. Joseph's Day, Labour Day, National Day, All Saints' Day, Constitution Day, Immaculate Conception, Christmas Day
- **Netherlands (NL)**: New Year's Day, King's Day, Liberation Day, Christmas Day, Boxing Day
- **Belgium (BE)**: New Year's Day, Labour Day, National Day, Assumption Day, All Saints' Day, Armistice Day, Christmas Day
- **Switzerland (CH)**: New Year's Day, Berchtold's Day, Labour Day, Swiss National Day, Christmas Day, Boxing Day
- **Sweden (SE)**: New Year's Day, Epiphany, Labour Day, National Day, Midsummer Eve, All Saints' Day, Christmas Day, Boxing Day
- **Norway (NO)**: New Year's Day, Labour Day, Constitution Day, Christmas Day, Boxing Day
- **Poland (PL)**: New Year's Day, Epiphany, Labour Day, Constitution Day, Assumption Day, All Saints' Day, Independence Day, Christmas Day, Boxing Day
- **Portugal (PT)**: New Year's Day, Freedom Day, Labour Day, Portugal Day, Assumption Day, Republic Day, All Saints' Day, Restoration of Independence, Immaculate Conception, Christmas Day
- **Greece (GR)**: New Year's Day, Epiphany, Independence Day, Labour Day, Assumption Day, Ochi Day, Christmas Day, Boxing Day
- **Russia (RU)**: New Year's Day, Orthodox Christmas, Defender of the Fatherland Day, International Women's Day, Spring and Labour Day, Victory Day, Russia Day, Unity Day
- **Turkey (TR)**: New Year's Day, National Sovereignty and Children's Day, Labour Day, Commemoration of Atatürk, Victory Day, Republic Day

**Asia-Pacific:**
- **Japan (JP)**: New Year's Day, Foundation Day, Vernal Equinox Day, Showa Day, Constitution Memorial Day, Greenery Day, Children's Day, Marine Day, Mountain Day, Respect for the Aged Day, Autumnal Equinox Day, Sports Day, Culture Day, Labour Thanksgiving Day, Emperor's Birthday
- **China (CN)**: New Year's Day, Spring Festival (Chinese New Year), Qingming Festival, Labour Day, Dragon Boat Festival, Mid-Autumn Festival, National Day
- **South Korea (KR)**: New Year's Day, Independence Movement Day, Children's Day, Memorial Day, Liberation Day, National Foundation Day, Hangul Day, Christmas Day
- **India (IN)**: Republic Day, Independence Day, Gandhi Jayanti, Diwali
- **Singapore (SG)**: New Year's Day, Chinese New Year, Chinese New Year Day 2, Labour Day, National Day, Christmas Day
- **Philippines (PH)**: New Year's Day, People Power Revolution, Day of Valor, Labour Day, Independence Day, National Heroes Day, Bonifacio Day, Christmas Day, Rizal Day
- **Indonesia (ID)**: New Year's Day, Labour Day, Independence Day, Christmas Day
- **Thailand (TH)**: New Year's Day, Songkran Festival, Labour Day, Coronation Day, King's Birthday, Queen's Birthday, Constitution Day, New Year's Eve
- **Vietnam (VN)**: New Year's Day, Tet Holiday, Hung Kings Festival, Liberation Day, Labour Day, National Day
- **Australia (AU)**: New Year's Day, Australia Day, Anzac Day, Queen's Birthday, Christmas Day, Boxing Day
- **New Zealand (NZ)**: New Year's Day, Day after New Year's Day, Waitangi Day, Anzac Day, Queen's Birthday, Labour Day, Christmas Day, Boxing Day

**South America:**
- **Brazil (BR)**: New Year's Day, Carnival, Tiradentes Day, Labour Day, Independence Day, Our Lady of Aparecida, All Souls' Day, Republic Day, Christmas Day
- **Argentina (AR)**: New Year's Day, Truth and Justice Memorial Day, Malvinas Day, Labour Day, May Revolution, Flag Day, Independence Day, San Martín Day, Day of Respect for Cultural Diversity, Immaculate Conception, Christmas Day
- **Chile (CL)**: New Year's Day, Labour Day, Navy Day, Our Lady of Mount Carmel, Independence Day, Army Day, Discovery of Two Worlds, All Saints' Day, Immaculate Conception, Christmas Day

**Africa & Middle East:**
- **South Africa (ZA)**: New Year's Day, Human Rights Day, Freedom Day, Workers' Day, Youth Day, National Women's Day, Heritage Day, Day of Reconciliation, Christmas Day, Day of Goodwill
- **Saudi Arabia (SA)**: Founding Day, National Day
- **United Arab Emirates (AE)**: New Year's Day, Hijri New Year, Prophet's Birthday, National Day, National Day Holiday

**Other:**
- **No Holidays**: Only excludes Sundays

You can modify the holidays list in `dateUtils.js` to add or remove holidays for any country.

## 🔧 Requirements

### For Desktop Application (End Users)
- ✅ **Git** installed and configured (download from https://git-scm.com/)
- ✅ **No Node.js required!** The app bundles everything it needs.

### For Development/Web Application
- Node.js (v14 or higher)
- Git installed and configured
- Internet connection (for pushing to remote and GitHub API operations)

## 📝 Important Notes

- **Git Configuration**: Make sure you have git configured on your system (`git config --global user.name` and `git config --global user.email`)
- **Repository Setup**: The repository will be initialized if it doesn't exist. You need to add a remote repository before pushing (e.g., `git remote add origin <url>`)
- **GitHub Token**: For PR operations, auto-follow, and auto-star features, you need a GitHub Personal Access Token with these scopes:
  - `repo` (for PR operations)
  - `public_repo` (for starring repositories)
  - `user:follow` (for following users)
- **Co-Authors**: Co-authors are randomly selected for commits based on the co-author rate. Each commit can have either one random co-author or all co-authors.
- **Date Exclusion**: The program automatically skips dates that are Sundays or holidays based on your selected country
- **Port**: The desktop application runs a local server internally (default: port 3000). You don't need to open a browser - the Electron window displays the UI.

## 🛠️ Development

### Project Structure

```
auto-git/
├── main.js              # Electron main process
├── server.js            # Express server and API endpoints
├── gitOperations.js     # Git operations (clone, commit, push)
├── prOperations.js      # GitHub API operations (PRs, follow, star)
├── dateUtils.js         # Date utilities and holiday calculations
├── public/
│   └── index.html       # Web UI
├── package.json         # Dependencies and scripts
└── BUILD.md            # Detailed build instructions
```

### Available Scripts

```bash
# Web application
npm start                 # Start web server

# Desktop application (development)
npm run electron          # Run Electron app
npm run electron:dev      # Run with DevTools open

# Build executables
npm run build:win         # Build Windows .exe
npm run build:mac         # Build macOS .dmg
npm run build:linux       # Build Linux packages
npm run build             # Build for current platform
```

## 🐛 Troubleshooting

### Desktop Application Issues

- **App won't start**: Ensure Git is installed and available in system PATH
- **Build errors**: See [BUILD.md](BUILD.md) for detailed troubleshooting
- **Port already in use**: The app will automatically find an available port

### Web Application Issues

- **Port 3000 in use**: Change the port by setting `PORT` environment variable
- **Git operations fail**: Ensure Git is properly configured and the repository path is correct
- **GitHub API errors**: Verify your GitHub token has the required scopes

## 📄 License

MIT

## 🙏 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⭐ Support

If you find this project useful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting new features
- 📖 Improving documentation

---

**Made with ❤️ by [princedev-toptal](https://github.com/princedev-toptal)**
