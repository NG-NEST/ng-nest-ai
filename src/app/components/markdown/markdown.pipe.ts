import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { micromark } from 'micromark';

@Pipe({
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    try {
      const html = micromark(value);
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (error) {
      console.error('Error processing markdown:', error);
      return this.sanitizer.bypassSecurityTrustHtml(
        `<pre>Error processing markdown: ${error instanceof Error ? error.message : 'Unknown error'}</pre>`
      );
    }
  }
}
