import { describe, it, expect } from 'vitest'
import { flowNodeToNode, flowEdgeToEdge, nodeToCreateRequest, nodeToUpdateRequest } from './flow-adapter'
import { NodeType, AttributeKey, AnswerType } from '@shared/types/dag.types'
import { MarkerType } from 'reactflow'
import type { FlowNodeDto, FlowEdgeDto, OptionDto } from '@shared/types/api.types'
import type { Node } from 'reactflow'
import type { DagNodeData } from '@shared/types/dag.types'

const baseOption = { id: 'o1', label: 'Label', value: 'val', displayOrder: 0, mediaUrl: null }

const questionDto: FlowNodeDto = {
  id: 'n1',
  type: 'question',
  attributeKey: 'goal',
  title: 'What is your goal?',
  description: null,
  mediaUrl: null,
  positionX: 100,
  positionY: 200,
  options: [baseOption],
  nodeOffers: [],
}

const infoDto: FlowNodeDto = {
  id: 'n2',
  type: 'info_page',
  attributeKey: null,
  title: 'Welcome',
  description: 'Some body text',
  mediaUrl: 'https://example.com/img.png',
  positionX: 300,
  positionY: 0,
  options: [],
  nodeOffers: [],
}

const offerDto: FlowNodeDto = {
  id: 'n3',
  type: 'offer',
  attributeKey: null,
  title: 'Special Plan',
  description: 'Best offer ever',
  mediaUrl: null,
  positionX: 0,
  positionY: 400,
  options: [],
  nodeOffers: [],
}

describe('flowNodeToNode', () => {
  it('converts a question DTO to a ReactFlow node', () => {
    const node = flowNodeToNode(questionDto)
    expect(node.id).toBe('n1')
    expect(node.type).toBe(NodeType.Question)
    expect(node.position).toEqual({ x: 100, y: 200 })
    expect(node.data.type).toBe(NodeType.Question)
    if (node.data.type === NodeType.Question) {
      expect(node.data.questionText).toBe('What is your goal?')
      expect(node.data.attribute).toBe('goal')
      expect(node.data.answerType).toBe(AnswerType.SingleChoice)
      expect(node.data.options).toHaveLength(1)
      expect(node.data.options[0].label).toBe('Label')
    }
  })

  it('converts an info_page DTO to a ReactFlow node', () => {
    const node = flowNodeToNode(infoDto)
    expect(node.id).toBe('n2')
    expect(node.type).toBe(NodeType.Info)
    if (node.data.type === NodeType.Info) {
      expect(node.data.title).toBe('Welcome')
      expect(node.data.body).toBe('Some body text')
      expect(node.data.imageUrl).toBe('https://example.com/img.png')
    }
  })

  it('converts an offer DTO to a ReactFlow node', () => {
    const node = flowNodeToNode(offerDto)
    expect(node.id).toBe('n3')
    expect(node.type).toBe(NodeType.Offer)
    if (node.data.type === NodeType.Offer) {
      expect(node.data.headline).toBe('Special Plan')
      expect(node.data.description).toBe('Best offer ever')
    }
  })

  it('falls back to AttributeKey.Goal when attributeKey is null', () => {
    const node = flowNodeToNode({ ...questionDto, attributeKey: null })
    if (node.data.type === NodeType.Question) {
      expect(node.data.attribute).toBe(AttributeKey.Goal)
    }
  })

  it('handles null options gracefully for question nodes', () => {
    const dtoWithNullOptions = { ...questionDto, options: null as unknown as OptionDto[] }
    const node = flowNodeToNode(dtoWithNullOptions)
    expect(node.type).toBe(NodeType.Question)
    if (node.data.type === NodeType.Question) {
      expect(node.data.options).toEqual([])
    }
  })
})

describe('flowEdgeToEdge', () => {
  const edgeDto: FlowEdgeDto = {
    id: 'e1',
    sourceNodeId: 'n1',
    targetNodeId: 'n2',
    priority: 0,
    conditions: {
      operator: 'AND',
      rules: [{ attribute: 'goal', op: 'eq', value: 'weight_loss' }],
    },
  }

  it('converts a FlowEdgeDto to a ReactFlow edge', () => {
    const edge = flowEdgeToEdge(edgeDto)
    expect(edge.id).toBe('e1')
    expect(edge.source).toBe('n1')
    expect(edge.target).toBe('n2')
    expect(edge.type).toBe('conditionEdge')
    expect(edge.markerEnd).toMatchObject({ type: MarkerType.ArrowClosed })
    expect(edge.data?.condition?.value).toBe('weight_loss')
    expect(edge.data?.label).toContain('weight_loss')
  })

  it('handles edges without conditions', () => {
    const edge = flowEdgeToEdge({ ...edgeDto, conditions: null })
    expect(edge.data?.condition).toBeUndefined()
    expect(edge.data?.label).toBeUndefined()
  })
})

describe('nodeToCreateRequest', () => {
  it('builds a CreateNodeRequest from a question node', () => {
    const node: Node<DagNodeData> = {
      id: 'new1',
      type: NodeType.Question,
      position: { x: 50, y: 75 },
      data: {
        type: NodeType.Question,
        questionText: 'How old are you?',
        attribute: AttributeKey.Age,
        answerType: AnswerType.SingleChoice,
        options: [],
      },
    }
    const req = nodeToCreateRequest(node)
    expect(req.type).toBe('question')
    expect(req.title).toBe('How old are you?')
    expect(req.positionX).toBe(50)
    expect(req.positionY).toBe(75)
  })

  it('builds a CreateNodeRequest from an info node', () => {
    const node: Node<DagNodeData> = {
      id: 'new2',
      type: NodeType.Info,
      position: { x: 0, y: 0 },
      data: {
        type: NodeType.Info,
        title: 'Hello',
        body: 'World',
        imageUrl: undefined,
      },
    }
    const req = nodeToCreateRequest(node)
    expect(req.type).toBe('info_page')
    expect(req.title).toBe('Hello')
  })

  it('builds a CreateNodeRequest from an offer node', () => {
    const node: Node<DagNodeData> = {
      id: 'new3',
      type: NodeType.Offer,
      position: { x: 0, y: 0 },
      data: {
        type: NodeType.Offer,
        headline: 'Big Deal',
        description: 'Only today',
        ctaText: 'Buy',
        price: 9.99,
      },
    }
    const req = nodeToCreateRequest(node)
    expect(req.type).toBe('offer')
    expect(req.title).toBe('Big Deal')
  })
})

describe('nodeToUpdateRequest', () => {
  it('builds an UpdateNodeRequest from a question node', () => {
    const node: Node<DagNodeData> = {
      id: 'n1',
      type: NodeType.Question,
      position: { x: 150, y: 250 },
      data: {
        type: NodeType.Question,
        questionText: 'Updated question?',
        attribute: AttributeKey.Goal,
        answerType: AnswerType.SingleChoice,
        options: [],
      },
    }
    const req = nodeToUpdateRequest(node)
    expect(req.title).toBe('Updated question?')
    expect(req.positionX).toBe(150)
    expect(req.positionY).toBe(250)
  })
})
