import { Settings as SettingsIcon, Crosshair, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/PageTransition";
import { ParametrosRadar } from "@/components/radar/ParametrosRadar";
import { reindexAll } from "@/lib/api/embedding";

export default function Settings() {
  const [reindexing, setReindexing] = useState(false);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const { queued } = await reindexAll();
      toast.success(`Reindexação concluída (${queued} itens)`);
    } catch (e) {
      toast.error("Erro na reindexação");
      console.error(e);
    } finally {
      setReindexing(false);
    }
  };

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
            <TabsTrigger value="ai">
              <Sparkles className="w-4 h-4 mr-2" />
              IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="radar" className="mt-6">
            <ParametrosRadar />
          </TabsContent>

          <TabsContent value="ai" className="mt-6">
            <Card className="p-6 max-w-2xl space-y-4">
              <div>
                <h2 className="font-semibold text-lg">Indexação semântica</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA mantém um índice do seu conteúdo para identificar relações entre notas, tarefas, projetos e produtos.
                  Itens novos ou editados são indexados automaticamente. Use a reindexação para processar tudo de uma vez
                  (recomendado na primeira vez).
                </p>
              </div>
              <Button onClick={handleReindex} disabled={reindexing}>
                {reindexing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Reindexar workspace
              </Button>
              <p className="text-xs text-muted-foreground">
                A reindexação consome créditos do workspace (proporcional ao volume de itens).
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
