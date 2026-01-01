import { Directive, ElementRef, Renderer2, OnInit, OnDestroy, Input, input } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';

@Directive({
  selector: '[appDragResize]'
})
export class DragResizeDirective implements OnInit, OnDestroy {
  min = input(200);
  max = input(800);

  private subscription: Subscription | null = null;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.renderer.listen(this.el.nativeElement, 'mousedown', this.onMouseDown.bind(this));
  }

  onMouseDown(event: MouseEvent) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = this.el.nativeElement.previousElementSibling.offsetWidth;

    this.subscription = fromEvent(document, 'mousemove').subscribe((moveEvent: any) => {
      const width = startWidth + moveEvent.clientX - startX;

      if (width >= this.min() && width <= this.max()) {
        this.renderer.setStyle(this.el.nativeElement.previousElementSibling, 'width', `${width}px`);
      }
    });

    fromEvent(document, 'mouseup').subscribe(() => {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = null;
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
