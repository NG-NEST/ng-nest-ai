import { ChangeDetectionStrategy, Component, inject, input, output, viewChild } from '@angular/core';
import { XBubbleModule, XBubblesComponent, XMessageService } from '@ng-nest/ui';
import { ChatMessage, PrismService } from '@ui/core';
import { micromark } from 'micromark';
import { from, fromEvent } from 'rxjs';

@Component({
  selector: 'app-bubbles',
  imports: [XBubbleModule],
  templateUrl: './bubbles.html',
  styleUrl: './bubbles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BubblesComponent {
  data = input.required<ChatMessage[]>();
  loading = input.required<boolean>();
  typingStart = output<void>();
  typingEnd = output<void>();
  prismService = inject(PrismService);
  message = inject(XMessageService);

  bubbles = viewChild.required<XBubblesComponent>('bubbles');

  render = (value: string) => {
    const html = micromark(value);
    return from(this.prismService.highlightCodeInHtml(html));
  };

  ngAfterViewInit() {
    this.addCopyButtonListeners();
  }

  private addCopyButtonListeners() {
    // 委托事件处理，处理所有复制按钮点击
    fromEvent(this.bubbles().elementRef.nativeElement as HTMLElement, 'click').subscribe((event: Event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('copy-button')) {
        const codeText = target.getAttribute('data-clipboard-text') || '';
        const decodedText = this.decodeHtmlEntitiesForCopy(codeText);

        this.prismService
          .copyToClipboard(decodedText)
          .then(() => {
            this.message.success('Copied to clipboard!');
          })
          .catch((err) => {
            console.error('Failed to copy text: ', err);
          });
      }
    });
  }

  private decodeHtmlEntitiesForCopy(text: string): string {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return textArea.value;
  }
}
