import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ClientesListPage } from "@/pages/clientes/ClientesListPage";
import { ClienteDetailPage } from "@/pages/clientes/ClienteDetailPage";
import { KanbanPage } from "@/pages/kanban/KanbanPage";
import { SitPlanPage } from "@/pages/sitplan/SitPlanPage";
import { DemandasPage } from "@/pages/demandas/DemandasPage";
import { AgendaPage } from "@/pages/agenda/AgendaPage";
import { AniversariantesPage } from "@/pages/aniversariantes/AniversariantesPage";
import { RevisitasPage } from "@/pages/revisitas/RevisitasPage";
import { RevisitasGate } from "@/pages/revisitas/RevisitasGate";
import { NovaRevisitaPage } from "@/pages/revisitas/NovaRevisitaPage";
import { EditarRevisitaPage } from "@/pages/revisitas/EditarRevisitaPage";
import { RevisitaViewPage } from "@/pages/revisitas/RevisitaViewPage";
import { TagsPage } from "@/pages/tags/TagsPage";
import { ImportarClientesPage } from "@/pages/importar/ImportarClientesPage";
import { AtualizarCapitalPage } from "@/pages/importar/AtualizarCapitalPage";
import { ImportarVencimentosPage } from "@/pages/importar/ImportarVencimentosPage";
import { ImportarDetalhesApolicesPage } from "@/pages/importar/ImportarDetalhesApolicesPage";
import { SincronizarPrudentialPage } from "@/pages/importar/SincronizarPrudentialPage";
import { GeradorPrevidenciaPage } from "@/pages/previdencia/GeradorPrevidenciaPage";
import NotFound from "@/pages/NotFound";

export const routers = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "clientes", element: <ClientesListPage /> },
      { path: "clientes/:id", element: <ClienteDetailPage /> },
      { path: "kanban", element: <KanbanPage /> },
      { path: "sitplan", element: <SitPlanPage /> },
      { path: "demandas", element: <DemandasPage /> },
      { path: "agenda", element: <AgendaPage /> },
      { path: "aniversariantes", element: <AniversariantesPage /> },
      {
        path: "revisitas",
        element: (
          <RevisitasGate>
            <RevisitasPage />
          </RevisitasGate>
        ),
      },
      {
        path: "revisitas/nova",
        element: (
          <RevisitasGate>
            <NovaRevisitaPage />
          </RevisitasGate>
        ),
      },
      {
        path: "revisitas/:id",
        element: (
          <RevisitasGate>
            <RevisitaViewPage />
          </RevisitasGate>
        ),
      },
      {
        path: "revisitas/:id/editar",
        element: (
          <RevisitasGate>
            <EditarRevisitaPage />
          </RevisitasGate>
        ),
      },
      { path: "previdencia", element: <GeradorPrevidenciaPage /> },
      { path: "tags", element: <TagsPage /> },
      { path: "importar", element: <ImportarClientesPage /> },
      { path: "importar/capital", element: <AtualizarCapitalPage /> },
      { path: "importar/vencimentos", element: <ImportarVencimentosPage /> },
      { path: "importar/apolices", element: <ImportarDetalhesApolicesPage /> },
      { path: "importar/sincronizar", element: <SincronizarPrudentialPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
