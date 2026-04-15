export const ROOT_APPEND_DROP_ID = "studio-root-append";

export type StudioDropPosition = "before" | "inside" | "after";

const DROP_PREFIX = "studio-drop";
const DROP_SEPARATOR = "::";

export function getStudioNodeDropId(nodeId: string, position: StudioDropPosition) {
  return [DROP_PREFIX, position, nodeId].join(DROP_SEPARATOR);
}

export function parseStudioDropId(dropId: string):
  | { kind: "root" }
  | { kind: "node"; nodeId: string; position: StudioDropPosition }
  | null {
  if (dropId === ROOT_APPEND_DROP_ID) {
    return { kind: "root" };
  }

  const [prefix, position, nodeId] = dropId.split(DROP_SEPARATOR);
  if (
    prefix !== DROP_PREFIX ||
    !nodeId ||
    (position !== "before" && position !== "inside" && position !== "after")
  ) {
    return null;
  }

  return {
    kind: "node",
    nodeId,
    position,
  };
}
