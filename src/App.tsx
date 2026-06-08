import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { OfflineBanner } from "@/components/OfflineBanner";
import Dashboard from "@/pages/Dashboard";
import Notes from "@/pages/Notes";
import NoteDetail from "@/pages/NoteDetail";
import Tasks from "@/pages/Tasks";
import TaskDetail from "@/pages/TaskDetail";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Graph from "@/pages/Graph";
import Archive from "@/pages/Archive";
import Import from "@/pages/Import";
import RadarPage from "@/pages/RadarPage";
import AprovadosPage from "@/pages/AprovadosPage";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      staleTime: 1000 * 60 * 5, // 5 min
      retry: (failureCount, error) => {
        // Don't retry when offline
        if (!navigator.onLine) return false;
        return failureCount < 3;
      },
    },
  },
});

const IDB_KEY = "nexus_cache";

const persister = {
  persistClient: async (client: unknown) => {
    await set(IDB_KEY, client);
  },
  restoreClient: async () => {
    return await get(IDB_KEY);
  },
  removeClient: async () => {
    await del(IDB_KEY);
  },
};

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/notes", element: <Notes /> },
          { path: "/notes/:id", element: <NoteDetail /> },
          { path: "/tasks", element: <Tasks /> },
          { path: "/tasks/:id", element: <TaskDetail /> },
          { path: "/projects", element: <Projects /> },
          { path: "/projects/:id", element: <ProjectDetail /> },
          { path: "/graph", element: <Graph /> },
          { path: "/archive", element: <Archive /> },
          { path: "/import", element: <Import /> },
          { path: "/radar", element: <RadarPage /> },
          { path: "/radar/aprovados", element: <AprovadosPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <RouterProvider router={router} />
      </AuthProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
