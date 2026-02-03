# Skill Classification System

The skill system now supports four distinct types of skills, each serving different purposes and use cases:

## 1. JavaScript Skills (`javascript`)

**Purpose**: Execute custom JavaScript code to perform computations, data processing, or complex logic.

**Use Cases**:
- Mathematical calculations
- Data transformation and processing
- Complex business logic
- Integration with Node.js APIs
- File system operations
- Custom algorithms

**Configuration**:
- **Code**: JavaScript function that receives `args` parameter
- **Execution Environment**: Sandboxed VM with limited global objects
- **Available APIs**: console, JSON, Date, Math, setTimeout, Promise, fetch (simplified)

**Example**:
```javascript
async function execute(args) {
  const { numbers } = args;
  const sum = numbers.reduce((a, b) => a + b, 0);
  const average = sum / numbers.length;
  
  return {
    sum,
    average,
    count: numbers.length
  };
}
```

## 2. HTTP Skills (`http`)

**Purpose**: Make HTTP requests to external APIs and services.

**Use Cases**:
- Weather data retrieval
- REST API integration
- Third-party service calls
- Data fetching from web services
- Webhook notifications

**Configuration**:
- **Endpoint**: Target URL
- **Method**: GET, POST, PUT, DELETE
- **Headers**: Custom HTTP headers (JSON format)
- **Request Body**: Skill parameters sent as JSON

**Features**:
- Automatic JSON parsing
- Custom headers support
- Error handling for HTTP status codes
- 30-second timeout
- Request/response logging

## 3. Markdown Skills (`markdown`)

**Purpose**: Provide structured documentation and knowledge to the AI without code execution.

**Use Cases**:
- Domain-specific knowledge bases
- Standard operating procedures
- Best practices documentation
- Reference materials
- Guidelines and policies
- FAQ content

**Configuration**:
- **Content**: Markdown-formatted documentation
- **Instructions**: Brief usage guidelines for the AI
- **No Execution**: Pure informational content

**Features**:
- Rich markdown formatting support
- Structured knowledge delivery
- Context-aware information
- No security concerns (no code execution)

**Example Content**:
```markdown
# Customer Service Guidelines

## Greeting Customers
Always start with a warm, professional greeting.

## Handling Complaints
1. Listen actively
2. Acknowledge the issue
3. Provide solutions
4. Follow up

## Escalation Process
For complex issues, escalate to supervisor when...
```

## 4. Built-in Skills (`builtin`)

**Purpose**: Use predefined system functions and utilities.

**Use Cases**:
- System information retrieval
- Time and date functions
- Common utility functions
- Platform-specific operations

**Configuration**:
- **Handler**: Name of the built-in function
- **Predefined**: Functions are implemented in the system

**Available Built-ins**:
- `get_time`: Returns current timestamp and formatted time

## Skill Classification Guidelines

### When to Use JavaScript Skills
- Need custom logic or calculations
- Require data processing or transformation
- Want to use Node.js capabilities
- Need complex algorithmic operations

### When to Use HTTP Skills
- Integrating with external APIs
- Fetching data from web services
- Making REST API calls
- Connecting to third-party services

### When to Use Markdown Skills
- Providing reference documentation
- Sharing knowledge bases
- Defining procedures and guidelines
- Creating FAQ content
- No computation needed, just information

### When to Use Built-in Skills
- Need common system functions
- Want reliable, tested functionality
- Require platform-specific operations
- Need standard utilities

## Skill Management Best Practices

### Naming Conventions
- Use descriptive, action-oriented names
- Follow snake_case format (e.g., `get_weather`, `calculate_tax`)
- Include the domain or category when relevant

### Categories
Organize skills into logical categories:
- **Data Processing**: Data transformation, calculations
- **External APIs**: Third-party integrations
- **Documentation**: Knowledge bases, procedures
- **System**: Built-in utilities, system functions
- **Business Logic**: Domain-specific operations

### Parameters Schema
Always define clear parameter schemas:
```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "City name for weather lookup"
    },
    "units": {
      "type": "string",
      "enum": ["metric", "imperial"],
      "default": "metric"
    }
  },
  "required": ["city"]
}
```

### Documentation
- Provide clear descriptions
- Include usage examples
- Document expected parameters
- Explain return values
- Add troubleshooting notes

## Security Considerations

### JavaScript Skills
- Run in sandboxed environment
- Limited access to system APIs
- No file system write access by default
- Timeout protection (30 seconds)

### HTTP Skills
- Validate endpoint URLs
- Support custom authentication headers
- Handle network errors gracefully
- Log requests for debugging

### Markdown Skills
- No code execution
- Safe content rendering
- No security risks

### Built-in Skills
- Predefined, tested functions
- System-level access controls
- Audit trail for usage

## Performance Guidelines

### JavaScript Skills
- Keep execution time under 30 seconds
- Avoid infinite loops
- Use efficient algorithms
- Handle large data sets carefully

### HTTP Skills
- Set appropriate timeouts
- Handle rate limiting
- Cache responses when possible
- Use connection pooling for multiple requests

### Markdown Skills
- Keep content concise but comprehensive
- Use clear structure and formatting
- Optimize for AI consumption
- Regular content updates

## Error Handling

All skill types include comprehensive error handling:
- Clear error messages
- Detailed logging
- Graceful degradation
- User-friendly feedback

## Future Extensions

The skill system is designed to be extensible:
- Additional runtime types can be added
- New built-in functions can be implemented
- Enhanced security features
- Performance optimizations
- Integration with more external services