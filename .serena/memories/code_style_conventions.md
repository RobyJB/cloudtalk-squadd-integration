# Code Style and Conventions

## File Structure
- **ES6 Modules**: All files use `import`/`export` syntax
- **File Extensions**: `.js` for all JavaScript files
- **Directory Structure**:
  - `src/` - Main application source code
  - `src/routes/` - Express route handlers
  - `src/services/` - Business logic and external service integrations
  - `src/utils/` - Utility functions
  - `API CloudTalk/` - CloudTalk API integration and tests
  - `API Squadd/` - GoHighLevel integration

## Naming Conventions
- **Files**: kebab-case (e.g., `cloudtalk-webhooks.js`, `transcription-service.js`)
- **Variables**: camelCase (e.g., `makeCloudTalkRequest`, `processRecording`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `CLOUDTALK_CONFIG`, `CUSTOM_VOCABULARY`)
- **Functions**: camelCase with descriptive names (e.g., `performPhase1Analysis`)

## Code Patterns
- **Async/Await**: Preferred over Promises for asynchronous operations
- **ES6 Destructuring**: Used for object and array destructuring
- **Template Literals**: Used for string interpolation
- **Arrow Functions**: Used for short callback functions
- **Default Parameters**: Used in function definitions

## Error Handling
- **Try/Catch blocks** for async operations
- **Comprehensive error logging** with descriptive messages
- **HTTP status codes** properly handled in API responses
- **Graceful fallbacks** for external service failures

## Logging Pattern
- **Emoji-prefixed logs** for visual categorization:
  - `🔗` for API requests
  - `📝` for method/action descriptions
  - `🔑` for authentication
  - `📊` for response status
  - `✅` for success operations
  - `❌` for errors
- **Structured logging** with consistent format
- **Request/Response logging** for all external API calls

## Configuration Management
- **Environment variables** for all external configurations
- **Centralized config** objects (e.g., `CLOUDTALK_CONFIG`)
- **Default values** provided in `.env.example`

## Authentication Patterns
- **Basic Auth** for CloudTalk (Base64 encoded)
- **API Key Auth** for GoHighLevel and OpenAI
- **Centralized auth headers** in config modules

## Service Architecture
- **Single responsibility** for each service
- **Dependency injection** pattern for external dependencies
- **Modular exports** with named exports preferred