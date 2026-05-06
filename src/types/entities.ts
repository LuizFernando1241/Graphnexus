export type EntityType = 'note' | 'task' | 'project';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string | null;
  color: string | null;
  emoji: string | null;
  tags: string[] | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  subtasks: Subtask[];
  archived: boolean;
  recurrence_rule: string | null;
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
  recurrence_days: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  cover_color: string | null;
  emoji: string | null;
  start_date: string | null;
  target_date: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityLink {
  id: string;
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
  label: string | null;
  created_at: string;
}

export type AnyEntity = Note | Task | Project;

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  emoji?: string | null;
  color?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
}
