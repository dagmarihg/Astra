const bcrypt = require('bcrypt');

async function genHash() {
  const hash = await bcrypt.hash('password123', 12);
  console.log('Use this hash in database:');
  console.log(hash);
}

genHash();
