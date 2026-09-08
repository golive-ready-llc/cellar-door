export type DragType =
  | "wine-id"
  | "section-id"
  | "template"
  | "storage-type"
  | "case-size";

export interface DragPayload {
  type: DragType;
  data: string;
  /** Color for ghost circle (wine type color) */
  ghostColor?: string;
  /** Short label for ghost chip (e.g. "Slots", "12-pk") */
  ghostLabel?: string;
  /** Wine name for drag ghost display (wine-id type only) */
  ghostName?: string;
}

export interface DropTargetInfo {
  id: string;
  element: HTMLElement;
  accepts: DragType[];
  /** Called when a compatible drag is dropped. Receives the drag data string + pointer position */
  onDrop: (data: string, position: { x: number; y: number }) => void;
}

export interface Position {
  x: number;
  y: number;
}
