import { DatePipe } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import {
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XEmptyComponent,
  XI18nPipe,
  XIconComponent,
  XInputComponent,
  XKeywordDirective,
  XListComponent,
  XListNode,
  XLoadingComponent
} from '@ng-nest/ui';
import { SessionService } from '@ui/core';
import { debounceTime, distinctUntilChanged, fromEvent, map, Subject, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-search',
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
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class Search {
  session = inject(SessionService);
  dialogRef = inject(XDialogRef<Search>);
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
  keywordText = signal('');

  $destroy = new Subject<void>();

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
          }

          return [];
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

  nodeClick(node: XListNode) {
    this.router.navigate(['/coversation'], { queryParams: { sessionId: node.id } }).then(() => {
      this.dialogRef.close();
    });
  }
}
