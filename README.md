# Backend Stage 2 - Country Data API

## Overview

This project is a Node.js/Express backend service that provides comprehensive data about countries around the world. It fetches, processes, and caches data from external APIs, stores it in a MySQL database, and exposes several endpoints for querying, filtering, and visualizing this information.

A key feature is the ability to generate and serve a dynamic bar chart image summarizing the top 5 countries by estimated GDP.

## Features

- **Data Aggregation**: Fetches country information from `RestCountries` and currency exchange rates from `Open Exchange Rates API`.
- **Database Caching**: Stores and manages country data in a MySQL database to reduce reliance on external APIs.
- **Dynamic Data Refresh**: An endpoint to manually trigger a refresh of all country data.
- **Robust API**: Endpoints to list, filter, sort, and retrieve individual country data.
- **Image Generation**: Dynamically creates and serves a PNG image of a bar chart showing the top 5 countries by estimated GDP.
- **Error Handling**: Gracefully handles failures from external API dependencies.

---

## Prerequisites

- Node.js (v18.x or later recommended)
- MySQL

---

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd backend-stage2
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    -   This project uses a `.env` file to manage environment variables. To get started, copy the example file:
        ```bash
        cp .env.example .env
        ```
    -   Now, open the `.env` file and fill in your actual MySQL database credentials. The `.gitignore` file is already configured to prevent this file from being committed.

4.  **Set up the Database:**
    -   Connect to your MySQL server.
    -   Create the database:
        ```sql
        CREATE DATABASE countries_db;
        ```
    -   Use the database:
        ```sql
        USE countries_db;
        ```
    -   Create the `countries` table with the following schema:
        ```sql
        CREATE TABLE countries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            capital VARCHAR(255),
            region VARCHAR(255),
            population BIGINT,
            currency_code VARCHAR(10),
            exchange_rate DECIMAL(20, 10),
            estimated_gdp DECIMAL(20, 2),
            flag_url TEXT,
            last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        ```

5.  **Run the application:**
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`.

6.  **Initial Data Population:**
    -   Once the server is running, you must populate the database for the first time by making a `POST` request to the `/countries/refresh` endpoint using a tool like Postman or `curl`.
    ```bash
    curl -X POST http://localhost:3000/countries/refresh
    ```
    This process may take a moment as it fetches data for all countries.

---

## API Endpoints

#### `POST /countries/refresh`
- **Description**: Fetches the latest data from external APIs, calculates estimated GDP, and updates the local database. Also regenerates the `summary.png` chart.
- **Response (201 Created)**:
  ```json
  {
    "message": "Countries refreshed and stored in database successfully."
  }
  ```

#### `GET /countries`
- **Description**: Retrieves a list of all countries from the database. Supports filtering and sorting.
- **Query Parameters**:
  - `region` (string): Filter countries by region (e.g., `?region=Africa`).
  - `currency` (string): Filter by currency code (e.g., `?currency=NGN`).
  - `sort` (string): Sort results. Options: `name_asc`, `name_desc`, `gdp_asc`, `gdp_desc`.
- **Example**: `http://localhost:3000/countries?region=Europe&sort=gdp_desc`

#### `GET /countries/:name`
- **Description**: Retrieves detailed information for a single country by its name.
- **Example**: `http://localhost:3000/countries/Nigeria`
- **Response (200 OK)**:
  ```json
  {
    "name": "Nigeria",
    "capital": "Abuja",
    "region": "Africa",
    "population": 206139587,
    "currency_code": "NGN",
    "exchange_rate": 410.83,
    "estimated_gdp": 981234567890.12,
    "flag_url": "https://restcountries.com/data/nga.svg"
  }
  ```

#### `GET /countries/image`
- **Description**: Redirects to the statically served summary chart image (`summary.png`). This image shows the top 5 countries by estimated GDP.
- **Example**: `http://localhost:3000/countries/image`

#### `GET /status`
- **Description**: Provides a simple status check, showing the total number of countries in the cache and when the data was last refreshed.
- **Response (200 OK)**:
  ```json
  {
    "total_countries": 250,
    "last_refreshed_at": "2023-10-27T10:00:00.000Z"
  }
  ```

---

## Core Dependencies

- **Express**: Web server framework.
- **axios**: For making HTTP requests to external APIs.
- **mysql2**: MySQL database driver.
- **chartjs-node-canvas**: For generating the summary chart on the server side.