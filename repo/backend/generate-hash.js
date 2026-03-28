const bcrypt = require('bcryptjs');

const password = 'Admin@123456';
const hash = bcrypt.hashSync(password, 12);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('');
console.log('SQL UPDATE:');
console.log(`UPDATE users SET password_hash = '${hash}', password_salt = NULL WHERE username = 'admin';`);
