import { Point } from 'pixi.js';
import { OnEvent } from './types';

export interface ClientEventsArgs {
  initWheelOffset?: Point;
  onAnyEvent?: (ev: OnEvent) => void;
}

export type ClientEventsType = {
  keyDownEvent?: KeyboardEvent;
  keyUpEvent?: KeyboardEvent;
  keydown?: Record<string, KeyboardEvent>;
  mouseDownEvent?: MouseEvent;
  mouseUpEvent?: MouseEvent;
  lastMouseDown?: MouseEvent;
  lastMouseUp?: MouseEvent;
  wheelEvent?: WheelEvent;
  wheelDelta?: { yValue: 0 | number, xValue: 0 | number, xLast: number, yLast: number }
}

export class ClientEvents {
  wheelDelta: { yValue: number; xValue: number; };
  mouseUpEvent: MouseEvent;
  mouseDownEvent: MouseEvent;
  lastMouseDown: MouseEvent;
  lastMouseUp: MouseEvent;
  keyDownEvent: KeyboardEvent;
  keyUpEvent: any;
  keydown: any;
  wheelOffets: Point;
  movePosition: Point;
  lastMovePosition: Point;
  moveDelta: Point;

  static instance: ClientEvents = null;

  constructor({ initWheelOffset = new Point(), onAnyEvent = (ev: OnEvent) => {} }: ClientEventsArgs = {}) {
    // since we are hooking events into the document, we only want one instance of this class
    if (ClientEvents.instance) {
      return ClientEvents.instance;
    }
    this.wheelOffets = initWheelOffset;
    this.keydown = {} as any;
    this.movePosition = new Point();

    const anyEvent = (ev: OnEvent) => {
      onAnyEvent(ev);
    }

    document.addEventListener('wheel', (event) => {
      const wheelDelta = this.wheelOffets || new Point();
      const xValue = wheelDelta.x + event.deltaX;
      const yValue = wheelDelta.y + event.deltaY;
      this.wheelOffets = new Point(xValue, yValue);
      anyEvent({ eventType: 'wheel', event });
    })

    document.addEventListener('mousemove', (event) => {
      this.lastMovePosition = this.movePosition;
      this.movePosition = new Point(event.clientX, event.clientY);
      this.moveDelta = new Point(
        this.movePosition.x - this.lastMovePosition.x,
        this.movePosition.y - this.lastMovePosition.y
      );
      anyEvent({ eventType: 'mousemove', event });
    });

    document.addEventListener('mousedown', (event) => {
      this.mouseDownEvent = event;
      this.lastMouseDown = event;
      this.mouseUpEvent = null;
      anyEvent({ eventType: 'mousedown', event });
    });

    document.addEventListener('mouseup', (event) => {
      this.mouseUpEvent = event;
      this.lastMouseUp = event;
      this.mouseDownEvent = null;
      anyEvent({ eventType: 'mouseup', event });
    })

    document.addEventListener('keydown', (event) => {
      const { key } = event;
      this.keyDownEvent = event;
      this.keyUpEvent = null;
      this.keydown[key] = event;
      anyEvent({ eventType: 'keydown', event });
    });

    document.addEventListener('keyup', (event) => {
      const { key } = event;
      this.keyUpEvent = event;
      this.keyDownEvent = null;
      delete this.keydown[key];
      anyEvent({ eventType: 'keyup', event });
    });

    ClientEvents.instance = this;
  }

  isKeyDown(key: string) {
    return this.keydown[key];
  }

  isKeyUp(key: string) {
    return !this.keydown[key];
  }

}



