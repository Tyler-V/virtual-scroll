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
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/observable/fromEvent';

import { AnimationService } from './animation.service';
import { EasingFunctions } from './animations';

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
    host: { 'class': 'virtual-scroll' },
    providers: [AnimationService]
})

export class VirtualScrollComponent implements OnInit {

    /** Required */
    @Input() size: number;
    @Input() rowHeight: number;

    /** Options */
    @Input() rowPadding: number = 3; // How many additional virtual items should be padded to the top/bottom for visual/UI purposes
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
    private originalElementCss: string;
    private originalElementIndex: number;
    private dragElement: Node;
    private scrollContainerWidth: number;
    private scrollContainerHeight: number;
    private scrollContainerTop: number;
    private scrollContainerBottom: number;
    private scrollContainerLeft: number;
    private scrollContainerRight: number;
    private reorderIndex: Index;
    private initialOffsetX: number;
    private initialOffsetY: number;

    private scrollbarWidth: number = 0;
    private scrollbarHeight: number = 0;

    private scrollSubscription$: Subscription;
    private scrollTop: number;

    private onDragStartListener: Function;
    private onDraggingListener: Function;
    private onDragEndListener: Function;
    private onDragCancelListener: Function;

    private previousIndex: Index;
    private dragBorderElement: any;
    private dragBorderTimeout: any;
    private drawDragBorder: boolean = false;

    public scrollHeight: number;
    public topPadding: number;
    public index: Index;

    constructor(public elementRef: ElementRef, private renderer2: Renderer2, private ngZone: NgZone, private animationService: AnimationService) { }

    ngOnInit() {
        this.scrollSubscription$ = Observable.fromEvent(this.elementRef.nativeElement, 'scroll')
            .subscribe(() => {
                const scrollTop = this.elementRef.nativeElement.scrollTop;
                if (this.scrollTop !== scrollTop) {
                    this.scrollTop = scrollTop;
                    this.refresh();
                }
            });

        this.onDragStartListener = this.renderer2.listen(this.contentElementRef.nativeElement, 'touchstart', (e) => this.onDragStart(e));
    }

    ngOnChanges(changes: SimpleChanges) {
        this.previousIndex = undefined;
        this.refresh();
    }

    ngOnDestroy() {
        this.scrollSubscription$.unsubscribe();
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
        this.scrollContainerRight = Math.round(this.scrollContainerLeft + this.scrollContainerWidth)

        while (!this.dragElement) {
            if (target.parentElement == this.contentElementRef.nativeElement) {
                this.dragElement = target.cloneNode(true);
                break;
            }
            target = target.parentElement;
            this.originalElementIndex = Array.from(this.contentElementRef.nativeElement.children).indexOf(target) + this.index.start;
        }
        this.originalElementCss = target.style.cssText;
        this.setOriginalElementStyling();

        this.renderer2.addClass(this.dragElement, "vs-drag-transit");
        this.renderer2.setStyle(this.dragElement, "position", "absolute");
        this.renderer2.setStyle(this.dragElement, "opacity", "0.9");
        this.renderer2.setStyle(this.dragElement, "width", "inherit");
        this.renderer2.setStyle(this.dragElement, "box-shadow", "0px 7px 7px -4px rgba(0, 0, 0, 0.5)");
        this.transit.nativeElement.appendChild(this.dragElement);

        let el = this.renderer2.createElement("div");
        this.renderer2.addClass(el, "vs-drag-border");
        this.renderer2.setStyle(el, "visibility", "hidden");
        this.renderer2.setStyle(el, "position", "absolute");
        this.renderer2.setStyle(el, "width", "inherit");
        this.renderer2.setStyle(el, "border-top", "2px solid red");
        this.dragBorderElement = this.transit.nativeElement.appendChild(el);

        this.initialOffsetX = this.lastTouch.clientX - $(target).offset().left;
        this.initialOffsetY = this.lastTouch.clientY - $(target).offset().top;

        this.drag();

        this.reorderIndex = { start: Array.from(this.contentElementRef.nativeElement.children).indexOf(target) + this.index.start };
        this.dragStart.emit(this.reorderIndex);

        this.removeTouchListeners();
        this.onDraggingListener = this.renderer2.listen(e.target, 'touchmove', (e) => { this.onDragMove(e); });
        this.onDragEndListener = this.renderer2.listen(e.target, 'touchend', (e) => { this.onDragEnd(e); });
        this.onDragCancelListener = this.renderer2.listen(e.target, 'touchcancel', (e) => { this.onDragEnd(e); });

        this.paint();
    }

    /**
     * Prevent iOS under scrolling of fixed position elements.
     */
    @HostListener('touchmove', ['$event'])
    private onTouchMove(e) {
        let containsTarget = $.contains(this.contentElementRef.nativeElement, e.target);
        let child: any = this.getChildElement(this.contentElementRef.nativeElement, e.target);
        let canScrollX = child != null && child.scrollWidth > child.offsetWidth ? true : false
        let canScrollY = (this.size * this.rowHeight) > this.elementRef.nativeElement.offsetHeight;
        if (!containsTarget || (!canScrollX && !canScrollY))
            e.preventDefault();
    }

    getChildElement(parent: HTMLElement, target: HTMLElement) {
        if (!$.contains(parent, target))
            return null;
        let child = target;
        let children = Array.from(parent.children);
        while (true) {
            if (parent == child) return null;
            let index = children.indexOf(child);
            if (index >= 0) return children[index];
            child = child.parentElement;
        }
    }

    @HostListener('document:mousemove', ['$event'])
    private onDragMove(e: TouchEvent | MouseEvent) {
        if (!this.isDragging) return;
        let point = this.getPoint(e);
        if (this.lastTouch == point) return;
        this.lastTouch = this.getPoint(e);
        clearTimeout(this.dragBorderTimeout);
        this.dragBorderTimeout = setTimeout(() => {
            this.drawDragBorder = true;
        }, 100);
        e.preventDefault();
    }

    private paint() {
        let animate = () => {
            this.drag();
            this.setDragBorder();
            this.scroll(this.getScrollDirection(this.lastTouch))
            if (this.isDragging) {
                window.requestAnimFrame(animate);
            }
        };
        window.requestAnimFrame(animate);
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
    }

    @HostListener('document:mouseup', ['$event'])
    private onDragEnd(e: TouchEvent | MouseEvent) {
        if (!this.isDragging) return;
        this.setOriginalElementStyling(false);
        this.getDropIndex(this.getPoint(e));
        this.dragEnd.emit(this.reorderIndex);
        this.removeTouchListeners();
        this.removeDragElement();
        this.originalElementIndex = null;
        this.reorderIndex = null;
        this.isDragging = false;
    }

    private getIndex(): Index {
        let contentWidth = this.elementRef.nativeElement.clientWidth - this.scrollbarWidth;
        let contentHeight = this.elementRef.nativeElement.clientHeight - this.scrollbarHeight;
        this.scrollHeight = this.rowHeight * this.size;
        let start = (this.elementRef.nativeElement.scrollTop / this.scrollHeight) * this.size;

        let index: Index = {
            start: Math.max(0, Math.floor(start)),
            end: Math.min(this.size, Math.ceil(start) + Math.ceil(contentHeight / this.rowHeight))
        }
        return index;
    }

    /**
     * @returns: Whether scrolling is getting close to the start or end of the currently displayed content.
     */
    private shouldUpdate(index: Index) {
        if (!this.index) {
            return true;
        }
        if (index.start > 0 && index.start <= this.index.start) {
            return true;
        }
        if (index.end < this.size && index.end >= this.index.end) {
            return true;
        }
        return false;
    }

    /**
     * Recalculates the current start and end index of the virtual scroll component based on your current scroll position.
     */
    public update() {
        // iOS Overscroll
        if (this.elementRef.nativeElement.scrollTop < 0
            || this.elementRef.nativeElement.scrollTop > this.scrollHeight) {
            return;
        }

        let index = this.getIndex();

        if (!this.shouldUpdate(index)) {
            return;
        }

        this.topPadding = Math.max(0, ((this.rowHeight * index.start) - (this.rowHeight * this.rowPadding)));

        index.first = Math.max(0, index.start);
        index.last = Math.min(this.size, index.end);
        index.start = Math.max(0, (index.start - this.rowPadding));
        index.end = Math.min(this.size, (index.end + this.rowPadding));

        if (this.previousIndex === undefined || index.start !== this.previousIndex.start || index.end !== this.previousIndex.end) {
            if (!isNaN(index.start) && !isNaN(index.end)) {
                this.index = this.previousIndex = index;
                this.onUpdate.emit(this.index);
            }
        }
    }

    private refresh() {
        clearTimeout(this.dragBorderTimeout);
        this.hideDragBorder();
        this.setOriginalElementStyling();
        requestAnimationFrame(() => this.update());
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
            if (touch) {
                return touch;
            }
        } else if (e instanceof MouseEvent) {
            return e;
        }
        return null;
    }

    private getScrollDirection(touch: Touch): Direction {
        try {
            if (this.scrollContainerTop + this.rowHeight > touch.clientY) {
                return Direction.Up;
            } else if (this.scrollContainerBottom - this.rowHeight < touch.clientY) {
                return Direction.Down;
            }
        } catch (e) {
            return -1;
        }
    }

    /**
     * Scrolls by Direction {Up, Down} once for the height of a single items row height.
     * 
     * @param direction {Direction} - Up or Down
     */
    private scroll(direction: Direction) {
        if (direction == null) {
            return false;
        }
        let distance = Math.min(Math.ceil(((this.rowHeight * this.size) / 1000) + 5), this.rowHeight);
        let scrollTop = Math.max(0, this.elementRef.nativeElement.scrollTop + (direction == Direction.Down ? distance : -distance));
        if (scrollTop > this.elementRef.nativeElement.scrollHeight) {
            scrollTop = this.elementRef.nativeElement.scrollHeight;
        }
        this.elementRef.nativeElement.scrollTop = scrollTop;
        return true;
    }

    private setOriginalElementStyling(set: boolean = true) {
        if (this.originalElementIndex == null || this.originalElementIndex < this.index.first || this.originalElementIndex > this.index.last) return;
        let element = Array.from(this.contentElementRef.nativeElement.children)[this.originalElementIndex - this.index.start];
        if (!element) return;
        if (set) {
            this.renderer2.addClass(element, "vs-drag-source");
        } else {
            this.renderer2.removeClass(element, "vs-drag-source");
        }
    }

    private hideDragBorder() {
        this.drawDragBorder = false;
        if (this.dragBorderElement) {
            this.renderer2.setStyle(this.dragBorderElement, 'visibility', 'hidden');
        }
    }

    private setDragBorder() {
        if (!this.drawDragBorder) {
            return;
        }

        this.drawDragBorder = false;

        this.getDropIndex(this.lastTouch);

        if (!this.dragBorder || !this.reorderIndex || this.reorderIndex.start == this.reorderIndex.end || this.reorderIndex.start == this.reorderIndex.target) {
            this.hideDragBorder();
            return;
        }

        let offsetHeight = this.reorderIndex.end * this.rowHeight;
        let scrollTop = this.elementRef.nativeElement.scrollTop;
        let offsetTop = offsetHeight - scrollTop;

        let dragBorderHeight = 2;
        if (this.reorderIndex.end == this.size - 1) {
            offsetTop -= dragBorderHeight;
        }

        if (this.reorderIndex.start < this.reorderIndex.end) {
            offsetTop += this.rowHeight;
        }

        if (this.dragBorderElement) {
            this.renderer2.setStyle(this.dragBorderElement, 'visibility', 'visible');
            this.renderer2.setStyle(this.dragBorderElement, 'transform', 'translate3d(0px, ' + offsetTop + 'px, 0px)');
        }
    }

    private removeDragElement() {
        while (this.transit.nativeElement.firstChild) {
            this.transit.nativeElement.removeChild(this.transit.nativeElement.firstChild);
        }
        this.renderer2.removeClass(this.dragElement, 'vs-drag-transit');
        this.dragElement = null;
        this.dragBorderElement = null;
    }

    private getDropIndex(point: any): void {
        if (!this.dragElement) {
            return;
        }

        let dragOffsetTop = Math.round($(this.dragElement).offset().top);
        let dragCenterY = Math.round(dragOffsetTop + (this.rowHeight / 2));
        let dragClientX = Math.round(this.getDragElementClientX());
        let target = this.getElementFromPointInContainer(dragClientX, dragCenterY, this.contentElementRef.nativeElement);

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
        this.dragging.emit(this.reorderIndex);
    }

    /**
     * Returns a valid x coordinate that falls within the scroll container 
     * so we can return the correct elements from point.
     */
    private getDragElementClientX(): number {
        if (!this.dragElement) {
            return;
        }
        let bounds = $(this.dragElement)[0].getBoundingClientRect();
        if (bounds.left >= this.scrollContainerLeft && bounds.left <= this.scrollContainerRight) {
            return bounds.left;
        }
        if (bounds.right >= this.scrollContainerLeft && bounds.right <= this.scrollContainerRight) {
            return bounds.right;
        }
    }

    /**
     * Scrolls to the specified index of the items array.
     * 
     * @param index {number} - index to scroll to
     */
    public scrollToIndex(index: number, offset?: number) {
        let scrollTop: number;
        if (index == 0) {
            scrollTop = 0;
        } else if (index == this.size) {
            scrollTop = this.size * this.rowHeight;
        } else {
            scrollTop = (index * this.rowHeight) - ((this.elementRef.nativeElement.clientHeight + this.rowHeight) / 2) + offset;
        }
        this.animationService.animate(this.elementRef.nativeElement, "scrollTop", scrollTop, 500, EasingFunctions.easeOutQuad, () => {
            this.refresh();
        });
    }

    public resetScrollTop() {
        this.elementRef.nativeElement.scrollTop = 0;
    }

    public scrollToTop() {
        this.scrollToIndex(0);
    }

    public scrollToBottom() {
        this.scrollToIndex(this.size);
    }

    /**
     * Return the child element of a container that contains the specified coordinate.
     * 
     * @param x : X coordinate
     * @param y : Y coordinate
     * @param c : Container Element
     */
    private getElementFromPointInContainer(x: number, y: number, c: Element): Element {
        let children: HTMLCollection = c.children;
        for (let i = 0; i < children.length; i++) {
            let child: Element = children.item(i);
            let childRect: ClientRect = child.getBoundingClientRect();
            if (this.pointInsideRectangle(x, y, childRect)) {
                return child;
            }
        }
        return null;
    }

    /**
     * Return whether the point is inside the specified rectangle.
     * 
     * @param x : X coordinate
     * @param y : Y coordinate
     * @param r : Rectangle ClientRect
     */
    private pointInsideRectangle(x: number, y: number, r: ClientRect): boolean {
        if (x < Math.floor(r.left)) return false;
        if (x > Math.ceil(r.right)) return false;
        if (y < Math.floor(r.top)) return false;
        if (y > Math.ceil(r.bottom)) return false;
        return true;
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