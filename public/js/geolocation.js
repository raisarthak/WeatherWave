/**
 * geolocation.js — Promise wrapper around navigator.geolocation.
 * Resolves with { lat, lon } or rejects with a user-friendly Error.
 */

const GEO_TIMEOUT_MS = 10000;

/**
 * Get the user's current position.
 * @returns {Promise<{lat: number, lon: number}>}
 */
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Location request timed out. Please try again.'));
    }, GEO_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        clearTimeout(timeout);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location access denied. Please search by city name instead.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable. Please try again.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            break;
          default:
            reject(new Error('Unable to retrieve your location.'));
        }
      },
      { timeout: GEO_TIMEOUT_MS, maximumAge: 60000 }
    );
  });
}
