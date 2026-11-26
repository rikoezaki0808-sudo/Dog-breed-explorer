// Favourites manages the user's favourite breed names and text files.

// Class for saving, displaying, importing and exporting favourites.
class Favourites {
  // app: the DogApp instance used to check imported breed names.
  constructor(app) {
    // Keep a reference to the main app for breed validation.
    this.app = app;
    this.names = []; // Saved breed names.
    this.selectedBreed = ''; // Breed currently displayed.
    this.list = document.getElementById('favouritesList'); // List of favourites.
    this.empty = document.getElementById('favouritesEmpty'); // Empty list message.
    this.status = document.getElementById('favouritesStatus'); // Feedback message.
    this.addButton = document.getElementById('addFavourite'); // Save breed button.
    this.fileInput = document.getElementById('importFavourites'); // Text file picker.

    // Restore favourites from this browser, if available.
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.favouritesKey) || '[]');

      if (Array.isArray(saved)) {
        this.names = [...new Set(saved.filter(name => typeof name === 'string' && name.trim() && name.length <= 80))];
      }
    } catch (error) {
      this.names = [];
    }

    // Connect buttons and the file picker to their methods.
    this.addButton.addEventListener('click', () => this.toggle());
    document.getElementById('exportFavourites').addEventListener('click', () => this.exportFile());
    this.fileInput.addEventListener('change', () => this.importFile());

    this.render();
    this.updateButton();
  }

  // name: breed currently shown in the search result.
  selectBreed(name) {
    this.selectedBreed = name;
    this.updateButton();
  }

  // Toggle the selected breed between saved and not saved.
  toggle() {
    if (!this.selectedBreed) return;
    if (this.names.includes(this.selectedBreed)) {
      this.remove(this.selectedBreed);
      document.getElementById('breedFavouriteStatus').textContent = this.status.textContent;
    } else {
      this.add();
    }
  }

  // Add the selected breed if it is not already saved.
  add() {
    if (this.selectedBreed && !this.names.includes(this.selectedBreed)) {
      this.names.push(this.selectedBreed);
      this.save();
      this.status.textContent = this.selectedBreed + ' added to favourites.';
      // Show confirmation inside the open breed popup too.
      document.getElementById('breedFavouriteStatus').textContent = this.status.textContent;
    }
  }

  // name: breed to remove from the list.
  remove(name) {
    this.names = this.names.filter(item => item !== name);
    this.save();
    this.status.textContent = name + ' removed.';
  }

  // Save the list in the browser and update the page.
  save() {
    try {
      localStorage.setItem(CONFIG.favouritesKey, JSON.stringify(this.names));
    } catch (error) {
      // Export is still available if browser storage is disabled.
    }

    this.render();
    this.updateButton();
  }

  // Update the add button for the currently selected breed.
  updateButton() {
    const added = this.names.includes(this.selectedBreed);

    this.addButton.disabled = !this.selectedBreed;
    this.addButton.setAttribute('aria-pressed', String(added));
    this.addButton.title = added ? 'Remove from favourites' : 'Add to favourites';
    this.addButton.textContent = added ? '♥ Added to favourites' : '♡ Add to favourites';
  }

  // Display each saved name with a search and remove button.
  render() {
    this.list.replaceChildren();
    this.empty.hidden = this.names.length > 0;

    for (const name of this.names) {
      const item = document.createElement('li');
      const breedButton = document.createElement('button');
      const removeButton = document.createElement('button');

      breedButton.type = 'button';
      breedButton.className = 'favourite-name';
      // Display saved names as plain text, not HTML.
      breedButton.textContent = '♥ ' + name;

      breedButton.addEventListener('click', () => {
        // Search again when a saved breed is clicked.
        const input = document.getElementById('breedInput');
        input.value = name;
        document.getElementById('searchForm').requestSubmit();
      });

      removeButton.type = 'button';
      removeButton.className = 'btn btn-outline-secondary btn-sm';
      removeButton.textContent = 'Remove';
      removeButton.setAttribute('aria-label', 'Remove ' + name);
      removeButton.addEventListener('click', () => this.remove(name));

      item.append(breedButton, removeButton);
      this.list.appendChild(item);
    }
  }

  // Write one favourite breed per line in a plain text file.
  exportFile() {
    if (this.names.length === 0) {
      showMessage('Add a favourite breed first.', 'error');
      return;
    }

    // Convert the array into a text file for download.
    const text = this.names.join('\n');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href = url;
    link.download = CONFIG.favouritesFile;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Release the temporary file URL after the download starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    this.status.textContent = 'Favourite list download requested.';
  }

  // Read a local text file and merge its names into the current list.
  async importFile() {
    const file = this.fileInput.files[0];

    if (!file) return;

    this.fileInput.value = '';

    // Reject unsupported file types and oversized files.
    if (!file.name.toLowerCase().endsWith('.txt') || file.size > CONFIG.maxFileSize) {
      showMessage('Choose a .txt file smaller than 20 KB.', 'error');
      return;
    }

    try {
      // Read the file and split it into individual lines.
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      let added = 0;
      let skipped = 0;

      // Check against the catalogue so arbitrary text cannot become a breed.
      if (this.app.breeds.length === 0) {
        showMessage('Load the breed catalogue before importing favourites.', 'error');
        return;
      }

      for (const line of lines) {
        // Remove extra whitespace and ignore blank lines.
        const name = line.trim();

        if (name === '') continue;

        const breed = this.app.breeds.find(item =>
          this.app.normaliseName(item.attributes.name) === this.app.normaliseName(name)
        );

        // Skip unknown breeds and names already saved.
        if (!breed || this.names.includes(breed.attributes.name)) {
          skipped++;
        } else {
          this.names.push(breed.attributes.name);
          added++;
        }
      }

      this.save();
      this.status.textContent = added + ' new favourite breeds imported. ' + skipped + ' duplicate or unknown names skipped.';
    } catch (error) {
      showMessage('Unable to read the text file.', 'error');
    }
  }
}
