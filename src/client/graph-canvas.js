import React, { useState, useEffect, useMemo, useCallback } from "react";
import { gateBranchForEdge, normalizeGateType } from "../../lib/condition-gates.js";
import { branchDisplayLabel } from "./graph-model.js";

function FlowNode({ data, selected, copy }) {
  const kind = data.kind ?? "agent";
  const kindLabel = kind === "condition"
    ? `${copy.nodeKind[kind]} · ${copy.gateType[normalizeGateType(data.gateType)]}`
    : copy.nodeKind[kind] ?? kind;
  const children = [
    React.createElement("div", { className: "df-node__kind" }, kindLabel),
    React.createElement("div", { className: "df-node__label" }, String(data.label ?? kind)),
    (data.prompt || data.instructions) ? React.createElement("div", { className: "df-node__prompt" }, String(data.prompt ?? data.instructions)) : null,
    data.docPath ? React.createElement("div", { className: "df-node__file" }, String(data.docPath)) : null
  ];
  return React.createElement("div", { className: `df-node df-node--${kind}${selected ? " is-selected" : ""}` }, children);
}

const GRAPH_NODE_WIDTH = 208;
const GRAPH_NODE_HEIGHT = 116;
export const GRAPH_MIN_ZOOM = 0.5;
const GRAPH_MAX_ZOOM = 2.5;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function graphEdgeGeometry(edge, byId) {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const start = { x: source.position.x + GRAPH_NODE_WIDTH, y: source.position.y + GRAPH_NODE_HEIGHT / 2 };
  const end = { x: target.position.x, y: target.position.y + GRAPH_NODE_HEIGHT / 2 };
  const forward = Math.max(54, Math.abs(end.x - start.x) * 0.46);
  const bend = end.x >= start.x ? forward : Math.max(90, forward * 0.7);
  return {
    start,
    end,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    path: `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`
  };
}

export function GraphCanvas({
  nodes,
  edges,
  copy,
  selectedNode,
  selectedEdge,
  onInit,
  onNodeDragStart,
  onNodeMove,
  onNodeSelect,
  onEdgeSelect,
  onPaneClick,
  onConnect,
  onConnectionRejected,
  isValidConnection,
  fitLabel,
  zoomInLabel,
  zoomOutLabel
}) {
  const rootRef = React.useRef(null);
  const cleanupRef = React.useRef(null);
  const viewportRef = React.useRef({ x: 32, y: 32, zoom: 0.8 });
  const viewportAnimationRef = React.useRef(null);
  const markerIdRef = React.useRef(`df-arrow-${Math.random().toString(36).slice(2, 10)}`);
  const [viewport, setViewport] = useState({ x: 32, y: 32, zoom: 0.8 });
  const [panning, setPanning] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const updateViewport = useCallback((value) => {
    setViewport((current) => {
      const next = typeof value === "function" ? value(current) : value;
      viewportRef.current = next;
      return next;
    });
  }, []);

  const cancelViewportAnimation = useCallback(() => {
    const active = viewportAnimationRef.current;
    if (!active) return;
    cancelAnimationFrame(active.frame);
    viewportAnimationRef.current = null;
  }, []);

  const animateViewport = useCallback((target, duration = 0) => {
    cancelViewportAnimation();
    const milliseconds = Math.max(0, Number(duration) || 0);
    if (milliseconds === 0) {
      updateViewport(target);
      return;
    }
    const start = viewportRef.current;
    const startedAt = performance.now();
    const active = { frame: 0 };
    viewportAnimationRef.current = active;
    const tick = (now) => {
      if (viewportAnimationRef.current !== active) return;
      const progress = clamp((now - startedAt) / milliseconds, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      updateViewport({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased
      });
      if (progress < 1) active.frame = requestAnimationFrame(tick);
      else viewportAnimationRef.current = null;
    };
    active.frame = requestAnimationFrame(tick);
  }, [cancelViewportAnimation, updateViewport]);

  const stopGesture = useCallback(() => {
    cancelViewportAnimation();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPanning(false);
    setDraggingNode(null);
  }, [cancelViewportAnimation]);

  useEffect(() => stopGesture, [stopGesture]);

  const fitView = useCallback((options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const requestedIds = new Set((options.nodes ?? []).map((node) => typeof node === "string" ? node : node?.id).filter(Boolean));
    const visibleNodes = requestedIds.size > 0 ? nodes.filter((node) => requestedIds.has(node.id)) : nodes;
    if (visibleNodes.length === 0) return;
    const minX = Math.min(...visibleNodes.map((node) => node.position.x));
    const minY = Math.min(...visibleNodes.map((node) => node.position.y));
    const maxX = Math.max(...visibleNodes.map((node) => node.position.x + GRAPH_NODE_WIDTH));
    const maxY = Math.max(...visibleNodes.map((node) => node.position.y + GRAPH_NODE_HEIGHT));
    const paddingRatio = Number(options.padding ?? 0.16);
    const padding = Math.max(36, Math.min(rect.width, rect.height) * paddingRatio);
    const minZoom = Number(options.minZoom ?? GRAPH_MIN_ZOOM);
    const maxZoom = Number(options.maxZoom ?? 1.15);
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((rect.width - padding * 2) / graphWidth, (rect.height - padding * 2) / graphHeight), minZoom, maxZoom);
    animateViewport({
      x: (rect.width - graphWidth * zoom) / 2 - minX * zoom,
      y: (rect.height - graphHeight * zoom) / 2 - minY * zoom,
      zoom
    }, options.duration);
  }, [animateViewport, nodes]);

  const focusNode = useCallback((id, options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const node = nodes.find((candidate) => candidate.id === id);
    if (!rect || !node) return;
    const zoom = clamp(Number(options.zoom ?? Math.max(viewportRef.current.zoom, 0.96)), GRAPH_MIN_ZOOM, 1.15);
    animateViewport({
      x: rect.width / 2 - (node.position.x + GRAPH_NODE_WIDTH / 2) * zoom,
      y: rect.height / 2 - (node.position.y + GRAPH_NODE_HEIGHT / 2) * zoom,
      zoom
    }, options.duration ?? 720);
  }, [animateViewport, nodes]);

  useEffect(() => {
    onInit?.({ fitView, focusNode });
  }, [fitView, focusNode, onInit]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  const zoomAtCenter = useCallback((factor) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelViewportAnimation();
    updateViewport((current) => {
      const zoom = clamp(current.zoom * factor, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      return {
        x: centerX - (centerX - current.x) * (zoom / current.zoom),
        y: centerY - (centerY - current.y) * (zoom / current.zoom),
        zoom
      };
    });
  }, [cancelViewportAnimation, updateViewport]);

  const beginPan = useCallback((event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__node,.df-graph__controls")) return;
    event.preventDefault();
    onPaneClick?.();
    stopGesture();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewport;
    setPanning(true);
    const move = (next) => setViewport({ ...origin, x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPaneClick, stopGesture, viewport]);

  const beginNodeDrag = useCallback((node, event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__handle")) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    onNodeSelect?.(node.id);
    onNodeDragStart?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = node.position;
    setDraggingNode(node.id);
    const move = (next) => onNodeMove?.(node.id, {
      x: origin.x + (next.clientX - startX) / viewport.zoom,
      y: origin.y + (next.clientY - startY) / viewport.zoom
    });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onNodeDragStart, onNodeMove, onNodeSelect, stopGesture, viewport.zoom]);

  const beginConnection = useCallback((source, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    const sourceNode = byId.get(source);
    if (!sourceNode) return;
    const start = { x: sourceNode.position.x + GRAPH_NODE_WIDTH, y: sourceNode.position.y + GRAPH_NODE_HEIGHT / 2 };
    setConnectionDraft({ source, start, end: start });
    const move = (next) => setConnectionDraft((draft) => draft ? { ...draft, end: screenToWorld(next.clientX, next.clientY) } : null);
    const up = (next) => {
      const targetElement = document.elementFromPoint(next.clientX, next.clientY)?.closest?.("[data-df-target-id]");
      const target = targetElement?.getAttribute("data-df-target-id") ?? null;
      const connection = { source, target, sourceHandle: null, targetHandle: null };
      if (target) {
        if (isValidConnection?.(connection) ?? true) onConnect?.(connection);
        else onConnectionRejected?.(connection);
      }
      setConnectionDraft(null);
      stopGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [byId, isValidConnection, onConnect, onConnectionRejected, screenToWorld, stopGesture]);

  // 画布滚轮/手势：原生 non-passive 监听，preventDefault 才真正生效——
  // 画布内的一切滚动/缩放手势只作用于画布，不再外溢为页面滚动或浏览器缩放。
  useEffect(() => {
    const canvas = rootRef.current;
    if (!canvas) return undefined;
    const onCanvasWheel = (event) => {
      event.preventDefault();
      cancelViewportAnimation();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        // 缩放：Ctrl/⌘+滚轮，或触控板捏合（捏合手势带 ctrlKey）
        updateViewport((current) => {
          const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0012), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
          return {
            x: cursorX - (cursorX - current.x) * (zoom / current.zoom),
            y: cursorY - (cursorY - current.y) * (zoom / current.zoom),
            zoom
          };
        });
      } else {
        // 平移：触控板双指滑动 / 鼠标滚轮
        updateViewport((current) => ({
          ...current,
          x: current.x - (Number.isFinite(event.deltaX) ? event.deltaX : 0),
          y: current.y - (Number.isFinite(event.deltaY) ? event.deltaY : 0)
        }));
      }
    };
    canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onCanvasWheel);
  }, [cancelViewportAnimation, updateViewport]);

  const edgeElements = [];
  for (const edge of edges) {
    const geometry = graphEdgeGeometry(edge, byId);
    if (!geometry) continue;
    const selected = selectedEdge === edge.id;
    const displayLabel = edge.autoLogicLabel
      ? branchDisplayLabel(gateBranchForEdge(edge), copy)
      : edge.label;
    edgeElements.push(
      React.createElement("g", { key: edge.id, className: "df-graph__edge-group", "data-edge-id": edge.id },
        React.createElement("path", {
          className: `df-graph__edge${selected ? " is-selected" : ""}`,
          d: geometry.path,
          markerEnd: `url(#${markerIdRef.current})`
        }),
        React.createElement("path", {
          className: "df-graph__edge-hit",
          d: geometry.path,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.stopPropagation();
            onEdgeSelect?.(edge.id);
          }
        }),
        displayLabel ? React.createElement("g", { transform: `translate(${geometry.label.x} ${geometry.label.y})` },
          React.createElement("rect", { className: "df-graph__label-bg", x: -18, y: -10, width: 36, height: 20, rx: 7 }),
          React.createElement("text", { className: "df-graph__label", x: 0, y: 1 }, String(displayLabel))
        ) : null
      )
    );
  }
  if (connectionDraft) {
    const bend = Math.max(54, Math.abs(connectionDraft.end.x - connectionDraft.start.x) * 0.46);
    edgeElements.push(React.createElement("path", {
      key: "connection-draft",
      className: "df-graph__connection",
      d: `M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${connectionDraft.start.x + bend} ${connectionDraft.start.y}, ${connectionDraft.end.x - bend} ${connectionDraft.end.y}, ${connectionDraft.end.x} ${connectionDraft.end.y}`
    }));
  }

  return React.createElement("div", {
    ref: rootRef,
    className: `df-canvas${panning ? " is-panning" : ""}`,
    onPointerDown: beginPan
  },
    React.createElement("div", {
      className: "df-graph__stage",
      style: { transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }
    },
      React.createElement("svg", { className: "df-graph__edges", width: 1, height: 1, "aria-label": "Workflow arrows" },
        React.createElement("defs", null,
          React.createElement("marker", {
            id: markerIdRef.current,
            markerWidth: 10,
            markerHeight: 10,
            refX: 9,
            refY: 5,
            orient: "auto",
            markerUnits: "strokeWidth",
            viewBox: "0 0 10 10"
          }, React.createElement("path", { d: "M 0 0 L 10 5 L 0 10 Z", fill: "var(--df-brand)" }))
        ),
        edgeElements
      ),
      nodes.map((node) => React.createElement("div", {
        key: node.id,
        className: `df-graph__node${draggingNode === node.id ? " is-dragging" : ""}`,
        style: { left: `${node.position.x}px`, top: `${node.position.y}px` },
        "data-node-id": node.id,
        onPointerDown: (event) => beginNodeDrag(node, event),
        onClick: (event) => {
          event.stopPropagation();
          onNodeSelect?.(node.id);
        }
      },
        React.createElement(FlowNode, { data: node.data, selected: selectedNode === node.id, copy }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--target",
          "data-df-target-id": node.id,
          "aria-label": `Connect into ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => event.stopPropagation()
        }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--source",
          "data-df-source-id": node.id,
          "aria-label": `Connect from ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => beginConnection(node.id, event)
        })
      ))
    ),
    React.createElement("div", { className: "df-graph__controls" },
      React.createElement("button", { type: "button", title: zoomInLabel, "aria-label": zoomInLabel, onClick: () => zoomAtCenter(1.2) }, "+"),
      React.createElement("button", { type: "button", title: zoomOutLabel, "aria-label": zoomOutLabel, onClick: () => zoomAtCenter(1 / 1.2) }, "−"),
      React.createElement("button", { type: "button", title: fitLabel, "aria-label": fitLabel, onClick: () => fitView({}) }, "⊙")
    )
  );
}
