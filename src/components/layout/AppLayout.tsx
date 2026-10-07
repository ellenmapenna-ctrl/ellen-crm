import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Cake, CalendarClock, CalendarDays, ClipboardList, KanbanSquare, LayoutDashboard, ListChecks, PiggyBank, ShieldCheck, Tags, Upload, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAniversariantes } from "@/hooks/useAniversariantes";
import { useDemandasAbertasCount } from "@/hooks/useDemandas";
import { useSitPlanCount } from "@/hooks/useSitPlan";
import { hojeIso } from "@/lib/sitplan";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const NAV_ITENS: Omit<NavItem, "badge">[] = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/kanban", label: "Funil", icon: KanbanSquare },
  { to: "/sitplan", label: "SitPlan & TA", icon: ListChecks },
  { to: "/demandas", label: "Demandas", icon: ClipboardList },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { to: "/revisitas", label: "Revisão Anual", icon: CalendarClock },
  { to: "/previdencia", label: "Previdência", icon: PiggyBank },
  { to: "/tags", label: "Tags", icon: Tags },
  { to: "/importar", label: "Importar", icon: Upload },
];

const TITULOS: Record<string, string> = {
  "/": "Início",
  "/clientes": "Clientes",
  "/kanban": "Funil",
  "/sitplan": "SitPlan & TA",
  "/demandas": "Demandas",
  "/agenda": "Agenda",
  "/aniversariantes": "Aniversariantes",
  "/revisitas": "Revisão Anual",
  "/previdencia": "Gerador de Previdência",
  "/tags": "Tags",
  "/importar": "Importar clientes",
  "/importar/capital": "Atualizar capital segurado",
  "/importar/vencimentos": "Importar vencimentos",
};

function tituloDaRota(pathname: string): string {
  if (pathname.startsWith("/clientes/")) return "Detalhe do cliente";
  return TITULOS[pathname] ?? "CRM - ELLEN";
}

export function AppLayout() {
  const location = useLocation();
  const { data: aniversariantes } = useAniversariantes(30);
  const hojeCount = aniversariantes?.hojeCount ?? 0;
  const { data: demandasAbertas } = useDemandasAbertasCount();
  const { data: sitplanHojeCount } = useSitPlanCount(hojeIso());

  return (
    <SidebarProvider className="min-h-screen w-full bg-gradient-subtle">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">CRM - ELLEN</span>
              <span className="text-[11px] text-muted-foreground">Carteira de clientes</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITENS.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <NavLink to={item.to} end={item.to === "/"}>
                        {({ isActive }) => (
                          <>
                            <item.icon />
                            <span>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                    {item.to === "/aniversariantes" && hojeCount > 0 && (
                      <SidebarMenuBadge>
                        <Badge className="h-5 min-w-5 justify-center bg-primary px-1.5 text-[11px] text-primary-foreground">
                          {hojeCount}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                    {item.to === "/demandas" && !!demandasAbertas && demandasAbertas > 0 && (
                      <SidebarMenuBadge>
                        <Badge className="h-5 min-w-5 justify-center bg-primary px-1.5 text-[11px] text-primary-foreground">
                          {demandasAbertas}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                    {item.to === "/sitplan" && !!sitplanHojeCount && sitplanHojeCount > 0 && (
                      <SidebarMenuBadge>
                        <Badge className="h-5 min-w-5 justify-center bg-primary px-1.5 text-[11px] text-primary-foreground">
                          {sitplanHojeCount}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
        <SidebarFooter>
          <div className="px-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
            Uso interno — sem login
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <h1 className="text-sm font-semibold tracking-tight">{tituloDaRota(location.pathname)}</h1>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

