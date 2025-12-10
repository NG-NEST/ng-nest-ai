import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { X_DIALOG_DATA, XButtonComponent, XDialogModule, XDialogRef, XDialogService } from '@ng-nest/ui';
import { Subject } from 'rxjs';
import { EditorComponent } from '../editor/editor';
import { HelpComponent } from '../help/help';

@Component({
  selector: 'app-value-function',
  imports: [ReactiveFormsModule, XDialogModule, XButtonComponent, EditorComponent],
  templateUrl: './value-function.html',
  styleUrl: './value-function.scss'
})
export class ValueFunction {
  dialogRef = inject(XDialogRef<ValueFunction>);
  dialogService = inject(XDialogService);
  data = inject<{ title: string; content: string; helpContent: string; save: (content: string) => void }>(
    X_DIALOG_DATA
  );
  formBuilder = inject(FormBuilder);
  form = this.formBuilder.group({
    content: ['', [Validators.required]]
  });

  title = signal<string>('');
  helpContent = signal<string>(``);

  $destroy = new Subject<void>();

  constructor() {
    this.title.set(this.data.title);
    this.helpContent.set(this.data.helpContent);
    this.form.patchValue({ content: this.data.content });
  }

  ngAfterViewInit() {}

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  onHelp() {
    this.dialogService.create(HelpComponent, {
      width: '100%',
      height: '100%',
      data: {
        title: this.title(),
        content: this.helpContent()
      }
    });
  }

  onSubmit() {
    const { save } = this.data;
    save && save(this.form.getRawValue().content!);
    this.dialogRef.close();
  }
}
