import { Redirect, useLocalSearchParams } from 'expo-router';
import { isPracticeKind } from '../../features/practice/exercises';
import PracticeExercise from '../../features/practice/PracticeExercise';

export default function ExerciseRoute() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  return isPracticeKind(mode) ? (
    <PracticeExercise key={mode} kind={mode} />
  ) : (
    <Redirect href="/practice" />
  );
}
