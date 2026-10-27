import { useEffect, useState } from 'react';
import { localDay } from './practiceTime';

export function usePracticeDay() {
  const [day, setDay] = useState(() => localDay(Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setDay(localDay(Date.now())), 1000);
    return () => clearInterval(timer);
  }, []);
  return day;
}
