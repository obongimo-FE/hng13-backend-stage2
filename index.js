import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import { db } from './db.js';
import fs, { write } from 'fs';
import { generateSummaryChart } from './generate_image.js';
import env from "dotenv";



const app = express();
const PORT = process.env.PORT || 3000;


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/cache', express.static('cache')); // Serve static files from 'cache' directory

let countries = []; // This will hold the cached country data
let global_last_refreshed_at = null;

async function getData (){
    return await db.query('SELECT * FROM countries');
}


app.get('/', (req, res) => {
    res.redirect('/countries');
});

app.get('/countries', async(req, res) => {
    try {
        const { region, currency, sort } = req.query;
        const [rows] = await getData();
        if (rows.length === 0){
            return res.status(404).send({ message:'No countries found in the database.'});
        }

        let filteredList = rows;
        if (region !== undefined){
            filteredList = filteredList.filter(item => item.region.toLowerCase() === region.toLowerCase()); 
        }

        if (currency !== undefined){
            filteredList = filteredList.filter(item => item.currency_code && item.currency_code.toLowerCase() === currency.toLowerCase())
        }

        if (sort !== undefined){
            if (sort === 'gdp_desc'){
                filteredList.sort((a, b) => (b.estimated_gdp || 0) - (a.estimated_gdp || 0));
            } else {
                res.status(400).send({ message: 'Invalid sort parameter. Use "desc" for descending order.'});
            }
        }

        res.json(filteredList);
    } catch (error) {
        console.error('Error fetching countries:', error.message);
        res.status(500).send({ message: 'Database error' });
    }
    
});

app.get('/countries/image', (req, res) => {
    try {
        if (!fs.existsSync('cache/summary.png')){
            return res.status(404).send({ error: 'Summary image not found.' });
        }
        res.redirect('/cache/summary.png');
    } catch(error){
        console.error('Error Displaying Summary Image', error.message);
        res.status(500).send({ message: 'Database error' });
    }
});

app.get('/status', async (req, res) => {

    // Get total number of countries
    const [countResult] = await db.query('SELECT COUNT(*) AS total FROM countries');
    const totalCountries = countResult[0].total;

    // Get latest updated_at timestamp
    const [timestampResult] = await db.query('SELECT MAX(last_refreshed_at) AS last_refresh FROM countries');
    const lastRefresh = timestampResult[0].last_refresh;

    res.json({
        total_countries: totalCountries,
        last_refreshed_at: lastRefresh,
    });
});

app.get('/countries/:name', async (req, res) => {
    const countryName = req.params.name.toLowerCase();
    const [country] = await db.query('SELECT * FROM countries WHERE LOWER(name) = ?', [countryName]);
    if (!country.length) {
        return res.status(404).send({ message: 'Country not found' });
    }
    res.json(country[0]);
});

app.post('/countries/refresh', async (req, res) => {
    const connection = await db.getConnection(); // Get a single connection for the transaction
    try {
        await connection.beginTransaction();

        let countries, exchangeRates;
        const countriesAPI = 'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies';
        const ratesAPI = 'https://open.er-api.com/v6/latest/USD';

        try {
            const [countriesResponse, ratesResponse] = await Promise.all([
                axios.get(countriesAPI).catch(err => { throw { source: 'RestCountries', error: err }; }),
                axios.get(ratesAPI).catch(err => { throw { source: 'OpenExchangeRates', error: err }; })
            ]);
    
            countries = countriesResponse.data; // v2 data
            exchangeRates = ratesResponse.data.rates;
        } catch (apiError) {
            const source = apiError.source || 'Unknown API';
            const underlyingError = apiError.error || apiError;

            console.error(`Failed to fetch data from ${source}:`, underlyingError.message);

            const status = underlyingError.response ? underlyingError.response.status : 502; // Bad Gateway is more appropriate
            const message = underlyingError.response ? underlyingError.response.data : 'Error connecting to external services.';
            
            return res.status(status).send({ error: "External data source unavailable", details: `Could not fetch data from ${source}.`, underlyingError: message });
        }

        const countryData = countries.map(country => {
            let currencyCode = null;
            let exchangeRateToUSD = null;
            let estimated_gdp = null;

            if (country.currencies) {
                const currency = country.currencies[0];
                if (currency && currency.code) {
                    currencyCode = currency.code;
                    exchangeRateToUSD = exchangeRates[currencyCode] || null;
                }
            }

            // Compute estimated gdp
            const randomFactor = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
            if (exchangeRateToUSD) {
                estimated_gdp = (country.population * randomFactor) / exchangeRateToUSD;
            }

            return [
                country.name,
                country.capital || null,
                country.region || null,
                country.population || null,
                currencyCode,
                exchangeRateToUSD,
                estimated_gdp,
                country.flag || null,
            ];
        });

        const upsertSql = ` 
            INSERT INTO countries (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                capital = VALUES(capital),
                region = VALUES(region),
                population = VALUES(population),
                currency_code = VALUES(currency_code),
                exchange_rate = VALUES(exchange_rate),
                estimated_gdp = VALUES(estimated_gdp),
                flag_url = VALUES(flag_url),
                last_refreshed_at = NOW()
        `;

        await connection.query(upsertSql, [countryData]);

        global_last_refreshed_at = new Date().toISOString();
        await generateSummaryChart(db);
        await connection.commit();
        res.status(201).send({ message: 'Countries refreshed and stored in database successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error during database operation in /countries/refresh:', error.message);
        res.status(500).send({ message: 'An internal server error occurred during database processing.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/countries/:name', async (req, res) => {
    const countryName = req.params.name.toLowerCase();
    const [country] = await db.query('SELECT * FROM countries WHERE LOWER(name) = ?', [countryName]);
    if (!country.length) {
        return res.status(404).send({ message: 'Country not found' });
    }
    await db.query('DELETE FROM countries WHERE LOWER(name) = ?', [countryName]);
    
    res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});