import { Settings as SettingsIcon, Crosshair } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageTransition } from "@/components/PageTransition";
import { ParametrosRadar } from "@/components/radar/ParametrosRadar";

export default function Settings() {
  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Configurações</h1>
        </div>

        <Tabs defaultValue="radar" className="w-full">
          <TabsList>
            <TabsTrigger value="radar">
              <Crosshair className="w-4 h-4 mr-2" />
              Radar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="radar" className="mt-6">
            <ParametrosRadar />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
