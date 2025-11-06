import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, model, output, signal } from '@angular/core';
import { XDropdownComponent, XDropdownNode } from '@ng-nest/ui/dropdown';
import { XIconComponent } from '@ng-nest/ui/icon';
import { XMessageBoxAction, XMessageBoxService } from '@ng-nest/ui/message-box';
import { Session, SessionService } from '@ui/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SessionComponent } from '../session/session';
import { XDialogService } from '@ng-nest/ui/dialog';
import { XRippleDirective } from '@ng-nest/ui';

@Component({
  selector: 'app-history',
  imports: [XIconComponent, XDropdownComponent, XRippleDirective],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class History {
  session = inject(SessionService);
  messageBox = inject(XMessageBoxService);
  dialogService = inject(XDialogService);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  data = signal<Session[]>([]);
  page = signal(1);
  size = signal(20);
  count = signal(0);
  toggle = signal(true);
  selectedItem = model<Session | null>(null);
  delete = output<number>();

  $destroy = new Subject<void>();

  ngOnInit() {
    this.getData();

    this.session.added.pipe(takeUntil(this.$destroy)).subscribe(() => this.getData());
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  getData() {
    this.session.getByPage(this.page(), this.size()).subscribe((result) => {
      this.data.set(result.data);
      this.count.set(result.count);
    });
  }

  onToggle() {
    this.toggle.update((x) => !x);
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
          this.session.delete(item.id!).subscribe((x) => {
            this.getData();

            this.delete.emit(item.id!);
          });
        }
      });
    }
  }

  itemClick(item: Session) {
    this.selectedItem.set(item);
    this.router.navigate(['/coversation'], { queryParams: { sessionId: item.id } });
  }
}
