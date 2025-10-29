import 'dotenv/config';
import mysql from 'mysql2/promise';

export const db = await mysql.createConnection(process.env.DATABASE_URL);







// {

//   host: process.env.DB_HOST || 'localhost',
//   user: process.env.DB_USERNAME || 'root',       // your MySQL username
//   password: process.env.DB_PASSWORD || '',  // your MySQL password
//   database: process.env.DB_DATABASE || 'countries_db', // your database name
//   port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
// }
