'use client'

import dynamic from 'next/dynamic'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { FlowSection } from '@/components/landing/FlowSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { CTASection } from '@/components/landing/CTASection'

const Scene3D = dynamic(
  () => import('@/components/landing/Scene3D').then((mod) => ({ default: mod.Scene3D })),
  { ssr: false }
)

export default function LandingPage() {
  return (
    <>
      <Scene3D />
      <HeroSection />
      <FeaturesSection />
      <FlowSection />
      <StatsSection />
      <CTASection />
    </>
  )
}
