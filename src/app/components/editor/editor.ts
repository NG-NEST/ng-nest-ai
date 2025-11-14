import {
  AfterViewInit,
  Component,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  Renderer2,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { XButtonComponent } from '@ng-nest/ui';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { fromEvent, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-editor',
  imports: [XButtonComponent],
  templateUrl: './editor.html',
  styleUrls: ['./editor.scss'],
  host: {
    '[class.fullscreen]': 'fullscreen()'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditorComponent),
      multi: true
    }
  ]
})
export class EditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  filename = input<string>('.plaintext');
  theme = input<string>('vs');
  options = input<monaco.editor.IStandaloneEditorConstructionOptions>({});
  disabled = input<boolean>(false);

  document = inject(DOCUMENT);
  renderer = inject(Renderer2);

  editorRef = viewChild.required<ElementRef<HTMLDivElement>>('editorRef');

  language = computed(() => {
    return this.getLanguageFromFilename(this.filename());
  });

  fullscreen = signal(false);

  value: any = '';

  private originalDimensions: { width: string; height: string } | null = null;

  private $destroy = new Subject<void>();

  private editor!: monaco.editor.IStandaloneCodeEditor;
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      this.updateEditorLanguage(this.language());
    });
  }

  ngOnInit() {
    // console.log('MonacoEnvironment:', (window as any).MonacoEnvironment);
  }

  ngAfterViewInit(): void {
    this.initializeEditor();

    fromEvent<KeyboardEvent>(this.document.documentElement, 'keydown')
      .pipe(takeUntil(this.$destroy))
      .subscribe((event) => {
        if (event.key === 'Escape' && this.fullscreen()) {
          this.toggleFullscreen();
        }
      });

    fromEvent(this.document.defaultView as Window, 'resize')
      .pipe(takeUntil(this.$destroy))
      .subscribe(() => {
        if (this.fullscreen() && this.editor) {
          setTimeout(() => {
            this.editor.layout();
          }, 100);
        }
      });
  }

  ngOnDestroy() {
    if (this.editor) {
      this.editor.dispose();
    }
    this.$destroy.next();
    this.$destroy.complete();
  }

  toggleFullscreen() {
    const wasFullscreen = this.fullscreen();
    const isFullscreen = !wasFullscreen;

    this.fullscreen.set(isFullscreen);

    const hostElement = this.editorRef().nativeElement;

    if (isFullscreen && hostElement) {
      this.originalDimensions = {
        width: hostElement.clientWidth + 'px',
        height: hostElement.clientHeight + 'px'
      };
      this.renderer.setStyle(hostElement, 'width', '100%');
      this.renderer.setStyle(hostElement, 'height', 'calc(100% - 2rem - var(--x-border-width))');
    } else if (!isFullscreen && hostElement && this.originalDimensions) {
      this.renderer.setStyle(hostElement, 'width', this.originalDimensions.width);
      this.renderer.setStyle(hostElement, 'height', this.originalDimensions.height);

      setTimeout(() => {
        if (this.editor) {
          this.editor.layout();
        }
      });
    }
    setTimeout(() => {
      if (this.editor) {
        this.editor.layout();
      }
    }, 10);
  }

  private updateEditorLanguage(language: string) {
    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }

  private getLanguageFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    const languageMap: { [key: string]: string } = {
      html: 'html',
      htm: 'html',
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      java: 'java',
      py: 'python',
      md: 'markdown',
      sql: 'sql',
      php: 'php',
      rb: 'ruby',
      cpp: 'cpp',
      cs: 'csharp',
      go: 'go',
      sh: 'shell',
      vue: 'vue'
    };

    return extension ? languageMap[extension] || 'plaintext' : 'plaintext';
  }

  private initializeEditor(): void {
    this.editor = monaco.editor.create(this.editorRef().nativeElement, {
      value: this.value,
      readOnly: this.disabled(),
      language: this.language(),
      theme: this.theme(),
      automaticLayout: true,
      ...this.options()
    });

    this.editor.onDidChangeModelContent(() => {
      const value = this.editor.getValue();
      this.value = value;
      this.onChange(value);
    });
  }

  writeValue(value: string) {
    this.value = value;
    if (this.editor) {
      this.editor.setValue(value || '');
      this.editor.setScrollTop(0);
      this.editor.setScrollLeft(0);
    }
  }

  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    if (this.editor) {
      this.editor.updateOptions({ readOnly: isDisabled });
    }
  }
}
