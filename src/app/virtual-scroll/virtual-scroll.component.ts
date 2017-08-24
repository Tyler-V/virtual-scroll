import {
  Component,
  ViewChild, ElementRef,
  Input, Output, EventEmitter,
  OnChanges, OnDestroy, OnInit,
  Renderer2,
  SimpleChanges,
  HostBinding,
  HostListener,
  NgZone
} from '@angular/core';

/**
* <virtual-scroll> is a component that will display the minimum amount of rows in a vertical list
* using transclusion to display a large dataset in the most efficient manner possible.
* 
* Required:
* 1. @Input() size: number - The amount of items in the array
* 2. @Input() rowHeight: number - The minimum height of the row for displaying purposes
* 3. You must specify a unique view child id (i.e. #vs) on the <virtual-scroll>
* 
* The rest is handled by the <virtual-scroll> component, it will apply the overflow properties and calculate
* the height of the host container and fire an update event that will be consumed transclused (?) component
* to splice the original array and display the current viewport.
*/

@Component({
  selector: 'virtual-scroll',
  templateUrl: './virtual-scroll.component.html',
  styleUrls: ['./virtual-scroll.component.css'],
  host: { 'class': 'virtual-scroll' }
})

export class VirtualScrollComponent implements OnInit {

  /** Required */
  @Input() size: number;
  @Input() rowHeight: number;

  /** Options */
  @Input() virtualPadding: number = 3; // How many additional virtual items should be padded to the top/bottom for visual/UI purposes
  @Input() draggable: string = 'drag'; // The class name of the layer that you want to become draggable on touch
  @Input() dragBorder: boolean = false; // Styled by '.vs-drag-border' class
  @Input() dragInsideContainer: boolean = true; // Restricts transit layer to remain inside the container
  @Input() verticalDrag: boolean = true; // Allows dragging the transit layer vertically
  @Input() horizontalDrag: boolean = false; // Allows dragging the transit layer horizontally

  @Output() onUpdate: EventEmitter<Index> = new EventEmitter<Index>();
  @Output() dragStart: EventEmitter<Index> = new EventEmitter<Index>();
  @Output() dragging: EventEmitter<Index> = new EventEmitter<Index>();
  @Output() dragEnd: EventEmitter<Index> = new EventEmitter<Index>();

  @ViewChild('transit') transit: ElementRef;
  @ViewChild('scroll') scrollElementRef: ElementRef;
  @ViewChild('content') contentElementRef: ElementRef;

  @HostBinding('class.dragging') isDragging: boolean = false;

  private lastTouch: any;
  private originalElement: any;
  private dragElement: Node;
  private scrollContainerWidth: number;
  private scrollContainerHeight: number;
  private scrollContainerTop: number;
  private scrollContainerBottom: number;
  private scrollContainerLeft: number;
  private scrollContainerRight: number;
  private reorderIndex: Index;
  private cssText: string;
  private initialOffsetX: number;
  private initialOffsetY: number;

  private scrollbarWidth: number = 0;
  private scrollbarHeight: number = 0;

  private onScrollListener: Function;
  private onDragStartListener: Function;

  private onDraggingListener: Function;
  private onDragEndListener: Function;
  private onDragCancelListener: Function;

  private onStart: boolean = true;
  private previousStart: number;
  private previousEnd: number;
  private currentStart: number;
  private scrollInterval: any;
  private dragBorderElement: any;

  public scrollHeight: number;
  public topPadding: number;
  public displayedItems: number;
  public index: Index;

  constructor(private elementRef: ElementRef, private renderer2: Renderer2, private ngZone: NgZone) { }

  ngOnInit() {
      this.onScrollListener = this.renderer2.listen(this.elementRef.nativeElement, 'scroll', this.refresh.bind(this));
      this.onDragStartListener = this.renderer2.listen(this.contentElementRef.nativeElement, 'touchstart', (e) => this.onDragStart(e));
  }

  ngOnChanges(changes: SimpleChanges) {
      this.previousStart = undefined;
      this.previousEnd = undefined;
      this.refresh();
  }

  ngOnDestroy() {
      this.onScrollListener();
      this.onDragStartListener();
      this.removeTouchListeners();
  }

  @HostListener('mousedown', ['$event'])
  private onDragStart(e: TouchEvent | MouseEvent) {
      let target: any = e.target;
      if (target == null) return;
      if (target.className.indexOf(this.draggable) == -1) return;

      this.lastTouch = this.getPoint(e);
      this.isDragging = true;

      this.scrollContainerWidth = Math.round(this.elementRef.nativeElement.clientWidth);
      this.scrollContainerHeight = Math.round(this.elementRef.nativeElement.clientHeight);
      this.scrollContainerTop = Math.round($(this.elementRef.nativeElement).offset().top);
      this.scrollContainerBottom = Math.round(this.scrollContainerTop + this.scrollContainerHeight);
      this.scrollContainerLeft = Math.round($(this.elementRef.nativeElement).offset().left);
      this.scrollContainerRight = Math.round(this.scrollContainerLeft + this.scrollContainerWidth);

      this.originalElement = target;
      while (!this.dragElement) {
          if (this.originalElement.parentElement == this.contentElementRef.nativeElement) {
              this.dragElement = this.originalElement.cloneNode(true);
              break;
          }
          this.originalElement = this.originalElement.parentElement;
      }
      this.cssText = this.originalElement.style.cssText;

      this.renderer2.addClass(this.originalElement, "vs-drag-source");
      this.renderer2.setStyle(this.originalElement, "box-shadow", "inset 0 20px 10px -20px rgba(0,0,0,0.8)");
      this.renderer2.setStyle(this.originalElement, "background-color", "#D7D7D7");

      this.renderer2.addClass(this.dragElement, "vs-drag-transit");
      this.renderer2.setStyle(this.dragElement, "position", "absolute");
      this.renderer2.setStyle(this.dragElement, "opacity", "0.9");
      this.renderer2.setStyle(this.dragElement, "width", "inherit");
      this.renderer2.setStyle(this.dragElement, "box-shadow", "0px 7px 7px -4px rgba(0, 0, 0, 0.5)");
      this.transit.nativeElement.appendChild(this.dragElement);

      if (this.dragBorder) {
          let el = this.renderer2.createElement("div");
          this.renderer2.addClass(el, "vs-drag-border");
          this.renderer2.setStyle(el, "visibility", "hidden");
          this.renderer2.setStyle(el, "position", "absolute");
          this.renderer2.setStyle(el, "width", "inherit");
          this.renderer2.setStyle(el, "border-top", "2px solid red");
          this.dragBorderElement = this.transit.nativeElement.appendChild(el);
      }

      this.initialOffsetX = this.lastTouch.clientX - $(this.originalElement).offset().left;
      this.initialOffsetY = this.lastTouch.clientY - $(this.originalElement).offset().top;

      this.drag();

      this.reorderIndex = {
          start: Array.from(this.contentElementRef.nativeElement.children).indexOf(this.originalElement) + this.index.start
      };
      this.dragStart.emit(this.reorderIndex);

      this.removeTouchListeners();
      this.onDraggingListener = this.renderer2.listen(e.target, 'touchmove', (e) => { this.onDragMove(e); });
      this.onDragEndListener = this.renderer2.listen(e.target, 'touchend', (e) => { this.onDragEnd(e); });
      this.onDragCancelListener = this.renderer2.listen(e.target, 'touchcancel', (e) => { this.onDragEnd(e); });
  }

  @HostListener('document:mousemove', ['$event'])
  private onDragMove(e: TouchEvent | MouseEvent) {
      if (!this.isDragging) return;
      let point = this.getPoint(e);
      if (this.lastTouch == point) return;

      if (this.scrollInterval)
          this.clearInterval(this.scrollInterval);

      this.lastTouch = this.getPoint(e);
      this.dragging.emit(this.reorderIndex);
      this.getDropIndex(this.lastTouch);

      this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(this.drag.bind(this));
      });

      let direction = this.getScrollDirection(this.lastTouch);
      if (direction != null) {
          this.scrollInterval = this.requestInterval(() => {
              this.scroll(direction);
          });
      }

      e.preventDefault();
  }

  private drag(): any {
      let offsetClientX = this.lastTouch.clientX - this.initialOffsetX - this.scrollContainerLeft;
      let offsetClientY = this.lastTouch.clientY - this.initialOffsetY - this.scrollContainerTop;

      if (this.dragInsideContainer) {
          if (offsetClientY <= 0) {
              offsetClientY = 0;
          }
          else if (offsetClientY - (this.scrollContainerHeight - this.rowHeight) >= 0) {
              offsetClientY = this.scrollContainerHeight - this.rowHeight;
          }
      }

      if (this.dragElement)
          this.renderer2.setStyle(this.dragElement, 'transform', 'translate3d(' + (this.horizontalDrag ? offsetClientX : 0) + 'px, ' + (this.verticalDrag ? offsetClientY : 0) + 'px, 0px)');

      if (this.dragBorder)
          this.setDragBorder();
  }

  @HostListener('document:mouseup', ['$event'])
  private onDragEnd(e: TouchEvent | MouseEvent) {
      if (!this.isDragging) return;
      if (this.originalElement) this.originalElement.style.cssText = this.cssText;
      if (this.scrollInterval) this.clearInterval(this.scrollInterval);
      this.getDropIndex(this.getPoint(e));
      this.dragEnd.emit(this.reorderIndex);
      this.removeTouchListeners();
      this.removeDragElement();
      this.reorderIndex = null;
      this.isDragging = false;
  }

  /**
   * Recalculates the current start and end index of the virtual scroll component based on your current scroll position.
   */
  public updateItems() {
      setTimeout(() => {
          let el = this.elementRef.nativeElement;

          //If scroll is below 0, (iOS overscroll), then do not emit any changes
          if (el.scrollTop < 0) {
              this.onUpdate.emit(null);
              return;
          }

          let content = this.contentElementRef.nativeElement;

          let size = this.size;
          let contentWidth = el.clientWidth - this.scrollbarWidth;
          let contentHeight = el.clientHeight - this.scrollbarHeight;
          let childHeight = this.rowHeight;
          this.scrollHeight = this.rowHeight * size;

          let isScrolledPastBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 0;

          //If scroll is above the top, (iOS overscroll), then do not emit any changes
          if (el.scrollTop > 0 && isScrolledPastBottom) {
              this.onUpdate.emit(null);
              return;
          }

          if (el.scrollTop > this.scrollHeight)
              el.scrollTop = this.scrollHeight;

          let start = Math.floor(el.scrollTop / this.scrollHeight * size);
          if (start < 0)
              start = 0;

          let end = Math.min(size, Math.ceil(el.scrollTop / this.scrollHeight * size) + Math.ceil(contentHeight / childHeight));

          this.displayedItems = end - start;
          this.topPadding = this.rowHeight * start;

          let firstVisible = start;
          let lastVisible = end;

          if (this.virtualPadding) {
              this.topPadding -= this.rowHeight * this.virtualPadding;
              if (this.topPadding < 0) this.topPadding = 0;
              start = Math.max(0, (start - this.virtualPadding));
              end = Math.min(this.size, (end + this.virtualPadding))
          }

          if (start !== this.previousStart || end !== this.previousEnd) {
              this.previousStart = start;
              this.previousEnd = end;
              this.index = {
                  first: firstVisible,
                  last: lastVisible,
                  start: start,
                  end: end
              };
              if (!isNaN(this.index.start) && !isNaN(this.index.end))
                  this.onUpdate.emit(this.index);
              if (this.onStart)
                  this.refresh();
          }
          else {
              this.onStart = false;
          }
      });
  }

  private refresh() {
      requestAnimationFrame(this.updateItems.bind(this));
  }

  private removeTouchListeners() {
      if (this.onDraggingListener) this.onDraggingListener();
      if (this.onDragEndListener) this.onDragEndListener();
      if (this.onDragCancelListener) this.onDragCancelListener();
      this.onDraggingListener = null;
      this.onDragEndListener = null;
      this.onDragCancelListener = null;
  }

  private getPoint(e: any) {
      if (e instanceof TouchEvent) {
          let touch: Touch = e.changedTouches[0];
          if (!touch)
              return;
          return touch;
      } else if (e instanceof MouseEvent) {
          return e;
      }
      return null;
  }

  private getScrollDirection(touch: Touch): Direction {
      try {
          if (this.scrollContainerTop + this.rowHeight > touch.clientY)
              return Direction.Up;
          else if (this.scrollContainerBottom - this.rowHeight < touch.clientY)
              return Direction.Down;
      } catch (e) { return -1; }
  }

  /**
   * Scrolls by Direction {Up, Down} once for the height of a single items row height.
   * 
   * @param direction {Direction} - Up or Down
   */
  private scroll(direction: Direction) {
      let scrollTop = this.elementRef.nativeElement.scrollTop + (direction == Direction.Down ? 10 : -10);
      if (scrollTop < 0) scrollTop = 0;
      if (scrollTop > this.elementRef.nativeElement.scrollHeight) scrollTop = this.elementRef.nativeElement.scrollHeight;
      this.elementRef.nativeElement.scrollTop = scrollTop;
  }

  private setDragBorder() {
      if (!this.reorderIndex || !this.dragBorderElement) return;

      if (this.reorderIndex.start == this.reorderIndex.end || this.reorderIndex.start == this.reorderIndex.target) {
          this.renderer2.setStyle(this.dragBorderElement, 'visibility', 'hidden');
          return;
      }

      let offsetHeight = this.reorderIndex.end * this.rowHeight;
      let scrollTop = this.elementRef.nativeElement.scrollTop;
      let offsetTop = offsetHeight - scrollTop;

      if (this.reorderIndex.start < this.reorderIndex.end) {
          offsetTop += this.rowHeight;
      }

      if (this.dragBorderElement) {
          this.renderer2.setStyle(this.dragBorderElement, 'visibility', 'visible');
          this.renderer2.setStyle(this.dragBorderElement, 'transform', 'translate3d(0px, ' + offsetTop + 'px, 0px)');
      }
  }

  private removeDragElement() {
      while (this.transit.nativeElement.firstChild)
          this.transit.nativeElement.removeChild(this.transit.nativeElement.firstChild);
      this.renderer2.removeClass(this.originalElement, 'vs-drag-source');
      this.renderer2.removeClass(this.dragElement, 'vs-drag-transit');
      this.dragElement = null;
      this.originalElement = null;
      this.dragBorderElement = null;
  }

  private getDropIndex(point: any): void {
      if (!this.dragElement) return;

      let dragOffsetTop = Math.round($(this.dragElement).offset().top);
      let dragCenterY = Math.round(dragOffsetTop + (this.rowHeight / 2));
      let dragClientX = Math.round(this.getDragElementClientX());
      let elements = this.elementsFromPoint(dragClientX, dragCenterY);

      let target;
      for (let el of elements) {
          if (el.parentElement == this.contentElementRef.nativeElement) {
              target = el;
              break;
          }
      }
      if (!target && this.dragInsideContainer) {
          this.reorderIndex.target = this.size;
          this.reorderIndex.end = this.size - 1;
          this.reorderIndex.accuracy = 0.0;
          return;
      }

      // The row that the reordered row is dropped on
      this.reorderIndex.target = Array.from(this.contentElementRef.nativeElement.children).indexOf(target) + this.index.start;

      let targetOffsetTop = Math.round($(target).offset().top);
      let targetOffsetCenterY = targetOffsetTop + (this.rowHeight / 2) - this.scrollContainerTop;
      let dragOffsetCenterY = dragOffsetTop + (this.rowHeight / 2) - this.scrollContainerTop;

      this.reorderIndex.end = this.reorderIndex.target;

      if (dragOffsetCenterY > targetOffsetCenterY) {
          this.reorderIndex.end = Math.min(this.reorderIndex.target + (this.reorderIndex.start > this.reorderIndex.target ? 1 : 0), this.size - 1);
      } else if (dragOffsetCenterY < targetOffsetCenterY) {
          this.reorderIndex.end = Math.max(this.reorderIndex.target - (this.reorderIndex.start < this.reorderIndex.target ? 1 : 0), 0);
      }

      // Distance between center points of target and reordered element
      let distance = Math.abs(targetOffsetCenterY - dragOffsetCenterY);
      let percent = Math.round((100 - ((distance / this.rowHeight) * 100)) * 10) / 10;
      this.reorderIndex.accuracy = percent;

      // Ignore reordering when an adjacent row is dropped directly ontop of another
      if (this.reorderIndex.accuracy == 100) {
          if (this.reorderIndex.target > 0 && this.reorderIndex.target < this.size - 1) {
              if (Math.abs(this.reorderIndex.start - this.reorderIndex.target) == 1)
                  this.reorderIndex.end = this.reorderIndex.start;
          }
      }
  }

  /**
   * setInterval() alternative for using requestAnimationFrame for browser rendering.
   * 
   * @param fn 
   * @param delay 
   */
  private requestInterval(fn: any, delay: number = 0) {
      var start = Date.now();
      var data: any = {};
      data.id = this.ngZone.runOutsideAngular(() => {
          return requestAnimationFrame(loop);
      });
      return data;
      function loop() {
          data.id = requestAnimationFrame(loop);
          if (Date.now() - start >= delay) {
              fn();
              start = Date.now();
          }
      }
  }

  /**
   * Clears the interval with cancelAnimationFrame().
   */
  private clearInterval(data) {
      if (data == null || data.id == null) return;
      cancelAnimationFrame(data.id);
  }

  /**
   * Returns a valid x coordinate that falls within the scroll container 
   * so we can return the correct elements from point.
   */
  private getDragElementClientX(): number {
      if (!this.dragElement) return;
      let bounds = $(this.dragElement)[0].getBoundingClientRect();
      if (bounds.left >= this.scrollContainerLeft && bounds.left <= this.scrollContainerRight)
          return bounds.left;
      if (bounds.right >= this.scrollContainerLeft && bounds.right <= this.scrollContainerRight)
          return bounds.right;
  }

  /**
   * Scrolls to the specified index of the items array.
   * 
   * @param index {number} - index to scroll to
   * @param size {number} - optional size in the event row height is known but size is not
   * @param allowScrollDown {boolean} - optional, allow scrolling down direction
   */
  public scrollToIndex(index: number, size?: number, allowScrollDown?: boolean) {
      let containerHeight = this.elementRef.nativeElement.clientHeight;
      let contentHeight = !size ? size * this.rowHeight : this.size;
      let scrollTop = index * this.rowHeight - (containerHeight - this.rowHeight);

      if (allowScrollDown) {
          scrollTop = scrollTop + contentHeight;
      }
      else if (scrollTop < 0 || scrollTop > contentHeight) {
          scrollTop = 0;
      }

      jQuery(this.elementRef.nativeElement).animate({
          scrollTop: scrollTop
      }, 300);
  }

  /**
   * Snaps scroll to the top.
   */
  public resetScrollTop() {
      this.elementRef.nativeElement.scrollTop = 0;
  }

  /**
   * Scrolls to the top.
   */
  public scrollToTop() {
      this.updateItems();
      setTimeout(() => {
          this.ngZone.runOutsideAngular(() => {
              jQuery(this.elementRef.nativeElement).animate({
                  scrollTop: 0
              }, 300);
          });
      });
  }

  /**
   * Scrolls to the bottom.
   */
  public scrollToBottom() {
      this.updateItems();
      // Actual scrollTop would be scrollHeight - outerHeight but this ensures we go to the bottom.
      setTimeout(() => {
          this.ngZone.runOutsideAngular(() => {
              let scrollHeight = this.elementRef.nativeElement.scrollHeight;
              jQuery(this.elementRef.nativeElement).animate({
                  scrollTop: scrollHeight
              }, 300);
          });
      });
  }

  /**
   * Document.elementsFromPoint() shim for Safari support
   */
  private elementsFromPoint(x: number, y: number) {
      let elements = [], previousPointerEvents = [], current, i, d;
      while ((current = document.elementFromPoint(x, y)) && elements.indexOf(current) === -1 && current != null) {
          elements.push(current);
          previousPointerEvents.push({
              value: current.style.getPropertyValue('pointer-events'),
              priority: current.style.getPropertyPriority('pointer-events')
          });
          current.style.setProperty('pointer-events', 'none', 'important');
      }
      for (i = previousPointerEvents.length; d = previousPointerEvents[--i];)
          elements[i].style.setProperty('pointer-events', d.value ? d.value : '', d.priority);
      return elements;
  }
}

/**
* first: the first visible row.
* last: the last visible row.
* start: the start index of the virtual array of an array of items. (This is the start of your array splice)
* end: the end index of the virtual array of an array of items. (This is the end of your array splice)
* target: the index in the virtual array that the reordered row is over.
* accuracy: the % accuracy that the reordered row is over the target row. (100% is directly over, 90% - is 10% up or down from the center of the row.)
*/
export interface Index {
  first?: number; // Visible
  last?: number; // Visible
  start?: number; // Array Index
  end?: number; // Array Index
  target?: number; // Target Index
  accuracy?: number; // Percent
}

export enum Direction {
  Up = 0,
  Down = 1
}