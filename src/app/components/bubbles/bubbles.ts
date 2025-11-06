import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { XBubbleModule } from '@ng-nest/ui';
import { ChatMessage } from '@ui/core';

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
}
