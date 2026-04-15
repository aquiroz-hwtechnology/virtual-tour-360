/**
 * SKIN.JS — Controlador de interfaz de usuario
 * Gestiona modales, menus, toasts y componentes visuales
 */
'use strict';

const SkinController = {

  // ──────────────────────────────────────────
  // MODALES
  // ──────────────────────────────────────────
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  },

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  },

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  },

  showInfoModal(hotspot) {
    document.getElementById('info-title').textContent       = hotspot.info_title || '';
    document.getElementById('info-description').textContent = hotspot.info_text  || '';
    const img = document.getElementById('info-image');
    if (hotspot.info_image) {
      img.src = hotspot.info_image;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
    this.showModal('modal-info');
  },

  // ──────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ──────────────────────────────────────────
  showToast(message, duration = 2500) {
    const toast = document.getElementById('toast-copy');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  },

  // ──────────────────────────────────────────
  // MENU LATERAL — BLOQUES
  // ──────────────────────────────────────────
  buildBlocksMenu(groups, nodes) {
    const container = document.getElementById('node-list');
    if (!container) return;
    container.innerHTML = '';

    groups.forEach(group => {
      const groupNodes = Object.values(nodes).filter(n => n.group === group.id);
      if (!groupNodes.length) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'node-group';

      const header = document.createElement('div');
      header.className = 'node-group-header';
      header.innerHTML = `
        <span class="toggle-icon">&#9660;</span>
        <span>${group.label} (${groupNodes.length})</span>
      `;

      const items = document.createElement('div');
      items.className = 'node-group-items';

      groupNodes.forEach(node => {
        items.appendChild(this._buildNodeItem(node));
      });

      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        items.style.maxHeight = header.classList.contains('collapsed') ? '0' : items.scrollHeight + 'px';
      });
      // Iniciar expandido
      items.style.maxHeight = items.scrollHeight + 'px';

      groupEl.appendChild(header);
      groupEl.appendChild(items);
      container.appendChild(groupEl);
    });
  },

  // ──────────────────────────────────────────
  // MENU LATERAL — PROGRAMAS
  // ──────────────────────────────────────────
  buildProgramsMenu(programs, nodes) {
    const container = document.getElementById('program-list');
    if (!container) return;
    container.innerHTML = '';

    programs.forEach(program => {
      const progNodes = Object.values(nodes).filter(n => n.program === program.id);
      if (!progNodes.length) return;

      const header = document.createElement('div');
      header.className = 'program-group-header';
      header.style.borderLeftColor = program.color || 'var(--color-secondary)';
      header.innerHTML = `
        <img src="${program.icon}" alt="${program.label}" onerror="this.style.display='none'" />
        <span>${program.label}</span>
      `;

      const items = document.createElement('div');
      items.className = 'node-group-items';
      progNodes.forEach(node => items.appendChild(this._buildNodeItem(node)));

      header.addEventListener('click', () => {
        items.style.display = items.style.display === 'none' ? '' : 'none';
      });

      container.appendChild(header);
      container.appendChild(items);
    });
  },

  _buildNodeItem(node) {
    const el = document.createElement('div');
    el.className = 'node-item';
    el.dataset.nodeId = node.id;
    el.innerHTML = `
      <img src="${node.thumbnail || node.preview || ''}" 
           alt="${node.label}"
           onerror="this.style.display='none'" />
      <span>${node.label}</span>
    `;
    el.addEventListener('click', () => {
      if (typeof navigateTo === 'function') navigateTo(node.id);
    });
    return el;
  },
};