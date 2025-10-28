import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import moment from 'moment';

export const generateSummaryChart = async (db) => {
  // Get top 5 countries by GDP
  const [topCountries] = await db.query(`
    SELECT name, estimated_gdp 
    FROM countries 
    WHERE estimated_gdp IS NOT NULL 
    ORDER BY estimated_gdp DESC 
    LIMIT 5
  `);

  // Get total number of countries
  const [countResult] = await db.query('SELECT COUNT(*) AS total FROM countries');
  const totalCountries = countResult[0].total;

  // Get latest updated_at timestamp
  const [timestampResult] = await db.query('SELECT MAX(last_refreshed_at) AS last_refresh FROM countries');
  const lastRefresh = timestampResult[0].last_refresh;

  // Prepare chart data
  const labels = topCountries.map(c => c.name);
  const data = topCountries.map(c => c.estimated_gdp);

  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const configuration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Estimated GDP (USD)',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `Top 5 Countries by Estimated GDP\nTotal Countries: ${totalCountries} | Last Refresh: ${moment(lastRefresh).format('YYYY-MM-DD HH:mm:ss')}`,
          font: { size: 18 },
        },
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => '$' + (value / 1e9).toFixed(1) + 'B',
          },
        },
      },
    },
  };

  // Render PNG
  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

  // Ensure directory exists
  if (!fs.existsSync('cache')) fs.mkdirSync('cache');

  // Save file
  fs.writeFileSync('cache/summary.png', imageBuffer);
  console.log('Summary chart saved to cache/summary.png');
};
