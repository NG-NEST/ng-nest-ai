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
  XMessageService
} from '@ng-nest/ui';
import { EditorComponent } from '@ui/components';
import { Skill, SkillService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

import { form, FormField, required } from '@angular/forms/signals';

@Component({
  selector: 'app-skill',
  imports: [XInputComponent, XDialogModule, XButtonComponent, XLoadingComponent, XI18nPipe, EditorComponent, FormField],
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
execute;`
    }
  });
  form = form(this.model, (schema) => {
    required(schema.name);
    required(schema.displayName);
    required(schema.description);
  });

  $destroy = new Subject<void>();

  ngOnInit(): void {
    const { id } = this.data;
    this.id.set(id);

    const req: Observable<any>[] = [];

    if (this.id()) {
      req.push(
        this.service.getById(this.id()!).pipe(
          tap((x) => {
            this.model.set(x!);
          })
        )
      );
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
