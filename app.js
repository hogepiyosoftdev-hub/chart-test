/**
 * Task Management Tool - Core Engine
 * Implements: WBS, EVM, Gantt with Inazuma Line (Progress Line), Dependencies, and Aggregation
 */

class TaskManager {
  constructor() {
    this.tasks = [];
    this.statusDate = new Date().toISOString().split('T')[0];
    this.storageKey = 'pm_task_manager_data_v1';
    this.viewMode = 'all'; // 'all', 'gantt', 'wbs', 'dashboard'
    this.timeScale = 'day'; // 'day', 'week'
    this.filterCategory = 'all';
    this.filterStatus = 'all';
    this.filterAssignee = 'all';
    this.searchKeyword = '';
  }

  // Generate unique ID
  generateId() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  }

  // Load from LocalStorage or initialize default sample project
  init() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.tasks = data.tasks || [];
          this.statusDate = data.statusDate || new Date().toISOString().split('T')[0];
          if (this.tasks.length > 0) {
            this.recalculateAll();
            return;
          }
        } catch (e) {
          console.error('Failed to load saved data:', e);
        }
      }
    }
    this.loadSampleData();
  }

  save() {
    if (typeof localStorage !== 'undefined') {
      const data = {
        tasks: this.tasks,
        statusDate: this.statusDate,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
  }

  resetAll() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this.init();
  }

  // Load rich sample project (Modern Web System Development)
  loadSampleData() {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    const addDays = (d, n) => {
      const res = new Date(d);
      res.setDate(res.getDate() + n);
      return res;
    };

    // Base date anchor: 8 days before today as project start
    const base = addDays(today, -8);
    this.statusDate = fmt(today);

    this.tasks = [
      {
        id: 't_req',
        name: '要件定義・基本設計',
        parentId: null,
        startDate: fmt(base),
        endDate: fmt(addDays(base, 5)),
        actualStartDate: fmt(base),
        actualEndDate: fmt(addDays(base, 5)),
        bac: 40,
        ac: 42,
        progress: 100,
        priority: 'high',
        status: 'completed',
        category: '設計',
        assignee: '佐藤',
        predecessors: [],
        collapsed: false
      },
      {
        id: 't_req_1',
        name: 'ユーザー要求仕様書策定',
        parentId: 't_req',
        startDate: fmt(base),
        endDate: fmt(addDays(base, 2)),
        actualStartDate: fmt(base),
        actualEndDate: fmt(addDays(base, 2)),
        bac: 20,
        ac: 20,
        progress: 100,
        priority: 'high',
        status: 'completed',
        category: '設計',
        assignee: '佐藤',
        predecessors: [],
        collapsed: false
      },
      {
        id: 't_req_2',
        name: 'システム方式・UI設計書作成',
        parentId: 't_req',
        startDate: fmt(addDays(base, 3)),
        endDate: fmt(addDays(base, 5)),
        actualStartDate: fmt(addDays(base, 3)),
        actualEndDate: fmt(addDays(base, 5)),
        bac: 20,
        ac: 22,
        progress: 100,
        priority: 'high',
        status: 'completed',
        category: '設計',
        assignee: '田中',
        predecessors: ['t_req_1'],
        collapsed: false
      },
      {
        id: 't_dev',
        name: 'システム開発フェーズ',
        parentId: null,
        startDate: fmt(addDays(base, 6)),
        endDate: fmt(addDays(base, 16)),
        actualStartDate: fmt(addDays(base, 6)),
        actualEndDate: '',
        bac: 120,
        ac: 55,
        progress: 45,
        priority: 'urgent',
        status: 'in_progress',
        category: '開発',
        assignee: '鈴木',
        predecessors: ['t_req'],
        collapsed: false
      },
      {
        id: 't_dev_frontend',
        name: 'フロントエンド実装 (UI/UX)',
        parentId: 't_dev',
        startDate: fmt(addDays(base, 6)),
        endDate: fmt(addDays(base, 13)),
        actualStartDate: fmt(addDays(base, 5)), // 1日早く前倒し着手
        actualEndDate: '',
        bac: 50,
        ac: 30,
        progress: 70, // 前倒し進行中
        priority: 'high',
        status: 'in_progress',
        category: '開発',
        assignee: '田中',
        predecessors: [],
        collapsed: false
      },
      {
        id: 't_dev_backend',
        name: 'バックエンドAPI・DB開発',
        parentId: 't_dev',
        startDate: fmt(addDays(base, 6)),
        endDate: fmt(addDays(base, 14)),
        actualStartDate: fmt(addDays(base, 7)), // 1日遅れて着手
        actualEndDate: '',
        bac: 50,
        ac: 20,
        progress: 30, // やや遅延気味
        priority: 'urgent',
        status: 'in_progress',
        category: '開発',
        assignee: '鈴木',
        predecessors: [],
        collapsed: false
      },
      {
        id: 't_dev_api_int',
        name: 'API疎通・結合確認',
        parentId: 't_dev',
        startDate: fmt(addDays(base, 14)),
        endDate: fmt(addDays(base, 16)),
        actualStartDate: '',
        actualEndDate: '',
        bac: 20,
        ac: 5,
        progress: 10,
        priority: 'medium',
        status: 'in_progress',
        category: '開発',
        assignee: '高橋',
        predecessors: ['t_dev_frontend', 't_dev_backend'],
        collapsed: false
      },
      {
        id: 't_test',
        name: '総合テスト・受入検証',
        parentId: null,
        startDate: fmt(addDays(base, 17)),
        endDate: fmt(addDays(base, 23)),
        actualStartDate: '',
        actualEndDate: '',
        bac: 60,
        ac: 0,
        progress: 0,
        priority: 'high',
        status: 'not_started',
        category: 'テスト',
        assignee: '渡辺',
        predecessors: ['t_dev'],
        collapsed: false
      },
      {
        id: 't_test_scenario',
        name: 'テストシナリオ作成・実施',
        parentId: 't_test',
        startDate: fmt(addDays(base, 17)),
        endDate: fmt(addDays(base, 21)),
        actualStartDate: '',
        actualEndDate: '',
        bac: 40,
        ac: 0,
        progress: 0,
        priority: 'high',
        status: 'not_started',
        category: 'テスト',
        assignee: '渡辺',
        predecessors: [],
        collapsed: false
      },
      {
        id: 't_test_fix',
        name: '不具合改修・回帰テスト',
        parentId: 't_test',
        startDate: fmt(addDays(base, 21)),
        endDate: fmt(addDays(base, 23)),
        actualStartDate: '',
        actualEndDate: '',
        bac: 20,
        ac: 0,
        progress: 0,
        priority: 'medium',
        status: 'not_started',
        category: 'テスト',
        assignee: '鈴木',
        predecessors: ['t_test_scenario'],
        collapsed: false
      },
      {
        id: 't_release',
        name: '本番環境移行・リリース',
        parentId: null,
        startDate: fmt(addDays(base, 24)),
        endDate: fmt(addDays(base, 25)),
        actualStartDate: '',
        actualEndDate: '',
        bac: 20,
        ac: 0,
        progress: 0,
        priority: 'urgent',
        status: 'not_started',
        category: '管理',
        assignee: '佐藤',
        predecessors: ['t_test'],
        collapsed: false
      }
    ];

    this.recalculateAll();
    this.save();
  }

  // WBS Tree Building & Hierarchy Management
  isParent(taskId) {
    return this.tasks.some(t => t.parentId === taskId);
  }

  getChildren(taskId) {
    return this.tasks.filter(t => t.parentId === taskId);
  }

  getAllDescendants(taskId) {
    let result = [];
    const children = this.getChildren(taskId);
    for (const child of children) {
      result.push(child);
      result = result.concat(this.getAllDescendants(child.id));
    }
    return result;
  }

  getAncestors(taskId) {
    const ancestors = [];
    let current = this.tasks.find(t => t.id === taskId);
    while (current && current.parentId) {
      const parent = this.tasks.find(t => t.id === current.parentId);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  }

  // Build sorted hierarchical list with WBS codes (e.g. 1, 1.1, 1.1.1)
  getOrderedWbsList() {
    const result = [];
    const buildLevel = (parentId, prefix) => {
      const siblings = this.tasks.filter(t => t.parentId === parentId);
      siblings.forEach((task, index) => {
        const wbsCode = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        task._wbsCode = wbsCode;
        task._level = prefix ? prefix.split('.').length : 0;
        task._isParent = this.isParent(task.id);
        result.push(task);

        if (!task.collapsed) {
          buildLevel(task.id, wbsCode);
        }
      });
    };
    buildLevel(null, '');
    return result;
  }

  // Recalculate parent task rollups (Start, End, BAC, AC, Progress)
  recalculateRollups() {
    // Process bottom-up by tree depth
    const maxDepth = 10;
    for (let depth = maxDepth; depth >= 0; depth--) {
      for (const task of this.tasks) {
        const children = this.getChildren(task.id);
        if (children.length > 0) {
          // Parent task rollup
          // Start date: earliest child start date
          const validStarts = children.map(c => c.startDate).filter(Boolean);
          if (validStarts.length > 0) {
            task.startDate = validStarts.reduce((min, cur) => cur < min ? cur : min, validStarts[0]);
          }

          // End date: latest child end date
          const validEnds = children.map(c => c.endDate).filter(Boolean);
          if (validEnds.length > 0) {
            task.endDate = validEnds.reduce((max, cur) => cur > max ? cur : max, validEnds[0]);
          }

          // Actual Start date: earliest child actual start date (if any)
          const validActStarts = children.map(c => c.actualStartDate).filter(Boolean);
          if (validActStarts.length > 0) {
            task.actualStartDate = validActStarts.reduce((min, cur) => cur < min ? cur : min, validActStarts[0]);
          }

          // Actual End date: latest child actual end date only if all children with actual dates have ended
          const validActEnds = children.map(c => c.actualEndDate).filter(Boolean);
          if (validActEnds.length === children.length && validActEnds.length > 0) {
            task.actualEndDate = validActEnds.reduce((max, cur) => cur > max ? cur : max, validActEnds[0]);
          } else {
            task.actualEndDate = '';
          }

          // BAC: sum of leaf descendants or direct children
          const directBac = children.reduce((sum, c) => sum + (Number(c.bac) || 0), 0);
          task.bac = Math.round(directBac * 10) / 10;

          // AC: sum of direct children
          const directAc = children.reduce((sum, c) => sum + (Number(c.ac) || 0), 0);
          task.ac = Math.round(directAc * 10) / 10;

          // Progress: weighted by BAC of children, fallback to simple average
          if (directBac > 0) {
            const weightedEarned = children.reduce((sum, c) => sum + ((Number(c.bac) || 0) * (Number(c.progress) || 0) / 100), 0);
            task.progress = Math.round((weightedEarned / directBac) * 100);
          } else {
            const avgProgress = children.reduce((sum, c) => sum + (Number(c.progress) || 0), 0) / children.length;
            task.progress = Math.round(avgProgress);
          }

          // Status auto-update based on progress
          if (task.progress >= 100) {
            task.status = 'completed';
          } else if (task.progress > 0) {
            task.status = 'in_progress';
          } else {
            task.status = 'not_started';
          }
        }
      }
    }
  }

  // Calculate EVM for a single task
  calculateTaskEvm(task) {
    const bac = Number(task.bac) || 0;
    const ac = Number(task.ac) || 0;
    const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));

    // Status Date and dates
    const sDate = new Date(this.statusDate + 'T00:00:00');
    const start = new Date(task.startDate + 'T00:00:00');
    const end = new Date(task.endDate + 'T00:00:00');

    // Total task duration in days
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    // Planned Value (PV) calculation
    let pv = 0;
    if (sDate < start) {
      pv = 0;
    } else if (sDate >= end) {
      pv = bac;
    } else {
      const elapsedDays = Math.max(0, Math.round((sDate - start) / (1000 * 60 * 60 * 24)) + 1);
      const ratio = Math.min(1, Math.max(0, elapsedDays / totalDays));
      pv = Math.round(bac * ratio * 10) / 10;
    }

    // Earned Value (EV) calculation
    const ev = Math.round((bac * (progress / 100)) * 10) / 10;

    // Variance & Indices
    const sv = Math.round((ev - pv) * 10) / 10;
    const cv = Math.round((ev - ac) * 10) / 10;

    // SPI (Schedule Performance Index) & CPI (Cost Performance Index)
    const spi = pv > 0 ? Math.round((ev / pv) * 100) / 100 : (ev > 0 ? 1.0 : 1.0);
    const cpi = ac > 0 ? Math.round((ev / ac) * 100) / 100 : (ev > 0 ? 1.0 : 1.0);

    // EAC (Estimate at Completion) & VAC (Variance at Completion)
    const eac = cpi > 0 ? Math.round((bac / cpi) * 10) / 10 : bac;
    const vac = Math.round((bac - eac) * 10) / 10;

    // Progress Date for Inazuma Line
    // If progress = 0 -> startDate, if progress = 100 -> endDate
    const progressTime = start.getTime() + (end.getTime() - start.getTime()) * (progress / 100);
    const progressDate = new Date(progressTime);
    const progressDateStr = progressDate.toISOString().split('T')[0];

    // Delay Days: (Status Date - Progress Date) in days
    // >0 means delayed behind status date, <0 means ahead
    let delayDays = Math.round((sDate.getTime() - progressDate.getTime()) / (1000 * 60 * 60 * 24));

    // Special Inazuma Line Rules:
    // 1. 過去の予定（endDate <= statusDate）で完了済みのタスクは遅延とみなさず垂直線上に整列
    // 2. 開始日が未来（startDate > statusDate）で未着手（progress === 0）のタスクも遅延・前倒しとみなさず垂直線上に整列
    // 3. 未来の予定が前倒し完了したタスク（progress > 0）は前倒し（右突出）として維持
    const isPastPlanCompleted = (progress >= 100 || task.status === 'completed') && (task.endDate <= this.statusDate);
    const isFutureUnstarted = (task.startDate > this.statusDate) && (progress === 0);
    const isInazumaVerticalPass = isPastPlanCompleted || isFutureUnstarted;

    if (isInazumaVerticalPass) {
      delayDays = 0;
    }

    return {
      bac,
      pv,
      ev,
      ac,
      sv,
      cv,
      spi,
      cpi,
      eac,
      vac,
      progressDateStr,
      delayDays,
      isPastPlanCompleted,
      isFutureUnstarted,
      isInazumaVerticalPass
    };
  }

  // Global Project EVM Metrics
  getProjectEvm() {
    // Only sum leaf tasks to avoid double counting
    const leafTasks = this.tasks.filter(t => !this.isParent(t.id));
    let totalBac = 0;
    let totalPv = 0;
    let totalEv = 0;
    let totalAc = 0;

    for (const t of leafTasks) {
      const metrics = this.calculateTaskEvm(t);
      totalBac += metrics.bac;
      totalPv += metrics.pv;
      totalEv += metrics.ev;
      totalAc += metrics.ac;
    }

    totalBac = Math.round(totalBac * 10) / 10;
    totalPv = Math.round(totalPv * 10) / 10;
    totalEv = Math.round(totalEv * 10) / 10;
    totalAc = Math.round(totalAc * 10) / 10;

    const sv = Math.round((totalEv - totalPv) * 10) / 10;
    const cv = Math.round((totalEv - totalAc) * 10) / 10;
    const spi = totalPv > 0 ? Math.round((totalEv / totalPv) * 100) / 100 : 1.0;
    const cpi = totalAc > 0 ? Math.round((totalEv / totalAc) * 100) / 100 : 1.0;
    const eac = cpi > 0 ? Math.round((totalBac / cpi) * 10) / 10 : totalBac;
    const vac = Math.round((totalBac - eac) * 10) / 10;

    // Overall progress %
    const overallProgress = totalBac > 0 ? Math.round((totalEv / totalBac) * 100) : 0;

    return {
      bac: totalBac,
      pv: totalPv,
      ev: totalEv,
      ac: totalAc,
      sv,
      cv,
      spi,
      cpi,
      eac,
      vac,
      overallProgress,
      leafCount: leafTasks.length,
      totalCount: this.tasks.length
    };
  }

  // Category & Assignee Aggregations
  getAggregations() {
    const leafTasks = this.tasks.filter(t => !this.isParent(t.id));

    // Status breakdown
    const byStatus = {
      not_started: { count: 0, bac: 0, ac: 0, ev: 0, label: '未着手', color: '#64748b' },
      in_progress: { count: 0, bac: 0, ac: 0, ev: 0, label: '進行中', color: '#3b82f6' },
      completed: { count: 0, bac: 0, ac: 0, ev: 0, label: '完了', color: '#10b981' },
      on_hold: { count: 0, bac: 0, ac: 0, ev: 0, label: '保留', color: '#f59e0b' }
    };

    // Category breakdown
    const byCategory = {};
    // Assignee breakdown
    const byAssignee = {};

    for (const t of leafTasks) {
      const evm = this.calculateTaskEvm(t);
      const st = t.status || 'not_started';
      if (byStatus[st]) {
        byStatus[st].count++;
        byStatus[st].bac += evm.bac;
        byStatus[st].ac += evm.ac;
        byStatus[st].ev += evm.ev;
      }

      const cat = t.category || '未分類';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, bac: 0, ac: 0, ev: 0, pv: 0 };
      }
      byCategory[cat].count++;
      byCategory[cat].bac += evm.bac;
      byCategory[cat].ac += evm.ac;
      byCategory[cat].ev += evm.ev;
      byCategory[cat].pv += evm.pv;

      const user = t.assignee || '未設定';
      if (!byAssignee[user]) {
        byAssignee[user] = { count: 0, bac: 0, ac: 0, ev: 0 };
      }
      byAssignee[user].count++;
      byAssignee[user].bac += evm.bac;
      byAssignee[user].ac += evm.ac;
      byAssignee[user].ev += evm.ev;
    }

    return { byStatus, byCategory, byAssignee };
  }

  // Recalculate all state
  recalculateAll() {
    this.recalculateRollups();
  }

  // Task CRUD operations
  addTask(taskData) {
    const newTask = {
      id: this.generateId(),
      name: taskData.name || '新しいタスク',
      parentId: taskData.parentId || null,
      startDate: taskData.startDate || this.statusDate,
      endDate: taskData.endDate || this.statusDate,
      actualStartDate: taskData.actualStartDate || '',
      actualEndDate: taskData.actualEndDate || '',
      bac: Number(taskData.bac) || 10,
      ac: Number(taskData.ac) || 0,
      progress: Math.max(0, Math.min(100, Number(taskData.progress) || 0)),
      priority: taskData.priority || 'medium',
      status: taskData.status || 'not_started',
      category: taskData.category || '一般',
      assignee: taskData.assignee || '',
      isMilestone: Boolean(taskData.isMilestone),
      predecessors: taskData.predecessors || [],
      collapsed: false
    };

    // If inserted after a specific task
    if (taskData.insertAfterId) {
      const idx = this.tasks.findIndex(t => t.id === taskData.insertAfterId);
      if (idx !== -1) {
        this.tasks.splice(idx + 1, 0, newTask);
      } else {
        this.tasks.push(newTask);
      }
    } else {
      this.tasks.push(newTask);
    }

    this.recalculateAll();
    this.save();
    return newTask;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;

    // Check circular dependencies if predecessors updated
    if (updates.predecessors && this.detectCircularDependency(taskId, updates.predecessors)) {
      throw new Error('循環依存が検出されました。先行タスクの設定を見直してください。');
    }

    Object.assign(task, updates);

    // If completed status set, auto set 100% progress
    if (updates.status === 'completed' && updates.progress === undefined) {
      task.progress = 100;
    } else if (updates.progress === 100 && updates.status === undefined) {
      task.status = 'completed';
    }

    this.recalculateAll();
    this.save();
    return true;
  }

  deleteTask(taskId) {
    // Delete task and all descendants
    const descendants = this.getAllDescendants(taskId);
    const toDeleteIds = new Set([taskId, ...descendants.map(d => d.id)]);

    this.tasks = this.tasks.filter(t => !toDeleteIds.has(t.id));

    // Remove deleted tasks from predecessors
    for (const t of this.tasks) {
      if (t.predecessors && t.predecessors.length > 0) {
        t.predecessors = t.predecessors.filter(pid => !toDeleteIds.has(pid));
      }
    }

    this.recalculateAll();
    this.save();
  }

  // WBS Indent (make child of previous sibling)
  indentTask(taskId) {
    const ordered = this.getOrderedWbsList();
    const idx = ordered.findIndex(t => t.id === taskId);
    if (idx <= 0) return false; // Can't indent first task

    const target = ordered[idx];
    const prev = ordered[idx - 1];

    // Cannot make child of its own descendant or if prev is same parent level
    if (prev.parentId === target.parentId) {
      target.parentId = prev.id;
      prev.collapsed = false;
      this.recalculateAll();
      this.save();
      return true;
    } else if (prev.id !== target.id) {
      target.parentId = prev.id;
      prev.collapsed = false;
      this.recalculateAll();
      this.save();
      return true;
    }
    return false;
  }

  // WBS Outdent (promote to parent's parent)
  outdentTask(taskId) {
    const target = this.tasks.find(t => t.id === taskId);
    if (!target || !target.parentId) return false;

    const parent = this.tasks.find(t => t.id === target.parentId);
    target.parentId = parent ? parent.parentId : null;

    this.recalculateAll();
    this.save();
    return true;
  }

  // Move task up / down
  moveTaskOrder(taskId, direction) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return false;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= this.tasks.length) return false;

    const temp = this.tasks[idx];
    this.tasks[idx] = this.tasks[targetIdx];
    this.tasks[targetIdx] = temp;

    this.recalculateAll();
    this.save();
    return true;
  }

  // WBS Drag-and-Drop Reordering & Hierarchy Nesting (before, after, inside)
  reorderTask(sourceId, targetId, position) {
    if (sourceId === targetId) return false;
    const sourceTask = this.tasks.find(t => t.id === sourceId);
    const targetTask = this.tasks.find(t => t.id === targetId);
    if (!sourceTask || !targetTask) return false;

    // Cannot drop into own descendants
    const descendants = this.getAllDescendants(sourceId);
    if (descendants.some(d => d.id === targetId)) {
      return false;
    }

    // Remove source task from tasks list temporarily
    const sourceIndex = this.tasks.findIndex(t => t.id === sourceId);
    this.tasks.splice(sourceIndex, 1);

    if (position === 'inside') {
      // Make child of targetTask (Indenting / nesting)
      sourceTask.parentId = targetTask.id;
      targetTask.collapsed = false;

      const targetDescendants = this.getAllDescendants(targetTask.id);
      let insertIndex = this.tasks.findIndex(t => t.id === targetTask.id);
      if (targetDescendants.length > 0) {
        const lastDesc = targetDescendants[targetDescendants.length - 1];
        const lastDescIndex = this.tasks.findIndex(t => t.id === lastDesc.id);
        insertIndex = Math.max(insertIndex, lastDescIndex);
      }
      this.tasks.splice(insertIndex + 1, 0, sourceTask);
    } else {
      // 'before' or 'after' -> same parent level as targetTask
      sourceTask.parentId = targetTask.parentId;
      let targetIndex = this.tasks.findIndex(t => t.id === targetTask.id);

      if (position === 'before') {
        this.tasks.splice(targetIndex, 0, sourceTask);
      } else {
        // If targetTask has descendants, place after all its descendants
        const targetDescendants = this.getAllDescendants(targetTask.id);
        if (targetDescendants.length > 0) {
          const lastDesc = targetDescendants[targetDescendants.length - 1];
          const lastDescIndex = this.tasks.findIndex(t => t.id === lastDesc.id);
          targetIndex = Math.max(targetIndex, lastDescIndex);
        }
        this.tasks.splice(targetIndex + 1, 0, sourceTask);
      }
    }

    this.recalculateAll();
    this.save();
    return true;
  }

  // Helper to shift ISO date string by days (timezone-safe)
  shiftDate(dateStr, daysDelta) {
    if (!dateStr || daysDelta === 0) return dateStr;
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day + daysDelta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  // D&D: Move task dates (shift start and end by delta days)
  moveTaskDates(taskId, daysDelta, cascade = true) {
    if (daysDelta === 0) return false;
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.startDate = this.shiftDate(task.startDate, daysDelta);
    task.endDate = this.shiftDate(task.endDate, daysDelta);

    // If parent task and cascade is true, also shift all descendant tasks
    if (cascade && this.isParent(taskId)) {
      const descendants = this.getAllDescendants(taskId);
      for (const d of descendants) {
        d.startDate = this.shiftDate(d.startDate, daysDelta);
        d.endDate = this.shiftDate(d.endDate, daysDelta);
      }
    }

    this.recalculateAll();
    this.save();
    return true;
  }

  // D&D: Resize task duration (adjust start date or end date)
  resizeTaskDates(taskId, newStart, newEnd) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;

    if (newStart && newEnd && newStart > newEnd) {
      // Prevent start date from exceeding end date
      return false;
    }

    if (newStart) task.startDate = newStart;
    if (newEnd) task.endDate = newEnd;

    this.recalculateAll();
    this.save();
    return true;
  }

  // Milestone check: duration 0 days or explicit isMilestone flag
  isMilestone(task) {
    if (!task) return false;
    return Boolean(task.isMilestone || (task.startDate === task.endDate && (Number(task.bac) || 0) === 0));
  }

  // Calculate Critical Path (Longest path based on dependencies & duration)
  calculateCriticalPath() {
    const leafTasks = this.tasks.filter(t => !this.isParent(t.id));
    if (leafTasks.length === 0) return new Set();

    // Calculate duration in days for each task
    const durationMap = new Map();
    leafTasks.forEach(t => {
      const s = new Date(t.startDate + 'T00:00:00');
      const e = new Date(t.endDate + 'T00:00:00');
      const dur = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
      durationMap.set(t.id, dur);
    });

    // Forward pass: calculate Early Finish (EF)
    const efMap = new Map();
    const esMap = new Map();

    const getEarliest = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return efMap.get(taskId) || 0;
      visited.add(taskId);

      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return 0;

      let maxPredEf = 0;
      if (task.predecessors && task.predecessors.length > 0) {
        for (const pid of task.predecessors) {
          maxPredEf = Math.max(maxPredEf, getEarliest(pid, visited));
        }
      }

      const es = maxPredEf;
      const ef = es + (durationMap.get(taskId) || 1);
      esMap.set(taskId, es);
      efMap.set(taskId, ef);
      return ef;
    };

    leafTasks.forEach(t => getEarliest(t.id));

    // Find project max completion time
    let maxProjectEf = 0;
    leafTasks.forEach(t => {
      maxProjectEf = Math.max(maxProjectEf, efMap.get(t.id) || 0);
    });

    // Backward pass: calculate Late Finish (LF) and Total Float (Slack)
    const lfMap = new Map();
    const lsMap = new Map();

    // Successor map
    const successors = new Map();
    leafTasks.forEach(t => successors.set(t.id, []));
    leafTasks.forEach(t => {
      if (t.predecessors) {
        t.predecessors.forEach(pid => {
          if (successors.has(pid)) successors.get(pid).push(t.id);
        });
      }
    });

    const getLatest = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return lsMap.get(taskId) || 0;
      visited.add(taskId);

      const succs = successors.get(taskId) || [];
      let minSuccLs = maxProjectEf;
      if (succs.length > 0) {
        minSuccLs = Math.min(...succs.map(sid => getLatest(sid, visited)));
      }

      const lf = minSuccLs;
      const ls = lf - (durationMap.get(taskId) || 1);
      lfMap.set(taskId, lf);
      lsMap.set(taskId, ls);
      return ls;
    };

    leafTasks.forEach(t => getLatest(t.id));

    // Tasks with float == 0 (LS === ES) are on the critical path
    const criticalSet = new Set();
    leafTasks.forEach(t => {
      const es = esMap.get(t.id) || 0;
      const ls = lsMap.get(t.id) || 0;
      if (Math.abs(ls - es) <= 0.01) {
        criticalSet.add(t.id);
        // Also add ancestors
        const ancestors = this.getAncestors(t.id);
        ancestors.forEach(a => criticalSet.add(a.id));
      }
    });

    return criticalSet;
  }

  // Detect circular dependency graph
  detectCircularDependency(taskId, newPredecessors) {
    if (!newPredecessors || newPredecessors.length === 0) return false;
    if (newPredecessors.includes(taskId)) return true;

    const visited = new Set();
    const queue = [...newPredecessors];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (currId === taskId) return true;
      if (visited.has(currId)) continue;
      visited.add(currId);

      const currTask = this.tasks.find(t => t.id === currId);
      if (currTask && currTask.predecessors) {
        for (const p of currTask.predecessors) {
          queue.push(p);
        }
      }
    }
    return false;
  }

  // Export / Import JSON
  exportData() {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      statusDate: this.statusDate,
      tasks: this.tasks
    }, null, 2);
  }

  importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.tasks)) {
      throw new Error('無効なデータ形式です。tasks配列が含まれていません。');
    }
    this.tasks = data.tasks;
    this.statusDate = data.statusDate || new Date().toISOString().split('T')[0];
    this.recalculateAll();
    this.save();
  }

  resetAll() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this.init();
  }
}

// Global instance for browser
if (typeof window !== 'undefined') {
  window.TaskManager = TaskManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskManager };
}
