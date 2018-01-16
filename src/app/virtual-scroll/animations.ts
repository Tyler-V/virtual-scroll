declare global {
    interface Window {
      requestAnimFrame(callback: () => void): any;
      webkitRequestAnimationFrame(callback: () => void): any;
      mozRequestAnimationFrame(callback: () => void): any;
      oRequestAnimationFrame(callback: () => void): any;
    }
  }
  
  /**
  * https://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
  */
  Window.prototype.requestAnimFrame = function (callback) {
    return window.requestAnimationFrame(callback) ||
      window.webkitRequestAnimationFrame(callback) ||
      window.mozRequestAnimationFrame(callback) ||
      window.oRequestAnimationFrame(callback) ||
      function (callback) {
        window.setTimeout(callback, 1000 / 60);
      };
  }
  
  /**
  *  Github: https://github.com/AndrewRayCode/easing-utils/blob/master/src/easing.js
  *  Demo: http://andrewraycode.github.io/easing-utils/gh-pages/
  */
  export class Easings {
    public static getTime(easing: EasingFunctions, time: number) {
      switch (easing) {
        case EasingFunctions.easeInBack: return Easings.easeInBack(time);
        case EasingFunctions.easeInBounce: return Easings.easeInBounce(time);
        case EasingFunctions.easeInCirc: return Easings.easeInCirc(time);
        case EasingFunctions.easeInCubic: return Easings.easeInCubic(time);
        case EasingFunctions.easeInElastic: return Easings.easeInElastic(time);
        case EasingFunctions.easeInExpo: return Easings.easeInExpo(time);
        case EasingFunctions.easeInOutBack: return Easings.easeInOutBack(time);
        case EasingFunctions.easeInOutBounce: return Easings.easeInOutBounce(time);
        case EasingFunctions.easeInOutCirc: return Easings.easeInOutCirc(time);
        case EasingFunctions.easeInOutCubic: return Easings.easeInOutCubic(time);
        case EasingFunctions.easeInOutElastic: return Easings.easeInOutCubic(time);
        case EasingFunctions.easeInOutExpo: return Easings.easeInOutExpo(time);
        case EasingFunctions.easeInOutQuad: return Easings.easeInOutQuad(time);
        case EasingFunctions.easeInOutQuart: return Easings.easeInOutQuart(time);
        case EasingFunctions.easeInOutQuint: return Easings.easeInOutQuint(time);
        case EasingFunctions.easeInOutSine: return Easings.easeInOutSine(time);
        case EasingFunctions.easeInQuad: return Easings.easeInQuad(time);
        case EasingFunctions.easeInQuart: return Easings.easeInQuart(time);
        case EasingFunctions.easeInQuint: return Easings.easeInQuint(time);
        case EasingFunctions.easeInSine: return Easings.easeInSine(time);
        case EasingFunctions.easeOutBack: return Easings.easeOutBack(time);
        case EasingFunctions.easeOutBounce: return Easings.easeOutBounce(time);
        case EasingFunctions.easeOutCirc: return Easings.easeOutCirc(time);
        case EasingFunctions.easeOutCubic: return Easings.easeOutCubic(time);
        case EasingFunctions.easeOutElastic: return Easings.easeOutElastic(time);
        case EasingFunctions.easeOutExpo: return Easings.easeOutExpo(time);
        case EasingFunctions.easeOutQuad: return Easings.easeOutQuad(time);
        case EasingFunctions.easeOutQuart: return Easings.easeOutQuart(time);
        case EasingFunctions.easeOutQuint: return Easings.easeOutQuint(time);
        case EasingFunctions.easeOutSine: return Easings.easeOutSine(time);
        case EasingFunctions.linear: return Easings.linear(time);
      }
    }
  
    public static linear(t) {
      return t;
    }
  
    public static easeInSine(t) {
      return -1 * Math.cos(t * (Math.PI / 2)) + 1;
    }
  
    public static easeOutSine(t) {
      return Math.sin(t * (Math.PI / 2));
    }
  
    public static easeInOutSine(t) {
      return -0.5 * (Math.cos(Math.PI * t) - 1);
    }
  
    public static easeInQuad(t) {
      return t * t;
    }
  
    public static easeOutQuad(t) {
      return t * (2 - t);
    }
  
    public static easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : - 1 + (4 - 2 * t) * t;
    }
  
    public static easeInCubic(t) {
      return t * t * t;
    }
  
    public static easeOutCubic(t) {
      const t1 = t - 1;
      return t1 * t1 * t1 + 1;
    }
  
    public static easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
  
    public static easeInQuart(t) {
      return t * t * t * t;
    }
  
    public static easeOutQuart(t) {
      const t1 = t - 1;
      return 1 - t1 * t1 * t1 * t1;
    }
  
    public static easeInOutQuart(t) {
      const t1 = t - 1;
      return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
    }
  
    public static easeInQuint(t) {
      return t * t * t * t * t;
    }
  
    public static easeOutQuint(t) {
      const t1 = t - 1;
      return 1 + t1 * t1 * t1 * t1 * t1;
    }
  
    public static easeInOutQuint(t) {
      const t1 = t - 1;
      return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
    }
  
    public static easeInExpo(t) {
      if (t === 0)
        return 0;
      return Math.pow(2, 10 * (t - 1));
    }
  
    public static easeOutExpo(t) {
      if (t === 1)
        return 1;
      return (-Math.pow(2, -10 * t) + 1);
    }
  
    public static easeInOutExpo(t) {
      if (t === 0 || t === 1)
        return t;
      const scaledTime = t * 2;
      const scaledTime1 = scaledTime - 1;
      if (scaledTime < 1)
        return 0.5 * Math.pow(2, 10 * (scaledTime1));
      return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
    }
  
    public static easeInCirc(t) {
      const scaledTime = t / 1;
      return -1 * (Math.sqrt(1 - scaledTime * t) - 1);
    }
  
    public static easeOutCirc(t) {
      const t1 = t - 1;
      return Math.sqrt(1 - t1 * t1);
    }
  
    public static easeInOutCirc(t) {
      const scaledTime = t * 2;
      const scaledTime1 = scaledTime - 2;
      if (scaledTime < 1)
        return -0.5 * (Math.sqrt(1 - scaledTime * scaledTime) - 1);
      return 0.5 * (Math.sqrt(1 - scaledTime1 * scaledTime1) + 1);
    }
  
    public static easeInBack(t, magnitude = 1.70158) {
      const scaledTime = t / 1;
      return scaledTime * scaledTime * ((magnitude + 1) * scaledTime - magnitude);
    }
  
    public static easeOutBack(t, magnitude = 1.70158) {
      const scaledTime = (t / 1) - 1;
      return (scaledTime * scaledTime * ((magnitude + 1) * scaledTime + magnitude)) + 1;
    }
  
    public static easeInOutBack(t, magnitude = 1.70158) {
      const scaledTime = t * 2;
      const scaledTime2 = scaledTime - 2;
      const s = magnitude * 1.525;
      if (scaledTime < 1)
        return 0.5 * scaledTime * scaledTime * (((s + 1) * scaledTime) - s);
      return 0.5 * (scaledTime2 * scaledTime2 * ((s + 1) * scaledTime2 + s) + 2);
    }
  
    public static easeInElastic(t, magnitude = 0.7) {
      if (t === 0 || t === 1)
        return t;
      const scaledTime = t / 1;
      const scaledTime1 = scaledTime - 1;
      const p = 1 - magnitude;
      const s = p / (2 * Math.PI) * Math.asin(1);
      return -(Math.pow(2, 10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p));
    }
  
    public static easeOutElastic(t, magnitude = 0.7) {
      const p = 1 - magnitude;
      const scaledTime = t * 2;
      if (t === 0 || t === 1)
        return t;
      const s = p / (2 * Math.PI) * Math.asin(1);
      return (Math.pow(2, -10 * scaledTime) * Math.sin((scaledTime - s) * (2 * Math.PI) / p)) + 1;
    }
  
    public static easeInOutElastic(t, magnitude = 0.65) {
      const p = 1 - magnitude;
      if (t === 0 || t === 1)
        return t;
      const scaledTime = t * 2;
      const scaledTime1 = scaledTime - 1;
      const s = p / (2 * Math.PI) * Math.asin(1);
      if (scaledTime < 1)
        return -0.5 * (Math.pow(2, 10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p));
      return (Math.pow(2, -10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p) * 0.5) + 1;
    }
  
    public static easeOutBounce(t) {
      const scaledTime = t / 1;
      if (scaledTime < (1 / 2.75)) {
        return 7.5625 * scaledTime * scaledTime;
      } else if (scaledTime < (2 / 2.75)) {
        const scaledTime2 = scaledTime - (1.5 / 2.75);
        return (7.5625 * scaledTime2 * scaledTime2) + 0.75;
      } else if (scaledTime < (2.5 / 2.75)) {
        const scaledTime2 = scaledTime - (2.25 / 2.75);
        return (7.5625 * scaledTime2 * scaledTime2) + 0.9375;
      } else {
        const scaledTime2 = scaledTime - (2.625 / 2.75);
        return (7.5625 * scaledTime2 * scaledTime2) + 0.984375;
      }
    }
  
    public static easeInBounce(t) {
      return 1 - this.easeOutBounce(1 - t);
    }
  
    public static easeInOutBounce(t) {
      if (t < 0.5)
        return this.easeInBounce(t * 2) * 0.5;
      return (this.easeOutBounce((t * 2) - 1) * 0.5) + 0.5;
    }
  }
  
  export enum EasingFunctions {
    linear,
    easeInSine,
    easeOutSine,
    easeInOutSine,
    easeInQuad,
    easeOutQuad,
    easeInOutQuad,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInQuint,
    easeOutQuint,
    easeInOutQuint,
    easeInExpo,
    easeOutExpo,
    easeInOutExpo,
    easeInCirc,
    easeOutCirc,
    easeInOutCirc,
    easeInBack,
    easeOutBack,
    easeInOutBack,
    easeInElastic,
    easeOutElastic,
    easeInOutElastic,
    easeOutBounce,
    easeInBounce,
    easeInOutBounce
  }