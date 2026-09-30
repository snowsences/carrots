// These Firebase identifiers are public; access is enforced by Firestore rules.
export const config = Object.freeze({
  firebase: {
    apiKey: 'AIzaSyB5RnX8nf00fdvDCkpRNn39NiQp_ldbREE',
    authDomain: 'glauco-3985e.firebaseapp.com',
    projectId: 'glauco-3985e',
    storageBucket: 'glauco-3985e.firebasestorage.app',
    messagingSenderId: '529982898488',
    appId: '1:529982898488:web:b0ecf0c04b37d41840c1cd',
  },
  // Bootstrap: Google sign-in creates user records, but these IDs grant nobody trip access.
  // Replace them with the two UIDs from this project's Authentication → Users.
  ownerUids: ['pending-owner-1', 'pending-owner-2'],
  // Wikimedia images are supported by default. Keep this list and the index.html CSP in agreement.
  imageHosts: ['upload.wikimedia.org', 'thumb.wikimedia.org', 'res.cloudinary.com'],
});
