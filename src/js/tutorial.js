/* src/js/tutorial.js — Tutorial module (not wired to game yet) */
(function () {
'use strict';
var POS = window.POS || (window.POS = {});

/*
  Minimal, data-driven tutorial module.
  - Does not attach to gameplay yet.
  - Intended to consume rows from src/data/tutorial_steps.csv
*/
POS.Tutorial = {
  enabled: false,
  completed: false,
  stepIndex: 0,
  steps: [],

  reset: function () {
    this.enabled = false;
    this.completed = false;
    this.stepIndex = 0;
  },

  loadFromRows: function (rows) {
    if (!Array.isArray(rows)) return;
    this.steps = rows.slice();
    this.stepIndex = 0;
  },

  loadFromCsvText: function (csvText) {
    var rows = POS.Tutorial.parseCsv(csvText);
    this.loadFromRows(rows);
  },

  getCurrentStep: function () {
    return this.steps[this.stepIndex] || null;
  },

  advance: function () {
    if (this.stepIndex < this.steps.length - 1) {
      this.stepIndex += 1;
    } else {
      this.completed = true;
      this.enabled = false;
    }
  },

  /*
    Simple CSV parser for tutorial steps.
    - Assumes no commas inside fields.
    - First row is header.
  */
  parseCsv: function (csvText) {
    if (!csvText) return [];
    var lines = csvText.split(/\r?\n/).filter(function (l) { return l.trim().length; });
    if (!lines.length) return [];
    var header = lines[0].split(',').map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i += 1) {
      var parts = lines[i].split(',');
      var row = {};
      for (var j = 0; j < header.length; j += 1) {
        var key = header[j];
        row[key] = (parts[j] || '').trim();
      }
      rows.push(row);
    }
    return rows;
  },
};

})();
