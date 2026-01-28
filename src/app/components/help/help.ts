import { Component, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XLoadingComponent,
  XMessageBoxService,
  XMessageService
} from '@ng-nest/ui';
import { AppPrismService, PromptService } from '@ui/core';
import { micromark } from 'micromark';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-help',
  imports: [XDialogModule, XButtonComponent, XLoadingComponent],
  templateUrl: './help.html',
  styleUrl: './help.scss'
})
export class HelpComponent {
  data = inject<{ title: string; content: string }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<HelpComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  prismService = inject(AppPrismService);
  dom = inject(DomSanitizer);
  service = inject(PromptService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  $destroy = new Subject<void>();

  title = signal('');
  content = signal<SafeHtml>('');

  ngOnInit(): void {
    const { content, title } = this.data;
    this.title.set(title);
    const html = micromark(content);
    this.prismService.highlightCodeInHtml(html).then((x) => {
      this.content.set(this.dom.bypassSecurityTrustHtml(x));
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  onContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && this.isExternalUrl(href)) {
        event.preventDefault();
        window.electronAPI.windowControls.openExternal(href);
      }
    }
  }

  private isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false; // 无效 URL 或相对路径
    }
  }
}
