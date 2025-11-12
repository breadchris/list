import React, { useState } from 'react';
import { TaskListData } from '../contentTypeSchemas';

interface TaskListViewerProps {
  data: TaskListData;
}

/**
 * Viewer component for task list content type
 * Interactive task management with priorities, due dates, and subtasks
 */
export const TaskListViewer: React.FC<TaskListViewerProps> = ({ data }) => {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSubtask = (subtaskId: string) => {
    setCompletedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(subtaskId)) {
        next.delete(subtaskId);
      } else {
        next.add(subtaskId);
      }
      return next;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const completedCount = completedTasks.size;
  const totalCount = data.tasks.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.title}</h1>
        {data.description && (
          <p className="text-gray-600">{data.description}</p>
        )}
        {data.category && (
          <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            📁 {data.category}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progress: {completedCount}/{totalCount} tasks
          </span>
          <span className="text-sm text-gray-500">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-4">
        {data.tasks.map((task) => {
          const isCompleted = completedTasks.has(task.task_id);

          return (
            <div
              key={task.task_id}
              className={`border rounded-lg p-4 transition-all ${
                isCompleted ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'
              }`}
            >
              {/* Task header */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleTask(task.task_id)}
                  className={`flex-shrink-0 mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                      {task.description}
                    </p>
                  )}

                  {/* Task metadata */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.estimated_duration && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        ⏱️ {task.estimated_duration} min
                      </span>
                    )}
                    {task.due_date && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        📅 {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.tags && task.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Subtasks */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                      {task.subtasks.map((subtask) => {
                        const isSubtaskCompleted = completedSubtasks.has(subtask.subtask_id);

                        return (
                          <div key={subtask.subtask_id} className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSubtask(subtask.subtask_id)}
                              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSubtaskCompleted
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-gray-300 hover:border-blue-500'
                              }`}
                            >
                              {isSubtaskCompleted && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <span className={`text-sm ${isSubtaskCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {subtask.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
