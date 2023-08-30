# GivingApi

Shared api for tracking church donations.

### Dev Setup Instructions

1. Create a MySQL database named `givingapi`
2. Copy `dotenv.sample.txt` to `.env` and edit it to point to your MySQL database.
3. Install the dependencies with: `npm install`
4. Create the database tables with `npm run initdb`
5. Start the api with `npm run dev`
