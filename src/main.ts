import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { CreateMonacoConfig } from './monaco-editor.config';

CreateMonacoConfig();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
