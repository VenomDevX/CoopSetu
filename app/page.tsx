import { getIsNative } from '@/lib/native/server';
import { WebLanding } from '@/components/marketing/web-landing';
import { NativeLanding } from '@/components/mobile/marketing/native-landing';

/**
 * The landing page picks its implementation from the request.
 *
 * A server component so the choice is made before the first byte — branching
 * on the client would ship, mount and animate the 1200-line desktop landing
 * page inside the app before replacing it.
 *
 * WebLanding is the previous contents of this file, moved verbatim (only the
 * component's name changed), so the browser experience is unchanged.
 */
export default async function LandingPage() {
  const isNative = await getIsNative();
  return isNative ? <NativeLanding /> : <WebLanding />;
}
