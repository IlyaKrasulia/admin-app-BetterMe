import styled from 'styled-components'
import { motion } from 'framer-motion'
import { DollarSign, Zap } from 'lucide-react'
import type { OfferNodeData } from '@shared/types/dag.types'
import { Button } from '@shared/ui/Button'

// ─── Styles ───────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
`

const BadgeRow = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SpecialBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.warningLight};
  color: ${({ theme }) => theme.colors.warning};
  font-size: ${({ theme }) => theme.typography.sizes.xs};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const Headline = styled(motion.h2)`
  font-size: ${({ theme }) => theme.typography.sizes.xxl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
`

const Description = styled(motion.p)`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
  max-width: 480px;
`

const PriceTag = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.sizes.xxxl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
`

const PriceCurrency = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.xl};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 6px;
`

const CtaWrapper = styled(motion.div)`
  width: 100%;
`

// ─── Component ────────────────────────────────────────────────────────────────

interface OfferStepProps {
  data: OfferNodeData
  onAccept: () => void
}

export function OfferStep({ data, onAccept }: OfferStepProps) {
  return (
    <Wrapper>
      <BadgeRow
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
      >
        <SpecialBadge>
          <Zap size={10} />
          Your personalised plan
        </SpecialBadge>
      </BadgeRow>

      <Headline
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        {data.headline}
      </Headline>

      <Description
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        {data.description}
      </Description>

      {data.price !== undefined && (
        <PriceTag
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.24, type: 'spring', stiffness: 200 }}
        >
          <PriceCurrency>$</PriceCurrency>
          {data.price.toFixed(2)}
        </PriceTag>
      )}

      <CtaWrapper
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          fullWidth
          size="lg"
          icon={<DollarSign size={18} />}
          onClick={onAccept}
        >
          {data.ctaText}
        </Button>
      </CtaWrapper>
    </Wrapper>
  )
}
