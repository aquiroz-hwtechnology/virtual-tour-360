/**
 * GAMIFICATION.JS — Sistema de tour guiado y gamificacion
 * Gestiona pistas, contadores y el flujo del tour guiado
 */
'use strict';

const GameController = {
  active:       false,
  currentTour:  null,
  foundClues:   new Set(),
  totalClues:   0,
  clueSequence: [],

  // ──────────────────────────────────────────
  // INICIAR TOUR GUIADO
  // ──────────────────────────────────────────
  startGuidedTour(tourId) {
    const tour = AppState.guidedTours?.find(t => t.id === tourId);
    if (!tour) return;

    this.active      = true;
    this.currentTour = tour;
    this.foundClues  = new Set();
    this.totalClues  = tour.total_clues;

    // Mostrar contador
    const counter = document.getElementById('game-counter');
    if (counter) {
      counter.classList.remove('hidden');
      this.updateCounter();
    }

    console.log('Tour guiado iniciado:', tour.label);
  },

  // ──────────────────────────────────────────
  // RECOLECTAR PISTA
  // ──────────────────────────────────────────
  collectClue(clueId, clueText) {
    if (!this.active || !clueId) return;
    if (this.foundClues.has(clueId)) {
      SkinController.showToast('Ya encontraste esta pista');
      return;
    }

    this.foundClues.add(clueId);
    this.updateCounter();

    // Mostrar modal de pista
    const content = document.getElementById('clue-content');
    if (content) content.textContent = clueText || 'Pista encontrada!';
    
    const found = document.getElementById('clue-found');
    const total = document.getElementById('clue-total');
    if (found) found.textContent = this.foundClues.size;
    if (total) total.textContent = this.totalClues;

    SkinController.showModal('modal-clue');

    // Verificar si completo el tour
    if (this.foundClues.size >= this.totalClues) {
      setTimeout(() => {
        SkinController.hideModal('modal-clue');
        this.completeTour();
      }, 1500);
    }
  },

  // ──────────────────────────────────────────
  // COMPLETAR TOUR
  // ──────────────────────────────────────────
  completeTour() {
    this.active = false;
    SkinController.showModal('modal-reward');
    
    // Ocultar contador
    const counter = document.getElementById('game-counter');
    if (counter) counter.classList.add('hidden');
    
    console.log('Tour completado!');
  },

  // ──────────────────────────────────────────
  // ACTUALIZAR CONTADOR UI
  // ──────────────────────────────────────────
  updateCounter() {
    const found = document.getElementById('game-found');
    const total = document.getElementById('game-total');
    if (found) found.textContent = this.foundClues.size;
    if (total) total.textContent = this.totalClues;
  },

  // ──────────────────────────────────────────
  // REINICIAR
  // ──────────────────────────────────────────
  reset() {
    this.active      = false;
    this.currentTour = null;
    this.foundClues  = new Set();
    this.totalClues  = 0;
    this.updateCounter();
    const counter = document.getElementById('game-counter');
    if (counter) counter.classList.add('hidden');
  }
};