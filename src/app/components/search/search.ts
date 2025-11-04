import { DatePipe } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  XLoadingComponent
} from '@ng-nest/ui';
import { SessionService } from '@ui/core';
import { debounceTime, distinctUntilChanged, fromEvent, map, Subject, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-search',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XInputComponent,
    XLoadingComponent,
    XEmptyComponent,
    XListComponent,
    XKeywordDirective,
    DatePipe
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class Search {
  session = inject(SessionService);
  dialogRef = inject(XDialogRef<Search>);
  input = viewChild.required(XInputComponent);
  formBuilder = inject(FormBuilder);
  router = inject(Router);
  form = this.formBuilder.group({
    title: ['', [Validators.required]]
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
          let value = this.form.controls.title.value;
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
