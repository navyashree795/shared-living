const admin = require('/home/jeevan/Desktop/my projects/shared living/functions/node_modules/firebase-admin');
admin.initializeApp({
  projectId: 'shared-living-app',
});

const checkBucket = (name) => {
  const bucket = admin.storage().bucket(name);
  return bucket.getMetadata()
    .then(([metadata]) => {
      console.log(`SUCCESS for bucket [${name}]:`, metadata.name);
      return true;
    })
    .catch(err => {
      console.log(`FAILED for bucket [${name}]:`, err.message);
      return false;
    });
};

async function run() {
  await checkBucket('shared-living-app.firebasestorage.app');
  await checkBucket('shared-living-app.appspot.com');
  await checkBucket('shared-living-app');
}
run();

