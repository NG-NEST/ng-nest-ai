import { Component, inject, signal } from '@angular/core';
import { X_DIALOG_DATA, XButtonComponent, XDialogModule, XDialogRef, XDialogService } from '@ng-nest/ui';
import { Subject } from 'rxjs';
import { EditorComponent } from '../editor/editor';
import { HelpComponent } from '../help/help';
import { form, required, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-value-function',
  imports: [XDialogModule, XButtonComponent, EditorComponent, FormField],
  templateUrl: './value-function.html',
  styleUrl: './value-function.scss'
})
export class ValueFunction {
  dialogRef = inject(XDialogRef<ValueFunction>);
  dialogService = inject(XDialogService);
  data = inject<{ title: string; content: string; helpContent: string; save: (content: string) => void }>(
    X_DIALOG_DATA
  );
  model = signal({
    content: ''
  });
  form = form(this.model, (schema) => {
    required(schema.content);
  });

  title = signal<string>('');
  helpContent = signal<string>(``);

  $destroy = new Subject<void>();

  constructor() {
    this.title.set(this.data.title);
    this.helpContent.set(this.data.helpContent);
    this.form.content().value.set(this.data.content);
  }

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

  onSubmit(event: Event) {
    event.preventDefault();
    const { save } = this.data;
    save && save(this.form.content().value()!);
    this.dialogRef.close();
  }
}
