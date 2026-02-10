---
name: hello_markdown
displayName: 你好问候
description: A simple hello world skill defined in Markdown
parameters:
  type: object
  properties:
    name:
      type: string
      description: The name to greet
---

This is a demonstration of an OpenClaw-style skill definition.

```javascript
(args) => {
  const name = args.name || "World";
  return {
    message: `Hello, ${name}! This skill was loaded from a Markdown file.`,
    timestamp: new Date().toISOString()
  };
}
```
