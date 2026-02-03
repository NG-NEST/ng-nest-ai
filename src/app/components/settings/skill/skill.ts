import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XI18nPipe,
  XI18nService,
  XInputComponent,
  XLoadingComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XMessageService,
  XSelectComponent,
  XTabsComponent,
  XTabComponent
} from '@ng-nest/ui';
import { EditorComponent } from '@ui/components';
import { Skill, SkillService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

import { form, FormField, required } from '@angular/forms/signals';

@Component({
  selector: 'app-skill',
  imports: [
    XInputComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XI18nPipe,
    EditorComponent,
    FormField,
    XSelectComponent
  ],
  templateUrl: './skill.html',
  styleUrl: './skill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkillComponent {
  data = inject<{ id: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<SkillComponent>);
  i18n = inject(XI18nService);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(SkillService);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  model = signal<Skill>({
    name: '',
    displayName: '',
    description: '',
    category: '',
    status: 'active',
    schema: {
      parameters: JSON.stringify(
        {
          type: 'object',
          properties: {},
          required: []
        },
        null,
        2
      ),
      returns: {}
    },
    runtime: {
      type: 'javascript',
      code: `// 参数通过 args 对象传入
// 例如: args.city, args.date 等
// 返回结果对象

async function execute(args) {
  // 在这里编写你的执行逻辑
  
  // 示例：返回简单结果
  return {
    success: true,
    message: '执行成功',
    data: args
  };
}

// 返回执行函数
execute;`,
      endpoint: '',
      method: 'POST',
      headers: JSON.stringify(
        {
          'Content-Type': 'application/json'
        },
        null,
        2
      ),
      content: `# Skill Documentation

This is a markdown-based skill that provides information and guidance to the AI.

## Purpose
Describe what this skill is for and when it should be used.

## Usage Instructions
Provide clear instructions on how to use this skill.

## Examples
Include examples of how this skill should be applied.

## Additional Notes
Any other relevant information.`,
      instructions: 'This skill provides documentation and guidance. Use it to inform responses with specific knowledge or procedures.'
    }
  });
  form = form(this.model, (schema) => {
    required(schema.name);
    required(schema.displayName);
    required(schema.description);
    // Dynamic validation based on runtime type
    if (this.model().runtime.type === 'http') {
      if (schema.runtime.endpoint) {
        required(schema.runtime.endpoint);
      }
    }
    if (this.model().runtime.type === 'javascript') {
      if (schema.runtime.code) {
        required(schema.runtime.code);
      }
    }
    if (this.model().runtime.type === 'markdown') {
      if (schema.runtime.content) {
        required(schema.runtime.content);
      }
    }
  });

  // Runtime type options
  runtimeTypes = [
    { label: 'JavaScript', id: 'javascript' },
    { label: 'HTTP Request', id: 'http' },
    { label: 'Markdown Documentation', id: 'markdown' },
    { label: 'Built-in', id: 'builtin' }
  ];

  // HTTP method options
  httpMethods = [
    { label: 'GET', id: 'GET' },
    { label: 'POST', id: 'POST' },
    { label: 'PUT', id: 'PUT' },
    { label: 'DELETE', id: 'DELETE' }
  ];

  $destroy = new Subject<void>();

  ngOnInit(): void {
    const { id } = this.data;
    this.id.set(id);

    const req: Observable<any>[] = [];

    if (this.id()) {
      req.push(
        this.service.getById(this.id()!).pipe(
          tap((x) => {
            if (x) {
              // Ensure headers is properly formatted as string
              if (x.runtime.headers && typeof x.runtime.headers === 'object') {
                x.runtime.headers = JSON.stringify(x.runtime.headers, null, 2);
              } else if (!x.runtime.headers) {
                x.runtime.headers = JSON.stringify(
                  {
                    'Content-Type': 'application/json'
                  },
                  null,
                  2
                );
              }
              this.model.set(x);
            }
          })
        )
      );
    } else {
      // Set default headers for new skills
      this.model.update((current) => ({
        ...current,
        runtime: {
          ...current.runtime,
          headers: JSON.stringify(
            {
              'Content-Type': 'application/json'
            },
            null,
            2
          )
        }
      }));
    }

    if (req.length > 0) {
      this.formLoading.set(true);
      forkJoin(req)
        .pipe(finalize(() => this.formLoading.set(false)))
        .subscribe();
    }
  }

  onRuntimeTypeChange(type: string) {
    this.model.update((current) => ({
      ...current,
      runtime: {
        ...current.runtime,
        type: type as 'builtin' | 'http' | 'javascript'
      }
    }));
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  save(event?: Event) {
    event?.preventDefault();

    // 验证并解析 parameters JSON
    try {
      const parametersStr = this.model().schema.parameters;
      if (typeof parametersStr === 'string') {
        JSON.parse(parametersStr); // 验证 JSON 格式
      }
    } catch (error) {
      this.message.error(this.i18n.L('$skill.invalidParametersJson'));
      return;
    }

    // 验证 HTTP 配置
    if (this.model().runtime.type === 'http') {
      if (!this.model().runtime.endpoint?.trim()) {
        this.message.error(this.i18n.L('$skill.endpointRequired'));
        return;
      }

      // 验证 URL 格式
      try {
        new URL(this.model().runtime.endpoint!);
      } catch (error) {
        this.message.error(this.i18n.L('$skill.invalidEndpointUrl'));
        return;
      }

      // 验证 headers JSON 格式
      const headers = this.model().runtime.headers;
      if (headers && headers.trim()) {
        try {
          JSON.parse(headers);
        } catch (error) {
          this.message.error(this.i18n.L('$skill.invalidHeadersJson'));
          return;
        }
      }
    }

    // 验证 JavaScript 代码
    if (this.model().runtime.type === 'javascript') {
      const code = this.model().runtime.code;
      if (!code || !code.trim()) {
        this.message.error(this.i18n.L('$skill.codeRequired'));
        return;
      }
    }

    // 验证 Markdown 内容
    if (this.model().runtime.type === 'markdown') {
      const content = this.model().runtime.content;
      if (!content || !content.trim()) {
        this.message.error(this.i18n.L('$skill.contentRequired'));
        return;
      }
    }

    let rq!: Observable<number>;
    if (!this.id()) {
      rq = this.service.create(this.model());
    } else {
      rq = this.service.update(this.id()!, { ...this.model() });
    }
    this.saveLoading.set(true);
    rq.pipe(
      tap(() => {
        this.dialogRef.close();
        this.data.saveSuccess();
      }),
      finalize(() => {
        this.saveLoading.set(false);
      })
    ).subscribe();
  }

  delete() {
    this.messageBox.confirm({
      title: this.i18n.L('$skill.deleteSkill'),
      content: `${this.i18n.L('$skill.sureDeleteSkill')} [${this.form.name().value()}]`,
      type: 'warning',
      callback: (data: XMessageBoxAction) => {
        if (data !== 'confirm') return;
        this.service.delete(this.id()!).subscribe((x) => {
          this.dialogRef.close();
          this.data.saveSuccess();
        });
      }
    });
  }
}
