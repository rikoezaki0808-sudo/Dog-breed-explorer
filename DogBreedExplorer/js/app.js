// DogApp loads the breed catalogue and displays the selected dog.

// Main class for breed searches and results.
class DogApp {
  // Set up the page and connect user actions to methods.
  constructor() {
    this.breeds = []; // All breed records from the API.
    this.form = document.getElementById('searchForm'); // Search form.
    this.result = document.getElementById('breedResult'); // Breed details dialog.
    this.closeButton = document.getElementById('closeBreed'); // Close the popup.
    this.previousButton = document.getElementById('previousBreed'); // Previous result.
    this.nextButton = document.getElementById('nextBreed'); // Next result.
    this.currentBreed = null; // Record currently shown in the popup.
    this.returnFocus = null; // Control to focus when the popup closes.
    this.status = document.getElementById('searchStatus'); // Search status.
    this.button = document.getElementById('searchBtn'); // Search button.
    this.list = document.getElementById('breedList'); // Breed selection.
    this.suggestions = document.getElementById('breedSuggestions'); // Search suggestions.
    this.input = document.getElementById('breedInput'); // Search input.
    this.activeSuggestion = -1; // Currently highlighted suggestion.
    this.count = document.getElementById('breedCount'); // Number of breeds.
    this.showAllButton = document.getElementById('showAllBtn'); // Reset or retry.

    // Run a search without reloading the page.
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.closeSuggestions();
      this.searchBreed();
    });

    // Show information when a breed is selected.
    this.list.addEventListener('change', () => {
      this.returnFocus = this.list;
      this.selectBreed();
    });

    // Close the popup using its button or the Escape key.
    this.closeButton.addEventListener('click', () => this.result.close());
    this.result.addEventListener('close', () => {
      // Clear the selection so the same breed can be opened again.
      this.list.selectedIndex = -1;
      if (this.returnFocus && this.returnFocus.isConnected) {
        this.returnFocus.focus({ preventScroll: true });
      }
    });

    // Move through the existing results without closing the popup.
    this.previousButton.addEventListener('click', () => this.moveBreed(-1));
    this.nextButton.addEventListener('click', () => this.moveBreed(1));
    document.getElementById('copyBreedName').addEventListener('click', () => this.copyBreedName());

    // Restore the complete breed list.
    this.showAllButton.addEventListener('click', () => {
      this.browseAll();
    });

    // Update suggestions while typing and support keyboard selection.
    this.input.addEventListener('input', () => this.showSuggestions());
    this.input.addEventListener('focus', () => this.showSuggestions());
    this.input.addEventListener('blur', () => this.closeSuggestions());
    this.input.addEventListener('keydown', (event) => this.suggestionKeys(event));

    // Keep the input focused when a suggestion is clicked.
    this.suggestions.addEventListener('pointerdown', (event) => event.preventDefault());

    this.filters = new BreedFilters(this); // Catalogue filtering and sorting.
    this.favourites = new Favourites(this); // Favourite breed list.
    this.browseAll();
  }

  // Load every page of the API catalogue.
  async loadBreeds() {
    if (this.breeds.length > 0) return;

    // Track visited pages and breed IDs to avoid duplicates.
    let page = CONFIG.breedsUrl;
    const records = [];
    const visitedPages = new Set();
    const breedIds = new Set();

    while (page) {
      // Only follow pagination links on the configured API.
      const url = new URL(page, CONFIG.breedsUrl);

      if (url.origin !== new URL(CONFIG.breedsUrl).origin || visitedPages.has(url.href)) {
        throw new Error('Invalid API pagination');
      }

      visitedPages.add(url.href);

      // Request API data with a 15-second timeout.
      const response = await fetch(url.href, {
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      // Convert the API response into a JavaScript object.
      const result = await response.json();

      if (!Array.isArray(result.data)) {
        throw new Error('Invalid breed data');
      }

      // Keep valid breed records with unique IDs.
      for (const breed of result.data) {
        if (breed && typeof breed.id === 'string' &&
            breed.attributes && typeof breed.attributes.name === 'string' &&
            !breedIds.has(breed.id)) {
          records.push(breed);
          breedIds.add(breed.id);
        }
      }

      // Move to the next API page, if available.
      page = result.links && result.links.next ? result.links.next : '';
    }

    if (records.length === 0) {
      throw new Error('No breed data received');
    }

    // Sort breeds alphabetically.
    records.sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));
    this.breeds = records;
    this.filters.prepare(); // Populate filter options from the catalogue.
    this.filters.loadGroups(); // Load group names without delaying breed search.

    // Refresh suggestions if the user is already typing.
    if (document.activeElement === this.input) this.showSuggestions();
  }

  // Show up to eight matching breed names in a readable list.
  showSuggestions() {
    this.closeSuggestions();
    const name = this.normaliseName(this.input.value);
    if (!name) return;

    const matches = this.breeds.filter((breed) =>
      this.normaliseName(breed.attributes.name).includes(name)
    ).slice(0, 8);

    for (const breed of matches) {
      const option = document.createElement('div');
      option.id = 'breedSuggestion-' + this.suggestions.children.length;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.className = 'breed-suggestion';
      option.textContent = breed.attributes.name;
      option.addEventListener('click', () => this.chooseSuggestion(option));
      this.suggestions.appendChild(option);
    }

    if (matches.length > 0) {
      this.suggestions.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }
  }

  // Close the suggestion list and clear its keyboard selection.
  closeSuggestions() {
    this.suggestions.hidden = true;
    this.suggestions.replaceChildren();
    this.activeSuggestion = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  // option: the selected suggestion. Copy its name into the search field.
  chooseSuggestion(option) {
    this.input.value = option.textContent;
    this.closeSuggestions();
  }

  // event: keyboard event. Navigate, choose or dismiss suggestions.
  suggestionKeys(event) {
    if (event.key === 'Escape') {
      this.closeSuggestions();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (this.suggestions.hidden) this.showSuggestions();
      const options = this.suggestions.children;
      if (!options.length) return;
      event.preventDefault();

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (this.activeSuggestion === -1) {
        this.activeSuggestion = direction === 1 ? 0 : options.length - 1;
      } else {
        this.activeSuggestion = (this.activeSuggestion + direction + options.length) % options.length;
      }

      for (let i = 0; i < options.length; i++) {
        options[i].setAttribute('aria-selected', String(i === this.activeSuggestion));
      }

      const active = options[this.activeSuggestion];
      this.input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }

    if (event.key === 'Enter' && !this.suggestions.hidden && this.activeSuggestion >= 0) {
      event.preventDefault();
      this.chooseSuggestion(this.suggestions.children[this.activeSuggestion]);
    }
  }

  // Load or restore the full list of breeds.
  async browseAll() {
    const input = document.getElementById('breedInput');

    // Reset the search and disable controls while loading.
    input.value = '';
    this.filters.reset(); // Restore the filter controls and default sorting.
    this.closeSuggestions();
    input.removeAttribute('aria-invalid');
    this.status.textContent = '';
    if (this.result.open) this.result.close();
    this.favourites.selectBreed('');
    this.list.disabled = true;
    this.button.disabled = true;
    this.showAllButton.disabled = true;
    this.count.textContent = 'Loading dog breeds...';

    try {
      await this.loadBreeds();
      this.showList(this.breeds);
    } catch (error) {
      this.count.textContent = 'Unable to load breeds. Select Show all breeds to try again.';
    } finally {
      this.button.disabled = false;
      this.showAllButton.disabled = false;
    }
  }

  // Create the visible list from the supplied breed records.
  // breeds: array of records to display in the selection list.
  showList(breeds) {
    this.filters.visibleBreeds = breeds; // Keep the current result set for sorting.
    const sorted = this.filters.sort(breeds);
    this.list.replaceChildren();

    for (const breed of sorted) {
      const option = document.createElement('option');

      option.value = breed.id;
      option.textContent = breed.attributes.name;
      this.list.appendChild(option);
    }

    this.list.selectedIndex = -1;
    this.list.disabled = breeds.length === 0;
    this.count.textContent = breeds.length ? breeds.length + ' of ' + this.breeds.length + ' breeds' : 'No matching breeds. Try fewer filters or a different name.';
  }

  // name: text to normalise for case, accents, spaces and punctuation.
  normaliseName(name) {
    return name.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Search all breeds and keep every matching result.
  async searchBreed() {
    if (this.button.disabled) return;

    // Remember where the search started so closing the popup returns focus.
    this.returnFocus = document.activeElement;
    const input = document.getElementById('breedInput');
    let name = this.normaliseName(input.value);

    if (this.result.open) this.result.close();
    this.favourites.selectBreed('');
    this.status.textContent = '';
    input.removeAttribute('aria-invalid');

    // Reject empty search input.
    if (name === '') {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      this.status.textContent = 'Please enter a dog breed.';
      showMessage(this.status.textContent, 'error');
      return;
    }

    // Common nicknames for dog breeds.
    const aliases = {
      lab: 'labrador',
      frenchie: 'frenchbulldog',
      gsd: 'germanshepherd',
      doxie: 'dachshund',
      sausagedog: 'dachshund',
      shibainu: 'shiba'
    };

    if (Object.hasOwn(aliases, name)) {
      name = aliases[name];
    }

    this.button.disabled = true;
    this.showAllButton.disabled = true;
    this.list.disabled = true;
    this.status.textContent = 'Searching...';

    try {
      await this.loadBreeds();

      // Collect partial matches and remember an exact match.
      const matches = [];
      let exactMatch = null;

      for (const breed of this.breeds) {
        const breedName = this.normaliseName(breed.attributes.name);

        if (breedName.includes(name)) {
          matches.push(breed);
        }

        if (breedName === name) {
          exactMatch = breed;
        }
      }

      this.filters.reset(); // Name searches are independent of catalogue filters.
      this.showList(matches);

      if (matches.length > 0) {
        // Prefer an exact match over the first partial match.
        const firstMatch = exactMatch || matches[0];

        this.list.value = firstMatch.id;
        this.selectBreed();
      } else {
        this.status.textContent = 'No matching dog breed found. Try a shorter name or browse all breeds.';
        showMessage(this.status.textContent, 'error');
      }
    } catch (error) {
      this.showList([]);
      this.status.textContent = 'Unable to load dog information. Please try again.';
      showMessage(this.status.textContent, 'error');
    } finally {
      this.button.disabled = false;
      this.showAllButton.disabled = false;
    }
  }

  // Display the selected breed from the list.
  selectBreed() {
    for (const breed of this.breeds) {
      if (breed.id === this.list.value) {
        this.showBreed(breed);
        this.status.textContent = 'Showing ' + breed.attributes.name + '.';

        return;
      }
    }
  }

  // Update navigation using the actual order of the visible breed list.
  updateBreedNavigation() {
    const options = Array.from(this.list.options);
    const index = options.findIndex(option => option.value === this.currentBreed?.id);
    this.previousButton.disabled = index <= 0;
    this.nextButton.disabled = index < 0 || index >= options.length - 1;
    document.getElementById('breedPosition').textContent = index < 0 ? '' : (index + 1) + ' / ' + options.length;
  }

  // direction: -1 for the previous result or 1 for the next result.
  moveBreed(direction) {
    const options = Array.from(this.list.options);
    const index = options.findIndex(option => option.value === this.currentBreed?.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= options.length) return;
    this.list.value = options[target].value;
    this.selectBreed();
    this.result.scrollTop = 0;
    // Keep keyboard focus available at either end of the list.
    if (direction === 1 && this.nextButton.disabled) this.previousButton.focus({ preventScroll: true });
    if (direction === -1 && this.previousButton.disabled) this.nextButton.focus({ preventScroll: true });
  }

  // Copy the current breed name using the browser clipboard API.
  async copyBreedName() {
    if (!this.currentBreed) return;
    const breed = this.currentBreed;
    const name = breed.attributes.name;
    const status = document.getElementById('copyBreedStatus');
    try {
      await navigator.clipboard.writeText(name);
      if (this.currentBreed === breed) status.textContent = 'Breed name copied.';
    } catch (error) {
      if (this.currentBreed === breed) status.textContent = 'Unable to copy. Please select and copy the name manually.';
    }
  }

  // breed: a breed record from the API. Display its information and own picture.
  showBreed(breed) {

    // Use textContent to display API text without interpreting HTML.
    const data = breed.attributes;
    this.currentBreed = breed;
    this.updateBreedNavigation();
    document.getElementById('copyBreedStatus').textContent = '';
    document.getElementById('breedName').textContent = data.name;
    document.getElementById('breedDescription').textContent = data.description || 'No description available.';
    document.getElementById('breedLife').textContent = this.formatRange(data.life, 'years');
    document.getElementById('breedWeight').textContent = this.formatRange(data.male_weight, 'kg');
    document.getElementById('femaleWeight').textContent = this.formatRange(data.female_weight, 'kg');
    this.filters.showFacts(breed); // Display the extra filterable breed details.

    const image = document.getElementById('dogImage');
    const message = document.getElementById('imageMessage');
    const credit = document.getElementById('imageCredit');

    // Reset the previous photo and its credit.
    image.onload = null;
    image.onerror = null;
    image.hidden = true;
    image.removeAttribute('src');
    credit.hidden = true;
    message.hidden = false;

    if (data.images && data.images.length > 0) {
      const photo = data.images[0];
      const info = photo.attribution;

      if (info) {
        document.getElementById('creditText').textContent = 'Photo: ' + (info.author || 'Unknown author') + ' · ' + (info.license || 'Licence not specified');
        this.setCreditLink('photoSource', info.source_url);
        this.setCreditLink('photoLicence', info.license_url);
      } else {
        document.getElementById('creditText').textContent = 'Photo: Dog API (credit unavailable).';
        this.setCreditLink('photoSource', '');
        this.setCreditLink('photoLicence', '');
      }

      // Reveal the image and credit only after loading succeeds.
      image.onload = () => {
        image.hidden = false;
        message.hidden = true;
        credit.hidden = false;
      };

      // Show a message if the image cannot load.
      image.onerror = () => {
        image.hidden = true;
        message.hidden = false;
        credit.hidden = true;
      };

      image.alt = data.name + ' dog';
      const url = photo.medium || photo.url;
      // Show only credited photos; never substitute an unrelated breed.
      if (typeof url === 'string' && url.startsWith('https://') && info && info.author && info.license) {
        image.src = url;
      }
    }

    // Update the selected favourite and open the result as a modal dialog.
    this.favourites.selectBreed(data.name);
    document.getElementById('breedFavouriteStatus').textContent = '';
    if (!this.result.open) this.result.showModal();
  }

  // Format numeric ranges for display.
  // range: minimum and maximum values; unit: text such as kg or years.
  formatRange(range, unit) {
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return 'Not available';
    return range.min + '–' + range.max + ' ' + unit;
  }

  // Display a credit link only when it uses HTTPS.
  // id: link element ID; url: HTTPS address of the source or licence.
  setCreditLink(id, url) {
    const link = document.getElementById(id);

    link.hidden = true;
    link.removeAttribute('href');

    if (typeof url === 'string' && url.startsWith('https://')) {
      link.href = url;
      link.hidden = false;
    }
  }
}

// Create the application instance.
new DogApp();
