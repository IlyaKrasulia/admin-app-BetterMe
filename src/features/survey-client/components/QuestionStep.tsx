import { useState } from 'react'
import styled from 'styled-components'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { QuestionNodeData, AnswerOption } from '@shared/types/dag.types'
import { AnswerType } from '@shared/types/dag.types'
import { Button } from '@shared/ui/Button'

// ─── Component ────────────────────────────────────────────────────────────────

interface QuestionStepProps {
  // Додаємо min та max до типізації, щоб TypeScript їх розпізнавав
  data: QuestionNodeData & { mediaUrl?: string | null; min?: number; max?: number }
  onAnswer: (value: string | string[]) => void
}

export function QuestionStep({ data, onAnswer }: QuestionStepProps) {
  const { questionText, answerType, options, mediaUrl, min = 0, max = 10 } = data

  const isMulti = answerType === AnswerType.MultipleChoice
  const isSlider = answerType === AnswerType.Slider

  // Стан для множинного вибору
  const [selected, setSelected] = useState<string[]>([])
  
  // Стан для слайдера (за замовчуванням ставимо по центру)
  const [sliderValue, setSliderValue] = useState<number>(Math.round((min + max) / 2))

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleOptionClick(option: AnswerOption) {
    if (answerType === AnswerType.SingleChoice) {
      // Одразу переходимо далі при одиничному виборі
      onAnswer(option.value)
    } else if (isMulti) {
      // Множинний вибір: перемикаємо стан
      setSelected((prev) =>
        prev.includes(option.value)
          ? prev.filter((v) => v !== option.value)
          : [...prev, option.value]
      )
    }
  }

  // Спільний обробник для кнопки "Continue" (використовується для Multi та Slider)
  function handleContinue() {
    if (isMulti && selected.length > 0) {
      onAnswer(selected)
    } else if (isSlider) {
      onAnswer(sliderValue.toString())
    }
  }

  return (
    <Wrapper>
      {mediaUrl && <QuestionMedia src={mediaUrl} alt={questionText} />}
      <QuestionText>{questionText}</QuestionText>

      {isMulti && <HintText>Select all that apply</HintText>}

      {/* Рендеримо сітку опцій або слайдер залежно від типу */}
      {!isSlider ? (
        <OptionsGrid>
          <AnimatePresence>
            {options?.map((opt, i) => {
              const isSelected = selected.includes(opt.value)
              return (
                <OptionCard
                  key={opt.id}
                  $selected={isMulti ? isSelected : false}
                  onClick={() => handleOptionClick(opt)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                >
                  {opt.icon && <OptionIcon>{opt.icon}</OptionIcon>}
                  <OptionLabel $selected={isMulti ? isSelected : false}>
                    {opt.label}
                  </OptionLabel>
                </OptionCard>
              )
            })}
          </AnimatePresence>
        </OptionsGrid>
      ) : (
        <SliderWrapper
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CurrentValue>{sliderValue}</CurrentValue>
          <SliderInput
            type="range"
            min={min}
            max={max}
            step={1}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
          />
          <SliderLabels>
            <span>{min}</span>
            <span>{max}</span>
          </SliderLabels>
        </SliderWrapper>
      )}

      {/* Показуємо кнопку Continue для MultipleChoice або Slider */}
      {(isMulti || isSlider) && (
        <Button
          fullWidth
          size="lg"
          disabled={isMulti && selected.length === 0}
          icon={<ChevronRight size={18} />}
          onClick={handleContinue}
        >
          Continue
        </Button>
      )}
    </Wrapper>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
`

const QuestionText = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes.xl};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  text-align: center;
`

const OptionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const OptionCard = styled(motion.button)<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 2px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.accent : theme.colors.border};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentLight : theme.colors.bgSurface};
  cursor: pointer;
  text-align: left;
  transition: border-color ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast},
    box-shadow ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: ${({ theme }) => theme.shadows.sm};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.accentLight};
  }
`

const OptionIcon = styled.span`
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
`

const OptionLabel = styled.span<{ $selected: boolean }>`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  font-weight: ${({ theme, $selected }) =>
    $selected
      ? theme.typography.weights.semibold
      : theme.typography.weights.regular};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentText : theme.colors.textPrimary};
`

const HintText = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textTertiary};
  text-align: center;
`

const QuestionMedia = styled.img`
  max-width: 100%;
  max-height: 240px;
  border-radius: ${({ theme }) => theme.radii.md};
  object-fit: contain;
  align-self: center;
`

// ─── Slider Styles ────────────────────────────────────────────────────────────

const SliderWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 16px;
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

const CurrentValue = styled.div`
  text-align: center;
  font-size: 42px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.accent};
`

const SliderInput = styled.input`
  width: 100%;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.accent};
  height: 6px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  outline: none;
  
  &::-webkit-slider-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    transition: transform 0.1s;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }
`

const SliderLabels = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
`