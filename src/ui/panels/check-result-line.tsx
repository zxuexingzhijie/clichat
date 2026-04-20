import React from 'react';
import { Box, Text } from 'ink';
import type { CheckResult } from '../../types/common';
import { GRADE_LABELS, ATTRIBUTE_LABELS } from '../../types/common';
import type { SuccessGrade, AttributeName } from '../../types/common';

type CheckResultLineProps = {
  readonly checkResult: CheckResult;
};

function getGradeColor(grade: SuccessGrade): string | undefined {
  switch (grade) {
    case 'critical_success':
    case 'great_success':
    case 'success':
      return 'green';
    case 'partial_success':
      return 'yellow';
    case 'failure':
    case 'critical_failure':
      return 'red';
  }
}

function isGradeBold(grade: SuccessGrade): boolean {
  return grade === 'critical_success' || grade === 'critical_failure';
}

export function CheckResultLine({ checkResult }: CheckResultLineProps): React.ReactNode {
  const { roll, attributeName, attributeModifier, total, dc, grade } = checkResult;
  const attrLabel = ATTRIBUTE_LABELS[attributeName as AttributeName];
  const gradeLabel = GRADE_LABELS[grade as SuccessGrade];
  const gradeColor = getGradeColor(grade as SuccessGrade);
  const gradeBold = isGradeBold(grade as SuccessGrade);

  const isNat20 = roll === 20;
  const isNat1 = roll === 1;

  if (isNat20) {
    return (
      <Box>
        <Text color="green" bold>
          [D20: {roll}] + {attrLabel} {attributeModifier} = {total} vs DC {dc} → {gradeLabel}（天命所归！）
        </Text>
      </Box>
    );
  }

  if (isNat1) {
    return (
      <Box>
        <Text color="red" bold>
          [D20: {roll}] + {attrLabel} {attributeModifier} = {total} vs DC {dc} → {gradeLabel}（命运弄人...）
        </Text>
      </Box>
    );
  }

  const modSign = attributeModifier >= 0 ? `+${attributeModifier}` : `${attributeModifier}`;

  return (
    <Box>
      <Text bold>[D20: {roll}]</Text>
      <Text> + {attrLabel} {modSign} </Text>
      <Text bold>= {total}</Text>
      <Text dimColor> vs DC {dc}</Text>
      <Text> → </Text>
      <Text color={gradeColor} bold={gradeBold}>{gradeLabel}</Text>
    </Box>
  );
}
