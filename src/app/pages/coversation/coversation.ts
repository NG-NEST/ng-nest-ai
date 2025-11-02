import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { XBubbleModule, XOrderBy, XSelectNode, XCollapseModule } from '@ng-nest/ui';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XDialogService } from '@ng-nest/ui/dialog';
import { XMessageService } from '@ng-nest/ui/message';
import { XSelectComponent } from '@ng-nest/ui/select';
import { XSenderComponent, XSenderStopComponent } from '@ng-nest/ui/sender';
import { ManufacturerService, Message, MessageService, ModelService, SessionService } from '@ui/core';
import { micromark } from 'micromark';
import { filter, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-coversation',
  imports: [
    FormsModule,
    XSenderComponent,
    XButtonComponent,
    XSenderStopComponent,
    XSelectComponent,
    ReactiveFormsModule,
    XBubbleModule,
    XCollapseModule
  ],
  templateUrl: './coversation.html',
  styleUrl: './coversation.scss'
})
export class Coversation {
  loading = signal(false);
  disabled = signal(false);
  message = inject(XMessageService);
  router = inject(Router);
  dialogService = inject(XDialogService);
  modelService = inject(ModelService);
  manufacturerService = inject(ManufacturerService);
  sessionService = inject(SessionService);
  messageService = inject(MessageService);
  formBuilder = inject(FormBuilder);
  formGroup = this.formBuilder.group({
    manufacturerId: [null, [Validators.required]],
    modelId: [null, [Validators.required]],
    content: ['', [Validators.required]]
  });
  manufacturerList = signal<XSelectNode[]>([]);
  modelList = signal<XSelectNode[]>([]);
  modelCode = signal('');
  sessionId = signal<number | null>(null);

  $destroy = new Subject<void>();

  data = signal<{ role: string; content: string; detail?: string; typing?: boolean }[]>([]);

  render = (value: string) => micromark(value);

  ngOnInit() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.$destroy)
      )
      .subscribe((x) => {
        const { url } = x;
        if (url === '/coversation') {
          this.reload();
        }
      });

    this.getRelationData();
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  reload() {
    this.formGroup.patchValue({ content: '' });
    this.data.set([]);
    this.sessionId.set(null);
  }

  getRelationData() {
    this.formGroup.controls.manufacturerId.valueChanges.subscribe((x: number | null) => {
      this.getModelList(x!);
    });
    this.manufacturerService.getAll().subscribe((x) => {
      const list = x.map((y) => ({
        id: y.id,
        label: y.name,
        baseURL: y.baseURL,
        apiKey: y.apiKey,
        isActive: y.isActive
      }));
      this.manufacturerList.set(XOrderBy(list, ['isActive'], ['desc']));
      if (this.manufacturerList().length > 0) {
        const first = this.manufacturerList()[0];
        const { baseURL, apiKey, id } = first as any;
        this.formGroup.patchValue({ manufacturerId: id });
        window.electronAPI.openAI.initialize({ baseURL, apiKey });
      }
    });
  }

  getModelList(manufacturerId: number) {
    if (!manufacturerId) {
      return;
    }
    this.modelService.getListByManufacturerId(manufacturerId).subscribe((x) => {
      const list = x.map((y) => ({ id: y.id, label: y.name, code: y.code, isActive: y.isActive }));
      this.modelList.set(XOrderBy(list, ['isActive'], ['desc']));
      if (this.modelList().length > 0) {
        const first = this.modelList()[0];
        const { code, id } = first as any;
        this.formGroup.patchValue({ modelId: id });
        this.modelCode.set(code);
      }
    });
  }

  onSubmit() {
    this.loading.set(true);
    const { content, manufacturerId, modelId } = this.formGroup.getRawValue();
    this.formGroup.patchValue({ content: '' });
    this.data.update((items) => {
      items.push({
        role: 'user',
        content: content!,
        typing: false
      });
      return items;
    });

    // 如果是第一条消息，创建会话
    if (this.sessionId() === null) {
      this.sessionService.create({ title: content!.substring(0, 50) }).subscribe((id) => {
        this.sessionId.set(id);
        // 保存用户消息到数据库
        this.saveUserMessage(id, content!, manufacturerId!, modelId!);
      });
    } else {
      // 保存用户消息到数据库
      this.saveUserMessage(this.sessionId()!, content!, manufacturerId!, modelId!);
    }

    // 构建对话历史记录
    const messages = this.data()
      .filter((x) => x.role !== 'error')
      .map((item) => ({
        role: item.role,
        content: item.content
      }));

    // 用于累积AI回复的内容
    let aiContent = '';
    let aiMessageId: number | null = null; // 用于跟踪AI消息ID

    window.electronAPI.openAI.chatCompletionStream(
      { model: this.modelCode(), messages },
      (data: any) => {
        if (data.choices && data.choices.length > 0) {
          const delta = data.choices[0].delta;
          if (delta && delta.content) {
            aiContent += delta.content;

            this.data.update((items) => {
              const lastItemIndex = items.length - 1;
              if (lastItemIndex >= 0 && items[lastItemIndex].role === 'assistant') {
                items[lastItemIndex].content = aiContent;
              } else {
                items.push({
                  role: 'assistant',
                  content: aiContent,
                  typing: true
                });
              }
              return [...items];
            });
          }
        }
      },
      () => {
        // 完成回调 - 保存AI回复到数据库
        if (this.sessionId() !== null) {
          const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
            sessionId: this.sessionId()!,
            manufacturerId: manufacturerId!,
            modelId: modelId!,
            role: 'assistant',
            content: aiContent
          };

          this.messageService.create(aiMessage).subscribe((id) => {
            console.log('AI消息已保存，ID:', id);
          });
        }
        this.data.update((items) => {
          // 完成打字效果
          const lastItemIndex = items.length - 1;
          if (lastItemIndex >= 0 && items[lastItemIndex].role === 'assistant') {
            items[lastItemIndex] = {
              ...items[lastItemIndex],
              typing: false
            };
          }
          return [...items];
        });
        this.loading.set(false);
      },
      (error: any) => {
        this.data.update((items) => {
          items.push({
            role: 'error',
            content: `服务端异常！ ${error}`,
            typing: false
          });
          return items;
        });
        this.loading.set(false);
      }
    );
  }

  // 保存用户消息到数据库
  private saveUserMessage(sessionId: number, content: string, manufacturerId: number, modelId: number) {
    const userMessage: Omit<Message, 'id' | 'createdAt'> = {
      sessionId: sessionId,
      manufacturerId: manufacturerId,
      modelId: modelId,
      role: 'user',
      content: content
    };

    this.messageService.create(userMessage).subscribe((id) => {
      console.log('用户消息已保存，ID:', id);
    });
  }
}
