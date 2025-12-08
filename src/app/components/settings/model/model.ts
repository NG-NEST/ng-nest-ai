import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XCheckboxComponent,
  XDialogModule,
  XDialogRef,
  XDialogService,
  XInputComponent,
  XInputGroupComponent,
  XLoadingComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XMessageService,
  XRadioComponent,
  XSelectComponent,
  XSwitchComponent,
  XTextareaComponent
} from '@ng-nest/ui';
import { EditorComponent } from '@ui/components';
import { Header, ModelService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';
import { HelpComponent } from '../../help/help';
import { XSliderComponent } from '@ng-nest/ui/slider';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-model',
  imports: [
    ReactiveFormsModule,
    XTextareaComponent,
    XInputComponent,
    XInputGroupComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XSwitchComponent,
    XRadioComponent,
    XSelectComponent,
    XCheckboxComponent,
    XSliderComponent,
    EditorComponent,
    NgTemplateOutlet
  ],
  templateUrl: './model.html',
  styleUrl: './model.scss'
})
export class ModelComponent {
  data = inject<{ id: number; manufacturerId: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<ModelComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  dialogService = inject(XDialogService);
  service = inject(ModelService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);
  sliderBase = signal(0);
  sliderHttp = signal(0);
  sliderFunction = signal(0);

  formLoading = signal(false);
  saveLoading = signal(false);

  form: FormGroup<any> = this.fb.group({
    manufacturerId: [0, [Validators.required]],
    name: ['', [Validators.required]],
    code: ['', [Validators.required]],
    description: [''],
    isActive: [false, [Validators.required]],
    usePrompt: [false, []],
    useUploadFile: [false, []],
    requestType: ['OpenAI', [Validators.required]],
    inputFunction: [''],
    outputFunction: [''],
    method: ['POST'],
    url: [],
    headers: this.fb.array([]),
    body: [],
    tags: []
  });

  get headers() {
    return this.form.get('headers') as FormArray;
  }

  $destroy = new Subject<void>();

  helpMap = new Map<string, { title: string; content: string }>([
    [
      'input',
      {
        title: '输入参数',
        content: `
### input 类型：
参考 openai 官方文档：[https://platform.openai.com/docs/api-reference/chat/create](https://platform.openai.com/docs/api-reference/chat/create)
\`\`\`json
{
  model: "gpt-5.1",
  messages: [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  stream: true,
}
\`\`\`
    `
      }
    ],
    [
      'output',
      {
        title: '输出参数',
        content: `
### output 类型：

参考 openai 官方文档：[https://platform.openai.com/docs/api-reference/chat/create](https://platform.openai.com/docs/api-reference/chat/create)

\`\`\`json
{
  "choices": [
    {
      "delta": {
        "content": "Wuhan"
      },
      "finish_reason": null,
      "index": 0,
      "logprobs": null
    }
  ],
  "object": "chat.completion.chunk",
  "usage": null,
  "created": 1764121984,
  "system_fingerprint": null,
  "model": "qwen3-vl-32b-thinking",
  "id": "chatcmpl-427c8957-be4a-4f54-8cf5-341043693949"
}
\`\`\`
    `
      }
    ],
    [
      'body',
      {
        title: 'Body（json）',
        content: `
### 内置变量

- \`\${apiKey}\`: 服务商中配置的密钥
- \`\${code}\`: 模型编码
- \`\${content}\`: 发送的内容
        `
      }
    ],
    [
      'http-input',
      {
        title: 'http-输入转换',
        content: `根据实际使用模型的输入参数进行转换`
      }
    ],
    [
      'http-output',
      {
        title: 'http-输出转换',
        content: `
output 类型是实际使用模型的输出结果，需要根据这个结果再转化为 OpenAI 模型的输出结果

比如：\`qwen-image-plus\` 的模型输出结果为：

\`\`\`json
{
    "output": {
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": [
                        {
                            "image": "https://dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com/xxx.png?Expires=xxxx"
                        }
                    ]
                }
            }
        ],
        "task_metric": {
            "TOTAL": 1,
            "FAILED": 0,
            "SUCCEEDED": 1
        }
    },
    "usage": {
        "width": 1328,
        "image_count": 1,
        "height": 1328
    },
    "request_id": "7a270c86-db58-9faf-b403-xxxxxx"
}
\`\`\`

需要把上面这个输出结果转化为 OpenAI 模型的输出结果：

\`\`\`json
{
  "choices": [
    {
      "delta": {
        "content": "Wuhan"
      },
      "finish_reason": null,
      "index": 0,
      "logprobs": null
    }
  ],
  "object": "chat.completion.chunk",
  "usage": null,
  "created": 1764121984,
  "system_fingerprint": null,
  "model": "qwen3-vl-32b-thinking",
  "id": "chatcmpl-427c8957-be4a-4f54-8cf5-341043693949"
}
\`\`\`
        `
      }
    ]
  ]);

  ngOnInit(): void {
    const { id, manufacturerId } = this.data;
    this.id.set(id);
    this.form.patchValue({ manufacturerId: manufacturerId });

    const req: Observable<any>[] = [];

    if (this.id()) {
      req.push(
        this.service.getById(this.id()!).pipe(
          tap((x) => {
            if (!x) return;
            if (x.headers) {
              for (let header of x.headers!) {
                this.add(header);
              }
            }

            this.form.patchValue(x!);
          })
        )
      );
    } else {
      const defaultHeaders = [
        { id: crypto.randomUUID(), enabled: true, key: 'Content-Type', value: 'application/json' },
        { id: crypto.randomUUID(), enabled: true, key: 'Authorization', value: 'Bearer ${apiKey}' }
      ];
      for (let header of defaultHeaders) {
        this.add(header);
      }
    }
    if (req.length > 0) {
      this.formLoading.set(true);
      forkJoin(req)
        .pipe(finalize(() => this.formLoading.set(false)))
        .subscribe();
    }
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  save() {
    let rq!: Observable<number>;
    if (!this.id()) {
      rq = this.service.create(this.form.value);
    } else {
      rq = this.service.update(this.id()!, { ...this.form.value });
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
      title: '删除模型',
      content: `确认删除此模型吗？ [${this.form.value.name}]`,
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

  onHelp(type: string) {
    if (!this.helpMap.has(type)) return;
    const { title, content } = this.helpMap.get(type)!;
    this.dialogService.create(HelpComponent, {
      width: '100%',
      height: '100%',
      data: {
        title,
        content
      }
    });
  }

  add(header?: Header) {
    this.headers.push(
      this.fb.group({
        id: [header?.id ?? crypto.randomUUID()],
        enabled: [header?.enabled ?? true],
        key: [header?.key ?? ''],
        value: [header?.value ?? ''],
        description: [header?.description ?? '']
      })
    );
  }

  remove(i: number) {
    this.headers.removeAt(i);
  }
}
