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
  // First member enabled. The second slot stays disabled pending their UID from this project's Authentication → Users.
  ownerUids: ['4ct4jQf9cPhbzqiasFT56Mav7Ds1', 'pending-owner-2'],
  // Wikimedia and iNaturalist open-data images are supported. Keep this list and the index.html CSP in agreement.
  imageHosts: ['upload.wikimedia.org', 'thumb.wikimedia.org', 'res.cloudinary.com', 'inaturalist-open-data.s3.amazonaws.com'],
});
