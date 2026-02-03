import { DatePipe } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import {
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XEmptyComponent,
  XIconComponent,
  XInputComponent,
  XKeywordDirective,
  XListComponent,
  XListNode,
  XLoadingComponent,
  XI18nPipe
} from '@ng-nest/ui';
import { SessionService } from '@ui/core';
import { debounceTime, distinctUntilChanged, fromEvent, map, of, Subject, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-more',
  imports: [
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XInputComponent,
    XLoadingComponent,
    XEmptyComponent,
    XListComponent,
    XKeywordDirective,
    XI18nPipe,
    DatePipe,
    FormField
  ],
  templateUrl: './more.html',
  styleUrl: './more.scss'
})
export class More {
  session = inject(SessionService);
  dialogRef = inject(XDialogRef<More>);
  input = viewChild.required(XInputComponent);
  router = inject(Router);
  model = signal({
    title: ''
  });
  form = form(this.model, (schema) => {
    required(schema.title);
  });
  loading = signal(false);
  data = signal<XListNode[]>([]);
  allData = signal<XListNode[]>([]);
  keywordText = signal('');

  $destroy = new Subject<void>();

  ngOnInit() {
    this.getData();
  }

  ngAfterViewInit() {
    this.input().inputFocus();

    const inputElement = this.input().inputRef().nativeElement;
    fromEvent<KeyboardEvent>(inputElement, 'keydown')
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((_event: KeyboardEvent) => {
          let value = this.form.title().value();
          if (value && value.trim().length > 0) {
            value = value.trim();
            this.loading.set(true);
            this.keywordText.set(value);
            return this.session.getListByTitle(value).pipe(
              map((x) => {
                return x.map((y) => ({
                  ...y,
                  label: y.title
                }));
              }),
              tap(() => {
                this.loading.set(false);
              })
            );
          } else {
            this.keywordText.set('');
            return of(this.allData());
          }
        }),
        takeUntil(this.$destroy)
      )
      .subscribe((x) => {
        this.data.set(x);
      });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  getData() {
    this.session.getAll().subscribe((x) => {
      this.data.set(
        x.map((y) => ({
          ...y,
          label: y.title
        }))
      );
      this.allData.set(this.data());
    });
  }

  nodeClick(node: XListNode) {
    this.router.navigate(['/coversation'], { queryParams: { sessionId: node.id } }).then(() => {
      this.dialogRef.close();
    });
  }
}
