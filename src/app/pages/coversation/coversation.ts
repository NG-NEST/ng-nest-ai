import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { XBubbleModule, XCollapseModule, XDialogService, XIconComponent } from '@ng-nest/ui';
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
  SessionService
} from '@ui/core';
import { Chat } from 'openai/resources';
import { finalize, Subject, Subscription } from 'rxjs';

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
    XIconComponent,
    BubblesComponent
  ],
  templateUrl: './coversation.html',
  styleUrl: './coversation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Coversation {
  loading = signal(false);
  message = inject(XMessageService);
  dialogService = inject(XDialogService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  activatedRoute = inject(ActivatedRoute);
  messageService = inject(MessageService);
  sessionService = inject(SessionService);
  promptService = inject(PromptService);
  openAIService = inject(AppOpenAIService);
  formBuilder = inject(FormBuilder);
  formGroup = this.formBuilder.group({
    content: ['', [Validators.required]]
  });
  sessionId = signal<number | null>(null);
  sendSubscription: Subscription | null = null;
  typing = signal(false);

  $destroy = new Subject<void>();

  data = signal<ChatMessage[]>([]);

  selectedPrompt = signal<Prompt | null>(null);

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
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
    this.onStop();
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
    this.formGroup.patchValue({ content: '' });
    this.formGroup.disable();

    const params: ChatSendParams = { content, data: this.data() };
    if (this.selectedPrompt() && this.data().length === 0) {
      params.prompt = this.selectedPrompt()!;
    }

    this.sendSubscription = this.openAIService
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
}
