# HTTP Skill Configuration Examples

The skill system now supports HTTP requests in addition to JavaScript code execution. Here are some examples of how to configure HTTP skills:

## Example 1: Weather API Skill

**Skill Configuration:**
- **Name**: `get_weather`
- **Display Name**: `Get Weather Information`
- **Description**: `Retrieves current weather information for a given city`
- **Runtime Type**: `HTTP Request`
- **Endpoint**: `https://api.openweathermap.org/data/2.5/weather`
- **Method**: `GET`
- **Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Parameters Schema:**
```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "The city name to get weather for"
    },
    "units": {
      "type": "string",
      "description": "Temperature units (metric, imperial, kelvin)",
      "enum": ["metric", "imperial", "kelvin"],
      "default": "metric"
    }
  },
  "required": ["city"]
}
```

## Example 2: Custom API with Authentication

**Skill Configuration:**
- **Name**: `custom_api_call`
- **Display Name**: `Custom API Call`
- **Description**: `Makes authenticated requests to a custom API`
- **Runtime Type**: `HTTP Request`
- **Endpoint**: `https://api.example.com/v1/data`
- **Method**: `POST`
- **Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_TOKEN",
  "X-Custom-Header": "custom-value"
}
```

**Parameters Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results",
      "default": 10
    }
  },
  "required": ["query"]
}
```

## Example 3: Simple GET Request

**Skill Configuration:**
- **Name**: `fetch_data`
- **Display Name**: `Fetch Data`
- **Description**: `Fetches data from a REST API endpoint`
- **Runtime Type**: `HTTP Request`
- **Endpoint**: `https://jsonplaceholder.typicode.com/posts`
- **Method**: `GET`
- **Headers**:
```json
{
  "Accept": "application/json"
}
```

**Parameters Schema:**
```json
{
  "type": "object",
  "properties": {
    "userId": {
      "type": "number",
      "description": "Filter posts by user ID"
    }
  },
  "required": []
}
```

## How HTTP Skills Work

1. **Request Format**: When an HTTP skill is executed, the skill parameters are sent as JSON in the request body (for POST, PUT, DELETE) or as query parameters (for GET).

2. **Request Structure**: The request body will contain:
```json
{
  "args": {
    // All skill parameters are nested under "args"
    "city": "New York",
    "units": "metric"
  }
}
```

3. **Response Handling**: 
   - JSON responses are parsed automatically
   - Non-JSON responses are wrapped in a success object with the raw data
   - HTTP errors (4xx, 5xx) are handled and returned as error messages

4. **Headers**: Headers can be specified as JSON and support authentication tokens, custom headers, etc.

5. **Timeout**: HTTP requests have a 30-second timeout to prevent hanging

## Testing HTTP Skills

You can test your HTTP skills by:
1. Creating a skill with the HTTP configuration
2. Using it in a chat conversation
3. Checking the console logs for request/response details
4. Verifying the response format matches your expectations

## Error Handling

The system provides detailed error messages for:
- Invalid endpoint URLs
- Network connection issues
- HTTP error responses (4xx, 5xx)
- JSON parsing errors
- Request timeouts

All errors are logged to the console with full request details for debugging.