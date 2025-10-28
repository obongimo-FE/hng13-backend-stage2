import { db } from './db.js';

(async () => {
  try {
    const [result] = await db.query('SELECT NOW() AS `current_time`');
    console.log('✅ MySQL Connected! Server time:', result[0].current_time);
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
})();