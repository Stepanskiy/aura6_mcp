import { Route, Routes } from "react-router-dom";
import { ProjectList } from "./ProjectList";
import { ProjectNew } from "./ProjectNew";
import { ProjectCard } from "./ProjectCard";

export function ProjectsApp() {
  return (
    <Routes>
      <Route index element={<ProjectList />} />
      <Route path="new" element={<ProjectNew />} />
      <Route path=":code" element={<ProjectCard />} />
    </Routes>
  );
}
