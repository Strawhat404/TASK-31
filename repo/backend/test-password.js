const bcrypt = require('bcryptjs');

const hash = '$2b$12$rScX4rsROPygKCefhYxLoePP5qVsY0eVs/k40A0lP1XI5h8Rnqyde';

const passwords = [
  'Admin123!@#',
  'admin',
  'password',
  'Admin@123',
  'RoadSafe2024!',
  'admin123',
  'Admin123'
];

console.log('Testing passwords against hash:');
passwords.forEach(pwd => {
  const result = bcrypt.compareSync(pwd, hash);
  console.log(`  "${pwd}": ${result ? 'MATCH ✓' : 'no match'}`);
});
