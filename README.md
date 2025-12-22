# Auto Git

Automatically create branches, commit, and push for a date range while excluding Sundays and holidays.

## Features

- ✅ Automatically creates branches for each valid date
- ✅ Creates specified number of commits per date
- ✅ Pushes branches to remote repository
- ✅ Excludes Sundays and country-specific holidays
- ✅ Supports multiple countries (US, UK, Canada, Australia, Germany, France, Japan, India, Brazil, Mexico)
- ✅ Simple web-based user interface
- ✅ Real-time progress tracking

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Fill in the form:
   - **Start Date**: First date to process
   - **End Date**: Last date to process
   - **Country**: Select your country to exclude its holidays (Sundays are always excluded)
   - **Commit Percentage**: Percentage of available dates to commit (0-100). Example: 50 means commit for 50% of available dates
   - **Repository Path**: Path to your git repository (will be created if it doesn't exist)
   - **Remote Name**: Git remote name (default: origin)

4. Click "Start Processing" and wait for the results

## How It Works

1. The program calculates all valid dates between start and end dates (excluding Sundays and holidays)
2. Based on the percentage you specify, it randomly selects that percentage of available dates
3. For each selected date:
   - Creates a branch named `auto-YYYY-MM-DD`
   - Creates 1 commit
   - Pushes the branch to the remote repository

**Example**: If there are 20 available dates and you set percentage to 50%, it will randomly select 10 dates and create commits for those 10 dates.

## Holidays

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

## Important Notes

- Make sure you have git configured on your system
- The repository will be initialized if it doesn't exist
- You need to add a remote repository before pushing (e.g., `git remote add origin <url>`)
- The program will skip dates that are Sundays or holidays automatically

## Requirements

- Node.js (v12 or higher)
- Git installed and configured
- Internet connection (for pushing to remote)

