/**
 * Date utility functions for excluding Sundays and holidays
 */

/**
 * Check if a date is a Sunday
 * @param {Date} date - The date to check
 * @returns {boolean} - True if the date is a Sunday
 */
function isSunday(date) {
  return date.getDay() === 0;
}

/**
 * Country-specific holidays
 * Format: { month: 0-11, day: 1-31, name: string }
 */
const COUNTRY_HOLIDAYS = {
  'US': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 15, name: "Martin Luther King Jr. Day" },
    { month: 1, day: 19, name: "Presidents' Day" },
    { month: 4, day: 27, name: "Memorial Day" },
    { month: 6, day: 4, name: "Independence Day" },
    { month: 8, day: 2, name: "Labor Day" },
    { month: 9, day: 8, name: "Columbus Day" },
    { month: 10, day: 11, name: "Veterans Day" },
    { month: 10, day: 22, name: "Thanksgiving" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'UK': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 17, name: "St. Patrick's Day" },
    { month: 3, day: 1, name: "Easter Monday" },
    { month: 4, day: 6, name: "Early May Bank Holiday" },
    { month: 4, day: 27, name: "Spring Bank Holiday" },
    { month: 7, day: 26, name: "Summer Bank Holiday" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'CA': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 17, name: "St. Patrick's Day" },
    { month: 3, day: 1, name: "Easter Monday" },
    { month: 4, day: 20, name: "Victoria Day" },
    { month: 6, day: 1, name: "Canada Day" },
    { month: 8, day: 2, name: "Labour Day" },
    { month: 9, day: 8, name: "Thanksgiving" },
    { month: 10, day: 11, name: "Remembrance Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'AU': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 26, name: "Australia Day" },
    { month: 3, day: 25, name: "Anzac Day" },
    { month: 5, day: 10, name: "Queen's Birthday" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'DE': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 9, day: 3, name: "Day of German Unity" },
    { month: 10, day: 1, name: "Reformation Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'FR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 8, name: "Victory in Europe Day" },
    { month: 6, day: 14, name: "Bastille Day" },
    { month: 7, day: 15, name: "Assumption Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 10, day: 11, name: "Armistice Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'JP': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 11, name: "Foundation Day" },
    { month: 2, day: 20, name: "Vernal Equinox Day" },
    { month: 3, day: 29, name: "Showa Day" },
    { month: 4, day: 3, name: "Constitution Memorial Day" },
    { month: 4, day: 4, name: "Greenery Day" },
    { month: 4, day: 5, name: "Children's Day" },
    { month: 6, day: 15, name: "Marine Day" },
    { month: 7, day: 11, name: "Mountain Day" },
    { month: 8, day: 16, name: "Respect for the Aged Day" },
    { month: 8, day: 22, name: "Autumnal Equinox Day" },
    { month: 9, day: 8, name: "Sports Day" },
    { month: 10, day: 3, name: "Culture Day" },
    { month: 10, day: 23, name: "Labour Thanksgiving Day" },
    { month: 11, day: 23, name: "Emperor's Birthday" },
  ],
  'IN': [
    { month: 0, day: 26, name: "Republic Day" },
    { month: 7, day: 15, name: "Independence Day" },
    { month: 9, day: 2, name: "Gandhi Jayanti" },
    { month: 9, day: 31, name: "Diwali" },
  ],
  'BR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 20, name: "Carnival" },
    { month: 3, day: 21, name: "Tiradentes Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 8, day: 7, name: "Independence Day" },
    { month: 9, day: 12, name: "Our Lady of Aparecida" },
    { month: 10, day: 2, name: "All Souls' Day" },
    { month: 10, day: 15, name: "Republic Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'MX': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 5, name: "Constitution Day" },
    { month: 2, day: 21, name: "Benito Juárez Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 8, day: 16, name: "Independence Day" },
    { month: 10, day: 2, name: "Day of the Dead" },
    { month: 10, day: 20, name: "Revolution Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'CN': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 10, name: "Spring Festival (Chinese New Year)" },
    { month: 3, day: 4, name: "Qingming Festival" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 4, name: "Dragon Boat Festival" },
    { month: 9, day: 1, name: "Mid-Autumn Festival" },
    { month: 9, day: 1, name: "National Day" },
  ],
  'KR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 1, name: "Independence Movement Day" },
    { month: 4, day: 5, name: "Children's Day" },
    { month: 5, day: 6, name: "Memorial Day" },
    { month: 7, day: 15, name: "Liberation Day" },
    { month: 9, day: 3, name: "National Foundation Day" },
    { month: 9, day: 9, name: "Hangul Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'IT': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: 3, day: 25, name: "Liberation Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 5, day: 2, name: "Republic Day" },
    { month: 7, day: 15, name: "Assumption Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "St. Stephen's Day" },
  ],
  'ES': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: 3, day: 19, name: "St. Joseph's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 9, day: 12, name: "National Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 6, name: "Constitution Day" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'RU': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 7, name: "Orthodox Christmas" },
    { month: 1, day: 23, name: "Defender of the Fatherland Day" },
    { month: 2, day: 8, name: "International Women's Day" },
    { month: 4, day: 1, name: "Spring and Labour Day" },
    { month: 4, day: 9, name: "Victory Day" },
    { month: 5, day: 12, name: "Russia Day" },
    { month: 10, day: 4, name: "Unity Day" },
  ],
  'ZA': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 21, name: "Human Rights Day" },
    { month: 3, day: 27, name: "Freedom Day" },
    { month: 4, day: 1, name: "Workers' Day" },
    { month: 5, day: 16, name: "Youth Day" },
    { month: 7, day: 9, name: "National Women's Day" },
    { month: 8, day: 24, name: "Heritage Day" },
    { month: 11, day: 16, name: "Day of Reconciliation" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Day of Goodwill" },
  ],
  'AR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 24, name: "Truth and Justice Memorial Day" },
    { month: 3, day: 2, name: "Malvinas Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 25, name: "May Revolution" },
    { month: 5, day: 20, name: "Flag Day" },
    { month: 6, day: 9, name: "Independence Day" },
    { month: 7, day: 17, name: "San Martín Day" },
    { month: 9, day: 12, name: "Day of Respect for Cultural Diversity" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'CL': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 21, name: "Navy Day" },
    { month: 6, day: 16, name: "Our Lady of Mount Carmel" },
    { month: 8, day: 18, name: "Independence Day" },
    { month: 8, day: 19, name: "Army Day" },
    { month: 9, day: 12, name: "Discovery of Two Worlds" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'NL': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 27, name: "King's Day" },
    { month: 4, day: 5, name: "Liberation Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'SE': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 5, day: 6, name: "National Day" },
    { month: 5, day: 24, name: "Midsummer Eve" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'NO': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 17, name: "Constitution Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'PL': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 3, name: "Constitution Day" },
    { month: 6, day: 15, name: "Assumption Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 10, day: 11, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'TR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 23, name: "National Sovereignty and Children's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 19, name: "Commemoration of Atatürk" },
    { month: 7, day: 30, name: "Victory Day" },
    { month: 9, day: 29, name: "Republic Day" },
  ],
  'SA': [
    { month: 1, day: 22, name: "Founding Day" },
    { month: 8, day: 23, name: "National Day" },
  ],
  'AE': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 7, day: 30, name: "Hijri New Year" },
    { month: 9, day: 2, name: "Prophet's Birthday" },
    { month: 11, day: 1, name: "National Day" },
    { month: 11, day: 2, name: "National Day Holiday" },
  ],
  'SG': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 10, name: "Chinese New Year" },
    { month: 1, day: 11, name: "Chinese New Year Day 2" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 7, day: 9, name: "National Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'PH': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 25, name: "People Power Revolution" },
    { month: 3, day: 9, name: "Day of Valor" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 5, day: 12, name: "Independence Day" },
    { month: 7, day: 26, name: "National Heroes Day" },
    { month: 10, day: 30, name: "Bonifacio Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 30, name: "Rizal Day" },
  ],
  'ID': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 7, day: 17, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'TH': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 13, name: "Songkran Festival" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 4, day: 5, name: "Coronation Day" },
    { month: 6, day: 28, name: "King's Birthday" },
    { month: 9, day: 13, name: "Queen's Birthday" },
    { month: 11, day: 5, name: "King's Birthday" },
    { month: 11, day: 10, name: "Constitution Day" },
    { month: 11, day: 31, name: "New Year's Eve" },
  ],
  'VN': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 10, name: "Tet Holiday" },
    { month: 3, day: 30, name: "Hung Kings Festival" },
    { month: 3, day: 30, name: "Liberation Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 8, day: 2, name: "National Day" },
  ],
  'NZ': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 2, name: "Day after New Year's Day" },
    { month: 1, day: 6, name: "Waitangi Day" },
    { month: 3, day: 25, name: "Anzac Day" },
    { month: 5, day: 3, name: "Queen's Birthday" },
    { month: 9, day: 23, name: "Labour Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'CH': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 2, name: "Berchtold's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 7, day: 1, name: "Swiss National Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'BE': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 6, day: 21, name: "National Day" },
    { month: 7, day: 15, name: "Assumption Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 10, day: 11, name: "Armistice Day" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'PT': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 25, name: "Freedom Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 5, day: 10, name: "Portugal Day" },
    { month: 7, day: 15, name: "Assumption Day" },
    { month: 9, day: 5, name: "Republic Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 1, name: "Restoration of Independence" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
  ],
  'GR': [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: 2, day: 25, name: "Independence Day" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 7, day: 15, name: "Assumption Day" },
    { month: 9, day: 28, name: "Ochi Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
  ],
  'NONE': [] // No holidays
};

/**
 * Get holidays for a specific country
 * @param {string} countryCode - Country code (e.g., 'US', 'UK', 'CA')
 * @returns {Array} - Array of holidays for the country
 */
function getHolidaysForCountry(countryCode) {
  return COUNTRY_HOLIDAYS[countryCode] || COUNTRY_HOLIDAYS['NONE'];
}

/**
 * Check if a date is a holiday for a specific country
 * @param {Date} date - The date to check
 * @param {string} countryCode - Country code
 * @returns {boolean} - True if the date is a holiday
 */
function isHoliday(date, countryCode = 'US') {
  const month = date.getMonth();
  const day = date.getDate();
  const holidays = getHolidaysForCountry(countryCode);
  
  return holidays.some(holiday => 
    holiday.month === month && holiday.day === day
  );
}

/**
 * Check if a date should be excluded (Sunday or holiday)
 * @param {Date} date - The date to check
 * @param {string} countryCode - Country code for holiday checking
 * @returns {boolean} - True if the date should be excluded
 */
function shouldExcludeDate(date, countryCode = 'US') {
  return isSunday(date) || isHoliday(date, countryCode);
}

/**
 * Get all valid dates (excluding Sundays and holidays) between start and end dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} countryCode - Country code for holiday checking
 * @returns {Date[]} - Array of valid dates
 */
function getValidDates(startDate, endDate, countryCode = 'US') {
  const validDates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (!shouldExcludeDate(currentDate, countryCode)) {
      validDates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return validDates;
}

/**
 * Get list of available countries organized by region
 * @returns {Array} - Array of country objects with code, name, and region
 */
function getAvailableCountries() {
  return [
    // North America
    { code: 'US', name: 'United States', region: 'North America' },
    { code: 'CA', name: 'Canada', region: 'North America' },
    { code: 'MX', name: 'Mexico', region: 'North America' },
    
    // Europe
    { code: 'UK', name: 'United Kingdom', region: 'Europe' },
    { code: 'DE', name: 'Germany', region: 'Europe' },
    { code: 'FR', name: 'France', region: 'Europe' },
    { code: 'IT', name: 'Italy', region: 'Europe' },
    { code: 'ES', name: 'Spain', region: 'Europe' },
    { code: 'NL', name: 'Netherlands', region: 'Europe' },
    { code: 'BE', name: 'Belgium', region: 'Europe' },
    { code: 'CH', name: 'Switzerland', region: 'Europe' },
    { code: 'SE', name: 'Sweden', region: 'Europe' },
    { code: 'NO', name: 'Norway', region: 'Europe' },
    { code: 'PL', name: 'Poland', region: 'Europe' },
    { code: 'PT', name: 'Portugal', region: 'Europe' },
    { code: 'GR', name: 'Greece', region: 'Europe' },
    { code: 'RU', name: 'Russia', region: 'Europe' },
    { code: 'TR', name: 'Turkey', region: 'Europe' },
    
    // Asia-Pacific
    { code: 'JP', name: 'Japan', region: 'Asia-Pacific' },
    { code: 'CN', name: 'China', region: 'Asia-Pacific' },
    { code: 'KR', name: 'South Korea', region: 'Asia-Pacific' },
    { code: 'IN', name: 'India', region: 'Asia-Pacific' },
    { code: 'SG', name: 'Singapore', region: 'Asia-Pacific' },
    { code: 'PH', name: 'Philippines', region: 'Asia-Pacific' },
    { code: 'ID', name: 'Indonesia', region: 'Asia-Pacific' },
    { code: 'TH', name: 'Thailand', region: 'Asia-Pacific' },
    { code: 'VN', name: 'Vietnam', region: 'Asia-Pacific' },
    { code: 'AU', name: 'Australia', region: 'Asia-Pacific' },
    { code: 'NZ', name: 'New Zealand', region: 'Asia-Pacific' },
    
    // South America
    { code: 'BR', name: 'Brazil', region: 'South America' },
    { code: 'AR', name: 'Argentina', region: 'South America' },
    { code: 'CL', name: 'Chile', region: 'South America' },
    
    // Africa & Middle East
    { code: 'ZA', name: 'South Africa', region: 'Africa & Middle East' },
    { code: 'SA', name: 'Saudi Arabia', region: 'Africa & Middle East' },
    { code: 'AE', name: 'United Arab Emirates', region: 'Africa & Middle East' },
    
    // Other
    { code: 'NONE', name: 'No Holidays (Sundays only)', region: 'Other' },
  ];
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  isSunday,
  isHoliday,
  shouldExcludeDate,
  getValidDates,
  formatDate,
  getAvailableCountries,
  getHolidaysForCountry
};

