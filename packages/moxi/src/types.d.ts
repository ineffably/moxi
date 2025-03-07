export type Asset = { src: string, alias?: string };

export interface OnEvent {
  event: Event;
  eventType: string;
}
