import {
    Component,
    ViewChild, ElementRef,
    Input, Output, EventEmitter,
    OnChanges, OnDestroy, OnInit,
    Renderer2,
    SimpleChanges,
    HostBinding,
    HostListener
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
    styleUrls: ['./virtual-scroll.component.css']
})

export class VirtualScrollComponent implements OnInit {

    /** Required */
    @Input() size: number;
    @Input() rowHeight: number;

    /** Options */
    @Input() virtualPadding: number = 3; // How many additional virtual items should be padded to the top/bottom for visual/UI purposes
    @Input() draggable: string = 'drag'; // The class name of the layer that you want to become draggable on touch
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
    private dragInterval: NodeJS.Timer;
    private originalElement: any;
    private dragElement: any;
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

    public scrollHeight: number;
    public topPadding: number;

    public displayedItems: number;
    private previousStart: number;
    private previousEnd: number;
    private currentStart: number;
    public index: Index;
    private onStart: boolean = true;

    constructor(public elementRef: ElementRef, private renderer2: Renderer2) { }

    ngOnInit() {
        this.onScrollListener = this.renderer2.listen(this.elementRef.nativeElement, 'scroll', this.refresh.bind(this));
        this.onDragStartListener = this.renderer2.listen(this.contentElementRef.nativeElement, 'touchstart', (e) => this.onDragStart(e));
    }


    @HostListener('mousedown', ['$event'])
    onDragStart(e: TouchEvent | MouseEvent) {
        let target: any = e.target;
        if (target == null) return;
        if (target.className.indexOf(this.draggable) == -1) return;
        this.lastTouch = this.getPoint(e);

        this.isDragging = true;

        this.scrollContainerWidth = this.elementRef.nativeElement.clientWidth;
        this.scrollContainerHeight = this.elementRef.nativeElement.clientHeight;
        this.scrollContainerTop = $(this.elementRef.nativeElement).offset().top;
        this.scrollContainerBottom = this.scrollContainerTop + this.scrollContainerHeight;
        this.scrollContainerLeft = $(this.elementRef.nativeElement).offset().left;
        this.scrollContainerRight = this.scrollContainerLeft + this.scrollContainerWidth;

        this.originalElement = target;
        while (!this.dragElement) {
            if (this.originalElement.parentElement == this.contentElementRef.nativeElement) {
                this.dragElement = this.originalElement.cloneNode(true);
                break;
            }
            this.originalElement = this.originalElement.parentElement;
        }
        this.cssText = this.originalElement.style.cssText;

        this.renderer2.addClass(this.originalElement, 'vs-drag-source');
        this.renderer2.setStyle(this.originalElement, 'box-shadow', 'inset 0 20px 10px -20px rgba(0,0,0,0.8)');
        this.renderer2.setStyle(this.originalElement, 'background-color', '#D7D7D7');

        this.renderer2.addClass(this.dragElement, 'vs-drag-transit');
        this.renderer2.setStyle(this.dragElement, 'position', 'absolute');
        this.renderer2.setStyle(this.dragElement, 'width', 'inherit');
        this.renderer2.setStyle(this.dragElement, "box-shadow", "0px 7px 7px -4px rgba(0, 0, 0, 0.5)");

        this.transit.nativeElement.appendChild(this.dragElement);

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

        this.dragInterval = setInterval(() => {
            this.onDragging();
        }, 0);
    }

    @HostListener('mousemove', ['$event'])
    onDragMove(e: TouchEvent | MouseEvent) {
        if (!this.isDragging) return;
        this.lastTouch = this.getPoint(e);
        this.drag();
        this.getDropIndex(this.getPoint(e));
        this.dragging.emit(this.reorderIndex);
        event.preventDefault();
    }

    @HostListener('mouseup', ['$event'])
    onDragEnd(e: TouchEvent | MouseEvent) {
        if (!this.isDragging) return;
        if (this.originalElement)
            this.originalElement.style.cssText = this.cssText;
        this.isDragging = false;
        this.getDropIndex(this.getPoint(e));
        this.removeTouchListeners();
        clearInterval(this.dragInterval);
        this.removeDragElement();
        this.dragEnd.emit(this.reorderIndex);
    }

    ngOnChanges(changes: SimpleChanges) {
        this.previousStart = undefined;
        this.previousEnd = undefined;
        this.refresh();
    }

    ngOnDestroy() {
        clearInterval(this.dragInterval);
        this.onScrollListener();
        this.onDragStartListener();
        this.removeTouchListeners();
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
     * Scrolls by Direction {Up, Down} once for the height of a single items row height.
     * 
     * @param direction {Direction} - Up or Down
     */
    public scroll(direction: Direction) {
        let scrollTop = this.elementRef.nativeElement.scrollTop + (direction == Direction.Down ? 2 : -2);
        if (scrollTop < 0 || scrollTop > this.elementRef.nativeElement.scrollHeight)
            return;
        $(this.elementRef.nativeElement).animate({
            scrollTop: scrollTop,
            easing: 'linear'
        }, 0);
    }

    /**
     * Snaps scroll to the top.
     */
    public resetScrollTop() {
        this.elementRef.nativeElement.scrollTop = 0;
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

    private onDragging() {
        switch (this.getScrollDirection(this.lastTouch)) {
            case Direction.Up:
                this.scroll(Direction.Up);
                break;
            case Direction.Down:
                this.scroll(Direction.Down);
                break;
        }
    }

    private getScrollDirection(touch: Touch): Direction {
        try {
            if (this.scrollContainerTop + this.rowHeight > touch.clientY)
                return Direction.Up;
            else if (this.scrollContainerBottom - this.rowHeight < touch.clientY)
                return Direction.Down;
        } catch (e) { return -1; }
    }

    private drag() {
        if (!this.dragElement) return;
        let offsetClientX = this.lastTouch.clientX - this.initialOffsetX - this.scrollContainerLeft;
        let offsetClientY = this.lastTouch.clientY - this.initialOffsetY - this.scrollContainerTop;
        if (this.dragInsideContainer) {
            if (offsetClientY <= 0) {
                this.renderer2.setStyle(this.dragElement, 'top', '0px');
                return;
            }
            else if (offsetClientY - (this.scrollContainerHeight - this.rowHeight) >= 0) {
                this.renderer2.setStyle(this.dragElement, 'top', (this.scrollContainerHeight - this.rowHeight) + 'px');
                return;
            }
        }
        if (this.horizontalDrag)
            this.renderer2.setStyle(this.dragElement, 'left', offsetClientX + 'px');
        if (this.verticalDrag)
            this.renderer2.setStyle(this.dragElement, 'top', offsetClientY + 'px');
    }

    private removeDragElement() {
        while (this.transit.nativeElement.firstChild)
            this.transit.nativeElement.removeChild(this.transit.nativeElement.firstChild);
        this.renderer2.removeClass(this.originalElement, 'vs-drag-source');
        this.renderer2.removeClass(this.dragElement, 'vs-drag-transit');
        this.dragElement = null;
        this.originalElement = null;
    }

    private getDropIndex(point: any): void {
        if (!this.dragElement) return;

        let dragOffsetTop = $(this.dragElement).offset().top;
        let dragCenterY = dragOffsetTop + (this.rowHeight / 2);
        let dragClientX = this.getDragElementClientX();
        let elements = this.elementsFromPoint(dragClientX, dragCenterY);

        let target;
        for (let el of elements) {
            if (el.parentElement == this.contentElementRef.nativeElement) {
                target = el;
                break;
            }
        }
        if (!target) {
            if (this.dragInsideContainer && this.index.end == this.size)
                this.reorderIndex.end = this.size;
            return;
        }

        // The row that the reordered row is dropped on
        this.reorderIndex.target = Array.from(this.contentElementRef.nativeElement.children).indexOf(target) + this.index.start;

        let targetOffsetTop = $(target).offset().top
        let targetOffsetCenterY = targetOffsetTop + (this.rowHeight / 2) - this.scrollContainerTop;
        let dragOffsetCenterY = dragOffsetTop + (this.rowHeight / 2) - this.scrollContainerTop;
        
        if (dragOffsetCenterY > targetOffsetCenterY)
            this.reorderIndex.end = Math.min(this.reorderIndex.target + 1, this.size - 1);

        // Distance between center points of target and reordered element
        let distance = Math.abs(targetOffsetCenterY - dragOffsetCenterY);
        let percent = Math.round((100 - ((distance / this.rowHeight) * 100)) * 10) / 10;
        this.reorderIndex.targetAccuracy = percent;

        this.reorderIndex.end = this.reorderIndex.end == null ? this.reorderIndex.target : this.reorderIndex.end;
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
 * targetAccuracy: the % accuracy that the reordered row is over the target row. (100% is directly over, 90% is 10% up or down from the center of the row.)
 */
export interface Index {
    first?: number; // Visible
    last?: number; // Visible
    start?: number; // Array Index
    end?: number; // Array Index
    target?: number; // Target Index
    targetAccuracy?: number; // Percent
}

export enum Direction {
    Up = 0,
    Down = 1
}