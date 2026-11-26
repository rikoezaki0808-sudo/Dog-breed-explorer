// Shared settings that can be changed in one place.

const CONFIG = {
  // Dog API endpoint for breed records.
  breedsUrl: 'https://dogapi.dog/api/v2/breeds?page%5Bsize%5D=1000',
  // Dog API endpoint for breed group names.
  groupsUrl: 'https://dogapi.dog/api/v2/groups',
  // Default name of the exported text file.
  favouritesFile: 'favourites.txt',
  // Browser storage key for favourite breeds.
  favouritesKey: 'dogExplorerFavourites',
  // Maximum import size in bytes.
  maxFileSize: 20000
};
