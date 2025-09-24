# Task Completion Checklist

## When Completing Development Tasks

### Code Quality Verification
1. **Manual Testing**: Test the specific functionality implemented
2. **API Endpoint Testing**: Use appropriate test scripts from `API CloudTalk/` or `API Squadd/`
3. **Webhook Testing**: Use curl commands or test endpoints if webhook-related
4. **Log Review**: Check console logs for any errors or warnings

### Pre-Deployment Checks
1. **Environment Variables**: Ensure all required environment variables are documented
2. **Dependencies**: Verify all new dependencies are added to package.json
3. **Error Handling**: Ensure proper error handling and logging is implemented
4. **Configuration**: Update configuration files if new services are added

### Testing Commands to Run
```bash
# Test server startup
npm start

# Test specific API functionality
node "API CloudTalk/GET/run-all-get-tests.js"    # If CloudTalk related
node "API Squadd/tests/test-functions.js"         # If GoHighLevel related

# Test webhook endpoints (if applicable)
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/[endpoint] \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
```

### Documentation Updates
1. **CLAUDE.md**: Update if new commands or patterns are introduced
2. **README.md**: Update if major features are added
3. **Environment Variables**: Update .env.example if new variables are needed

### Code Review Points
1. **ES6 Module Imports**: Ensure proper import/export syntax
2. **Error Handling**: All async operations should have try/catch
3. **Logging**: Use emoji-prefixed logging pattern for consistency
4. **Authentication**: Proper handling of API keys and auth headers
5. **Configuration**: Environment-based configuration, no hardcoded values

### No Linting/Formatting Tools Required
- **No ESLint configuration** found in project
- **No Prettier configuration** found in project  
- **No TypeScript** - pure JavaScript project
- **Manual code review** is the primary quality control mechanism

### Deployment Readiness
1. **Production Scripts**: Ensure production deployment scripts are updated
2. **Environment Configuration**: Production environment variables documented
3. **Webhook URLs**: Update webhook endpoints in external services if needed
4. **Service Dependencies**: Verify all external service integrations work