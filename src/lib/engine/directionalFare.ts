import type { FareResult } from './tflApi';

/** Pick a route within one direction; the reverse journey has its own result. */
export function selectDirectionalFare(result: FareResult, preferredRoute = '', cheapest = false) {
  const options = result.isFromApi ? result.options ?? [] : [];
  const preferred = options.find(option => option.routeDescription === preferredRoute);
  const option = preferred ?? (cheapest
    ? [...options].sort((a, b) => a.peak + a.offPeak - b.peak - b.offPeak)[0]
    : options.find(option => option.routeDescription === 'Default Route') ?? options[0]);
  const base = result.isFromApi && option
    ? result.baseOptions?.find(item => item.routeDescription === option.routeDescription)
    : undefined;
  return {
    peak: option?.peak ?? result.peak,
    offPeak: option?.offPeak ?? result.offPeak,
    basePeak: base?.peak ?? result.basePeak,
    baseOffPeak: base?.offPeak ?? result.baseOffPeak,
    routeDescription: option?.routeDescription ?? (result.isFromApi ? result.routeDescription ?? '' : ''),
    isFromApi: result.isFromApi,
  };
}
