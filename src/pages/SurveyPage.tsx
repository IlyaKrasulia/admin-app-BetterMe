import { useState, useCallback, useEffect } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useSurveysStore } from '@features/surveys/store/surveys.store'
import { NodeType, SurveyStatus } from '@shared/types/dag.types'
import type { DagNode } from '@shared/types/dag.types'
import {
  findStartNode,
  getNextNodeId,
  estimateProgress,
  type AnswerMap,
} from '@features/survey-client/utils/dag-navigator'
import { QuestionStep } from '@features/survey-client/components/QuestionStep'
import { InfoStep } from '@features/survey-client/components/InfoStep'
import { OfferStep } from '@features/survey-client/components/OfferStep'
import { Button } from '@shared/ui/Button'
import { Spinner } from '@shared/ui/Spinner'

// ─── Global scroll reset for the survey page ─────────────────────────────────
const SurveyPageGlobal = createGlobalStyle`
  body { overflow-y: auto; }
`

// ─── Layout ───────────────────────────────────────────────────────────────────

const PageShell = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
`

const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
`

const BrandName = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  text-align: center;
`

const BackBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.bgElevated};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ProgressTrack = styled.div`
  height: 3px;
  background: ${({ theme }) => theme.colors.bgElevated};
  width: 100%;
`

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: ${({ theme }) => theme.colors.accent};
  border-radius: 0 2px 2px 0;
`

// ─── Content area ─────────────────────────────────────────────────────────────

const ContentArea = styled.main`
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 24px 80px;
`

const Card = styled(motion.div)`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: 40px 40px;
  width: 100%;
  max-width: 600px;
  box-shadow: ${({ theme }) => theme.shadows.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 28px 20px;
  }
`

// ─── Error / Not-found states ─────────────────────────────────────────────────

const CenterBlock = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
`

const BigEmoji = styled.div`
  font-size: 56px;
`

const StateTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.sizes.xl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
`

const StateBody = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 360px;
`

// ─── Completion screen ────────────────────────────────────────────────────────

const CompletionWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  padding: 16px 0;
`

const CompletionIcon = styled(motion.div)`
  color: ${({ theme }) => theme.colors.success};
`

const CompletionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes.xxl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
`

const CompletionBody = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 400px;
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
`

// ─── Card animation variants ──────────────────────────────────────────────────

const cardVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

// ─── Component ────────────────────────────────────────────────────────────────

type PageState = 'survey' | 'completed'

export function SurveyPage() {
  const navigate = useNavigate()

  // The route exposes `surveyId` via search params ─ handled by TanStack Router.
  // We read it from the URL directly for maximum compatibility.
  const params = useParams({ strict: false }) as { surveyId?: string }
  const surveyId = params.surveyId ?? ''

  const getSurveyById = useSurveysStore((s) => s.getSurveyById)
  const updateSurvey = useSurveysStore((s) => s.updateSurvey)

  const survey = getSurveyById(surveyId)

  // ─── State ─────────────────────────────────────────────────────────────────
  const [currentNode, setCurrentNode] = useState<DagNode | null>(null)
  const [history, setHistory] = useState<DagNode[]>([])
  const [answers, setAnswers] = useState<AnswerMap>(new Map())
  const [pageState, setPageState] = useState<PageState>('survey')
  const [direction, setDirection] = useState<1 | -1>(1)

  // Initialise the survey at the start node
  useEffect(() => {
    if (!survey) return
    const start = findStartNode(survey)
    if (start) setCurrentNode(start)
  }, [survey])

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const advanceToNode = useCallback(
    (nodeId: string) => {
      if (!survey) return
      const next = survey.nodes.find((n) => n.id === nodeId) ?? null
      if (!next) return
      setDirection(1)
      setHistory((h) => (currentNode ? [...h, currentNode] : h))
      setCurrentNode(next)
    },
    [survey, currentNode]
  )

  const goBack = useCallback(() => {
    if (history.length === 0) return
    setDirection(-1)
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setCurrentNode(prev)
  }, [history])

  // ─── Answer handlers ───────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (value: string | string[]) => {
      if (!survey || !currentNode) return

      // Store the answer keyed by the node's attribute (for question nodes)
      const newAnswers = new Map(answers)
      if (currentNode.data.type === NodeType.Question) {
        newAnswers.set(currentNode.data.attribute, value)
      }
      setAnswers(newAnswers)

      // Navigate to the next node
      const nextId = getNextNodeId(survey, currentNode.id, newAnswers)
      if (nextId) {
        advanceToNode(nextId)
      } else {
        // Terminal node — complete the survey
        handleComplete()
      }
    },
    [survey, currentNode, answers, advanceToNode]
  )

  const handleInfoContinue = useCallback(() => {
    if (!survey || !currentNode) return
    const nextId = getNextNodeId(survey, currentNode.id, answers)
    if (nextId) {
      advanceToNode(nextId)
    } else {
      handleComplete()
    }
  }, [survey, currentNode, answers, advanceToNode])

  const handleOfferAccept = useCallback(() => {
    handleComplete()
  }, [])

  function handleComplete() {
    if (survey) {
      updateSurvey(survey.id, {
        completionCount: survey.completionCount + 1,
      })
    }
    setPageState('completed')
  }

  // ─── Edge-cases: loading / not-found / empty ────────────────────────────────

  if (!survey) {
    return (
      <PageShell>
        <SurveyPageGlobal />
        <CenterBlock>
          <BigEmoji>🔍</BigEmoji>
          <StateTitle>Survey not found</StateTitle>
          <StateBody>
            This survey does not exist or has been removed. Please check the link
            and try again.
          </StateBody>
          <Button variant="secondary" onClick={() => navigate({ to: '/dashboard' })}>
            Back to dashboard
          </Button>
        </CenterBlock>
      </PageShell>
    )
  }

  if (survey.status !== SurveyStatus.Published) {
    return (
      <PageShell>
        <SurveyPageGlobal />
        <CenterBlock>
          <BigEmoji>🔒</BigEmoji>
          <StateTitle>Survey unavailable</StateTitle>
          <StateBody>This survey is not yet published.</StateBody>
        </CenterBlock>
      </PageShell>
    )
  }

  if (survey.nodes.length === 0) {
    return (
      <PageShell>
        <SurveyPageGlobal />
        <CenterBlock>
          <BigEmoji>📋</BigEmoji>
          <StateTitle>Empty survey</StateTitle>
          <StateBody>This survey has no questions yet. Check back later.</StateBody>
        </CenterBlock>
      </PageShell>
    )
  }

  if (!currentNode) {
    return (
      <PageShell>
        <SurveyPageGlobal />
        <CenterBlock>
          <Spinner size={32} />
        </CenterBlock>
      </PageShell>
    )
  }

  // ─── Progress ──────────────────────────────────────────────────────────────

  const progressPct =
    pageState === 'completed'
      ? 100
      : estimateProgress(survey, history.length)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <SurveyPageGlobal />

      {/* ─── Top bar ─────────────────────────────────────────────────── */}
      <TopBar>
        <BackBtn
          aria-label="Go back"
          disabled={history.length === 0 || pageState === 'completed'}
          onClick={goBack}
        >
          <ArrowLeft size={18} />
        </BackBtn>
        <BrandName>🌿 {survey.title}</BrandName>
        {/* spacer to centre the title */}
        <div style={{ width: 32 }} />
      </TopBar>

      {/* ─── Progress bar ────────────────────────────────────────────── */}
      <ProgressTrack>
        <ProgressFill
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ width: 0 }}
        />
      </ProgressTrack>

      {/* ─── Content ─────────────────────────────────────────────────── */}
      <ContentArea>
        <AnimatePresence mode="wait" initial={false}>
          {pageState === 'completed' ? (
            <Card
              key="completion"
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              custom={direction}
            >
              <CompletionWrapper
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                <CompletionIcon
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <CheckCircle2 size={64} />
                </CompletionIcon>
                <CompletionTitle>All done! 🎉</CompletionTitle>
                <CompletionBody>
                  Thank you for completing the survey. Your personalised
                  recommendations have been saved — good luck on your wellness journey!
                </CompletionBody>
              </CompletionWrapper>
            </Card>
          ) : (
            <Card
              key={currentNode.id}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {currentNode.data.type === NodeType.Question && (
                <QuestionStep
                  data={currentNode.data}
                  onAnswer={handleAnswer}
                />
              )}

              {currentNode.data.type === NodeType.Info && (
                <InfoStep
                  data={currentNode.data}
                  onContinue={handleInfoContinue}
                />
              )}

              {currentNode.data.type === NodeType.Offer && (
                <OfferStep
                  data={currentNode.data}
                  onAccept={handleOfferAccept}
                />
              )}
            </Card>
          )}
        </AnimatePresence>
      </ContentArea>
    </PageShell>
  )
}
