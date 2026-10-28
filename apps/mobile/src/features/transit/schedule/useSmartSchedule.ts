import { useQuery } from '@tanstack/react-query';
import { smartScheduleQueryOptions, type SmartScheduleOptions } from '../transit.client';

export function useSmartSchedule(endpoint: string | undefined, options: SmartScheduleOptions = {}) {
  return useQuery(smartScheduleQueryOptions(endpoint, options));
}
