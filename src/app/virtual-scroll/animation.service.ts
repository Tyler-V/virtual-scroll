import { Injectable } from '@angular/core';
import { Easings, EasingFunctions } from './animations';

@Injectable()
export class AnimationService {

  private _id: number;

  constructor() { }

  /**
   * Animates an element using an easing function for a set duration using request animation frame.
   *
   * @param element: HTMLElement - The HTML element that should animate
   * @param property: HTMLElementProperty - The HTML element property that should animate
   * @param end: number - The end value the element should animate to
   * @param duration: number - The duration the element should animate for to the end
   * @param easing: EasingFunction - The type of easing function that should be used
   * @param callback?: Callback returned after the animation is completed or cancelled
   */
  public animate(element: HTMLElement, HTMLElementProperty: string, end: number, duration: number, easing: EasingFunctions = EasingFunctions.linear, callback?: () => void) {
    let start, time_start, id, raf;
    start = element[HTMLElementProperty];
    time_start = this._getTime();
    this._id = id = time_start;

    let animate = () => {
      let time_now = this._getTime();
      let animation_time = Math.min(1, ((time_now - time_start) / duration));
      let easing_time = Easings.getTime(easing, animation_time);
      let next = Math.round((easing_time * (end - start)) + start);

      if (animation_time == 1 || element[HTMLElementProperty] == end || this._id != id) {
        if (animation_time == 1)
          element[HTMLElementProperty] = end;
        _callback();
      } else {
        element[HTMLElementProperty] = next;
        raf = window.requestAnimFrame(animate);
      }
    }

    let _callback = () => {
      this._id = null;
      if (raf) window.cancelAnimationFrame(raf);
      if (callback) callback();
    }

    window.requestAnimFrame(animate);
  }

  public cancel() {
    this._id = null;
  }

  public isAnimating() {
    return this._id != null;
  }

  private _getTime(): number {
    return 'now' in window.performance ? performance.now() : new Date().getTime();
  }
}