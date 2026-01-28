# Built-in Skills

This directory contains all built-in skills for the OpenAI service. Skills are now organized in a structured directory system for better maintainability and extensibility.

## Directory Structure

```
electron/skills/
├── builtin/                    # Built-in skills directory
│   ├── types.ts               # Type definitions
│   ├── index.ts               # Skill loader and exports
│   ├── README.md              # Detailed documentation
│   ├── get-time.skill.ts      # Time-related skill
│   ├── query-indexeddb.skill.ts # Database query skill
│   ├── system-info.skill.ts   # System information skill
│   └── [other-skill].skill.ts # Additional skills
├── package.json               # Package configuration
└── README.md                  # This file
```

## Features

- **Automatic Loading**: Skills are automatically discovered and loaded from the `builtin/` directory
- **Type Safety**: Full TypeScript support with proper type definitions
- **Modular Structure**: Each skill is in its own file for better organization
- **Context Support**: Skills can access Electron APIs through the context parameter
- **Easy Extension**: Add new skills by simply creating new `.skill.ts` files

## Available Skills

### Built-in Skills
- **get_time**: Get current server time with timezone information
- **query_indexeddb**: Query frontend IndexedDB database with batch support
- **get_system_info**: Get system information including OS, memory, and CPU details
- **file_operations**: List files and directories with filtering and recursive options

## Adding New Skills

1. Create a new file in `electron/skills/builtin/` with the pattern `[skill-name].skill.ts`
2. Export a `skill` object that implements the `SkillDefinition` interface
3. The skill will be automatically loaded when the service starts

See `electron/skills/builtin/README.md` for detailed documentation and examples.

## Migration from Old System

The built-in skills have been extracted from the OpenAI service into this structured directory system. This provides:

- Better code organization and maintainability
- Easier testing and debugging of individual skills
- Clear separation of concerns
- Simplified skill development workflow
- Automatic skill discovery and loading