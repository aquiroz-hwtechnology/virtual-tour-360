/**
 * ROUTER.JS — Historial de navegacion del tour
 * Gestiona el historial del navegador para
 * que el boton atras funcione correctamente.
 */
'use strict';

const Router = {
  history: [],
  
  push(nodeId) {
    this.history.push(nodeId);
    // Actualizar URL sin recargar la pagina
    try {
      history.pushState({ nodeId }, '', '#' + nodeId);
    } catch(e) {}
  },

  back() {
    if (this.history.length > 1) {
      this.history.pop();
      return this.history[this.history.length - 1];
    }
    return null;
  },

  current() {
    return this.history[this.history.length - 1] || null;
  },

  init() {
    // Navegacion con boton atras del navegador
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.nodeId && typeof navigateTo === 'function') {
        navigateTo(e.state.nodeId);
      }
    });

    // Leer hash inicial
    const hash = location.hash.replace('#', '');
    if (hash && typeof navigateTo === 'function') {
      setTimeout(() => navigateTo(hash), 500);
    }
  }
};