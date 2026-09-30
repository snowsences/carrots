// Use a NEW Firebase project. These identifiers are public; access is enforced by Firestore rules.
export const config = Object.freeze({
  firebase: { apiKey: '', authDomain: '', projectId: '', appId: '' },
  ownerUids: ['REPLACE_OWNER_1_UID', 'REPLACE_OWNER_2_UID'],
  // Wikimedia images are supported by default. Keep this list and the index.html CSP in agreement.
  imageHosts: ['upload.wikimedia.org', 'thumb.wikimedia.org', 'res.cloudinary.com'],
});
