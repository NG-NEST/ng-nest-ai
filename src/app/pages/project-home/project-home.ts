import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  XDialogService,
  XDropdownComponent,
  XDropdownNode,
  XIconComponent,
  XMessageBoxAction,
  XMessageBoxService
} from '@ng-nest/ui';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XSenderComponent, XSenderStopComponent } from '@ng-nest/ui/sender';
import { BubblesComponent, SessionComponent } from '@ui/components';
import {
  AppOpenAIService,
  ChatMessage,
  MessageService,
  Project,
  ProjectService,
  Session,
  SessionService
} from '@ui/core';
import { finalize, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-project-home',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    BubblesComponent,
    XIconComponent,
    XSenderComponent,
    XButtonComponent,
    XSenderStopComponent,
    DatePipe,
    XDropdownComponent
  ],
  templateUrl: './project-home.html',
  styleUrl: './project-home.scss'
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
  openAIService = inject(AppOpenAIService);
  projectId = signal<number | null>(null);
  formBuilder = inject(FormBuilder);
  formGroup = this.formBuilder.group({
    content: ['', [Validators.required]]
  });
  loading = signal(false);
  data = signal<ChatMessage[]>([]);
  projectDetail = signal<Project | null>(null);
  sendSubscription: Subscription | null = null;
  $destroy = new Subject<void>();
  page = signal(1);
  size = signal(20);
  count = signal(0);
  sessions = signal<Session[]>([]);
  typing = signal(false);

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
  }

  ngOnDestory() {
    this.$destroy.next();
    this.$destroy.complete();
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
    this.formGroup.patchValue({ content: '' });
    this.formGroup.disable();

    this.sendSubscription = this.openAIService
      .send({ content, data: this.data(), projectId: this.projectId()! })
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
        this.data.update((items) => [...items]);
      });
  }

  onStop() {
    this.sendSubscription?.unsubscribe();
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
}
