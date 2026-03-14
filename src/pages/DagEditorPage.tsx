import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { ReactFlowProvider } from 'reactflow'
import { ArrowLeft, Save, Eye, Circle } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Badge } from '@shared/ui/Badge'
import { Spinner } from '@shared/ui/Spinner'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { DagCanvas } from '@features/dag-editor/components/DagCanvas'
import { useDagStore } from '@features/dag-editor/store/dag.store'
import { useFlow } from '@features/flows/hooks/useFlows'
import { useCreateNode, useUpdateNode, useDeleteNode } from '@features/nodes/hooks/useNodes'
import { useCreateEdge, useDeleteEdge } from '@features/edges/hooks/useEdges'
import { flowNodeToNode, flowEdgeToEdge, nodeToCreateRequest, nodeToUpdateRequest } from '@features/flows/utils/flow-adapter'
import { useQueryClient } from '@tanstack/react-query'
import type { FlowNodeDto, FlowEdgeDto } from '@shared/types/api.types'
import toast from 'react-hot-toast'

/* ── Height chain explanation ───────────────────────────────────────────
   html/body → #root (flex column, min-h: 100vh)
     → motion.div PageWrapper (flex: 1, height: 100vh, overflow: hidden)
       → PageLayout (flex column, height: 100%)
         → Header (56px fixed)
         → CanvasArea (flex: 1, min-h: 0, display: flex)
           → DagCanvas's EditorLayout (flex: 1, h: 100%, display: flex)
             → NodePalette (w: 210px)
             → CanvasWrapper (flex: 1, h: 100%)
               → <ReactFlow> (fills wrapper via CSS)
             → PropertiesPanel (w: 280px, conditional)
   
   Every flex ancestor has min-height: 0 so React Flow gets real pixels.
   ─────────────────────────────────────────────────────────────────────── */

export function DagEditorPage() {
  const { surveyId } = useParams({ from: '/editor/$surveyId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── API hooks ──────────────────────────────────────────────────────────
  const { data: flow, isLoading, isError } = useFlow(surveyId)
  const { mutateAsync: createNode } = useCreateNode()
  const { mutateAsync: updateNode } = useUpdateNode()
  const { mutateAsync: deleteNode } = useDeleteNode()
  const { mutateAsync: createEdge } = useCreateEdge()
  const { mutateAsync: deleteEdge } = useDeleteEdge()

  // ── DAG store ──────────────────────────────────────────────────────────
  const loadSurvey = useDagStore((s) => s.loadSurvey)
  const nodes = useDagStore((s) => s.nodes)
  const edges = useDagStore((s) => s.edges)
  const isDirty = useDagStore((s) => s.isDirty)
  const markSaved = useDagStore((s) => s.markSaved)

  // Track the original API data for diffing on save
  const originalNodesRef = useRef<FlowNodeDto[]>([])
  const originalEdgesRef = useRef<FlowEdgeDto[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // ── Load flow into DAG store on initial fetch ──────────────────────────
  useEffect(() => {
    if (flow) {
      originalNodesRef.current = flow.nodes
      originalEdgesRef.current = flow.edges
      const dagNodes = flow.nodes.map(flowNodeToNode)
      const dagEdges = flow.edges.map(flowEdgeToEdge)
      loadSurvey(flow.id, dagNodes, dagEdges)
    }
    // loadSurvey is stable; only re-run when the flow id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.id])

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageLayout>
        <LoadingBlock>
          <Spinner size={32} />
        </LoadingBlock>
      </PageLayout>
    )
  }

  if (isError || !flow) {
    return (
      <PageLayout>
        <NotFound>
          <p>{isError ? 'Failed to load survey.' : 'Survey not found.'}</p>
          <Button onClick={() => navigate({ to: '/dashboard' })}>Back to Dashboard</Button>
        </NotFound>
      </PageLayout>
    )
  }

  // ── Save handler — diffs current canvas state against the loaded API data ──
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const originalNodeIds = new Set(originalNodesRef.current.map((n) => n.id))
      const originalEdgeIds = new Set(originalEdgesRef.current.map((e) => e.id))
      const currentNodeIds = new Set(nodes.map((n) => n.id))
      const currentEdgeIds = new Set(edges.map((e) => e.id))

      // ── Nodes ──────────────────────────────────────────────────────────
      // Map client-generated IDs to the server-assigned IDs for newly created nodes
      const clientToServerId = new Map<string, string>()

      // 1. Create new nodes (in canvas but not in original API response)
      for (const node of nodes) {
        if (!originalNodeIds.has(node.id)) {
          const result = await createNode({ flowId: surveyId, data: nodeToCreateRequest(node) })
          clientToServerId.set(node.id, result.id)
        }
      }

      // 2. Update existing nodes (in both canvas and original API response)
      await Promise.all(
        nodes
          .filter((n) => originalNodeIds.has(n.id))
          .map((node) =>
            updateNode({ flowId: surveyId, nodeId: node.id, data: nodeToUpdateRequest(node) })
          )
      )

      // 3. Delete removed nodes (in original API response but not in canvas)
      await Promise.all(
        originalNodesRef.current
          .filter((n) => !currentNodeIds.has(n.id))
          .map((n) => deleteNode({ flowId: surveyId, nodeId: n.id }))
      )

      // ── Edges ──────────────────────────────────────────────────────────
      // Helper: resolve server ID for a node (handles newly created nodes)
      const resolveNodeId = (id: string) => clientToServerId.get(id) ?? id

      // 4. Create new edges
      await Promise.all(
        edges
          .filter((e) => !originalEdgeIds.has(e.id))
          .map((edge) =>
            createEdge({
              flowId: surveyId,
              data: {
                sourceNodeId: resolveNodeId(edge.source),
                targetNodeId: resolveNodeId(edge.target),
                conditions: edge.data?.condition
                  ? {
                      operator: 'AND' as const,
                      rules: [
                        {
                          attribute: edge.data.condition.attribute,
                          op: edge.data.condition.operator as 'eq',
                          value: edge.data.condition.value,
                        },
                      ],
                    }
                  : null,
              },
            })
          )
      )

      // 5. Delete removed edges
      await Promise.all(
        originalEdgesRef.current
          .filter((e) => !currentEdgeIds.has(e.id))
          .map((e) => deleteEdge({ flowId: surveyId, edgeId: e.id }))
      )

      // ── Reload from API so the store has server-assigned IDs ───────────
      const updated = await queryClient.fetchQuery({
        queryKey: ['flows', surveyId],
        staleTime: 0,
      })
      if (updated) {
        const typedFlow = updated as typeof flow
        originalNodesRef.current = typedFlow.nodes
        originalEdgesRef.current = typedFlow.edges
        const dagNodes = typedFlow.nodes.map(flowNodeToNode)
        const dagEdges = typedFlow.edges.map(flowEdgeToEdge)
        loadSurvey(typedFlow.id, dagNodes, dagEdges)
      }

      markSaved()
      toast.success('Survey saved!')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = () => {
    navigate({ to: `/survey/${surveyId}` })
  }

  return (
    <PageLayout>
      <EditorHeader>
        <BackLink to="/dashboard">
          <ArrowLeft size={15} />
          Surveys
        </BackLink>
        <Divider />
        <SurveyTitle>{flow.name}</SurveyTitle>
        <Badge $variant="neutral">{nodes.length} nodes · {edges.length} edges</Badge>

        <SaveIndicator>
          {isDirty ? (
            <>
              <Circle size={10} fill="#F59E0B" color="#F59E0B" />
              Unsaved changes
            </>
          ) : (
            <Badge $variant="success">Saved</Badge>
          )}
        </SaveIndicator>

        <ThemeSwitcher />

        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={14} />}
          onClick={handleTest}
        >
          Preview
        </Button>
        <Button
          size="sm"
          icon={isSaving ? <Spinner size={14} /> : <Save size={14} />}
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </EditorHeader>

      <CanvasArea>
        <ReactFlowProvider>
          <DagCanvas />
        </ReactFlowProvider>
      </CanvasArea>
    </PageLayout>
  )
}


const PageLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bg};
`

const EditorHeader = styled.header`
  height: 56px;
  background: ${({ theme }) => theme.colors.bgSurface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  z-index: 10;
`

const BackLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  text-decoration: none;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radii.md};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.bgElevated};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: ${({ theme }) => theme.colors.border};
`

const SurveyTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`

const SaveIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textTertiary};
`

const CanvasArea = styled.div`
  flex: 1 1 0%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
`

const NotFound = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const LoadingBlock = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`