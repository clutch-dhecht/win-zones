# Territory Atlas - Test Credentials

## Test Data Files
- City Data CSV: `/tmp/city_data.csv`
- County Data CSV: `/tmp/county_data.csv`

## Data Summary
- **City Data**: 13 geocoded US cities (512 skipped due to missing coordinates)
- **County Data**: 1,859 US counties
- **City Layers**: Feed Mills, Hog Producers, Grain Fumigation, Customers (4 layers)
- **County Layers**: 1000-plus Acre Growers, Growers with On Farm Storage, Grain Retail Handlers (3 layers)

## API Endpoints
- Upload City Data: `POST /api/upload/city`
- Upload County Data: `POST /api/upload/county`
- Get City Data: `GET /api/data/city`
- Get County Data: `GET /api/data/county`
- Get Top Zones: `GET /api/analytics/top-zones?layers=<comma-separated>`

## No Authentication Required
The app does not require login credentials.
