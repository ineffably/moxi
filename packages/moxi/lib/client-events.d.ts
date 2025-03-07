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
    wheelDelta?: {
        yValue: 0 | number;
        xValue: 0 | number;
        xLast: number;
        yLast: number;
    };
};
export declare class ClientEvents {
    wheelDelta: {
        yValue: number;
        xValue: number;
    };
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
    static instance: ClientEvents;
    constructor({ initWheelOffset, onAnyEvent }?: ClientEventsArgs);
    isKeyDown(key: string): any;
    isKeyUp(key: string): boolean;
}
