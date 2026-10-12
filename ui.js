/**
 * UI Controller & Rendering Engine for Task Management Tool
 * Features: WBS Hierarchical Table, EVM Dashboard, SVG Inazuma Line,
 * Drag-and-Drop Task Move & Resize, Timeline Zoom (Day/Week/Month),
 * Critical Path Highlighting, Milestones (◆), and Auto-Scroll Jump.
 */

class UIController {
  constructor(taskManager) {
    this.tm = taskManager;
    this.currentView = 'split'; // 'split', 'wbs', 'gantt', 'dashboard'
    this.selectedTaskId = null;
    this.timeScale = 'day'; // 'day', 'week', 'month'
    this.dayWidth = 36; // px per day in Gantt chart (day: 36, week: 18, month: 8)
    this.rowHeight = 44; // px per row
    this.showCriticalPath = false;
    this.ganttBarMode = 'both'; // 'both', 'plan', 'actual'
    this.startDateOffset = null;
    this.endDateOffset = null;
    this.timelineDays = [];

    // Drag and Drop state
    this.dragState = null; // { mode: 'move'|'resize-left'|'resize-right', taskId, startX, task, initialStart, initialEnd, barElem, targetBarType }

    // Split View Ratio / State
    this.splitRatio = 0.5; // default 50%
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('wbs_gantt_split_ratio');
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 0.15 && parsed <= 0.85) {
            this.splitRatio = parsed;
          }
        }
      } catch (e) {}
    }
  }

  init() {
    this.bindEvents();
    this.bindGanttDragEvents();
    this.bindSplitResizerEvents();
    this.applyViewLayout();
    this.render();
  }

  bindEvents() {
    // View Switcher
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentView = e.target.dataset.view;
        this.applyViewLayout();
      });
    });

    // Plan / Actual Dual Display Mode Switcher
    document.querySelectorAll('[data-bar-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-bar-mode]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.ganttBarMode = e.target.dataset.barMode;
        this.renderGanttChart();
      });
    });

    // Status Date Input
    const statusDateInput = document.getElementById('status-date-input');
    if (statusDateInput) {
      statusDateInput.value = this.tm.statusDate;
      statusDateInput.addEventListener('change', (e) => {
        this.tm.statusDate = e.target.value;
        this.tm.recalculateAll();
        this.tm.save();
        this.render();
      });
    }

    // Quick Status Date buttons
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const offset = parseInt(e.target.dataset.offset, 10);
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];
        this.tm.statusDate = dateStr;
        if (statusDateInput) statusDateInput.value = dateStr;
        this.tm.recalculateAll();
        this.tm.save();
        this.render();
      });
    });

    // Gantt Toolbar Controls
    // Zoom scale buttons
    const btnScaleDay = document.getElementById('scale-day');
    const btnScaleWeek = document.getElementById('scale-week');
    const btnScaleMonth = document.getElementById('scale-month');

    const setScale = (scale, width, activeBtn) => {
      this.timeScale = scale;
      this.dayWidth = width;
      [btnScaleDay, btnScaleWeek, btnScaleMonth].forEach(b => b && b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
      this.render();
    };

    if (btnScaleDay) btnScaleDay.addEventListener('click', () => setScale('day', 36, btnScaleDay));
    if (btnScaleWeek) btnScaleWeek.addEventListener('click', () => setScale('week', 18, btnScaleWeek));
    if (btnScaleMonth) btnScaleMonth.addEventListener('click', () => setScale('month', 8, btnScaleMonth));

    // Jump buttons
    const btnJumpToday = document.getElementById('btn-jump-today');
    if (btnJumpToday) {
      btnJumpToday.addEventListener('click', () => {
        this.scrollToDate(new Date().toISOString().split('T')[0]);
      });
    }

    const btnJumpStatus = document.getElementById('btn-jump-status');
    if (btnJumpStatus) {
      btnJumpStatus.addEventListener('click', () => {
        this.scrollToDate(this.tm.statusDate);
      });
    }

    // Critical Path Toggle
    const toggleCrit = document.getElementById('toggle-critical-path');
    if (toggleCrit) {
      toggleCrit.addEventListener('change', (e) => {
        this.showCriticalPath = e.target.checked;
        this.render();
      });
    }

    // Add Task Button
    const btnAddTask = document.getElementById('btn-add-task');
    if (btnAddTask) {
      btnAddTask.addEventListener('click', () => {
        this.openTaskModal();
      });
    }

    // Export / Import / Reset
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportJson());
    }

    const btnImport = document.getElementById('btn-import');
    const fileImport = document.getElementById('file-import');
    if (btnImport && fileImport) {
      btnImport.addEventListener('click', () => fileImport.click());
      fileImport.addEventListener('change', (e) => this.importJson(e));
    }

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('プロジェクトデータを初期サンプルデータにリセットしますか？')) {
          this.tm.resetAll();
          this.render();
        }
      });
    }

    // Filters
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.tm.searchKeyword = e.target.value.toLowerCase();
        this.render();
      });
    }

    const filterCat = document.getElementById('filter-category');
    if (filterCat) {
      filterCat.addEventListener('change', (e) => {
        this.tm.filterCategory = e.target.value;
        this.render();
      });
    }

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.tm.filterStatus = e.target.value;
        this.render();
      });
    }

    // Modal Events
    this.bindModalEvents();

    // Synchronize vertical scrolling between WBS table body and Gantt chart
    const wbsContainer = document.getElementById('wbs-table-container');
    const ganttContainer = document.getElementById('gantt-chart-container');
    if (wbsContainer && ganttContainer) {
      let isSyncingWbs = false;
      let isSyncingGantt = false;
      wbsContainer.addEventListener('scroll', () => {
        if (!isSyncingWbs) {
          isSyncingGantt = true;
          ganttContainer.scrollTop = wbsContainer.scrollTop;
          isSyncingGantt = false;
        }
      });
      ganttContainer.addEventListener('scroll', () => {
        if (!isSyncingGantt) {
          isSyncingWbs = true;
          wbsContainer.scrollTop = ganttContainer.scrollTop;
          isSyncingWbs = false;
        }
      });
    }
  }

  // Smooth scroll gantt chart horizontally to a date
  scrollToDate(dateStr) {
    const ganttContainer = document.getElementById('gantt-chart-container');
    if (!ganttContainer) return;
    const targetX = this.getDateX(dateStr);
    const containerWidth = ganttContainer.clientWidth;
    ganttContainer.scrollTo({
      left: Math.max(0, targetX - containerWidth / 3),
      behavior: 'smooth'
    });
  }

  bindSplitResizerEvents() {
    const resizer = document.getElementById('split-resizer');
    const container = document.getElementById('split-container');
    if (!resizer || !container) return;

    let isResizing = false;

    const onMouseDown = (e) => {
      if (this.currentView !== 'split') return;
      isResizing = true;
      resizer.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX;
      const offsetLeft = clientX - rect.left;
      const minLeft = 160;
      const maxLeft = Math.max(minLeft, rect.width - 160 - 6);

      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, offsetLeft));
      this.splitRatio = clampedLeft / (rect.width || 1);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('wbs_gantt_split_ratio', this.splitRatio.toString());
        } catch (err) {}
      }

      container.style.gridTemplateColumns = `${clampedLeft}px 6px 1fr`;
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      resizer.classList.remove('is-resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  applyViewLayout() {
    const splitContainer = document.getElementById('split-container');
    const splitResizer = document.getElementById('split-resizer');
    const dashboardSection = document.getElementById('dashboard-section');
    const wbsPanel = document.getElementById('wbs-panel');
    const ganttPanel = document.getElementById('gantt-panel');

    if (!splitContainer) return;

    if (this.currentView === 'dashboard') {
      splitContainer.style.display = 'none';
      if (splitResizer) splitResizer.style.display = 'none';
      if (dashboardSection) dashboardSection.style.display = 'block';
      this.renderDashboard();
    } else {
      if (dashboardSection) dashboardSection.style.display = 'none';
      splitContainer.style.display = 'grid';

      if (this.currentView === 'split') {
        const width = splitContainer.clientWidth || 1000;
        const leftPx = Math.max(160, Math.round(width * this.splitRatio));
        splitContainer.style.gridTemplateColumns = `${leftPx}px 6px 1fr`;
        if (splitResizer) splitResizer.style.display = 'flex';
        if (wbsPanel) wbsPanel.style.display = 'flex';
        if (ganttPanel) ganttPanel.style.display = 'flex';
      } else if (this.currentView === 'wbs') {
        splitContainer.style.gridTemplateColumns = '1fr';
        if (splitResizer) splitResizer.style.display = 'none';
        if (wbsPanel) wbsPanel.style.display = 'flex';
        if (ganttPanel) ganttPanel.style.display = 'none';
      } else if (this.currentView === 'gantt') {
        splitContainer.style.gridTemplateColumns = '1fr';
        if (splitResizer) splitResizer.style.display = 'none';
        if (wbsPanel) wbsPanel.style.display = 'none';
        if (ganttPanel) ganttPanel.style.display = 'flex';
      }
    }
    this.render();
  }

  render() {
    this.renderEVMHeader();
    this.renderFilterOptions();
    this.renderWbsTable();
    this.renderGanttChart();
    if (this.currentView === 'dashboard') {
      this.renderDashboard();
    }
  }

  // Render Top EVM Summary Cards
  renderEVMHeader() {
    const evm = this.tm.getProjectEvm();
    const container = document.getElementById('evm-metrics-bar');
    if (!container) return;

    let healthStatus = 'good';
    let healthLabel = '順調 (On Track)';
    if (evm.spi < 0.9 || evm.cpi < 0.9) {
      healthStatus = 'danger';
      healthLabel = '要警戒 (High Risk)';
    } else if (evm.spi < 1.0 || evm.cpi < 1.0) {
      healthStatus = 'warning';
      healthLabel = '注意 (At Risk)';
    }

    container.innerHTML = `
      <div class="evm-card">
        <div class="evm-label" title="Budget at Completion（総計画予算/工数）">BAC (総予算)</div>
        <div class="evm-val">${evm.bac} <span class="unit">h</span></div>
        <div class="evm-sub">完了時総工数</div>
      </div>
      <div class="evm-card">
        <div class="evm-label" title="Planned Value（基準日までの計画工数）">PV (計画価値)</div>
        <div class="evm-val">${evm.pv} <span class="unit">h</span></div>
        <div class="evm-sub">基準日計画</div>
      </div>
      <div class="evm-card highlight">
        <div class="evm-label" title="Earned Value（達成工数 = BAC × 進捗率）">EV (獲得価値)</div>
        <div class="evm-val">${evm.ev} <span class="unit">h</span></div>
        <div class="evm-sub">進捗 ${evm.overallProgress}%</div>
      </div>
      <div class="evm-card">
        <div class="evm-label" title="Actual Cost（実績消費工数）">AC (実コスト)</div>
        <div class="evm-val">${evm.ac} <span class="unit">h</span></div>
        <div class="evm-sub">実稼働工数</div>
      </div>
      <div class="evm-card ${evm.sv >= 0 ? 'pos' : 'neg'}">
        <div class="evm-label" title="Schedule Variance = EV - PV (正なら前倒し、負なら遅延)">SV (進捗差異)</div>
        <div class="evm-val">${evm.sv > 0 ? '+' : ''}${evm.sv} <span class="unit">h</span></div>
        <div class="evm-sub">${evm.sv >= 0 ? '前倒し' : '遅れ'}</div>
      </div>
      <div class="evm-card ${evm.cv >= 0 ? 'pos' : 'neg'}">
        <div class="evm-label" title="Cost Variance = EV - AC (正ならコスト削減、負ならコスト超過)">CV (コスト差異)</div>
        <div class="evm-val">${evm.cv > 0 ? '+' : ''}${evm.cv} <span class="unit">h</span></div>
        <div class="evm-sub">${evm.cv >= 0 ? '予算内' : '超過'}</div>
      </div>
      <div class="evm-card ${evm.spi >= 1.0 ? 'pos' : (evm.spi >= 0.9 ? 'warn' : 'neg')}">
        <div class="evm-label" title="Schedule Performance Index = EV / PV (1.0以上で良好)">SPI (進捗効率)</div>
        <div class="evm-val">${evm.spi.toFixed(2)}</div>
        <div class="evm-sub">${evm.spi >= 1.0 ? '高効率' : '要改善'}</div>
      </div>
      <div class="evm-card ${evm.cpi >= 1.0 ? 'pos' : (evm.cpi >= 0.9 ? 'warn' : 'neg')}">
        <div class="evm-label" title="Cost Performance Index = EV / AC (1.0以上で高生産性)">CPI (費用効率)</div>
        <div class="evm-val">${evm.cpi.toFixed(2)}</div>
        <div class="evm-sub">${evm.cpi >= 1.0 ? '予算内' : '効率低下'}</div>
      </div>
      <div class="evm-card health ${healthStatus}">
        <div class="evm-label">プロジェクト健全度</div>
        <div class="evm-val health-title">${healthLabel}</div>
        <div class="evm-sub">予測着地 EAC: ${evm.eac}h (VAC: ${evm.vac > 0 ? '+' : ''}${evm.vac}h)</div>
      </div>
    `;
  }

  renderFilterOptions() {
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      const currentVal = catSelect.value;
      const cats = Array.from(new Set(this.tm.tasks.map(t => t.category).filter(Boolean)));
      catSelect.innerHTML = '<option value="all">すべてのカテゴリ</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catSelect.appendChild(opt);
      });
      catSelect.value = currentVal || 'all';
    }
  }

  getVisibleTasks() {
    const list = this.tm.getOrderedWbsList();
    return list.filter(t => {
      if (this.tm.filterCategory !== 'all' && t.category !== this.tm.filterCategory) {
        return false;
      }
      if (this.tm.filterStatus !== 'all' && t.status !== this.tm.filterStatus) {
        return false;
      }
      if (this.tm.searchKeyword) {
        const kw = this.tm.searchKeyword;
        const matchesName = t.name.toLowerCase().includes(kw);
        const matchesAssignee = (t.assignee || '').toLowerCase().includes(kw);
        const matchesWbs = (t._wbsCode || '').includes(kw);
        if (!matchesName && !matchesAssignee && !matchesWbs) return false;
      }
      return true;
    });
  }

  renderWbsTable() {
    const tbody = document.getElementById('wbs-tbody');
    if (!tbody) return;

    const visibleTasks = this.getVisibleTasks();
    tbody.innerHTML = '';

    if (visibleTasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty-msg">表示対象のタスクがありません。</td></tr>`;
      return;
    }

    visibleTasks.forEach(task => {
      const evm = this.tm.calculateTaskEvm(task);
      const isParent = task._isParent;
      const isMilestone = this.tm.isMilestone(task);
      const tr = document.createElement('tr');
      tr.className = `wbs-row level-${task._level} ${isParent ? 'is-parent-row' : ''}`;
      tr.dataset.taskId = task.id;
      tr.draggable = true;

      const statusLabels = {
        not_started: { label: '未着手', cls: 'badge-secondary' },
        in_progress: { label: '進行中', cls: 'badge-primary' },
        completed: { label: '完了', cls: 'badge-success' },
        on_hold: { label: '保留', cls: 'badge-warning' }
      };
      const st = statusLabels[task.status] || statusLabels.not_started;

      const prioLabels = {
        low: { label: '低', cls: 'prio-low' },
        medium: { label: '中', cls: 'prio-med' },
        high: { label: '高', cls: 'prio-high' },
        urgent: { label: '緊急', cls: 'prio-urgent' }
      };
      const prio = prioLabels[task.priority] || prioLabels.medium;

      const indentPx = (task._level || 0) * 18;
      const subtaskCount = isParent ? this.tm.tasks.filter(t => t.parentId === task.id).length : 0;

      const predCodes = (task.predecessors || []).map(pid => {
        const pt = this.tm.tasks.find(x => x.id === pid);
        return pt ? (pt._wbsCode || pt.name) : pid;
      }).join(', ');

      tr.innerHTML = `
        <td class="col-wbs font-mono">
          <span class="drag-handle" title="ドラッグして上下並び替え、または行中央ドロップで子タスク化">⋮⋮</span>
          ${task._wbsCode}
        </td>
        <td class="col-name">
          <div class="name-cell" style="padding-left: ${indentPx}px;">
            ${isParent ? `
              <button class="btn-toggle-collapse" data-task-id="${task.id}" title="${task.collapsed ? '展開' : '折りたたみ'}">
                ${task.collapsed ? '▶' : '▼'}
              </button>
              <span class="parent-folder-icon" title="親タスク（サマリー）">${task.collapsed ? '📁' : '📂'}</span>
            ` : '<span class="leaf-spacer"></span>'}
            <span class="task-title ${isParent ? 'font-bold' : ''}" title="${task.name}">
              ${isMilestone ? '<span style="color:#f59e0b; margin-right:4px;">◆</span>' : ''}${task.name}
            </span>
            ${isParent ? `<span class="badge-subtask-count" title="配下の子タスク数: ${subtaskCount}件">子 ${subtaskCount}件</span>` : ''}
          </div>
        </td>
        <td class="col-status"><span class="badge ${st.cls}">${st.label}</span></td>
        <td class="col-prio"><span class="badge ${prio.cls}">${prio.label}</span></td>
        <td class="col-date" title="予定: ${task.startDate} / 実績: ${task.actualStartDate || '未着手'}">
          <div class="date-stack">
            <span class="date-stack-plan">予 ${task.startDate ? task.startDate.slice(5) : '-'}</span>
            ${task.actualStartDate ? `<span class="date-stack-actual">実 ${task.actualStartDate.slice(5)}</span>` : '<span class="date-stack-empty">実 -</span>'}
          </div>
        </td>
        <td class="col-date" title="予定: ${task.endDate} / 実績: ${task.actualEndDate || (task.status === 'completed' ? task.endDate : '進行中')}">
          <div class="date-stack">
            <span class="date-stack-plan">予 ${task.endDate ? task.endDate.slice(5) : '-'}</span>
            ${task.actualEndDate ? `<span class="date-stack-actual">実 ${task.actualEndDate.slice(5)}</span>` : (task.actualStartDate ? '<span class="date-stack-empty" style="color:#60a5fa;">実 進行中</span>' : '<span class="date-stack-empty">実 -</span>')}
          </div>
        </td>
        <td class="col-progress">
          <div class="table-progress-wrap">
            <div class="table-progress-bar">
              <div class="table-progress-fill" style="width: ${task.progress}%"></div>
            </div>
            <span class="table-progress-text">${task.progress}%</span>
          </div>
        </td>
        <td class="col-num">${evm.bac}h</td>
        <td class="col-num">${evm.ev}h</td>
        <td class="col-num">${evm.ac}h</td>
        <td class="col-pred font-mono text-muted" title="${predCodes}">${predCodes || '-'}</td>
        <td class="col-actions">
          <div class="action-btn-group">
            <button class="btn-action btn-add-child" data-task-id="${task.id}" title="子タスク追加">＋</button>
            <button class="btn-action btn-edit" data-task-id="${task.id}" title="タスク詳細編集">✎</button>
            <button class="btn-action btn-del" data-task-id="${task.id}" title="削除">🗑</button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    this.bindWbsTableEvents();
    this.bindWbsDragAndDropEvents();
  }

  bindWbsTableEvents() {
    document.querySelectorAll('.btn-toggle-collapse').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.dataset.taskId;
        const task = this.tm.tasks.find(t => t.id === tid);
        if (task) {
          task.collapsed = !task.collapsed;
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-add-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentId = btn.dataset.taskId;
        this.openTaskModal({ parentId });
      });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = this.tm.tasks.find(t => t.id === btn.dataset.taskId);
        if (task) this.openTaskModal(task);
      });
    });

    document.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('このタスクおよび配下の子タスクを削除しますか？')) {
          this.tm.deleteTask(btn.dataset.taskId);
          this.render();
        }
      });
    });

    document.querySelectorAll('#wbs-tbody tr').forEach(row => {
      row.addEventListener('click', () => {
        document.querySelectorAll('#wbs-tbody tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      });
    });
  }

  // WBS Table Row Drag & Drop for reordering and nesting
  bindWbsDragAndDropEvents() {
    const tbody = document.getElementById('wbs-tbody');
    if (!tbody) return;

    let draggedTaskId = null;

    tbody.querySelectorAll('.wbs-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedTaskId = row.dataset.taskId;
        row.classList.add('is-dragging-row');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging-row');
        tbody.querySelectorAll('.wbs-row').forEach(r => {
          r.classList.remove('drop-target-before', 'drop-target-after', 'drop-target-inside');
        });
        draggedTaskId = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedTaskId || row.dataset.taskId === draggedTaskId) return;

        const rect = row.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const height = rect.height;

        row.classList.remove('drop-target-before', 'drop-target-after', 'drop-target-inside');

        if (offsetY < height * 0.28) {
          row.classList.add('drop-target-before');
        } else if (offsetY > height * 0.72) {
          row.classList.add('drop-target-after');
        } else {
          row.classList.add('drop-target-inside');
        }

        e.dataTransfer.dropEffect = 'move';
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-target-before', 'drop-target-after', 'drop-target-inside');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = row.dataset.taskId;
        if (!draggedTaskId || draggedTaskId === targetId) return;

        let position = 'inside';
        if (row.classList.contains('drop-target-before')) {
          position = 'before';
        } else if (row.classList.contains('drop-target-after')) {
          position = 'after';
        }

        row.classList.remove('drop-target-before', 'drop-target-after', 'drop-target-inside');

        const success = this.tm.reorderTask(draggedTaskId, targetId, position);
        if (success) {
          this.render();
        }
      });
    });
  }

  calculateTimelineRange(visibleTasks) {
    if (visibleTasks.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: today, days: 1 };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    visibleTasks.forEach(t => {
      const s = new Date(t.startDate + 'T00:00:00').getTime();
      const e = new Date(t.endDate + 'T00:00:00').getTime();
      if (s < minTime) minTime = s;
      if (e > maxTime) maxTime = e;
    });

    const statusTime = new Date(this.tm.statusDate + 'T00:00:00').getTime();
    if (statusTime < minTime) minTime = statusTime;
    if (statusTime > maxTime) maxTime = statusTime;

    const minDate = new Date(minTime);
    minDate.setDate(minDate.getDate() - 4);

    const maxDate = new Date(maxTime);
    maxDate.setDate(maxDate.getDate() + 10);

    const diffDays = Math.max(14, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1);

    this.startDateOffset = minDate;
    this.endDateOffset = maxDate;

    const days = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + i);
      const dayOfWeekNum = d.getDay();
      days.push({
        dateStr: d.toISOString().split('T')[0],
        month: d.getMonth() + 1,
        day: d.getDate(),
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeekNum],
        isWeekend: dayOfWeekNum === 0 || dayOfWeekNum === 6,
        isMonday: dayOfWeekNum === 1,
        isStatusDate: d.toISOString().split('T')[0] === this.tm.statusDate
      });
    }

    this.timelineDays = days;
    return { minDate, maxDate, days: diffDays };
  }

  getDateX(dateStr) {
    if (!this.startDateOffset) return 0;
    const d = new Date(dateStr + 'T00:00:00');
    const diff = (d.getTime() - this.startDateOffset.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff * this.dayWidth);
  }

  // Convert pixel X coordinate in Gantt chart back to ISO Date string
  pixelToDateStr(pixelX) {
    if (!this.startDateOffset) return this.tm.statusDate;
    const daysOffset = Math.round(pixelX / this.dayWidth);
    const d = new Date(this.startDateOffset);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  renderGanttChart() {
    const ganttContainer = document.getElementById('gantt-chart-container');
    if (!ganttContainer) return;

    const visibleTasks = this.getVisibleTasks();
    this.calculateTimelineRange(visibleTasks);

    const totalDays = this.timelineDays.length;
    const chartWidth = totalDays * this.dayWidth;
    const headerHeight = 44;
    const totalHeight = headerHeight + (visibleTasks.length * this.rowHeight) + 30;

    const statusDateX = this.getDateX(this.tm.statusDate) + (this.dayWidth / 2);
    const criticalTasks = this.showCriticalPath ? this.tm.calculateCriticalPath() : new Set();

    let html = `
      <div class="gantt-inner" style="width: ${chartWidth}px; min-height: ${totalHeight}px;">
        <!-- Timeline Header -->
        <div class="gantt-header" style="height: ${headerHeight}px;">
          ${this.timelineDays.map((d, i) => {
            // Label customization depending on zoom scale
            let showMonth = d.day === 1 || i === 0;
            let showDay = this.timeScale !== 'month' || d.day === 1 || d.day === 15;
            let showDow = this.timeScale === 'day';

            return `
              <div class="gantt-day-col ${d.isWeekend ? 'weekend' : ''} ${d.isStatusDate ? 'status-day' : ''}"
                   style="left: ${i * this.dayWidth}px; width: ${this.dayWidth}px;">
                <span class="day-month">${showMonth ? d.month + '月' : ''}</span>
                <span class="day-num">${showDay ? d.day : ''}</span>
                <span class="day-name">${showDow ? d.dayOfWeek : ''}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Grid Column Background -->
        <div class="gantt-grid" style="top: ${headerHeight}px; height: ${visibleTasks.length * this.rowHeight}px;">
          ${this.timelineDays.map((d, i) => `
            <div class="grid-col ${d.isWeekend ? 'weekend-col' : ''}"
                 style="left: ${i * this.dayWidth}px; width: ${this.dayWidth}px;"></div>
          `).join('')}
        </div>

        <!-- Task Rows & Bars -->
        <div class="gantt-rows" style="top: ${headerHeight}px;">
    `;

    const inazumaPoints = [];
    inazumaPoints.push({ x: statusDateX, y: 0, isAnchor: true });

    visibleTasks.forEach((task, index) => {
      const topY = index * this.rowHeight;
      const centerY = topY + (this.rowHeight / 2);
      const startX = this.getDateX(task.startDate);
      const endX = this.getDateX(task.endDate) + this.dayWidth;
      const barWidth = Math.max(12, endX - startX);
      const isParent = task._isParent;
      const isMilestone = this.tm.isMilestone(task);
      const isCrit = criticalTasks.has(task.id);

      const evm = this.tm.calculateTaskEvm(task);
      const progressFraction = Math.max(0, Math.min(100, task.progress)) / 100;
      let progressX = isMilestone ? (startX + (this.dayWidth / 2)) : (startX + (barWidth * progressFraction));

      // 過去の予定で完了したタスク、または開始日が未来の未着手タスクはイナズマ線の折れ線を除外し、基準日の垂直線上に整列
      // 未来の予定が前倒し着手・完了したタスク（progress > 0）は従来通り前倒し（右突出）を維持
      if (evm.isInazumaVerticalPass) {
        progressX = statusDateX;
      }

      inazumaPoints.push({
        x: progressX,
        y: centerY,
        task,
        evm,
        isPastPlanCompleted: evm.isPastPlanCompleted,
        isFutureUnstarted: evm.isFutureUnstarted,
        isInazumaVerticalPass: evm.isInazumaVerticalPass,
        isAnchor: false
      });

      const prioColor = task.priority === 'urgent' ? 'bar-urgent' :
                        (task.priority === 'high' ? 'bar-high' : 'bar-normal');

      html += `
        <div class="gantt-row ${isParent ? 'parent-row' : ''}" style="top: ${topY}px; height: ${this.rowHeight}px;">
      `;

      // Overall Range Guide Lines (Start & End Markers) for Parent Task
      if (isParent) {
        html += `
          <div class="parent-range-guide" style="left: ${startX}px; width: ${barWidth}px;">
            <div class="range-guide-start" title="[親タスク開始位置] ${task.name}: ${task.startDate}"></div>
            <div class="range-guide-end" title="[親タスク終了位置] ${task.name}: ${task.endDate}"></div>
          </div>
        `;
      }

      if (isMilestone) {
        // Milestone diamond display
        const mX = startX + (this.dayWidth / 2) - 10;
        html += `
          <div class="gantt-milestone ${isCrit ? 'is-critical' : ''}"
               style="left: ${mX}px;"
               data-task-id="${task.id}"
               title="[マイルストーン] ${task.name} (${task.startDate})">
            <span class="gantt-milestone-label">${task.name}</span>
          </div>
        `;
      } else {
        // Dual-Track Plan & Actual Bar Rendering
        const showPlan = this.ganttBarMode === 'both' || this.ganttBarMode === 'plan';
        const showActual = this.ganttBarMode === 'both' || this.ganttBarMode === 'actual';

        // 1. Plan Bar (Top: dashed outline, subtle background, clear schedule duration)
        if (showPlan) {
          const isDual = this.ganttBarMode === 'both';
          const planClass = isDual ? 'gantt-bar-plan' : 'gantt-bar-plan single-mode-bar';
          const planTitle = isParent ? `[親タスク・サマリー予定] ${task.name} (${task.startDate} ～ ${task.endDate}) 予定工数合計: ${task.bac}h`
                                     : `[予定] ${task.name} (${task.startDate} ～ ${task.endDate}) 予定工数: ${task.bac}h`;
          html += `
            <div class="${planClass} ${isParent ? 'parent-bar' : ''} ${isCrit ? 'is-critical' : ''}"
                 style="left: ${startX}px; width: ${barWidth}px;"
                 data-task-id="${task.id}"
                 data-bar-type="plan"
                 data-start-x="${startX}"
                 data-width="${barWidth}"
                 title="${planTitle}">
              <!-- Left Resize Handle -->
              <div class="gantt-resize-handle gantt-resize-left" title="予定開始日をドラッグで変更"></div>
              ${isDual ? `<span class="plan-tag">${isParent ? '📁予' : '予'}</span><span class="plan-label">${task.name}</span>` : `
                <div class="gantt-bar-fill" style="width: 0%;"></div>
                <span class="gantt-bar-label">${isParent ? '📁 ' : ''}予定: ${task.name}</span>
              `}
              <!-- Right Resize Handle -->
              <div class="gantt-resize-handle gantt-resize-right" title="予定終了日をドラッグで変更"></div>
            </div>
          `;
        }

        // 2. Actual Bar (Bottom: progress fill, status colors, actual start/end dates)
        if (showActual) {
          const isDual = this.ganttBarMode === 'both';
          const actStartStr = task.actualStartDate || (task.progress > 0 ? task.startDate : '');
          const actEndStr = task.actualEndDate || (task.status === 'completed' ? task.endDate : (task.progress > 0 ? this.tm.statusDate : ''));

          let actStartX = startX;
          let actBarWidth = barWidth;

          if (actStartStr) {
            actStartX = this.getDateX(actStartStr);
            if (actEndStr && actEndStr >= actStartStr) {
              const actEndX = this.getDateX(actEndStr) + this.dayWidth;
              actBarWidth = Math.max(12, actEndX - actStartX);
            } else {
              // Ongoing or unended: from actStartX to current status date or plan end
              const targetEnd = task.endDate > this.tm.statusDate ? task.endDate : this.tm.statusDate;
              const actEndX = this.getDateX(targetEnd) + this.dayWidth;
              actBarWidth = Math.max(12, actEndX - actStartX);
            }
          }

          const hasActual = Boolean(task.actualStartDate || task.actualEndDate || task.progress > 0 || task.status === 'completed');
          const actualClass = isDual ? 'gantt-bar-actual' : 'gantt-bar-actual single-mode-bar';
          const actualTitle = isParent
            ? `[親タスク・サマリー実績] ${task.name}&#10;実績期間: ${task.actualStartDate || '未設定'} ～ ${task.actualEndDate || (task.progress > 0 ? '進行中' : '未完了')}&#10;ロールアップ進捗率: ${task.progress}%&#10;実績工数合計: ${task.ac}h`
            : `[実績] ${task.name}&#10;実績期間: ${task.actualStartDate || '未設定'} ～ ${task.actualEndDate || (task.progress > 0 ? '進行中' : '未完了')}&#10;進捗率: ${task.progress}%&#10;実績工数: ${task.ac}h`;

          html += `
            <div class="${actualClass} ${isParent ? 'parent-bar' : ''} ${prioColor} ${isCrit ? 'is-critical' : ''}"
                 style="left: ${actStartX}px; width: ${actBarWidth}px; ${!hasActual && isDual ? 'opacity: 0.45; border-style: dotted;' : ''}"
                 data-task-id="${task.id}"
                 data-bar-type="actual"
                 data-start-x="${actStartX}"
                 data-width="${actBarWidth}"
                 title="${actualTitle}">
              <!-- Left Resize Handle -->
              <div class="gantt-resize-handle gantt-resize-left" title="実績開始日をドラッグで変更"></div>
              <!-- Progress Fill -->
              <div class="gantt-bar-fill" style="width: ${task.progress}%;"></div>
              ${isDual ? `<span class="actual-tag">${isParent ? '📁実' : '実'}</span><span class="actual-label">${task.name}</span>` : `
                <span class="gantt-bar-label">${isParent ? '📁 ' : ''}${task.name}</span>
              `}
              <!-- Independent External Progress Badge (Right of Bar) -->
              <span class="gantt-progress-badge ${task.progress === 100 ? 'is-completed' : ''} ${isParent ? 'is-parent' : ''}"
                    title="進捗率: ${task.progress}%">
                ${task.progress === 100 ? '✓ 100%' : `${task.progress}%`}
              </span>
              <!-- Right Resize Handle -->
              <div class="gantt-resize-handle gantt-resize-right" title="実績終了日をドラッグで変更"></div>
            </div>
          `;
        }
      }

      html += `</div>`;
    });

    const bottomY = visibleTasks.length * this.rowHeight + 20;
    inazumaPoints.push({ x: statusDateX, y: bottomY, isAnchor: true });

    const svgPointsStr = inazumaPoints.map(p => `${p.x},${p.y}`).join(' ');

    html += `
        </div>

        <!-- SVG Layer for Dependencies & Inazuma Line -->
        <svg class="gantt-svg-layer" style="top: ${headerHeight}px; width: ${chartWidth}px; height: ${bottomY + 10}px;">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          ${this.renderDependencyArrows(visibleTasks)}

          <!-- Vertical Status Date Line -->
          <line x1="${statusDateX}" y1="0" x2="${statusDateX}" y2="${bottomY}"
                class="status-vertical-line" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4" />

          <!-- INAZUMA LINE (Progress Line) -->
          <polyline points="${svgPointsStr}"
                    class="inazuma-line"
                    stroke="#dc2626"
                    stroke-width="3.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    fill="none"
                    filter="url(#glow)" />

          <!-- Inazuma Vertex Nodes -->
          ${inazumaPoints.filter(p => !p.isAnchor).map(p => {
            const isPastCompleted = Boolean(p.isPastPlanCompleted);
            const isFutureUnstarted = Boolean(p.isFutureUnstarted);
            const isVerticalPass = Boolean(p.isInazumaVerticalPass);
            const isDelayed = !isVerticalPass && (p.x < statusDateX - 2);
            const isAhead = !isVerticalPass && (p.x > statusDateX + 2);
            const nodeColor = isPastCompleted ? '#10b981' :
                              (isFutureUnstarted ? '#94a3b8' :
                              (isDelayed ? '#ef4444' : (isAhead ? '#10b981' : '#3b82f6')));
            const delayDays = isVerticalPass ? 0 : p.evm.delayDays;
            const statusText = isPastCompleted ? '完了 (過去完了・垂直通過)' :
                              (isFutureUnstarted ? '未着手 (未来開始・垂直通過)' :
                              (delayDays > 0 ? `遅延 ${delayDays}日` : (delayDays < 0 ? `前倒し ${Math.abs(delayDays)}日` : 'オンスケジュール')));

            return `
              <g class="inazuma-node" transform="translate(${p.x}, ${p.y})">
                <circle r="${isVerticalPass ? 4.5 : 6}" fill="${nodeColor}" stroke="#ffffff" stroke-width="${isVerticalPass ? 1.5 : 2.5}" class="node-circle">
                  <title>${p.task.name}&#10;進捗率: ${p.task.progress}%&#10;状況: ${statusText}&#10;EV: ${p.evm.ev}h / PV: ${p.evm.pv}h</title>
                </circle>
              </g>
            `;
          }).join('')}
        </svg>

        <div class="status-date-flag" style="left: ${statusDateX - 45}px; top: ${headerHeight - 24}px;">
          基準日: ${this.tm.statusDate.slice(5)}
        </div>
      </div>
    `;

    ganttContainer.innerHTML = html;
  }

  // Bind Mouse Drag and Drop Events on Gantt bars and handles
  bindGanttDragEvents() {
    const tooltip = document.getElementById('gantt-drag-tooltip');

    document.addEventListener('mousedown', (e) => {
      // Check if clicked inside a gantt bar, plan bar, actual bar or milestone
      const resizeLeft = e.target.closest('.gantt-resize-left');
      const resizeRight = e.target.closest('.gantt-resize-right');
      const barElem = e.target.closest('.gantt-bar') ||
                      e.target.closest('.gantt-bar-plan') ||
                      e.target.closest('.gantt-bar-actual') ||
                      e.target.closest('.gantt-milestone');

      if (!barElem) return;

      const taskId = barElem.dataset.taskId;
      const task = this.tm.tasks.find(t => t.id === taskId);
      if (!task) return;

      const barType = barElem.dataset.barType || 'plan'; // 'plan' or 'actual'

      // Determine drag mode
      let mode = 'move';
      if (resizeLeft) mode = 'resize-left';
      else if (resizeRight) mode = 'resize-right';

      const initialStartX = parseFloat(barElem.style.left) || 0;
      const initialWidth = parseFloat(barElem.style.width) || this.dayWidth;

      const initialStart = (barType === 'actual' && task.actualStartDate) ? task.actualStartDate : task.startDate;
      const initialEnd = (barType === 'actual' && task.actualEndDate) ? task.actualEndDate :
                         (barType === 'actual' && task.actualStartDate ? (task.actualStartDate > task.endDate ? task.actualStartDate : task.endDate) : task.endDate);

      this.dragState = {
        mode,
        barType,
        taskId,
        task,
        startX: e.clientX,
        initialStartX,
        initialWidth,
        initialStart,
        initialEnd,
        barElem,
        hasDragged: false
      };

      barElem.classList.add('is-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;

      const deltaX = e.clientX - this.dragState.startX;
      if (Math.abs(deltaX) > 3) {
        this.dragState.hasDragged = true;
      }

      if (!this.dragState.hasDragged) return;

      const daysDelta = Math.round(deltaX / this.dayWidth);
      const task = this.dragState.task;
      let newStartDate = this.dragState.initialStart;
      let newEndDate = this.dragState.initialEnd;

      if (this.dragState.mode === 'move') {
        newStartDate = this.tm.shiftDate(this.dragState.initialStart, daysDelta);
        newEndDate = this.tm.shiftDate(this.dragState.initialEnd, daysDelta);

        // Visual position update
        this.dragState.barElem.style.left = `${this.dragState.initialStartX + (daysDelta * this.dayWidth)}px`;
      } else if (this.dragState.mode === 'resize-left') {
        newStartDate = this.tm.shiftDate(this.dragState.initialStart, daysDelta);
        if (newStartDate > this.dragState.initialEnd) newStartDate = this.dragState.initialEnd;

        const newPixelLeft = this.getDateX(newStartDate);
        const newPixelWidth = (this.dragState.initialStartX + this.dragState.initialWidth) - newPixelLeft;
        this.dragState.barElem.style.left = `${newPixelLeft}px`;
        this.dragState.barElem.style.width = `${Math.max(12, newPixelWidth)}px`;
      } else if (this.dragState.mode === 'resize-right') {
        newEndDate = this.tm.shiftDate(this.dragState.initialEnd, daysDelta);
        if (newEndDate < this.dragState.initialStart) newEndDate = this.dragState.initialStart;

        const newPixelWidth = (this.getDateX(newEndDate) + this.dayWidth) - this.dragState.initialStartX;
        this.dragState.barElem.style.width = `${Math.max(12, newPixelWidth)}px`;
      }

      // Show floating tooltip
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY - 30}px`;

        const typeLabel = this.dragState.barType === 'actual' ? '実績' : '予定';
        const actionText = this.dragState.mode === 'move' ? `${typeLabel}移動` :
                           (this.dragState.mode === 'resize-left' ? `${typeLabel}開始日変更` : `${typeLabel}終了日変更`);
        tooltip.innerHTML = `
          <b>${actionText}</b>: ${task.name}<br>
          期間: <b>${newStartDate}</b> ～ <b>${newEndDate}</b>
        `;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (!this.dragState) return;

      const { mode, barType, taskId, task, hasDragged, startX, initialStart, initialEnd, barElem } = this.dragState;
      barElem.classList.remove('is-dragging');
      if (tooltip) tooltip.style.display = 'none';

      if (!hasDragged) {
        // Just clicked -> open edit modal
        this.openTaskModal(task);
      } else {
        // Drag confirmed -> calculate delta and apply changes
        const deltaX = e.clientX - startX;
        const daysDelta = Math.round(deltaX / this.dayWidth);

        if (daysDelta !== 0) {
          if (barType === 'actual') {
            // Modify task's actual dates
            if (mode === 'move') {
              const newActStart = this.tm.shiftDate(initialStart, daysDelta);
              const newActEnd = initialEnd ? this.tm.shiftDate(initialEnd, daysDelta) : '';
              this.tm.updateTask(taskId, { actualStartDate: newActStart, actualEndDate: newActEnd });
            } else if (mode === 'resize-left') {
              let newActStart = this.tm.shiftDate(initialStart, daysDelta);
              if (initialEnd && newActStart > initialEnd) newActStart = initialEnd;
              this.tm.updateTask(taskId, { actualStartDate: newActStart });
            } else if (mode === 'resize-right') {
              let newActEnd = this.tm.shiftDate(initialEnd, daysDelta);
              if (newActEnd < initialStart) newActEnd = initialStart;
              this.tm.updateTask(taskId, { actualEndDate: newActEnd });
            }
          } else {
            // Modify task's planned dates
            if (mode === 'move') {
              this.tm.moveTaskDates(taskId, daysDelta, true);
            } else if (mode === 'resize-left') {
              let newStart = this.tm.shiftDate(initialStart, daysDelta);
              if (newStart > initialEnd) newStart = initialEnd;
              this.tm.resizeTaskDates(taskId, newStart, null);
            } else if (mode === 'resize-right') {
              let newEnd = this.tm.shiftDate(initialEnd, daysDelta);
              if (newEnd < initialStart) newEnd = initialStart;
              this.tm.resizeTaskDates(taskId, null, newEnd);
            }
          }
        }
        this.render();
      }

      this.dragState = null;
    });
  }

  renderDependencyArrows(visibleTasks) {
    let arrows = '';
    const taskMap = new Map();
    visibleTasks.forEach((t, i) => {
      taskMap.set(t.id, {
        task: t,
        index: i,
        endX: this.getDateX(t.endDate) + this.dayWidth,
        startX: this.getDateX(t.startDate),
        centerY: i * this.rowHeight + (this.rowHeight / 2)
      });
    });

    visibleTasks.forEach(task => {
      if (task.predecessors && task.predecessors.length > 0) {
        const targetPos = taskMap.get(task.id);
        if (!targetPos) return;

        task.predecessors.forEach(predId => {
          const sourcePos = taskMap.get(predId);
          if (!sourcePos) return;

          const sx = sourcePos.endX;
          const sy = sourcePos.centerY;
          const tx = targetPos.startX;
          const ty = targetPos.centerY;

          const midX = sx + Math.max(15, (tx - sx) / 2);
          const pathD = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;

          arrows += `<path d="${pathD}" fill="none" stroke="#94a3b8" stroke-width="1.8" marker-end="url(#arrow)" stroke-dasharray="3 2" />`;
        });
      }
    });

    return arrows;
  }

  renderDashboard() {
    const section = document.getElementById('dashboard-section');
    if (!section) return;

    const { byStatus, byCategory, byAssignee } = this.tm.getAggregations();
    const evm = this.tm.getProjectEvm();

    let html = `
      <div class="dash-grid">
        <div class="dash-card">
          <h3 class="dash-title">ステータス別タスク集計</h3>
          <div class="status-summary-list">
            ${Object.keys(byStatus).map(k => {
              const item = byStatus[k];
              const pct = evm.leafCount > 0 ? Math.round((item.count / evm.leafCount) * 100) : 0;
              return `
                <div class="status-item">
                  <div class="status-meta">
                    <span class="status-dot" style="background: ${item.color}"></span>
                    <span class="status-name">${item.label}</span>
                    <span class="status-count">${item.count}件 (${pct}%)</span>
                  </div>
                  <div class="dash-progress-track">
                    <div class="dash-progress-fill" style="width: ${pct}%; background: ${item.color}"></div>
                  </div>
                  <div class="status-sub-stats">予定: ${item.bac}h | 実績: ${item.ac}h | 達成EV: ${item.ev}h</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="dash-card">
          <h3 class="dash-title">分類（カテゴリ）別 EVM集計</h3>
          <div class="table-responsive">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>件数</th>
                  <th>BAC(予算)</th>
                  <th>PV(計画)</th>
                  <th>EV(達成)</th>
                  <th>AC(実費)</th>
                  <th>SPI</th>
                  <th>CPI</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(byCategory).map(catName => {
                  const c = byCategory[catName];
                  const spi = c.pv > 0 ? (c.ev / c.pv).toFixed(2) : '-';
                  const cpi = c.ac > 0 ? (c.ev / c.ac).toFixed(2) : '-';
                  return `
                    <tr>
                      <td class="font-bold">${catName}</td>
                      <td>${c.count}</td>
                      <td>${c.bac}h</td>
                      <td>${c.pv}h</td>
                      <td class="text-primary font-bold">${c.ev}h</td>
                      <td>${c.ac}h</td>
                      <td class="${spi !== '-' && Number(spi) < 1.0 ? 'text-danger' : 'text-success'}">${spi}</td>
                      <td class="${cpi !== '-' && Number(cpi) < 1.0 ? 'text-danger' : 'text-success'}">${cpi}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="dash-card">
          <h3 class="dash-title">担当者別 稼働・負荷集計</h3>
          <div class="table-responsive">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>担当者</th>
                  <th>担当タスク数</th>
                  <th>予定工数 (BAC)</th>
                  <th>実績工数 (AC)</th>
                  <th>獲得価値 (EV)</th>
                  <th>生産性 (EV/AC)</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(byAssignee).map(userName => {
                  const u = byAssignee[userName];
                  const prod = u.ac > 0 ? (u.ev / u.ac).toFixed(2) : '-';
                  return `
                    <tr>
                      <td class="font-bold">${userName}</td>
                      <td>${u.count}</td>
                      <td>${u.bac}h</td>
                      <td>${u.ac}h</td>
                      <td class="text-primary font-bold">${u.ev}h</td>
                      <td class="${prod !== '-' && Number(prod) < 1.0 ? 'text-danger' : 'text-success'}">${prod}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    section.innerHTML = html;
  }

  bindModalEvents() {
    const modal = document.getElementById('task-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const form = document.getElementById('task-form');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeTaskModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeTaskModal());

    // Quick Copy button: Copy Plan dates to Actual dates
    const btnCopyPlan = document.getElementById('btn-copy-plan-to-actual');
    if (btnCopyPlan) {
      btnCopyPlan.addEventListener('click', () => {
        const planStart = document.getElementById('modal-start-date').value;
        const planEnd = document.getElementById('modal-end-date').value;
        const actStartInput = document.getElementById('modal-actual-start-date');
        const actEndInput = document.getElementById('modal-actual-end-date');
        if (actStartInput && planStart) actStartInput.value = planStart;
        if (actEndInput && planEnd) actEndInput.value = planEnd;
      });
    }

    const progressSlider = document.getElementById('modal-progress');
    const progressVal = document.getElementById('modal-progress-val');
    if (progressSlider && progressVal) {
      progressSlider.addEventListener('input', (e) => {
        progressVal.textContent = e.target.value + '%';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTaskFromModal();
      });
    }
  }

  openTaskModal(taskOrOptions = {}) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('modal-title');
    if (!modal) return;

    const isEdit = Boolean(taskOrOptions.id);
    this.selectedTaskId = isEdit ? taskOrOptions.id : null;
    title.textContent = isEdit ? 'タスク編集' : '新規タスク追加';

    const parentSelect = document.getElementById('modal-parent');
    parentSelect.innerHTML = '<option value="">(ルート直下 / 親なし)</option>';
    this.tm.tasks.forEach(t => {
      if (isEdit && (t.id === taskOrOptions.id || this.tm.getAllDescendants(taskOrOptions.id).some(d => d.id === t.id))) {
        return;
      }
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t._wbsCode || ''} ${t.name}`;
      parentSelect.appendChild(opt);
    });

    const predContainer = document.getElementById('modal-predecessors');
    predContainer.innerHTML = '';
    this.tm.tasks.forEach(t => {
      if (isEdit && t.id === taskOrOptions.id) return;
      const label = document.createElement('label');
      label.className = 'pred-checkbox-label';
      const checked = isEdit && taskOrOptions.predecessors && taskOrOptions.predecessors.includes(t.id);
      label.innerHTML = `
        <input type="checkbox" name="predecessors" value="${t.id}" ${checked ? 'checked' : ''}>
        <span>${t._wbsCode || ''} ${t.name}</span>
      `;
      predContainer.appendChild(label);
    });

    document.getElementById('modal-name').value = taskOrOptions.name || '';
    parentSelect.value = taskOrOptions.parentId || '';
    document.getElementById('modal-start-date').value = taskOrOptions.startDate || this.tm.statusDate;
    document.getElementById('modal-end-date').value = taskOrOptions.endDate || this.tm.statusDate;
    
    // Actual Dates
    const actStartInput = document.getElementById('modal-actual-start-date');
    const actEndInput = document.getElementById('modal-actual-end-date');
    if (actStartInput) actStartInput.value = taskOrOptions.actualStartDate || '';
    if (actEndInput) actEndInput.value = taskOrOptions.actualEndDate || '';

    const milestoneCheckbox = document.getElementById('modal-is-milestone');
    if (milestoneCheckbox) {
      milestoneCheckbox.checked = this.tm.isMilestone(taskOrOptions);
    }

    document.getElementById('modal-bac').value = taskOrOptions.bac !== undefined ? taskOrOptions.bac : 10;
    document.getElementById('modal-ac').value = taskOrOptions.ac !== undefined ? taskOrOptions.ac : 0;
    
    const prog = taskOrOptions.progress !== undefined ? taskOrOptions.progress : 0;
    document.getElementById('modal-progress').value = prog;
    document.getElementById('modal-progress-val').textContent = prog + '%';

    document.getElementById('modal-priority').value = taskOrOptions.priority || 'medium';
    document.getElementById('modal-status').value = taskOrOptions.status || 'not_started';
    document.getElementById('modal-category').value = taskOrOptions.category || '一般';
    document.getElementById('modal-assignee').value = taskOrOptions.assignee || '';

    modal.classList.add('active');
  }

  closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
    this.selectedTaskId = null;
  }

  saveTaskFromModal() {
    const selectedPreds = Array.from(document.querySelectorAll('#modal-predecessors input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    const isMilestone = Boolean(document.getElementById('modal-is-milestone') && document.getElementById('modal-is-milestone').checked);
    const actStartInput = document.getElementById('modal-actual-start-date');
    const actEndInput = document.getElementById('modal-actual-end-date');

    const taskData = {
      name: document.getElementById('modal-name').value.trim() || '無題のタスク',
      parentId: document.getElementById('modal-parent').value || null,
      startDate: document.getElementById('modal-start-date').value,
      endDate: document.getElementById('modal-end-date').value,
      actualStartDate: actStartInput ? actStartInput.value : '',
      actualEndDate: actEndInput ? actEndInput.value : '',
      isMilestone,
      bac: isMilestone ? 0 : (parseFloat(document.getElementById('modal-bac').value) || 0),
      ac: isMilestone ? 0 : (parseFloat(document.getElementById('modal-ac').value) || 0),
      progress: parseInt(document.getElementById('modal-progress').value, 10) || 0,
      priority: document.getElementById('modal-priority').value,
      status: document.getElementById('modal-status').value,
      category: document.getElementById('modal-category').value.trim() || '一般',
      assignee: document.getElementById('modal-assignee').value.trim(),
      predecessors: selectedPreds
    };

    try {
      if (this.selectedTaskId) {
        this.tm.updateTask(this.selectedTaskId, taskData);
      } else {
        this.tm.addTask(taskData);
      }
      this.closeTaskModal();
      this.render();
    } catch (err) {
      alert('エラー: ' + err.message);
    }
  }

  exportJson() {
    const jsonStr = this.tm.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.tm.importData(e.target.result);
        alert('プロジェクトデータを正常に読み込みました。');
        this.render();
      } catch (err) {
        alert('インポートに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
}

if (typeof window !== 'undefined') {
  window.UIController = UIController;
}
