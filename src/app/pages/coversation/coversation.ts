import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormBuilder, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  XAttachmentsComponent,
  XBubbleModule,
  XCollapseModule,
  XDialogService,
  XFileCardComponent,
  XI18nPipe,
  XIconComponent,
  XResize,
  XResizeObserver,
  XScrollableComponent
} from '@ng-nest/ui';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XMessageService } from '@ng-nest/ui/message';
import { XSenderComponent, XSenderStopComponent } from '@ng-nest/ui/sender';
import { BubblesComponent, RuleComponent } from '@ui/components';
import {
  MessageService,
  AppOpenAIService,
  ChatMessage,
  Prompt,
  ChatSendParams,
  PromptService,
  SessionService,
  AppSendService,
  AppConfigService
} from '@ui/core';
import { debounceTime, finalize, Subject, Subscription, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-coversation',
  imports: [
    FormsModule,
    XSenderComponent,
    XButtonComponent,
    XSenderStopComponent,
    ReactiveFormsModule,
    XBubbleModule,
    XCollapseModule,
    BubblesComponent,
    XAttachmentsComponent,
    XFileCardComponent,
    XIconComponent,
    XI18nPipe,
    XScrollableComponent
  ],
  templateUrl: './coversation.html',
  styleUrl: './coversation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Coversation {
  loading = signal(false);
  config = inject(AppConfigService);
  message = inject(XMessageService);
  dialogService = inject(XDialogService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  activatedRoute = inject(ActivatedRoute);
  messageService = inject(MessageService);
  sessionService = inject(SessionService);
  promptService = inject(PromptService);
  openAIService = inject(AppOpenAIService);
  sendService = inject(AppSendService);
  formBuilder = inject(FormBuilder);
  formGroup = this.formBuilder.group({
    content: ['', [Validators.required]],
    files: []
  });
  sessionId = signal<number | null>(null);
  sendSubscription: Subscription | null = null;
  cancel?: () => void;
  typing = signal(false);
  $destroy = new Subject<void>();
  data = signal<ChatMessage[]>([]);
  selectedPrompt = signal<Prompt | null>(null);
  activeModel = computed(() => this.sendService.activeModel());
  file = signal<{ name: string; size: number; url: string; type: string } | null>(null);
  formElementRef = viewChild.required<ElementRef<HTMLElement>>('formElementRef');
  scrollableMaxHeight = signal('calc(100vh - 8.125rem)');
  private resizeObserver!: XResizeObserver;

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(({ sessionId, time }) => {
      if (sessionId) {
        sessionId = Number(sessionId);
        if (!isNaN(sessionId)) {
          this.sessionId.set(sessionId);
          this.loadSessionData(sessionId);
        }
      } else if (time) {
        this.reload();
      }
    });
    this.formGroup.controls.files.valueChanges.subscribe(async (files: any) => {
      if (!files) {
        this.file.set(null);
        return;
      }

      const file = files[0];

      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader!.result as string).split(',')[1]); // 去掉data:*/*;base64,前缀
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const bucketName = 'ng-nest-ai';
      const objectName = `${crypto.randomUUID()}/${file.name}`;

      const result = await window.electronAPI.minio.uploadFile('ng-nest-ai', objectName, fileData, file.type);

      if (result) {
        this.file.set({
          name: file.name,
          url: `https://cos.ngnest.com/${bucketName}/${objectName}`,
          size: file.size,
          type: file.type
        });
      }
    });
    XResize(this.formElementRef().nativeElement)
      .pipe(
        debounceTime(10),
        tap(({ resizeObserver }) => {
          this.resizeObserver = resizeObserver;
          this.scrollableMaxHeight.set(`calc(100vh - 2.25rem - ${this.formElementRef().nativeElement.clientHeight}px)`);
        }),
        takeUntil(this.$destroy)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.onStop();
    this.$destroy.next();
    this.$destroy.complete();
    this.resizeObserver?.disconnect();
  }

  loadSessionData(sessionId: number) {
    this.sessionService.getById(sessionId).subscribe((x) => {
      if (!x) return;
      if (!x.promptId) {
        this.selectedPrompt.set(null);
      } else {
        this.promptService.getById(x.promptId!).subscribe((y) => {
          this.selectedPrompt.set(y!);
        });
      }
    });
    this.messageService.getBySessionId(sessionId).subscribe((x) => {
      this.data.set(x);
    });
  }

  reload() {
    this.formGroup.patchValue({ content: '' });
    this.data.set([]);
    this.sessionId.set(null);
    this.selectedPrompt.set(null);
    this.onStop();
  }

  onSubmit() {
    const { content } = this.formGroup.getRawValue();
    if (!content) return;
    this.loading.set(true);

    const params: ChatSendParams = { content, data: this.data() };
    if (this.selectedPrompt() && this.data().length === 0) {
      params.prompt = this.selectedPrompt()!;
    }
    if (this.file() && this.isImageFile(this.file()?.type!)) {
      params.image = this.file()?.url;
    }
    if (this.file() && this.isVideoFile(this.file()?.type!)) {
      params.video = this.file()?.url;
    }

    this.formGroup.patchValue({ content: '', files: null });
    this.formGroup.disable();

    this.sendSubscription = this.sendService
      .send(params)
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.formGroup.enable();
        })
      )
      .subscribe((x: any) => {
        if (x?.start && this.loading()) {
          this.loading.set(false);
        }
        if (x?.cancel) {
          this.cancel = x.cancel;
        }
        this.data.update((items) => [...items]);
      });
  }

  onStop() {
    this.sendSubscription?.unsubscribe();
    this.cancel && this.cancel();
    this.formGroup.enable();
    this.loading.set(false);
    if (this.typing()) {
      this.data.update((items) => {
        items.forEach((x) => (x.typing = false));
        return [...items];
      });
      this.typing.set(false);
    }
  }

  onTool() {
    this.dialogService.create(RuleComponent, {
      className: 'app-no-padding-dialog',
      width: '40rem',
      data: {
        promptId: this.selectedPrompt()?.id,
        disabled: this.data().length > 0,
        save: (prompt: Prompt) => {
          this.selectedPrompt.set(prompt);
        }
      }
    });
  }

  isImageFile(fileType: string): boolean {
    const imageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff'
    ];

    return imageTypes.includes(fileType.toLowerCase());
  }

  isVideoFile(fileType: string): boolean {
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];

    return videoTypes.includes(fileType.toLowerCase());
  }
}
