import { DatePipe } from '@angular/common';
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
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  XAttachmentsComponent,
  XBubbleModule,
  XCollapseModule,
  XDialogService,
  XDropdownComponent,
  XDropdownNode,
  XFileCardComponent,
  XI18nPipe,
  XIconComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XResize,
  XResizeObserver,
  XScrollableComponent
} from '@ng-nest/ui';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XSenderComponent, XSenderStopComponent } from '@ng-nest/ui/sender';
import { BubblesComponent, RuleComponent, SessionComponent } from '@ui/components';
import {
  AppSendService,
  ChatMessage,
  ChatSendParams,
  MessageService,
  Project,
  ProjectService,
  Prompt,
  Session,
  SessionService
} from '@ui/core';
import { debounceTime, finalize, Subject, Subscription, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-project-home',
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
    XDropdownComponent,
    DatePipe,
    XScrollableComponent
  ],
  templateUrl: './project-home.html',
  styleUrl: './project-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectHome {
  router = inject(Router);
  dialogService = inject(XDialogService);
  cdr = inject(ChangeDetectorRef);
  messageBox = inject(XMessageBoxService);
  activatedRoute = inject(ActivatedRoute);
  projectService = inject(ProjectService);
  sessionService = inject(SessionService);
  messageService = inject(MessageService);
  sendService = inject(AppSendService);
  projectId = signal<number | null>(null);
  formBuilder = inject(FormBuilder);
  formGroup = this.formBuilder.group({
    content: ['', [Validators.required]],
    files: []
  });
  loading = signal(false);
  data = signal<ChatMessage[]>([]);
  projectDetail = signal<Project | null>(null);
  sendSubscription: Subscription | null = null;
  cancel?: () => void;
  $destroy = new Subject<void>();
  page = signal(1);
  size = signal(20);
  count = signal(0);
  sessions = signal<Session[]>([]);
  typing = signal(false);
  selectedPrompt = signal<Prompt | null>(null);
  activeModel = computed(() => this.sendService.activeModel());
  file = signal<{ name: string; size: number; url: string; type: string } | null>(null);
  formElementRef = viewChild.required<ElementRef<HTMLElement>>('formElementRef');
  scrollableMaxHeight = signal('calc(100vh - 8.125rem)');
  private resizeObserver!: XResizeObserver;

  constructor() {}
  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(({ projectId, sessionId }) => {
      this.projectId.set(Number(projectId));
      this.getData();

      if (sessionId) {
        this.loadSessionData(Number(sessionId));
      } else {
        this.data.set([]);
      }
    });
    this.projectService.updated.subscribe(({ id }) => {
      if (id === this.projectId()) {
        this.getData();
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

  ngOnDestory() {
    this.onStop();
    this.$destroy.next();
    this.$destroy.complete();
    this.resizeObserver?.disconnect();
  }

  loadSessionData(sessionId: number) {
    this.messageService.getBySessionId(sessionId).subscribe((x) => {
      this.data.set(x);
    });
  }

  getData() {
    this.projectService.getById(this.projectId()!).subscribe((x) => {
      this.projectDetail.set(x!);
    });
    this.sessionService.getProjectByPage(this.page(), this.size(), this.projectId()!).subscribe(({ data, count }) => {
      this.sessions.set(data);
      this.count.set(count);
    });
  }

  onSubmit() {
    const { content } = this.formGroup.getRawValue();
    if (!content) return;
    this.loading.set(true);

    const params: ChatSendParams = { content, data: this.data(), projectId: this.projectId()! };
    if (this.selectedPrompt() && this.data().length === 0) {
      params.prompt = this.selectedPrompt()!;
    }
    if (this.file() && this.isImageFile(this.file()?.type!)) {
      params.image = this.file()?.url;
    }
    if (this.file() && this.isVideoFile(this.file()?.type!)) {
      params.video = this.file()?.url;
    }

    this.formGroup.patchValue({ content: '' });
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

  operation(event: XDropdownNode, item: Session) {
    const { id } = event;
    if (id === 'rename') {
      this.dialogService.create(SessionComponent, {
        width: '30rem',
        data: {
          saveSuccess: (session: Session) => {
            Object.assign(item, session);
            this.cdr.markForCheck();
          },
          id: item.id
        }
      });
    } else if (id === 'delete') {
      this.messageBox.confirm({
        title: '删除聊天',
        content: `确认删除此聊天吗？ [${item.title}]`,
        type: 'warning',
        callback: (data: XMessageBoxAction) => {
          if (data !== 'confirm') return;
          this.sessionService.delete(item.id!).subscribe((x) => {
            this.getData();
          });
        }
      });
    }
  }

  itemClick(item: Session) {
    this.router.navigate(['/project-home'], { queryParams: { projectId: this.projectId(), sessionId: item.id } });
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
