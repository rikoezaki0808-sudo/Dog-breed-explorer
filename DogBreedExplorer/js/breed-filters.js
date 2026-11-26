// BreedFilters filters and sorts the Dog API catalogue and displays extra breed facts.
class BreedFilters {
  // app: the DogApp instance which owns the catalogue and the result list.
  constructor(app) {
    this.app = app; // Main application.
    this.form = document.getElementById('filterForm'); // Filter form.
    this.fields = document.getElementById('filterFields'); // Filter controls.
    this.sortInput = document.getElementById('breedSort'); // Current sort order.
    this.visibleBreeds = []; // Records in the current result list.
    this.groups = new Map(); // Breed group IDs and names.
    this.controls = [...this.form.querySelectorAll('[data-filter]')]; // Filter selections.

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.apply();
    });
    document.getElementById('resetFilters').addEventListener('click', () => {
      this.reset();
      this.apply();
    });
    this.sortInput.addEventListener('change', () => {
      this.app.showList(this.visibleBreeds);
    });
  }

  // range: an API minimum/maximum pair. Return its midpoint or null.
  midpoint(range) {
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) ||
        range.min <= 0 || range.max < range.min) return null;
    return (range.min + range.max) / 2;
  }

  // first, second: male and female ranges. Average the available midpoints.
  averageRanges(first, second) {
    const values = [this.midpoint(first), this.midpoint(second)].filter(value => value !== null);
    if (!values.length) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  // value: estimated adult weight in kg. Use the conventional five size classes.
  // Size classification reference: Salt et al. (2017), https://doi.org/10.1371/journal.pone.0182064.
  size(value) {
    if (value === null) return null;
    if (value < 5) return 'toy';
    if (value < 10) return 'small';
    if (value < 25) return 'medium';
    if (value < 40) return 'large';
    return 'giant';
  }

  // value: a trait rating from the API. Unknown ratings remain unknown.
  rating(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  }

  // value: a 1-5 score. Convert it to low, moderate or high for styling.
  ratingLevel(value) {
    if (value === null) return null;
    if (value <= 2) return 'low';
    if (value === 3) return 'moderate';
    return 'high';
  }

  // value: text from the API. Ignore empty or unavailable data.
  cleanText(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text && !['unknown', 'n/a', 'not available'].includes(text.toLowerCase()) ? text : null;
  }

  // breed: one API record; key: the filter or sort field to read.
  value(breed, key) {
    const data = breed.attributes;
    const traits = data.traits || {};
    const coat = data.coat || {};
    const weight = this.averageRanges(data.male_weight, data.female_weight);
    switch (key) {
      case 'size': return this.size(weight);
      case 'weight': return weight;
      case 'height': return this.averageRanges(data.male_height, data.female_height);
      case 'life': return this.midpoint(data.life);
      case 'country': return this.cleanText(data.origin?.country);
      case 'group': return breed.relationships?.group?.data?.id || null;
      case 'coat': return this.cleanText(coat.length);
      case 'coatType': return this.cleanText(coat.type);
      case 'colour': return Array.isArray(coat.colors) ? coat.colors.map(item => this.cleanText(item)).filter(Boolean) : [];
      case 'temperament': return Array.isArray(traits.temperament) ? traits.temperament.map(item => this.cleanText(item)).filter(Boolean) : [];
      case 'exercise': return Number.isFinite(traits.exercise_minutes) && traits.exercise_minutes > 0 ? traits.exercise_minutes : null;
      case 'hypoallergenic': return typeof data.hypoallergenic === 'boolean' ? (data.hypoallergenic ? 'yes' : 'no') : null;
      case 'children': return this.rating(traits.good_with_children);
      case 'dogs': return this.rating(traits.good_with_dogs);
      case 'strangers': return this.rating(traits.good_with_strangers);
      case 'apartment': return this.rating(traits.apartment_friendly);
      default: return this.rating(traits[key]);
    }
  }

  // key: dynamic filter field. Fill its menu with actual catalogue values.
  fillOptions(key) {
    const select = document.getElementById('filter-' + key);
    const values = new Map();
    for (const breed of this.app.breeds) {
      const value = this.value(breed, key);
      for (const item of Array.isArray(value) ? value : [value]) {
        if (!item) continue;
        const label = key === 'group' ? this.groups.get(item) : item;
        if (label) values.set(key === 'group' ? item : item.toLowerCase(), label);
      }
    }
    select.replaceChildren(new Option('Any', ''));
    const sorted = [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    for (const [value, label] of sorted) {
      select.add(new Option(label.charAt(0).toUpperCase() + label.slice(1), value));
    }
    select.disabled = sorted.length === 0;
  }

  // Initialise controls only when the API catalogue has loaded.
  prepare() {
    const dynamicKeys = ['country', 'group', 'coat', 'coatType', 'colour', 'temperament'];
    for (const control of this.controls) {
      const key = control.dataset.filter;
      if (dynamicKeys.includes(key)) {
        this.fillOptions(key);
      } else {
        control.disabled = !this.app.breeds.some(breed => this.value(breed, key) !== null);
      }
    }
    this.fields.disabled = false;
    this.sortInput.disabled = false;
    // Disable sorts if the catalogue does not contain their data.
    for (const option of this.sortInput.options) {
      if (option.value === 'name' || option.value === 'nameDesc') continue;
      const key = option.value.replace(/Asc$|Desc$/, '');
      option.disabled = !this.app.breeds.some(breed => this.value(breed, key) !== null);
    }
  }

  // Fetch readable group names separately. Other filters work if this request fails.
  async loadGroups() {
    try {
      let page = CONFIG.groupsUrl;
      const seen = new Set();
      while (page) {
        const url = new URL(page, CONFIG.groupsUrl);
        if (url.origin !== new URL(CONFIG.groupsUrl).origin || seen.has(url.href)) break;
        seen.add(url.href);
        const response = await fetch(url.href, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) break;
        const result = await response.json();
        if (!Array.isArray(result.data)) break;
        for (const group of result.data) {
          const name = this.cleanText(group.attributes?.name);
          if (typeof group.id === 'string' && name) this.groups.set(group.id, name);
        }
        page = result.links?.next || '';
      }
    } catch (error) {
      // Keep the group control unavailable if group names cannot be loaded.
    }
    this.fillOptions('group');
  }

  // value: numeric data; selection: lower and upper bounds separated by a colon.
  inRange(value, selection) {
    if (!Number.isFinite(value)) return false;
    const [min, max] = selection.split(':');
    return value >= Number(min) && (max === '' || value < Number(max));
  }

  // breed: API record; key: filter name; selection: chosen menu value.
  matches(breed, key, selection) {
    if (!selection) return true;
    const value = this.value(breed, key);
    if (value === null) return false;
    if (['weight', 'height', 'life', 'exercise'].includes(key)) return this.inRange(value, selection);
    if (Array.isArray(value)) return value.some(item => item.toLowerCase() === selection);
    if (typeof value === 'number') {
      const level = value <= 2 ? 'low' : value === 3 ? 'moderate' : 'high';
      return level === selection;
    }
    if (key === 'group') return value === selection;
    return value.toLowerCase() === selection;
  }

  // Apply all selected filters together, without opening a result popup.
  apply() {
    if (!this.app.breeds.length) return;
    this.app.input.value = '';
    this.app.input.removeAttribute('aria-invalid');
    this.app.closeSuggestions();
    this.app.status.textContent = '';
    const selected = this.controls.filter(control => !control.disabled && control.value);
    const matches = this.app.breeds.filter(breed => selected.every(control =>
      this.matches(breed, control.dataset.filter, control.value)
    ));
    this.app.showList(matches);
    if (!matches.length) this.app.count.textContent = 'No matching breeds. Try fewer filters.';
  }

  // Reset filter and sorting selections to their defaults.
  reset() {
    this.form.reset();
    this.sortInput.value = 'name';
  }

  // breeds: records to sort. Unknown values always appear last.
  sort(breeds) {
    const order = this.sortInput.value;
    const byName = (a, b) => a.attributes.name.localeCompare(b.attributes.name);
    return [...breeds].sort((a, b) => {
      if (order === 'name') return byName(a, b);
      if (order === 'nameDesc') return byName(b, a);
      const key = order.replace(/Asc$|Desc$/, '');
      const x = this.value(a, key);
      const y = this.value(b, key);
      if (x === null && y === null) return byName(a, b);
      if (x === null) return 1;
      if (y === null) return -1;
      // Compare country names as text and other fields as numbers.
      const difference = typeof x === 'string' && typeof y === 'string'
        ? x.localeCompare(y, 'en', { sensitivity: 'base' })
        : x - y;

      return (order.endsWith('Desc') ? -difference : difference) || byName(a, b);
    });
  }

  // node: a dd element; value: plain text to display safely.
  showText(node, value) {
    node.textContent = value ?? 'Not available';
    node.removeAttribute('aria-label');
    node.closest('div').removeAttribute('data-score');
  }

  // country: an API country name. Match known countries to their flag emoji.
  countryFlag(country) {
    if (!country) return '';
    const key = country.trim().toLowerCase();
    const aliases = {
      'uk': 'GB', 'u.k.': 'GB', 'great britain': 'GB',
      'usa': 'US', 'u.s.a.': 'US', 'united states of america': 'US',
      'czech republic': 'CZ', 'russian federation': 'RU',
      'south korea': 'KR', 'north korea': 'KP', 'ivory coast': 'CI',
      'turkey': 'TR', 'viet nam': 'VN', 'the netherlands': 'NL'
    };
    // ISO 3166-1 alpha-2 codes; Intl supplies English country names.
    const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
    let code = Object.hasOwn(aliases, key) ? aliases[key] : '';
    if (!code && /^[a-z]{2}$/i.test(country) && codes.includes(country.toUpperCase())) {
      code = country.toUpperCase();
    }
    if (!code && typeof Intl.DisplayNames === 'function') {
      const names = new Intl.DisplayNames(['en'], { type: 'region' });
      code = codes.find(item => names.of(item).toLowerCase() === key);
    }
    // Use subdivision flags for these explicitly named UK origins.
    const subdivisions = { england: 'gbeng', scotland: 'gbsct', wales: 'gbwls' };
    if (!code && Object.hasOwn(subdivisions, key)) {
      return '🏴' + [...subdivisions[key]].map(letter => String.fromCodePoint(0xE0000 + letter.charCodeAt(0))).join('') + String.fromCodePoint(0xE007F);
    }
    // Leave unknown or mixed origins unchanged rather than guessing.
    if (!code) return '';
    return [...code].map(letter => String.fromCodePoint(0x1F1E6 + letter.charCodeAt(0) - 65)).join('');
  }

  // node: a dd element; value: API score from 1 to 5, or null.
  showRating(node, value) {
    node.replaceChildren();
    node.removeAttribute('aria-label');
    const card = node.closest('div');
    card.removeAttribute('data-score');

    if (this.rating(value) === null) {
      node.textContent = 'Not available';
      return;
    }

    // Use one brown colour palette with five levels of intensity.
    card.dataset.score = String(value);
    const wrap = document.createElement('span');
    wrap.className = 'score-visual';
    const stars = document.createElement('span');
    stars.className = 'score-stars';
    stars.setAttribute('aria-hidden', 'true');

    for (let index = 1; index <= 5; index++) {
      const star = document.createElement('span');
      star.className = index <= value ? 'star filled' : 'star empty';
      star.textContent = index <= value ? '★' : '☆';
      stars.appendChild(star);
    }

    // Keep the numeric rating and level visible, not just the colour.
    const number = document.createElement('span');
    number.className = 'score-number';
    const level = this.ratingLevel(value);
    number.textContent = value + ' / 5 · ' + level.charAt(0).toUpperCase() + level.slice(1);
    wrap.append(stars, number);
    node.appendChild(wrap);
  }

  // breed: selected API record. Display facts and temperament in their groups.
  showFacts(breed) {
    const data = breed.attributes;
    const textNode = (id, value) => this.showText(document.getElementById(id), value);
    const ratingNode = (id, key) => this.showRating(document.getElementById(id), this.value(breed, key));
    const size = this.value(breed, 'size');
    const exercise = this.value(breed, 'exercise');
    const country = this.value(breed, 'country');
    const flag = this.countryFlag(country);
    const temperament = document.getElementById('breedTemperament');
    const traits = this.value(breed, 'temperament');

    // Display only temperament words supplied by the API.
    temperament.textContent = traits.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' / ');
    temperament.hidden = traits.length === 0;

    textNode('breedOrigin', country);
    if (flag) {
      const emoji = document.createElement('span');
      emoji.className = 'country-flag';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = ' ' + flag;
      document.getElementById('breedOrigin').appendChild(emoji);
    }
    textNode('breedGroup', this.groups.get(this.value(breed, 'group')));
    textNode('breedSize', size ? size.charAt(0).toUpperCase() + size.slice(1) : null);
    textNode('maleHeight', this.app.formatRange(data.male_height, 'cm'));
    textNode('femaleHeight', this.app.formatRange(data.female_height, 'cm'));
    textNode('breedCoat', this.value(breed, 'coat'));
    textNode('breedCoatType', this.value(breed, 'coatType'));
    textNode('breedCoatColours', this.value(breed, 'colour').join(', ') || null);
    ratingNode('breedEnergy', 'energy');
    ratingNode('breedTrainability', 'trainability');
    ratingNode('breedBarking', 'barking');
    ratingNode('breedChildren', 'children');
    ratingNode('breedDogs', 'dogs');
    ratingNode('breedStrangers', 'strangers');
    textNode('breedExercise', exercise === null ? null : exercise + ' min');
    ratingNode('breedShedding', 'shedding');
    ratingNode('breedGrooming', 'grooming');
    ratingNode('breedDrooling', 'drooling');
    ratingNode('breedApartment', 'apartment');
    const hypoallergenic = this.value(breed, 'hypoallergenic');
    textNode('breedHypoallergenic', hypoallergenic ? hypoallergenic.charAt(0).toUpperCase() + hypoallergenic.slice(1) : null);
  }
}
