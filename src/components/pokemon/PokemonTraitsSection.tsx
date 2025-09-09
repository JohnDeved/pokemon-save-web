import { Skeleton } from '@/components/common'
import { AbilityTab } from '@/components/pokemon/traits/AbilityTab'
import { ItemTab } from '@/components/pokemon/traits/ItemTab'
import { NatureTab } from '@/components/pokemon/traits/NatureTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BoostSandboxTab } from '@/components/pokemon/traits/BoostSandboxTab'
import { useActivePokemonLoading } from '@/hooks'

export const PokemonTraitsSection: React.FC = () => {
  const isLoading = useActivePokemonLoading()
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="flex flex-col h-full">
        <Tabs defaultValue="nature" className="flex-1 flex flex-col">
          <div className="flex-shrink-0">
            <div className="w-full border-b border-border/60">
              <div className="px-4">
                <TabsList className="px-0">
                  <TabsTrigger value="nature" className="font-pixel text-xs">
                    Nature
                  </TabsTrigger>
                  <TabsTrigger value="ability" className="font-pixel text-xs">
                    Ability
                  </TabsTrigger>
                  <TabsTrigger value="item" className="font-pixel text-xs">
                    Held Item
                  </TabsTrigger>
                  <TabsTrigger value="boosts" className="font-pixel text-xs">
                    Boosts
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          <TabsContent value="nature" className="flex-1 flex flex-col">
            <NatureTab />
          </TabsContent>

          <TabsContent value="ability" className="flex-1 flex flex-col">
            <AbilityTab />
          </TabsContent>

          <TabsContent value="item" className="flex-1 flex flex-col">
            <ItemTab />
          </TabsContent>

          <TabsContent value="boosts" className="flex-1 flex flex-col">
            <BoostSandboxTab />
          </TabsContent>
        </Tabs>
      </div>
    </Skeleton.LoadingProvider>
  )
}
