/**
 * PHASE 18 — Baseline generator for the frozen 18/09 dataset.
 *
 * Pure Node.js. Consumes the UNMODIFIED engine (orchestrator) exactly like the
 * Desktop shell does, and prints a normalized contract of the PlanningResult.
 *
 * Usage:  node tests/baseline-18sep.json.js
 */
'use strict';

const path = require('path');
const orchestrator = require(path.join(__dirname, '..', 'src', 'orchestrator.js'));
const ui = require(path.join(__dirname, '..', 'src', 'ui.js'));

const RAW_18SEP = ui.DATASETS['18_SEP'];

const STOCK_18SEP = {
  'PERA_RAMA': 320,
  'COCKTAIL_ROMANTICO::CONSABOR': 0,
  'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
  'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
  'CHERRY_RAMA::SUNSTREAM': 100
};

const result = orchestrator.planLoad({
  rawText: RAW_18SEP,
  stock: { ...STOCK_18SEP },
  locks: [],
  exclusions: [],
  palletConfiguration: {}
});

const model = ui.buildTruckSlotsModel(result);

let towers = 0;
for (const slot of model.slots) {
  const t = slot.stackingPlan && slot.stackingPlan.towers ? slot.stackingPlan.towers : [];
  towers += t.length;
}

const contract = {
  deliveryDate: result.deliveryDate,
  totalRequested: result.demandSummary.totalRequested,
  totalBoxes: result.totalBoxes,
  totalPallets: result.totalPallets,
  totalPalletSlots: result.totalPalletSlots,
  totalBoxesFromModel: model.totalBoxes,
  totalPalletsFromModel: model.totalPallets,
  totalPalletSlotsFromModel: model.totalPalletSlots,
  totalTowers: towers,
  isPhysicallyFeasible: result.isPhysicallyFeasible,
  warningsCount: (result.warnings || []).length,
  errorsCount: (result.errors || []).length,
  platforms: model.slots.map(s => ({
    platform: s.platform,
    boxes: s.totalBoxes,
    pallets: s.totalPallets,
    palletSlots: s.palletSlots,
    towers: (s.stackingPlan && s.stackingPlan.towers ? s.stackingPlan.towers : []).map(t => ({
      index: t.towerIndex,
      format: t.format,
      pallets: t.palletCount,
      boxes: t.totalBoxes,
      height: t.towerHeightMm,
      maxHeight: t.maxTowerHeightMm,
      remaining: t.remainingHeightMm
    })),
    items: s.items.map(i => ({
      productId: i.productId,
      varietyId: i.varietyId,
      boxes: i.totalBoxes,
      palletCount: i.palletCount,
      palletType: i.palletType
    }))
  })),
  allocations: result.allocations.map(a => ({
    platform: a.platform,
    productId: a.productId,
    varietyId: a.varietyId || null,
    requested: a.requestedQuantity,
    allocated: a.allocatedQuantity,
    missing: a.missingQuantity,
    method: a.allocationMethod
  })),
  servedByArticle: ui.computeServedTotalsByArticle(result).totalsList.map(t => t.formattedText)
};

console.log(JSON.stringify(contract, null, 2));
