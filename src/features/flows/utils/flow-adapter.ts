/**
 * Conversion utilities between the backend API DTOs (FlowNodeDto / FlowEdgeDto)
 * and the React-Flow / DAG-store types used in the editor canvas.
 */

import { MarkerType } from "reactflow";
import type { Node, Edge } from "reactflow";
import type {
  FlowNodeDto,
  FlowEdgeDto,
  CreateNodeRequest,
  UpdateNodeRequest,
} from "@shared/types/api.types";
import { NodeType, AttributeKey, AnswerType } from "@shared/types/dag.types";
import type {
  DagNodeData,
  QuestionNodeData,
  InfoNodeData,
  OfferNodeData,
} from "@shared/types/dag.types";

// ─── API → DAG ────────────────────────────────────────────────────────────────

/**
 * Map the API `type` string to the internal `NodeType` enum.
 * The API uses `'info_page'`; the canvas uses `'info'`.
 */
function apiTypeToNodeType(apiType: string): NodeType {
  if (apiType === "info_page") return NodeType.Info;
  if (apiType === "offer") return NodeType.Offer;
  return NodeType.Question;
}

/**
 * Convert a single `FlowNodeDto` from the admin API into a ReactFlow
 * `Node<DagNodeData>` that can be loaded into the DAG store / canvas.
 */
export function flowNodeToNode(dto: FlowNodeDto): Node<DagNodeData> {
  const nodeType = apiTypeToNodeType(dto.type);

  let data: DagNodeData;
  switch (dto.type) {
    case "question": {
      const d: QuestionNodeData = {
        type: NodeType.Question,
        questionText: dto.title,
        attribute: (dto.attributeKey as AttributeKey) ?? AttributeKey.Goal,
        answerType: AnswerType.SingleChoice,
        options: dto.options.map((o) => ({
          id: o.id,
          label: o.label,
          value: o.value,
        })),
      };
      data = d;
      break;
    }
    case "info_page": {
      const d: InfoNodeData = {
        type: NodeType.Info,
        title: dto.title,
        body: dto.description ?? "",
        imageUrl: dto.mediaUrl ?? undefined,
      };
      data = d;
      break;
    }
    case "offer":
    default: {
      const d: OfferNodeData = {
        type: NodeType.Offer,
        headline: dto.title,
        description: dto.description ?? "",
        ctaText: "Get Started",
        price: undefined,
      };
      data = d;
      break;
    }
  }
  // TODO: Remove
  console.log({
    id: dto.id,
    type: nodeType,
    position: { x: dto.positionX, y: dto.positionY },
    data,
  });

  return {
    id: dto.id,
    type: nodeType,
    position: { x: dto.positionX, y: dto.positionY },
    data,
  };
}

/**
 * Convert a single `FlowEdgeDto` from the admin API into a ReactFlow `Edge`.
 */
export function flowEdgeToEdge(dto: FlowEdgeDto): Edge {
  const rule = dto.conditions?.rules[0];
  const label = rule ? `${rule.attribute} ${rule.op} ${rule.value}` : undefined;

  return {
    id: dto.id,
    source: dto.sourceNodeId,
    target: dto.targetNodeId,
    type: "conditionEdge",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    data: {
      label,
      condition: rule
        ? {
            attribute: rule.attribute as AttributeKey,
            operator: rule.op as string,
            value: rule.value,
          }
        : undefined,
    },
  };
}

// ─── DAG → API ────────────────────────────────────────────────────────────────

/**
 * Map the internal `NodeType` enum back to the API `FlowNodeType` string.
 */
function nodeTypeToApiType(type: NodeType): "question" | "info_page" | "offer" {
  if (type === NodeType.Info) return "info_page";
  if (type === NodeType.Offer) return "offer";
  return "question";
}

/**
 * Build a `CreateNodeRequest` payload from a ReactFlow `Node<DagNodeData>`.
 *
 * Note: answer options for question nodes are managed via the separate options
 * API (`POST /api/admin/nodes/{nodeId}/options`) and are not part of this
 * request.  Add/remove/reorder options using `useCreateOption` / `useDeleteOption`.
 */
export function nodeToCreateRequest(
  node: Node<DagNodeData>,
): CreateNodeRequest {
  const { data, position } = node;
  const base = {
    type: nodeTypeToApiType(data.type),
    positionX: Math.round(position.x),
    positionY: Math.round(position.y),
  } as const;

  switch (data.type) {
    case NodeType.Question:
      return {
        ...base,
        title: data.questionText,
        attributeKey: data.attribute,
      };
    case NodeType.Info:
      return {
        ...base,
        title: data.title,
        description: data.body || undefined,
        mediaUrl: data.imageUrl || undefined,
      };
    case NodeType.Offer:
      return {
        ...base,
        title: data.headline,
        description: data.description || undefined,
      };
  }
}

/**
 * Build an `UpdateNodeRequest` payload from a ReactFlow `Node<DagNodeData>`.
 *
 * Note: answer options are a separate resource and are not updated here.
 * Use `useCreateOption` / `useUpdateOption` / `useDeleteOption` for that.
 */
export function nodeToUpdateRequest(
  node: Node<DagNodeData>,
): UpdateNodeRequest {
  const { data, position } = node;
  const base = {
    positionX: Math.round(position.x),
    positionY: Math.round(position.y),
  } as const;

  switch (data.type) {
    case NodeType.Question:
      return {
        ...base,
        title: data.questionText,
        attributeKey: data.attribute,
      };
    case NodeType.Info:
      return {
        ...base,
        title: data.title,
        description: data.body || undefined,
        mediaUrl: data.imageUrl || undefined,
      };
    case NodeType.Offer:
      return {
        ...base,
        title: data.headline,
        description: data.description || undefined,
      };
  }
}
