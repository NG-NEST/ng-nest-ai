import { ChangeDetectionStrategy, Component, inject, input, output, viewChild } from '@angular/core';
import { XBubbleModule, XBubblesComponent, XImageComponent, XMessageService } from '@ng-nest/ui';
import { ChatMessage, AppPrismService } from '@ui/core';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { from, fromEvent, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-bubbles',
  imports: [XBubbleModule, XImageComponent],
  templateUrl: './bubbles.html',
  styleUrl: './bubbles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BubblesComponent {
  data = input.required<ChatMessage[]>();
  loading = input.required<boolean>();
  typingStart = output<void>();
  typingEnd = output<void>();
  prismService = inject(AppPrismService);
  message = inject(XMessageService);

  $destroy = new Subject<void>();

  bubbles = viewChild.required<XBubblesComponent>('bubbles');

  render = (value: string) => {
    const html = micromark(value, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()]
    });
    return from(this.prismService.highlightCodeInHtml(html));
  };

  ngAfterViewInit() {
    this.addButtonListeners();
  }

  ngDestroy() {
    this.$destroy.next();
    this.$destroy.complete();
  }

  private addButtonListeners() {
    fromEvent(this.bubbles().elementRef.nativeElement as HTMLElement, 'click')
      .pipe(takeUntil(this.$destroy))
      .subscribe((event: Event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains('copy-text')) {
          this.copyToClipboard(target);
        } else if (target.classList.contains('preview-html')) {
          this.previewHtml(target);
        }
      });
  }

  private copyToClipboard(target: HTMLElement) {
    const codeText = target.getAttribute('data-copy-text') || '';
    const decodedText = this.decodeHtmlEntitiesForCopy(codeText);

    this.prismService
      .copyToClipboard(decodedText)
      .then(() => {
        this.message.success('复制成功!');
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  }
  private previewHtml(target: HTMLElement) {
    const codeText = target.getAttribute('data-preview-html') || '';
    const decodedText = this.decodeHtmlEntitiesForCopy(codeText);

    window.electronAPI.windowControls.previewHtml(decodedText);
  }

  private decodeHtmlEntitiesForCopy(text: string): string {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return textArea.value;
  }
}
