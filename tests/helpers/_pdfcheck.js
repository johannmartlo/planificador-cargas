const path=require('path');
const SRC=path.join(__dirname,'..','src');
const ui=require(path.join(SRC,'ui.js'));
const {createDocument}=require('./mini-dom.js');
const result = require(path.join(SRC,'orchestrator.js')).planLoad({
  rawText:'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80',
  stock:{'PERA_RAMA':0,'COCKTAIL_ROMANTICO::CONSABOR':100,'COCKTAIL_ROMANTICO::SAO_PAULO':0,'COCKTAIL_ROMANTICO::SUNSTREAM':0,'CHERRY_RAMA::SUNSTREAM':0},
  locks:[],exclusions:[],palletConfiguration:{}
});
const doc=createDocument('<div id="print-articles-totals-list"></div><span id="print-grand-total-boxes"></span>');
global.document=doc;
const c=new ui.UIController(new ui.AppState());
c.renderPrintHeaderSummary(result);
console.log('list innerHTML:', JSON.stringify(doc.getElementById('print-articles-totals-list').innerHTML));
console.log('grand:', JSON.stringify(doc.getElementById('print-grand-total-boxes').textContent));
console.log('totalsList:', JSON.stringify(ui.computeServedTotalsByArticle(result).totalsList.map(t=>t.formattedText)));
