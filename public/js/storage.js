/**
 * storage.js — Recent search history backed by localStorage.
 * Stores up to MAX_ENTRIES city names as an array.
 */

const STORAGE_KEY  = 'ww_recent_searches';
const MAX_ENTRIES  = 8;

const RecentSearches = {
  /** @returns {string[]} */
  get() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  /**
   * Add a city to the top of the list.
   * Deduplicated (case-insensitive), trimmed to MAX_ENTRIES.
   * @param {string} city
   */
  add(city) {
    const trimmed = city.trim();
    if (!trimmed) return;

    let list = this.get().filter(c => c.toLowerCase() !== trimmed.toLowerCase());
    list.unshift(trimmed);
    list = list.slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  },

  /**
   * Remove a specific city.
   * @param {string} city
   */
  remove(city) {
    const list = this.get().filter(c => c.toLowerCase() !== city.toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
