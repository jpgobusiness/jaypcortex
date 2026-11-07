"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Pencil,
  Plus,
  Shapes,
  Trash2,
  Zap,
} from "lucide-react";
import ActivityModal from "@/components/activities/ActivityModal";
import { StatusBadge } from "@/components/activities/badges";
import WhatsAppAutomationModal from "@/components/activities/WhatsAppAutomationModal";
import {
  ShapeGraphic,
  ShapePalette,
  type MindMapShapeKind,
  type ShapeDefinition,
} from "@/components/activities/MindMapShapes";
import { Button } from "@/components/ui/form";
import Modal from "@/components/ui/Modal";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import type { Activity, ActivityStatusDef, ActivityType } from "@/lib/types";

const NODE_W = 220;
const NODE_H = 92;
const CARD_COLORS = [
  { value: null, label: "Branco", swatch: "#ffffff" },
  { value: "#fef3c7", label: "Amarelo", swatch: "#fef3c7" },
  { value: "#fee2e2", label: "Vermelho", swatch: "#fee2e2" },
  { value: "#dcfce7", label: "Verde", swatch: "#dcfce7" },
  { value: "#dbeafe", label: "Azul", swatch: "#dbeafe" },
  { value: "#ede9fe", label: "Roxo", swatch: "#ede9fe" },
  { value: "#fce7f3", label: "Rosa", swatch: "#fce7f3" },
  { value: "#e2e8f0", label: "Cinza", swatch: "#e2e8f0" },
] as const;

function elementKey(type: EndpointType, id: string) {
  return `${type}:${id}`;
}

function oppositeSide(side: EndpointSide): EndpointSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

type MapNode = {
  id: string;
  activityId: string;
  x: number;
  y: number;
  color: string | null;
  activity: Activity;
};

type EndpointType = "activity" | "shape";
type EndpointSide = "left" | "right" | "top" | "bottom";

type MapShape = {
  id: string;
  mapId: string;
  kind: MindMapShapeKind;
  label: string | null;
  iconName: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex: number;
};

type MapConnection = {
  id: string;
  fromType: EndpointType;
  fromId: string;
  fromSide: EndpointSide;
  toType: EndpointType;
  toId: string;
  toSide: EndpointSide;
};

type ElementOrigin = {
  type: EndpointType;
  id: string;
  x: number;
  y: number;
};

type MindMapRecord = {
  id: string;
  name: string;
  groupId: string | null;
  order: number;
};

type MindMapGroupRecord = {
  id: string;
  name: string;
  order: number;
};

type Camera = { x: number; y: number; scale: number };

const ACTIVE_MAP_KEY = "nuage-active-mindmap";
const PANEL_KEY = "nuage-mindmap-panel-collapsed";

type Drag =
  | { kind: "pan"; sx: number; sy: number; cx: number; cy: number }
  | { kind: "node"; id: string; dx: number; dy: number; moved: boolean }
  | {
      kind: "group";
      items: ElementOrigin[];
      sx: number;
      sy: number;
      moved: boolean;
    }
  | { kind: "shape"; id: string; dx: number; dy: number; moved: boolean }
  | {
      kind: "resize";
      id: string;
      sx: number;
      sy: number;
      width: number;
      height: number;
      moved: boolean;
    }
  | { kind: "select"; sx: number; sy: number; cx: number; cy: number }
  | {
      kind: "link";
      fromType: EndpointType;
      fromId: string;
      fromSide: EndpointSide;
    };

type Props = {
  activities: Activity[];
  types: ActivityType[];
  statuses: ActivityStatusDef[];
  onActivitiesChanged: () => void;
};

export default function ActivityMindMap({
  activities,
  types,
  statuses,
  onActivitiesChanged,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ x: 48, y: 48, scale: 1 });
  const dragRef = useRef<Drag | null>(null);
  const placeAt = useRef({ x: 120, y: 120 });

  const [camera, setCamera] = useState<Camera>(cameraRef.current);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [shapes, setShapes] = useState<MapShape[]>([]);
  const [connections, setConnections] = useState<MapConnection[]>([]);
  const [groups, setGroups] = useState<MindMapGroupRecord[]>([]);
  const [maps, setMaps] = useState<MindMapRecord[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCursor, setLinkCursor] = useState<{ x: number; y: number } | null>(
    null
  );
  const [linkingFrom, setLinkingFrom] = useState<{
    type: EndpointType;
    id: string;
    side: EndpointSide;
  } | null>(null);
  const [shapePaletteOpen, setShapePaletteOpen] = useState(false);
  const [shapeColorFor, setShapeColorFor] = useState<string | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [shapeLabelDraft, setShapeLabelDraft] = useState("");
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [queueEditingId, setQueueEditingId] = useState<string | null>(null);
  const [queueDraft, setQueueDraft] = useState("");
  const [queueUpdatingId, setQueueUpdatingId] = useState<string | null>(null);
  const [completingActivityId, setCompletingActivityId] = useState<string | null>(
    null
  );
  const [selectedElementKeys, setSelectedElementKeys] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removingActivity, setRemovingActivity] = useState<Activity | null>(null);
  const [removingActivityId, setRemovingActivityId] = useState<string | null>(
    null
  );
  const [automationActivity, setAutomationActivity] =
    useState<Activity | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMapId, setImportMapId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [nodesMapId, setNodesMapId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    kind: "map" | "group";
    groupId: string | null;
  } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renaming, setRenaming] = useState<{
    kind: "map" | "group";
    id: string;
    name: string;
  } | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [openFolderIds, setOpenFolderIds] = useState<string[]>([]);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const [draggingMap, setDraggingMap] = useState(false);
  const dragMapIdRef = useRef<string | null>(null);
  const openedForMapRef = useRef<string | null>(null);

  useEffect(() => {
    setPanelCollapsed(window.localStorage.getItem(PANEL_KEY) === "1");
  }, []);

  function togglePanel() {
    setPanelCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(PANEL_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleFolder(id: string) {
    setOpenFolderIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openFolder(id: string) {
    setOpenFolderIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  const activeMapIdRef = useRef<string | null>(null);
  activeMapIdRef.current = activeMapId;

  const loadLibrary = useCallback(async () => {
    const res = await apiGet<{
      groups: MindMapGroupRecord[];
      maps: MindMapRecord[];
    }>("/api/activities/maps");
    setGroups(res.groups);
    setMaps(res.maps);
    setActiveMapId((current) => {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_MAP_KEY)
          : null;
      const preferred = current ?? stored;
      if (preferred && res.maps.some((map) => map.id === preferred)) {
        return preferred;
      }
      return res.maps[0]?.id ?? null;
    });
    return res.maps;
  }, []);

  const loadMap = useCallback(async (mapId: string) => {
    const res = await apiGet<{
      nodes: MapNode[];
      shapes: MapShape[];
      connections: MapConnection[];
    }>(
      `/api/activities/map?mapId=${encodeURIComponent(mapId)}`
    );
    setNodes(res.nodes);
    setShapes(res.shapes);
    setConnections(res.connections);
    setNodesMapId(mapId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadLibrary();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLibrary]);

  useEffect(() => {
    if (!activeMapId) {
      setNodes([]);
      setShapes([]);
      setConnections([]);
      setNodesMapId(null);
      return;
    }
    window.localStorage.setItem(ACTIVE_MAP_KEY, activeMapId);
    let cancelled = false;
    (async () => {
      try {
        await loadMap(activeMapId);
      } catch {
        if (!cancelled) {
          setNodes([]);
          setShapes([]);
          setConnections([]);
          setNodesMapId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMapId, loadMap]);

  useEffect(() => {
    if (!activeMapId || openedForMapRef.current === activeMapId) return;
    const groupId = maps.find((map) => map.id === activeMapId)?.groupId;
    if (!groupId) return;
    openedForMapRef.current = activeMapId;
    openFolder(groupId);
  }, [activeMapId, maps]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cam = cameraRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextScale = Math.min(1.8, Math.max(0.45, cam.scale * factor));
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const wx = (px - cam.x) / cam.scale;
      const wy = (py - cam.y) / cam.scale;
      const next = {
        scale: nextScale,
        x: px - wx * nextScale,
        y: py - wy * nextScale,
      };
      cameraRef.current = next;
      setCamera(next);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const byId = useMemo(
    () => new Map(nodes.map((n) => [n.activityId, n])),
    [nodes]
  );
  const shapeById = useMemo(
    () => new Map(shapes.map((shape) => [shape.id, shape])),
    [shapes]
  );

  const onMap = useMemo(
    () => new Set(nodes.map((n) => n.activityId)),
    [nodes]
  );
  const queueActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.queueOrder != null)
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
    [activities]
  );
  const queuePositionById = useMemo(
    () =>
      new Map(
        queueActivities.map((activity, index) => [activity.id, index + 1])
      ),
    [queueActivities]
  );
  const doneStatus = useMemo(
    () => statuses.find((status) => status.isDone),
    [statuses]
  );

  function endpointBox(type: EndpointType, id: string) {
    if (type === "activity") {
      const node = byId.get(id);
      return node
        ? { x: node.x, y: node.y, width: NODE_W, height: NODE_H }
        : null;
    }
    const shape = shapeById.get(id);
    return shape
      ? {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        }
      : null;
  }

  function endpointPoint(
    type: EndpointType,
    id: string,
    side: EndpointSide
  ) {
    const box = endpointBox(type, id);
    if (!box) return null;
    if (side === "left") return { x: box.x, y: box.y + box.height / 2 };
    if (side === "right") {
      return { x: box.x + box.width, y: box.y + box.height / 2 };
    }
    if (side === "top") return { x: box.x + box.width / 2, y: box.y };
    return { x: box.x + box.width / 2, y: box.y + box.height };
  }

  function worldFromClient(clientX: number, clientY: number) {
    const rect = viewportRef.current!.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (clientX - rect.left - cam.x) / cam.scale,
      y: (clientY - rect.top - cam.y) / cam.scale,
    };
  }

  function viewportCenter() {
    const rect = viewportRef.current!.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (rect.width / 2 - cam.x) / cam.scale - NODE_W / 2,
      y: (rect.height / 2 - cam.y) / cam.scale - NODE_H / 2,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button === 2) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        kind: "select",
        sx: e.clientX,
        sy: e.clientY,
        cx: e.clientX,
        cy: e.clientY,
      };
      setColorPickerFor(null);
      setShapeColorFor(null);
      setSelectionBox({
        left: e.clientX - rect.left,
        top: e.clientY - rect.top,
        width: 0,
        height: 0,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-link-handle]");
    const resizeHandle = target.closest<HTMLElement>("[data-resize-handle]");
    const card = target.closest("[data-node-id]") as HTMLElement | null;
    const shapeElement = target.closest("[data-shape-id]") as HTMLElement | null;
    if (
      target.closest("button, select, input, textarea, [contenteditable]") &&
      !handle &&
      !resizeHandle
    ) {
      return;
    }

    if (handle) {
      const fromType = handle.dataset.endpointType as EndpointType;
      const fromId = handle.dataset.endpointId!;
      const fromSide = handle.dataset.endpointSide as EndpointSide;
      dragRef.current = { kind: "link", fromType, fromId, fromSide };
      setLinkingFrom({ type: fromType, id: fromId, side: fromSide });
      setLinkCursor(worldFromClient(e.clientX, e.clientY));
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (resizeHandle && shapeElement) {
      const id = shapeElement.dataset.shapeId!;
      const shape = shapeById.get(id);
      if (!shape) return;
      const w = worldFromClient(e.clientX, e.clientY);
      dragRef.current = {
        kind: "resize",
        id,
        sx: w.x,
        sy: w.y,
        width: shape.width,
        height: shape.height,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const selectedKey = card
      ? elementKey("activity", card.dataset.nodeId!)
      : shapeElement
        ? elementKey("shape", shapeElement.dataset.shapeId!)
        : null;
    if (
      selectedKey &&
      selectedElementKeys.includes(selectedKey) &&
      selectedElementKeys.length > 1
    ) {
      const items: ElementOrigin[] = [
        ...nodes
          .filter((item) =>
            selectedElementKeys.includes(elementKey("activity", item.activityId))
          )
          .map((item) => ({
            type: "activity" as const,
            id: item.activityId,
            x: item.x,
            y: item.y,
          })),
        ...shapes
          .filter((item) =>
            selectedElementKeys.includes(elementKey("shape", item.id))
          )
          .map((item) => ({
            type: "shape" as const,
            id: item.id,
            x: item.x,
            y: item.y,
          })),
      ];
      const w = worldFromClient(e.clientX, e.clientY);
      dragRef.current = {
        kind: "group",
        items,
        sx: w.x,
        sy: w.y,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (card) {
      const id = card.dataset.nodeId!;
      const node = byId.get(id);
      if (!node) return;
      const w = worldFromClient(e.clientX, e.clientY);
      setSelectedElementKeys([]);
      dragRef.current = {
        kind: "node",
        id,
        dx: w.x - node.x,
        dy: w.y - node.y,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (shapeElement) {
      const id = shapeElement.dataset.shapeId!;
      const shape = shapeById.get(id);
      if (!shape) return;
      const w = worldFromClient(e.clientX, e.clientY);
      setSelectedElementKeys([]);
      dragRef.current = {
        kind: "shape",
        id,
        dx: w.x - shape.x,
        dy: w.y - shape.y,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (target.closest("[data-edge-hit]")) return;

    setSelectedElementKeys([]);
    const cam = cameraRef.current;
    dragRef.current = {
      kind: "pan",
      sx: e.clientX,
      sy: e.clientY,
      cx: cam.x,
      cy: cam.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "select") {
      drag.cx = e.clientX;
      drag.cy = e.clientY;
      const rect = e.currentTarget.getBoundingClientRect();
      setSelectionBox({
        left: Math.min(drag.sx, e.clientX) - rect.left,
        top: Math.min(drag.sy, e.clientY) - rect.top,
        width: Math.abs(e.clientX - drag.sx),
        height: Math.abs(e.clientY - drag.sy),
      });
      return;
    }
    if (drag.kind === "pan") {
      const next = {
        ...cameraRef.current,
        x: drag.cx + (e.clientX - drag.sx),
        y: drag.cy + (e.clientY - drag.sy),
      };
      cameraRef.current = next;
      setCamera(next);
      return;
    }
    const w = worldFromClient(e.clientX, e.clientY);
    if (drag.kind === "node") {
      drag.moved = true;
      const x = w.x - drag.dx;
      const y = w.y - drag.dy;
      setNodes((prev) =>
        prev.map((n) => (n.activityId === drag.id ? { ...n, x, y } : n))
      );
      return;
    }
    if (drag.kind === "shape") {
      drag.moved = true;
      const x = w.x - drag.dx;
      const y = w.y - drag.dy;
      setShapes((current) =>
        current.map((shape) => (shape.id === drag.id ? { ...shape, x, y } : shape))
      );
      return;
    }
    if (drag.kind === "resize") {
      drag.moved = true;
      setShapes((current) =>
        current.map((shape) =>
          shape.id === drag.id
            ? {
                ...shape,
                width: Math.max(48, drag.width + (w.x - drag.sx)),
                height: Math.max(48, drag.height + (w.y - drag.sy)),
              }
            : shape
        )
      );
      return;
    }
    if (drag.kind === "group") {
      drag.moved = true;
      const dx = w.x - drag.sx;
      const dy = w.y - drag.sy;
      setNodes((current) =>
        current.map((node) => {
          const origin = drag.items.find(
            (item) => item.type === "activity" && item.id === node.activityId
          );
          return origin
            ? { ...node, x: origin.x + dx, y: origin.y + dy }
            : node;
        })
      );
      setShapes((current) =>
        current.map((shape) => {
          const origin = drag.items.find(
            (item) => item.type === "shape" && item.id === shape.id
          );
          return origin
            ? { ...shape, x: origin.x + dx, y: origin.y + dy }
            : shape;
        })
      );
      return;
    }
    setLinkCursor(w);
  }

  async function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    setLinkCursor(null);
    setLinkingFrom(null);
    if (!drag) return;

    if (drag.kind === "select") {
      setSelectionBox(null);
      const left = Math.min(drag.sx, e.clientX);
      const right = Math.max(drag.sx, e.clientX);
      const top = Math.min(drag.sy, e.clientY);
      const bottom = Math.max(drag.sy, e.clientY);
      const selected = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>(
          "[data-node-id], [data-shape-id]"
        )
      )
        .filter((card) => {
          const rect = card.getBoundingClientRect();
          return (
            rect.right >= left &&
            rect.left <= right &&
            rect.bottom >= top &&
            rect.top <= bottom
          );
        })
        .map((element) =>
          element.dataset.nodeId
            ? elementKey("activity", element.dataset.nodeId)
            : elementKey("shape", element.dataset.shapeId!)
        );
      setSelectedElementKeys(selected);
      return;
    }

    if (drag.kind === "node" && drag.moved) {
      const node = nodes.find((n) => n.activityId === drag.id);
      const w = worldFromClient(e.clientX, e.clientY);
      const x = w.x - drag.dx;
      const y = w.y - drag.dy;
      if (node) {
        try {
          await apiPatch(
            `/api/activities/map/nodes/${drag.id}?mapId=${encodeURIComponent(activeMapIdRef.current ?? "")}`,
            { x, y }
          );
        } catch {
          await refreshCurrent();
        }
      }
      return;
    }

    if (drag.kind === "shape" && drag.moved) {
      const mapId = activeMapIdRef.current;
      if (!mapId) return;
      const w = worldFromClient(e.clientX, e.clientY);
      try {
        await apiPatch(
          `/api/activities/map/shapes/${drag.id}?mapId=${encodeURIComponent(mapId)}`,
          { x: w.x - drag.dx, y: w.y - drag.dy }
        );
      } catch {
        await refreshCurrent();
      }
      return;
    }

    if (drag.kind === "resize" && drag.moved) {
      const mapId = activeMapIdRef.current;
      if (!mapId) return;
      const w = worldFromClient(e.clientX, e.clientY);
      try {
        await apiPatch(
          `/api/activities/map/shapes/${drag.id}?mapId=${encodeURIComponent(mapId)}`,
          {
            width: Math.max(48, drag.width + (w.x - drag.sx)),
            height: Math.max(48, drag.height + (w.y - drag.sy)),
          }
        );
      } catch {
        await refreshCurrent();
      }
      return;
    }

    if (drag.kind === "group" && drag.moved) {
      const mapId = activeMapIdRef.current;
      if (!mapId) return;
      const w = worldFromClient(e.clientX, e.clientY);
      const dx = w.x - drag.sx;
      const dy = w.y - drag.sy;
      try {
        await Promise.all(
          drag.items.map((origin) => {
            const path =
              origin.type === "activity"
                ? `/api/activities/map/nodes/${origin.id}`
                : `/api/activities/map/shapes/${origin.id}`;
            return apiPatch(
              `${path}?mapId=${encodeURIComponent(mapId)}`,
              { x: origin.x + dx, y: origin.y + dy }
            );
          })
        );
      } catch {
        await refreshCurrent();
      }
      return;
    }

    if (drag.kind === "link") {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const endpoint = el?.closest<HTMLElement>(
        "[data-endpoint-id], [data-node-id], [data-shape-id]"
      );
      const toType = (endpoint?.dataset.endpointType ??
        (endpoint?.dataset.nodeId ? "activity" : "shape")) as EndpointType;
      const toId =
        endpoint?.dataset.endpointId ??
        endpoint?.dataset.nodeId ??
        endpoint?.dataset.shapeId;
      const toSide =
        (endpoint?.dataset.endpointSide as EndpointSide | undefined) ??
        oppositeSide(drag.fromSide);
      if (
        !toId ||
        (toType === drag.fromType && toId === drag.fromId)
      ) {
        return;
      }
      try {
        await apiPost("/api/activities/map/connections", {
          mapId: activeMapIdRef.current,
          fromType: drag.fromType,
          fromId: drag.fromId,
          fromSide: drag.fromSide,
          toType,
          toId,
          toSide,
        });
        await refreshCurrent();
      } catch {
        await refreshCurrent();
      }
    }
  }

  async function refreshCurrent() {
    const id = activeMapIdRef.current;
    if (id) await loadMap(id);
  }

  function openImport(mapId: string | null) {
    if (!mapId) return;
    setImportMapId(mapId);
    setImportOpen(true);
    if (activeMapIdRef.current !== mapId) {
      activeMapIdRef.current = mapId;
      setActiveMapId(mapId);
    }
  }

  async function importSelected(ids: string[]) {
    const mapId = importMapId;
    if (!mapId || ids.length === 0) return;
    setImporting(true);
    try {
      const center = viewportCenter();
      for (let index = 0; index < ids.length; index++) {
        const col = index % 4;
        const row = Math.floor(index / 4);
        await apiPost("/api/activities/map", {
          mapId,
          activityId: ids[index],
          x: center.x + col * (NODE_W + 28),
          y: center.y + row * (NODE_H + 28),
        });
      }
      if (activeMapIdRef.current === mapId) await refreshCurrent();
      setImportOpen(false);
    } finally {
      setImporting(false);
    }
  }

  async function removeFromMap(activityId: string) {
    if (!activeMapIdRef.current) return;
    await apiDelete(
      `/api/activities/map/nodes/${activityId}?mapId=${encodeURIComponent(activeMapIdRef.current)}`
    );
    await refreshCurrent();
  }

  async function confirmRemoveFromMap() {
    if (!removingActivity) return;
    setRemovingActivityId(removingActivity.id);
    try {
      await removeFromMap(removingActivity.id);
      setRemovingActivity(null);
    } finally {
      setRemovingActivityId(null);
    }
  }

  async function completeAndRemoveFromMap(activityId: string) {
    if (!doneStatus) {
      window.alert("Cadastre um status de conclusão antes de concluir atividades.");
      return;
    }
    setCompletingActivityId(activityId);
    try {
      await apiPatch(`/api/activities/${activityId}`, {
        status: doneStatus.key,
      });
      await removeFromMap(activityId);
      onActivitiesChanged();
    } catch {
      await refreshCurrent();
      window.alert("Não foi possível concluir a atividade. Tente novamente.");
    } finally {
      setCompletingActivityId(null);
    }
  }

  async function changeNodeColor(activityId: string, color: string | null) {
    const mapId = activeMapIdRef.current;
    if (!mapId) return;
    setColorPickerFor(null);
    setNodes((current) =>
      current.map((node) =>
        node.activityId === activityId ? { ...node, color } : node
      )
    );
    try {
      await apiPatch(
        `/api/activities/map/nodes/${activityId}?mapId=${encodeURIComponent(mapId)}`,
        { color }
      );
    } catch {
      await refreshCurrent();
    }
  }

  async function setQueuePosition(activityId: string, position: number | null) {
    setQueueUpdatingId(activityId);
    try {
      if (position === null) {
        await apiDelete(
          `/api/activities/queue?id=${encodeURIComponent(activityId)}`
        );
      } else {
        const orderedIds = queueActivities
          .map((activity) => activity.id)
          .filter((id) => id !== activityId);
        const target = Math.max(0, Math.min(position - 1, orderedIds.length));
        orderedIds.splice(target, 0, activityId);
        await apiPatch("/api/activities/queue", { orderedIds });
      }
      await refreshCurrent();
      onActivitiesChanged();
    } finally {
      setQueueUpdatingId(null);
    }
  }

  function commitQueuePosition(
    activityId: string,
    currentPosition: number | null
  ) {
    const value = queueDraft.trim();
    setQueueEditingId(null);
    if (value === "") {
      if (currentPosition !== null) {
        void setQueuePosition(activityId, null);
      }
      return;
    }
    const position = Math.max(1, Math.floor(Number(value)));
    if (!Number.isFinite(position) || position === currentPosition) return;
    void setQueuePosition(activityId, position);
  }

  async function createShape(definition: ShapeDefinition) {
    const mapId = activeMapIdRef.current;
    if (!mapId) return;
    const center = viewportCenter();
    const shape = await apiPost<MapShape>("/api/activities/map/shapes", {
      mapId,
      kind: definition.kind,
      label: definition.label,
      x: center.x + NODE_W / 2 - definition.width / 2,
      y: center.y + NODE_H / 2 - definition.height / 2,
      width: definition.width,
      height: definition.height,
      color: "#ede9fe",
    });
    setShapes((current) => [...current, shape]);
    setShapePaletteOpen(false);
  }

  async function changeShapeColor(id: string, color: string) {
    const mapId = activeMapIdRef.current;
    if (!mapId) return;
    setShapeColorFor(null);
    setShapes((current) =>
      current.map((shape) => (shape.id === id ? { ...shape, color } : shape))
    );
    try {
      await apiPatch(
        `/api/activities/map/shapes/${id}?mapId=${encodeURIComponent(mapId)}`,
        { color }
      );
    } catch {
      await refreshCurrent();
    }
  }

  function startShapeEditing(shape: MapShape) {
    setEditingShapeId(shape.id);
    setShapeLabelDraft(shape.label ?? "");
  }

  async function saveShapeLabel(id: string) {
    const mapId = activeMapIdRef.current;
    if (!mapId) return;
    const label = shapeLabelDraft.trim();
    setEditingShapeId(null);
    setShapes((current) =>
      current.map((shape) => (shape.id === id ? { ...shape, label } : shape))
    );
    try {
      await apiPatch(
        `/api/activities/map/shapes/${id}?mapId=${encodeURIComponent(mapId)}`,
        { label }
      );
    } catch {
      await refreshCurrent();
    }
  }

  async function deleteShape(shape: MapShape) {
    const mapId = activeMapIdRef.current;
    if (!mapId || !confirm(`Excluir a forma "${shape.label ?? "sem texto"}"?`)) {
      return;
    }
    await apiDelete(
      `/api/activities/map/shapes/${shape.id}?mapId=${encodeURIComponent(mapId)}`
    );
    setShapes((current) => current.filter((item) => item.id !== shape.id));
    setConnections((current) =>
      current.filter(
        (connection) =>
          !(
            (connection.fromType === "shape" &&
              connection.fromId === shape.id) ||
            (connection.toType === "shape" && connection.toId === shape.id)
          )
      )
    );
  }

  async function removeConnection(id: string) {
    await apiDelete(`/api/activities/map/connections/${id}`);
    setConnections((current) =>
      current.filter((connection) => connection.id !== id)
    );
  }

  function openEdit(activity: Activity) {
    setEditing(activity);
    setModalOpen(true);
  }

  async function onSaved(activity: Activity) {
    if (!editing && activeMapIdRef.current) {
      await apiPost("/api/activities/map", {
        mapId: activeMapIdRef.current,
        activityId: activity.id,
        x: placeAt.current.x,
        y: placeAt.current.y,
      });
    }
    await refreshCurrent();
    onActivitiesChanged();
  }

  const linkingPoint = linkingFrom
    ? endpointPoint(linkingFrom.type, linkingFrom.id, linkingFrom.side)
    : null;
  const ungrouped = maps
    .filter((map) => !map.groupId)
    .sort((a, b) => a.order - b.order);
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  async function submitDraft() {
    const name = draftName.trim();
    if (!draft || !name) return;
    if (draft.kind === "group") {
      await apiPost("/api/activities/maps/groups", { name });
    } else {
      const created = await apiPost<MindMapRecord>("/api/activities/maps", {
        name,
        groupId: draft.groupId,
      });
      setActiveMapId(created.id);
    }
    setDraft(null);
    setDraftName("");
    await loadLibrary();
  }

  async function saveRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) {
      setRenaming(null);
      return;
    }
    const url =
      renaming.kind === "group"
        ? `/api/activities/maps/groups/${renaming.id}`
        : `/api/activities/maps/${renaming.id}`;
    await apiPatch(url, { name });
    setRenaming(null);
    await loadLibrary();
  }

  async function moveMap(mapId: string, groupId: string | null) {
    const siblings = maps.filter(
      (map) => map.id !== mapId && (map.groupId ?? null) === groupId
    );
    const order = siblings.reduce((max, map) => Math.max(max, map.order), -1) + 1;
    await apiPatch(`/api/activities/maps/${mapId}`, { groupId, order });
    await loadLibrary();
  }

  function dropMapOn(groupId: string | null) {
    const id = dragMapIdRef.current;
    dragMapIdRef.current = null;
    setDropGroupId(null);
    if (!id) return;
    const map = maps.find((item) => item.id === id);
    if (!map || (map.groupId ?? null) === groupId) return;
    if (groupId) openFolder(groupId);
    void moveMap(id, groupId);
  }

  async function deleteMap(map: MindMapRecord) {
    if (
      !confirm(
        `Excluir o mapa "${map.name}"? As atividades continuam. Só este quadro some.`
      )
    ) {
      return;
    }
    await apiDelete(`/api/activities/maps/${map.id}`);
    if (activeMapId === map.id) {
      const rest = maps.filter((item) => item.id !== map.id);
      setActiveMapId(rest[0]?.id ?? null);
    }
    await loadLibrary();
  }

  async function deleteGroup(group: MindMapGroupRecord) {
    if (
      !confirm(
        `Excluir o grupo "${group.name}"? Os mapas dele continuam, fora do grupo.`
      )
    ) {
      return;
    }
    await apiDelete(`/api/activities/maps/groups/${group.id}`);
    await loadLibrary();
  }

  function startDraft(kind: "map" | "group", groupId: string | null = null) {
    setDraft({ kind, groupId });
    setDraftName(kind === "group" ? "" : "Novo mapa");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row">
          <aside
            className={`flex shrink-0 flex-col border-[var(--border)] bg-[#eceef2] ${
              panelCollapsed
                ? "h-12 w-full flex-row items-center border-b md:h-auto md:w-12 md:flex-col md:border-b-0 md:border-r"
                : "max-h-[42vh] w-full border-b md:max-h-none md:w-72 md:border-b-0 md:border-r"
            }`}
          >
            {!panelCollapsed && (
              <>
            <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-2">
              <Button variant="outline" onClick={() => startDraft("group")}>
                <FolderPlus className="h-3.5 w-3.5" /> Grupo
              </Button>
              <Button variant="outline" onClick={() => startDraft("map", null)}>
                <Plus className="h-3.5 w-3.5" /> Mapa
              </Button>
            </div>
            {draft && (
              <form
                className="flex gap-1 border-b border-[var(--border)] p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitDraft();
                }}
              >
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={draft.kind === "group" ? "Nome do grupo" : "Nome do mapa"}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] px-2 py-1 text-xs outline-none focus:border-[var(--brand)]"
                />
                <button type="submit" className="text-xs font-semibold text-[var(--brand-600)]">
                  Ok
                </button>
              </form>
            )}
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              <div
                className={`rounded-md ${
                  dropGroupId === "root" ? "bg-[var(--brand)]/10" : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropGroupId("root");
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropMapOn(null);
                }}
              >
                {draggingMap && ungrouped.length === 0 && (
                  <p className="px-2 py-2 text-[11px] text-[var(--muted)]">
                    Solte aqui para deixar fora das pastas.
                  </p>
                )}
                {ungrouped.map((map) => (
                  <MapRow
                    key={map.id}
                    map={map}
                    selected={map.id === activeMapId}
                    renaming={renaming}
                    onSelect={setActiveMapId}
                    onRenameStart={(item) =>
                      setRenaming({ kind: "map", id: item.id, name: item.name })
                    }
                    onRenameChange={(name) =>
                      setRenaming((current) => (current ? { ...current, name } : current))
                    }
                    onRenameCommit={() => void saveRename()}
                    onDelete={(item) => void deleteMap(item)}
                    onDragStart={(id) => {
                      dragMapIdRef.current = id;
                      setDraggingMap(true);
                    }}
                    onDragEnd={() => {
                      dragMapIdRef.current = null;
                      setDraggingMap(false);
                      setDropGroupId(null);
                    }}
                    onAdd={(item) => openImport(item.id)}
                  />
                ))}
              </div>
              {sortedGroups.map((group) => {
                const inGroup = maps
                  .filter((map) => map.groupId === group.id)
                  .sort((a, b) => a.order - b.order);
                const open = openFolderIds.includes(group.id);
                const over = dropGroupId === group.id;
                return (
                  <div key={group.id}>
                    <div
                      className={`group/folder flex items-center gap-1 rounded-md px-1.5 py-1 ${
                        over ? "bg-[var(--brand)]/15" : "hover:bg-black/[0.04]"
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropGroupId(group.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropMapOn(group.id);
                      }}
                    >
                      {renaming?.kind === "group" && renaming.id === group.id ? (
                        <input
                          autoFocus
                          value={renaming.name}
                          onChange={(event) =>
                            setRenaming({ ...renaming, name: event.target.value })
                          }
                          onBlur={() => void saveRename()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveRename();
                          }}
                          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-white px-1.5 py-0.5 text-sm outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleFolder(group.id)}
                          onDoubleClick={() =>
                            setRenaming({ kind: "group", id: group.id, name: group.name })
                          }
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          title="Clique para abrir. Dois cliques para renomear."
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${
                              open ? "rotate-90" : ""
                            }`}
                          />
                          {open ? (
                            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                          ) : (
                            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)]">
                            {group.name}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Excluir grupo"
                        title="Excluir grupo"
                        onClick={() => void deleteGroup(group)}
                        className="rounded p-1 text-[var(--muted)] opacity-0 hover:bg-black/5 hover:text-red-600 group-hover/folder:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {open && (
                      <div
                        className={`ml-3 border-l border-[var(--border)] pl-1 ${
                          over ? "bg-[var(--brand)]/10" : ""
                        }`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDropGroupId(group.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          dropMapOn(group.id);
                        }}
                      >
                        {inGroup.length === 0 && (
                          <p className="px-2 py-1 text-[11px] text-[var(--muted)]">
                            Pasta vazia. Arraste um mapa para cá.
                          </p>
                        )}
                        {inGroup.map((map) => (
                          <MapRow
                            key={map.id}
                            map={map}
                            selected={map.id === activeMapId}
                            renaming={renaming}
                            onSelect={setActiveMapId}
                            onRenameStart={(item) =>
                              setRenaming({ kind: "map", id: item.id, name: item.name })
                            }
                            onRenameChange={(name) =>
                              setRenaming((current) =>
                                current ? { ...current, name } : current
                              )
                            }
                            onRenameCommit={() => void saveRename()}
                            onDelete={(item) => void deleteMap(item)}
                            onDragStart={(id) => {
                              dragMapIdRef.current = id;
                              setDraggingMap(true);
                            }}
                            onDragEnd={() => {
                              dragMapIdRef.current = null;
                              setDraggingMap(false);
                              setDropGroupId(null);
                            }}
                            onAdd={(item) => openImport(item.id)}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => startDraft("map", group.id)}
                          className="px-2 py-1 text-[11px] font-medium text-[var(--brand-600)]"
                        >
                          + Mapa nesta pasta
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
              </>
            )}
            <div className={panelCollapsed ? "flex w-full items-center justify-center py-2" : "border-t border-[var(--border)] px-2 py-2"}>
              <button
                type="button"
                onClick={togglePanel}
                className={`flex min-h-11 items-center gap-3 rounded-lg py-2 text-sm font-medium text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--foreground)] ${
                  panelCollapsed ? "h-11 w-11 justify-center" : "w-full px-3"
                }`}
                aria-label={panelCollapsed ? "Expandir menu do mapa" : "Recolher menu do mapa"}
                title={panelCollapsed ? "Expandir menu do mapa" : "Recolher menu do mapa"}
              >
                {panelCollapsed ? (
                  <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
                ) : (
                  <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
                )}
                {!panelCollapsed && <span>Recolher</span>}
              </button>
            </div>
          </aside>

        <div
          ref={viewportRef}
          className={`relative min-w-0 flex-1 overflow-hidden ${
            selectionBox
              ? "cursor-crosshair"
              : "cursor-grab active:cursor-grabbing"
          }`}
          style={{
            backgroundColor: "#f8fafc",
            backgroundImage:
              "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: `${22 * camera.scale}px ${22 * camera.scale}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(event) => event.preventDefault()}
        >
          {loading && (
            <p className="absolute left-4 top-4 text-sm text-[var(--muted)]">
              Carregando mapa...
            </p>
          )}
          {activeMapId && (
            <>
              <button
                type="button"
                aria-label="Adicionar formas"
                title="Adicionar formas"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setShapePaletteOpen((current) => !current)}
                className="absolute right-16 top-3 z-40 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] shadow-md hover:border-[var(--brand)]"
              >
                <Shapes className="h-5 w-5 text-[var(--brand)]" />
                Formas
              </button>
              <button
                type="button"
                aria-label="Importar atividades"
                title="Importar atividades"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => openImport(activeMapId)}
                className="absolute right-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-white shadow-md hover:bg-[var(--brand-600)]"
              >
                <Plus className="h-5 w-5" />
              </button>
              {shapePaletteOpen && (
                <ShapePalette
                  onChoose={(definition) => void createShape(definition)}
                />
              )}
            </>
          )}
          {!loading && nodes.length === 0 && shapes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="max-w-sm text-sm text-[var(--muted)]">
                O mapa está vazio. Use o + para importar atividades.
              </p>
            </div>
          )}
          {selectionBox && (
            <div
              className="pointer-events-none absolute z-40 border border-[var(--brand)] bg-[var(--brand)]/10"
              style={selectionBox}
            />
          )}
          {selectedElementKeys.length > 1 && !selectionBox && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-white shadow">
              {selectedElementKeys.length} elementos selecionados
            </div>
          )}

          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              className="absolute overflow-visible"
              width="1"
              height="1"
              style={{ left: 0, top: 0, pointerEvents: "none" }}
            >
              <defs>
                <marker
                  id="mindmap-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
                </marker>
              </defs>
              {connections.map((connection) => {
                const a = endpointPoint(
                  connection.fromType,
                  connection.fromId,
                  connection.fromSide
                );
                const b = endpointPoint(
                  connection.toType,
                  connection.toId,
                  connection.toSide
                );
                if (!a || !b) return null;
                const distance = Math.max(
                  45,
                  Math.hypot(b.x - a.x, b.y - a.y) * 0.3
                );
                const offset = (
                  point: { x: number; y: number },
                  side: EndpointSide
                ) => {
                  if (side === "left") return { x: point.x - distance, y: point.y };
                  if (side === "right") return { x: point.x + distance, y: point.y };
                  if (side === "top") return { x: point.x, y: point.y - distance };
                  return { x: point.x, y: point.y + distance };
                };
                const c1 = offset(a, connection.fromSide);
                const c2 = offset(b, connection.toSide);
                const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
                return (
                  <g key={connection.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth={2}
                      markerEnd="url(#mindmap-arrow)"
                    />
                    <path
                      data-edge-hit="true"
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      className="cursor-pointer"
                      style={{ pointerEvents: "stroke" }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (confirm("Remover esta ligação?")) {
                          void removeConnection(connection.id);
                        }
                      }}
                    />
                  </g>
                );
              })}
              {linkingPoint && linkCursor && (
                <path
                  d={`M ${linkingPoint.x} ${linkingPoint.y} L ${linkCursor.x} ${linkCursor.y}`}
                  fill="none"
                  stroke="#7b68ee"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}
            </svg>

            {shapes.map((shape) => {
              const selected = selectedElementKeys.includes(
                elementKey("shape", shape.id)
              );
              return (
                <div
                  key={shape.id}
                  data-shape-id={shape.id}
                  data-endpoint-type="shape"
                  data-endpoint-id={shape.id}
                  className={`group/shape absolute cursor-grab active:cursor-grabbing ${
                    selected ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""
                  } ${shapeColorFor === shape.id ? "z-20" : ""}`}
                  style={{
                    left: shape.x,
                    top: shape.y,
                    width: shape.width,
                    height: shape.height,
                    zIndex:
                      shapeColorFor === shape.id ? 30 : shape.zIndex,
                  }}
                  onDoubleClick={() => startShapeEditing(shape)}
                >
                  <ShapeGraphic kind={shape.kind} color={shape.color} />
                  <div className="pointer-events-none absolute inset-[12%] flex items-center justify-center text-center">
                    {editingShapeId === shape.id ? (
                      <div className="pointer-events-auto flex w-full items-center gap-1">
                        <input
                          autoFocus
                          value={shapeLabelDraft}
                          onChange={(event) =>
                            setShapeLabelDraft(event.target.value)
                          }
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.parentElement?.contains(
                                event.relatedTarget
                              )
                            ) {
                              void saveShapeLabel(shape.id);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveShapeLabel(shape.id);
                            }
                          }}
                          onDoubleClick={(event) => event.stopPropagation()}
                          className="min-w-0 flex-1 rounded border border-[var(--brand)] bg-white/90 px-2 py-1 text-center text-sm font-medium outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Salvar texto da forma"
                          title="Salvar"
                          onClick={() => void saveShapeLabel(shape.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand-600)]"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Clique para editar o texto"
                        onClick={() => startShapeEditing(shape)}
                        className="pointer-events-auto line-clamp-4 cursor-text break-words rounded px-1 text-sm font-medium text-slate-800 hover:bg-white/60"
                      >
                        {shape.label}
                      </button>
                    )}
                  </div>
                  <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/shape:opacity-100">
                    <button
                      type="button"
                      aria-label="Editar texto da forma"
                      title="Editar texto"
                      onClick={() => startShapeEditing(shape)}
                      className="rounded bg-white/90 p-1 text-[var(--muted)] shadow-sm hover:text-[var(--brand)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Alterar cor da forma"
                      title="Alterar cor"
                      onClick={() =>
                        setShapeColorFor((current) =>
                          current === shape.id ? null : shape.id
                        )
                      }
                      className="rounded bg-white/90 p-1 text-[var(--muted)] shadow-sm hover:text-[var(--brand)]"
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir forma"
                      title="Excluir forma"
                      onClick={() => void deleteShape(shape)}
                      className="rounded bg-white/90 p-1 text-[var(--muted)] shadow-sm hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {shapeColorFor === shape.id && (
                    <div
                      className="absolute right-0 top-9 z-30 grid grid-cols-4 gap-1.5 rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg"
                      aria-label="Cores da forma"
                    >
                      {CARD_COLORS.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-label={option.label}
                          title={option.label}
                          onClick={() =>
                            void changeShapeColor(shape.id, option.swatch)
                          }
                          className={`h-6 w-6 rounded-full border ${
                            shape.color === option.swatch
                              ? "ring-2 ring-[var(--brand)] ring-offset-1"
                              : "border-black/15"
                          }`}
                          style={{ backgroundColor: option.swatch }}
                        />
                      ))}
                    </div>
                  )}
                  {(["left", "right", "top", "bottom"] as EndpointSide[]).map(
                    (side) => (
                      <button
                        key={side}
                        type="button"
                        data-link-handle="true"
                        data-endpoint-type="shape"
                        data-endpoint-id={shape.id}
                        data-endpoint-side={side}
                        title={`Conectar por ${side}`}
                        className={`absolute h-4 w-4 rounded-full border-2 border-white bg-[#64748b] shadow ${
                          side === "left"
                            ? "-left-2 top-1/2 -translate-y-1/2"
                            : side === "right"
                              ? "-right-2 top-1/2 -translate-y-1/2"
                              : side === "top"
                                ? "-top-2 left-1/2 -translate-x-1/2"
                                : "-bottom-2 left-1/2 -translate-x-1/2"
                        }`}
                      />
                    )
                  )}
                  <button
                    type="button"
                    data-resize-handle="true"
                    title="Redimensionar"
                    className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[var(--brand)] shadow"
                  />
                </div>
              );
            })}

            {nodes.map((node) => {
              const status = statuses.find((s) => s.key === node.activity.status);
              const accent = node.activity.type?.color ?? status?.color ?? "#6366f1";
              const queuePosition =
                queuePositionById.get(node.activityId) ?? null;
              return (
                <div
                  key={node.id}
                  data-node-id={node.activityId}
                  data-endpoint-type="activity"
                  data-endpoint-id={node.activityId}
                  className={`absolute cursor-grab rounded-xl border shadow-sm active:cursor-grabbing ${
                    colorPickerFor === node.activityId
                      ? "z-20"
                      : selectedElementKeys.includes(
                            elementKey("activity", node.activityId)
                          )
                        ? "z-10 ring-2 ring-[var(--brand)] ring-offset-2"
                        : ""
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_W,
                    minHeight: NODE_H,
                    borderColor: `${accent}55`,
                    backgroundColor: node.color ?? "#ffffff",
                  }}
                  onDoubleClick={() => openEdit(node.activity)}
                >
                  <div
                    className="h-1.5 rounded-t-xl"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="px-3 pb-12 pt-3 pr-24">
                    <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                      {node.activity.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Automações da atividade"
                    title="Automações"
                    onClick={() => setAutomationActivity(node.activity)}
                    className="absolute right-[4.75rem] top-3 rounded bg-amber-50 p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Alterar cor do card"
                    title="Alterar cor do card"
                    onClick={() =>
                      setColorPickerFor((current) =>
                        current === node.activityId ? null : node.activityId
                      )
                    }
                    className="absolute right-[3.25rem] top-3 rounded p-1 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--brand)]"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Editar atividade"
                    title="Editar atividade"
                    onClick={() => openEdit(node.activity)}
                    className="absolute right-7 top-3 rounded p-1 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--brand)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Tirar atividade do mapa"
                    title="Tirar do mapa"
                    onClick={() => setRemovingActivity(node.activity)}
                    className="absolute right-1.5 top-3 rounded p-1 text-[var(--muted)] hover:bg-black/5 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {colorPickerFor === node.activityId && (
                    <div
                      className="absolute right-1.5 top-10 z-30 grid grid-cols-4 gap-1.5 rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg"
                      aria-label="Cores do card"
                    >
                      {CARD_COLORS.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-label={option.label}
                          title={option.label}
                          aria-pressed={node.color === option.value}
                          onClick={() =>
                            void changeNodeColor(node.activityId, option.value)
                          }
                          className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                            node.color === option.value
                              ? "ring-2 ring-[var(--brand)] ring-offset-1"
                              : "border-black/15"
                          }`}
                          style={{ backgroundColor: option.swatch }}
                        />
                      ))}
                    </div>
                  )}
                  {!status?.isDone && doneStatus && (
                    <button
                      type="button"
                      aria-label="Concluir atividade"
                      title="Concluir atividade e tirar do mapa"
                      disabled={completingActivityId === node.activityId}
                      onClick={() =>
                        void completeAndRemoveFromMap(node.activityId)
                      }
                      className="absolute bottom-2 left-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm transition-all hover:scale-105 hover:bg-emerald-500 hover:text-white disabled:cursor-wait disabled:opacity-50"
                    >
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    aria-label="Ordem na fila"
                    title="Clique e digite a posição na fila"
                    disabled={queueUpdatingId === node.activityId}
                    value={
                      queueEditingId === node.activityId
                        ? queueDraft
                        : queuePosition?.toString() ?? ""
                    }
                    placeholder="+"
                    onFocus={() => {
                      setColorPickerFor(null);
                      setQueueEditingId(node.activityId);
                      setQueueDraft(queuePosition?.toString() ?? "");
                    }}
                    onChange={(event) =>
                      setQueueDraft(event.target.value.replace(/\D/g, ""))
                    }
                    onBlur={() =>
                      commitQueuePosition(node.activityId, queuePosition)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    className={`absolute bottom-2 right-2 z-20 h-10 w-10 rounded-full border-2 text-center text-base font-bold shadow-md outline-none transition-all placeholder:text-[var(--brand)] focus:scale-110 focus:ring-4 focus:ring-[var(--brand)]/20 disabled:opacity-50 ${
                      queuePosition !== null
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-[var(--brand)] bg-white text-[var(--brand)]"
                    }`}
                  />
                  <button
                    type="button"
                    data-link-handle="true"
                    data-endpoint-type="activity"
                    data-endpoint-id={node.activityId}
                    data-endpoint-side="left"
                    aria-label="Conectar pelo lado esquerdo"
                    title="Arraste para conectar pelo lado esquerdo"
                    className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#64748b] shadow transition-transform hover:scale-125 hover:bg-[var(--brand)]"
                  />
                  <button
                    type="button"
                    data-link-handle="true"
                    data-endpoint-type="activity"
                    data-endpoint-id={node.activityId}
                    data-endpoint-side="right"
                    aria-label="Conectar pelo lado direito"
                    title="Arraste para conectar pelo lado direito"
                    className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#64748b] shadow transition-transform hover:scale-125 hover:bg-[var(--brand)]"
                  />
                  <button
                    type="button"
                    data-link-handle="true"
                    data-endpoint-type="activity"
                    data-endpoint-id={node.activityId}
                    data-endpoint-side="top"
                    aria-label="Conectar por cima"
                    title="Arraste para conectar por cima"
                    className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#64748b] shadow transition-transform hover:scale-125 hover:bg-[var(--brand)]"
                  />
                  <button
                    type="button"
                    data-link-handle="true"
                    data-endpoint-type="activity"
                    data-endpoint-id={node.activityId}
                    data-endpoint-side="bottom"
                    aria-label="Conectar por baixo"
                    title="Arraste para conectar por baixo"
                    className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#64748b] shadow transition-transform hover:scale-125 hover:bg-[var(--brand)]"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ActivityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
        types={types}
        statuses={statuses}
        activity={editing}
      />
      <WhatsAppAutomationModal
        open={automationActivity !== null}
        activity={automationActivity}
        onClose={() => setAutomationActivity(null)}
      />
      <Modal
        open={removingActivity !== null}
        onClose={() => {
          if (!removingActivityId) setRemovingActivity(null);
        }}
        title="Remover atividade do mapa?"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={removingActivityId !== null}
              onClick={() => setRemovingActivity(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={removingActivityId !== null}
              onClick={() => void confirmRemoveFromMap()}
            >
              <Trash2 className="h-4 w-4" />
              {removingActivityId ? "Removendo..." : "Confirmar remoção"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          Deseja remover
          {removingActivity ? (
            <strong> &quot;{removingActivity.title}&quot; </strong>
          ) : (
            " esta atividade "
          )}
          deste mapa?
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          A atividade continuará disponível nas outras visões e poderá ser
          importada novamente para o mapa.
        </p>
      </Modal>
      {importOpen && (
        <ImportActivitiesModal
          onClose={() => {
            if (!importing) setImportOpen(false);
          }}
          activities={activities}
          statuses={statuses}
          onMapIds={nodesMapId === importMapId ? onMap : new Set()}
          mapReady={nodesMapId === importMapId && importMapId !== null}
          importing={importing}
          onImport={(ids) => void importSelected(ids)}
        />
      )}
    </div>
  );
}

function MapRow({
  map,
  selected,
  renaming,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onDelete,
  onDragStart,
  onDragEnd,
  onAdd,
}: {
  map: MindMapRecord;
  selected: boolean;
  renaming: { kind: "map" | "group"; id: string; name: string } | null;
  onSelect: (id: string) => void;
  onRenameStart: (map: MindMapRecord) => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onDelete: (map: MindMapRecord) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onAdd: (map: MindMapRecord) => void;
}) {
  const editingName = renaming?.kind === "map" && renaming.id === map.id;
  return (
    <div
      className={`group/map flex items-center gap-1.5 rounded-md px-2 py-1 ${
        selected ? "bg-[var(--brand)]/10" : "hover:bg-black/[0.04]"
      }`}
    >
      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
      {editingName ? (
        <input
          autoFocus
          value={renaming.name}
          onChange={(event) => onRenameChange(event.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") onRenameCommit();
          }}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-white px-1.5 py-0.5 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", map.id);
            event.dataTransfer.effectAllowed = "move";
            onDragStart(map.id);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onSelect(map.id)}
          onDoubleClick={() => onRenameStart(map)}
          className="min-w-0 flex-1 cursor-grab truncate text-left text-sm text-[var(--foreground)] active:cursor-grabbing"
          title="Clique para abrir. Dois cliques para renomear. Arraste para outra pasta."
        >
          {map.name}
        </button>
      )}
      {!editingName && (
        <button
          type="button"
          aria-label="Importar atividades"
          title="Importar atividades"
          onClick={() => onAdd(map)}
          className="rounded p-1 text-[var(--brand)] hover:bg-black/5"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label="Excluir mapa"
        title="Excluir mapa"
        onClick={() => onDelete(map)}
        className="rounded p-1 text-[var(--muted)] opacity-0 hover:bg-black/5 hover:text-red-600 group-hover/map:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ImportActivitiesModal({
  onClose,
  activities,
  statuses,
  onMapIds,
  mapReady,
  importing,
  onImport,
}: {
  onClose: () => void;
  activities: Activity[];
  statuses: ActivityStatusDef[];
  onMapIds: Set<string>;
  mapReady: boolean;
  importing: boolean;
  onImport: (ids: string[]) => void;
}) {
  const [statusKey, setStatusKey] = useState("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const statusByKey = useMemo(
    () => new Map(statuses.map((status) => [status.key, status])),
    [statuses]
  );
  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order),
    [statuses]
  );
  const filtered = activities.filter((activity) => {
    if (statusKey !== "all" && activity.status !== statusKey) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    const blob = `${activity.title} ${activity.opportunity?.name ?? ""}`.toLowerCase();
    return blob.includes(term);
  });
  const selectable = filtered.filter((activity) => !onMapIds.has(activity.id));
  const allSelectablePicked =
    selectable.length > 0 && selectable.every((activity) => picked.includes(activity.id));

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleVisible() {
    setPicked((current) => {
      if (allSelectablePicked) {
        const visible = new Set(selectable.map((activity) => activity.id));
        return current.filter((id) => !visible.has(id));
      }
      const next = new Set(current);
      for (const activity of selectable) next.add(activity.id);
      return [...next];
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar atividades"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={() => onImport(picked)}
            disabled={!mapReady || importing || picked.length === 0}
          >
            {importing
              ? "Importando..."
              : picked.length === 0
                ? "Importar"
                : `Importar ${picked.length}`}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStatusKey("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            statusKey === "all"
              ? "bg-[var(--brand)] text-white"
              : "bg-black/[0.05] text-[var(--foreground)] hover:bg-black/[0.08]"
          }`}
        >
          Todas {activities.length}
        </button>
        {sortedStatuses.map((status) => {
          const count = activities.filter((activity) => activity.status === status.key).length;
          const active = statusKey === status.key;
          return (
            <button
              key={status.key}
              type="button"
              onClick={() => setStatusKey(status.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "bg-black/[0.05] text-[var(--foreground)] hover:bg-black/[0.08]"
              }`}
            >
              {status.name} {count}
            </button>
          );
        })}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar atividade"
        className="mb-3 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
      />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {mapReady ? `${filtered.length} na lista` : "Carregando mapa..."}
        </p>
        <button
          type="button"
          onClick={toggleVisible}
          disabled={!mapReady || selectable.length === 0}
          className="text-xs font-medium text-[var(--brand-600)] disabled:opacity-40"
        >
          {allSelectablePicked ? "Desmarcar visíveis" : "Marcar visíveis"}
        </button>
      </div>
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            Nenhuma atividade com esse filtro.
          </p>
        )}
        {filtered.map((activity) => {
          const already = onMapIds.has(activity.id);
          const status = statusByKey.get(activity.status);
          const checked = already || picked.includes(activity.id);
          return (
            <label
              key={activity.id}
              className={`flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2 ${
                already ? "opacity-60" : "cursor-pointer hover:border-[var(--brand)]"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                disabled={already || !mapReady || importing}
                onChange={() => toggle(activity.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                  {activity.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs text-[var(--muted)]">
                    {activity.opportunity?.name ?? "Sem oportunidade"}
                    {already ? " · Já neste mapa" : ""}
                  </span>
                  {status && <StatusBadge name={status.name} color={status.color} />}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
