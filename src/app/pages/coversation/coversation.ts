import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { XBubbleModule, XCollapseModule } from '@ng-nest/ui';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XMessageService } from '@ng-nest/ui/message';
import { XSenderComponent, XSenderStopComponent } from '@ng-nest/ui/sender';
import { BubblesComponent } from '@ui/components';
import { MessageService, AppOpenAIService, ChatMessage } from '@ui/core';
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
    BubblesComponent
  ],
  templateUrl: './coversation.html',
  styleUrl: './coversation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Coversation {
  loading = signal(false);
  message = inject(XMessageService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  activatedRoute = inject(ActivatedRoute);
  messageService = inject(MessageService);
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

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(({ sessionId }) => {
      if (sessionId) {
        sessionId = Number(sessionId);
        if (!isNaN(sessionId)) {
          this.sessionId.set(sessionId);
          this.loadSessionData(sessionId);
        }
      } else {
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
    this.messageService.getBySessionId(sessionId).subscribe((x) => {
      this.data.set(x);
    });
  }

  reload() {
    this.formGroup.patchValue({ content: '' });
    this.data.set([]);
    this.sessionId.set(null);
    this.onStop();
  }

  onSubmit() {
    const { content } = this.formGroup.getRawValue();
    if (!content) return;
    this.loading.set(true);
    this.formGroup.patchValue({ content: '' });
    this.formGroup.disable();

    this.sendSubscription = this.openAIService
      .send(content, this.data())
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
}
