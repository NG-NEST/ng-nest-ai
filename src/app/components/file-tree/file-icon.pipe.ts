import { Pipe, PipeTransform } from '@angular/core';
import { IconConfig } from '../../icon.config';

@Pipe({
  name: 'appFileIcon'
})
export class AppFileIconPipe implements PipeTransform {
  transform(value: string): any {
    const filename = value;
    if (filename.indexOf('.') >= 0) {
      const ext = filename.split('.').pop()?.toLocaleLowerCase();
      if (ext && Object.keys(IconConfig).includes(ext)) {
        return `icon:${ext}`;
      }
      return `icon:file-d`;
    }
    return `icon:file-d`;
  }
}
