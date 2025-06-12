# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the GivingApi - a Node.js/Express microservice for processing church donations and financial management. It uses TypeScript, Inversify dependency injection, and deploys to AWS Lambda via Serverless Framework.

## Development Commands

```bash
# Database setup (required first time)
npm install
npm run initdb              # Creates MySQL tables from tools/dbScripts/

# Development
npm run dev                 # Start development server with hot reload on port from .env
npm run start               # Start production server
npm run startDebug          # Start with debugging on port 9229

# Build and deployment
npm run clean               # Remove dist directory
npm run lint                # TSLint with auto-fix
npm run tsc                 # TypeScript compilation  
npm run build               # Full build: clean + lint + tsc
npm run copy-assets         # Copy template files to dist/templates

# Deployment (requires AWS credentials)
npm run deploy-staging      # Deploy to staging environment
npm run deploy-prod         # Deploy to production environment  
npm run deploy-demo         # Deploy to demo environment

# Testing
npm run serverless-local    # Test serverless function locally
```

## Architecture

**Core Technologies:**
- Node.js 18.x + TypeScript + Express.js
- Inversify dependency injection with decorators
- MySQL database with custom repository pattern
- AWS Lambda deployment via Serverless Framework
- Stripe integration for payment processing

**Key Patterns:**

1. **Dependency Injection**: Controllers use `@controller`, `@httpGet`, `@httpPost` decorators from inversify-express-utils
2. **Repository Pattern**: All data access via `Repositories.getCurrent()` singleton
3. **Base Controller**: All controllers extend `GivingBaseController` which provides `this.repositories` access
4. **Authentication**: Uses `CustomAuthProvider` from @churchapps/apihelper with JWT tokens
5. **Multi-tenant**: All operations scoped by `churchId` from auth context
6. **Permission Checks**: Always call `au.checkAccess(Permissions.xxx)` before business logic

## Database Setup

1. Create MySQL database named `givingapi`
2. Copy `dotenv.sample.txt` to `.env` with database credentials:
   ```
   CONNECTION_STRING=mysql://user:password@host:port/givingapi
   ENCRYPTION_KEY=aSecretKeyOfExactly192BitsLength
   JWT_SECRET=your_jwt_secret_here
   SERVER_PORT=8084
   ```
3. Run `npm run initdb` to create tables

## Configuration

Environment-specific configs:
- `config/dev.json` - Development settings
- `config/staging.json` - Staging environment
- `config/prod.json` - Production environment

Access configuration via `Environment.ts` helper class, never directly from config files.

## Controller Pattern

All controllers follow this pattern:
```typescript
@controller("/donations")
export class DonationController extends GivingBaseController {
    @httpGet("/")
    public async getAll(req: express.Request, res: express.Response) {
        return this.actionWrapper(req, res, async (au) => {
            if (!au.checkAccess(Permissions.donations.view)) return this.json({}, 401);
            const result = await this.repositories.donation.loadAll(au.churchId);
            return this.repositories.donation.convertAllToModel(au.churchId, result);
        });
    }
}
```

Key requirements:
- Extend `GivingBaseController` 
- Use `this.actionWrapper()` for authenticated endpoints
- Check permissions with `au.checkAccess()` before business logic
- Always scope database operations by `au.churchId`
- Use repository pattern via `this.repositories`

## Repository Access

Access all repositories via the singleton:
```typescript
const repos = Repositories.getCurrent();
repos.donation.loadAll(churchId);
repos.fund.save(fund);
// etc.
```

Available repositories: donation, donationBatch, fund, fundDonation, gateway, customer, eventLog, subscription, subscriptionFund