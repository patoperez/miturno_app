/* ============================================================
   Harness compartido de Mi Turno
   ============================================================
   Stubea document/localStorage/window y hace `eval` de
   config.js + app.js + gym.js, que es como se prueba una app sin
   build ni modulos (ver CLAUDE.md, "Como verificar sin dispositivo").

   Esto lo importan TODAS las suites: los huecos del stub se arreglan
   UNA vez, aqui, no una vez por suite. Cuando una prueba nueva
   necesite algo del DOM que falte, agregalo a `mkEl()` y ya lo
   tienen todas.

   NO carga `reorder.js`: ese arranca la app de verdad, y ahi vive el
   gesto de deslizar, que necesita eventos de puntero reales y se
   verifica en el navegador.
   `sync.js` tampoco se carga: `app.js` lo llama siempre con guardas
   `typeof … === "function"`, asi que su ausencia es parte de lo que
   se prueba. */
const fs = require("fs");
const path = require("path");

/* La raiz del repo sale de la ubicacion de este archivo, no del cwd:
   asi `npm test` funciona igual desde cualquier directorio. */
const ROOT = path.join(__dirname, "..");

/* ---------- Stub de elemento ----------
   Un elemento tiene que aguantar TODO lo que el codigo de la app le
   haga sin reventar; devolver valores vacios es correcto, tirar
   TypeError no. Cada vez que una suite se estrello contra un hueco,
   el hueco se tapo aqui. */
function mkEl(tag) {
  const cls = new Set();
  const attrs = {};
  return {
    tagName: (tag || "div").toUpperCase(),
    innerHTML: "", textContent: "", value: "", style: {}, dataset: {},
    files: null, checked: false, disabled: false, selectedIndex: 0, options: [],
    width: 600, height: 200, offsetWidth: 0, offsetHeight: 0, scrollTop: 0,
    classList: {
      add(c) { cls.add(c); }, remove(c) { cls.delete(c); },
      toggle(c, on) { on ? cls.add(c) : cls.delete(c); },
      contains(c) { return cls.has(c); }
    },
    /* Eventos y ciclo de vida: no-ops que no rompen la cadena. */
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; },
    remove() {}, click() {},
    /* Los que faltaban y tumbaron suites en su momento. */
    focus() {}, blur() {}, select() {}, setSelectionRange() {}, scrollIntoView() {},
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, contains() { return false; },
    getBoundingClientRect() { return { top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0 }; },
    /* Los sparklines son <canvas>: sin getContext, renderProgreso revienta. */
    getContext() {
      return {
        clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
        fillRect() {}, strokeRect() {}, save() {}, restore() {}, closePath() {},
        fillText() {}, measureText() { return { width: 0 }; },
        set strokeStyle(v) {}, get strokeStyle() { return ""; },
        set fillStyle(v) {}, get fillStyle() { return ""; },
        set lineWidth(v) {}, get lineWidth() { return 0; },
        set lineJoin(v) {}, get lineJoin() { return ""; },
        set font(v) {}, get font() { return ""; }
      };
    }
  };
}

/* ---------- El detalle que hay que tener presente al escribir pruebas ----------
   `getElementById` MATERIALIZA un elemento para CUALQUIER id y lo
   memoiza. Es lo que permite hacer `set("bpName", "x")` antes de
   llamar al handler, sin montar un DOM de verdad.

   Dos consecuencias, y las dos han mordido antes:
   1. Un parche al DOM despues de pintar NO se ve en `modal.innerHTML`:
      son objetos distintos. Para lo que se pinta, revisa el HTML;
      para lo que se parcha despues, revisa `els[id]`.
   2. Los stubs SOBREVIVEN entre pruebas del mismo archivo. Un aviso
      viejo puede dar un falso positivo, asi que limpia antes de
      revisar (`clearFormError()`, o `resetEls()` para empezar de
      cero). Ningun guard que busque un elemento "que no existe"
      va a funcionar aqui: aqui siempre existe. */
const els = {};
global.document = {
  getElementById(id) { return (els[id] = els[id] || mkEl()); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement(tag) { return mkEl(tag); },
  addEventListener() {}, removeEventListener() {},
  documentElement: mkEl("html"),
  body: mkEl("body")
};
function resetEls() { Object.keys(els).forEach(k => delete els[k]); }

/* Semilla opcional de localStorage, para arranque en frio y migraciones. */
const mem = process.env.MT_SEED ? JSON.parse(process.env.MT_SEED) : {};
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem(k, v) { mem[k] = String(v); },
  removeItem(k) { delete mem[k]; }
};
global.navigator = { vibrate() {}, serviceWorker: { register() { return Promise.resolve(); } } };
global.window = global;
global.__MEM = mem;
global.__els = els;

const src = ["js/config.js", "js/app.js", "js/gym.js"]
  .map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n");

/* `eval` en modo suelto deja `let`/`const` en su propio ambito, asi que
   hay que exportarlos a mano para poder inspeccionar el estado. Si
   agregas una funcion nueva a la app y una prueba la necesita, va aqui.
   Un nombre que ya no exista tira ReferenceError al cargar: eso es
   correcto, avisa de una vez en vez de fallar raro despues. */
(0, eval)(src + `
;Object.assign(globalThis,{
  CFG,LOG,TASKS,WORKOUTS,VDAY,VIEW,HOY_ORDER,BACKUP_KEYS,ICONS,icon,esc,
  today,addDays,day,saveLog,saveCfg,store,cap,fmtDate,weekdayIdx,uid,
  pointsFor,rawPoints,recalcDay,maxPts,maxFor,mealScore,freezePastDays,streak,weekStatsFor,
  renderHoy,renderProgreso,header,viewDay,setVDay,goDay,goToday,editDay,
  slideHoy,bounceHoy,swipeHintPending,dismissSwipeHint,loadCfg,
  toggleHabit,toggleCommit,toggleMenu,setFicha,toggleInneg,setSleep,setMood,setJournal,
  gymCardHoy,metricsSection,reviewSection,reviewDateFor,openDay,openTask,saveWorkouts,
  exKey,exById,exFind,findOrCreateExercise,addAlias,toExId,setExId,exName,migrateExercises,
  exSessions,exProgress,exTokens,jaccard,levenshtein,levSim,exSimilarity,dupPairKey,dupCandidates,
  mergeExercises,renameExercise,allLoggedExercises,lastPerf,exercisePR,openExerciseDetail,
  renderWorkouts,dupPrompt,normalizeRoutine,
  NAV,buildNav,openAjustes,renderNegocio,renderAjustes,renderMetas,PALETTE,DEFAULT_HOY_ORDER,
  BIZ,loadBiz,saveBiz,DEFAULT_BIZ,BIZ_STATUS,BIZ_STALE_DAYS,bizProject,touchProject,daysSince,agoLabel,
  isStale,dueState,projectRank,byAttention,activeProjects,projectCard,bizSection,
  openBizProject,saveBizProject,delBizProject,confirmDelProject,
  completeNextAction,openNextAction,saveNextAction,gotoProject,pickBizColor,pickBizStatus,
  buildBackup,applyBackup,refreshState,
  projectDone,doneThisWeek,weekStartTs,weekDates,toKey,doneHistoryBlock,projectsView,
  LEAD_STAGES,LEAD_OPEN,LEAD_COLOR,LEAD_STALE_DAYS,bizLead,isOpenStage,openLeadsList,leadStale,
  followState,leadRank,nextStage,fmtMoney,stageLeads,setLeadStage,advanceLead,
  openFollowUp,pickFollow,saveFollowUp,openLead,saveLead,confirmDelLead,delLead,gotoLead,
  leadRow,pipelineView,setNegTab,bizHoyItems,hoyProjRow,hoyLeadRow,pickLeadStage,pickLeadProject,
  restoreDone,doRestoreDone,doneHistoryBlock,focusSummaryBlock,
  LEAD_NO_UNIT,leadUnit,leadUnitTotals,unitTotalsText,commonLeadUnit,migrateLeadUnits,fmtMoney,pipelineView,
  openFocusEdit,saveFocusEdit,confirmDelFocus,
  clampPast,markGymHabit,openLogSession,saveSession,pickIntensity,
  openManualWorkout,mwSetDate,mwPickRoutine,mwDelSet,renderManualWorkout,openMwSet,addMwSet,saveManualWorkout,
  workoutsInRange,hasWorkout,weightUnit,beginWorkout,startRest,skipRest,tick,notifyRestDone,restExpired,restLeft,
  savePlayerState,getActiveWorkout,clearActive,
  BLOCK_KINDS,BLOCK_LABEL,BLOCK_COLOR,blockKind,routineBlocks,routineExercises,blockOfIndex,migrateRoutineBlocks,
  exType,exIsTime,exIsBw,exSeconds,exTargetText,fmtSecs,exSetsOf,exBestTime,exBestReps,exPRInfo,
  isFutureDate,validPast,unitKey,knownLeadUnits,canonicalLeadUnit,
  openMwEdit,saveMwEdit,mwSetDate,openRoutineEditor,renderRoutineEditor,openBlockEdit,saveBlock,delBlock,doDelBlock,
  pickBkKind,moveBlock,openMoveExercise,moveExerciseTo,moveExerciseWithin,delExercise,openExercise,saveExercise,
  pickXType,toggleXBw,saveRoutine,normalizeExercise,exportRoutine,
  buildPlan,planStep,curEx,startWork,workLeft,workExpired,finishWorkSet,stopWorkEarly,advanceAfterExercise,
  afterLastSet,continueNext,finishWorkout,logCurrentSet,sessionBestBy,dismissAlarm,cleanupPlayer,
  formError,formErrorText,clearFormError,armSheet,submitSheet,FMSG_ID,MSG_SIN_RAZON,MSG_FUTURO,
  moveBlockExercises,sheet,closeModal,
  __getPLAYER:()=>PLAYER, __setPLAYER:v=>{PLAYER=v;}, __getRT:()=>_RT, __setRT:v=>{_RT=v;}, __getMW:()=>_MW,
  BIZ_PERIODS,isoWeekKey,monthKey,periodKey,lastNPeriods,prevPeriodKey,periodLabel,
  bizMetric,bizMval,setBizMval,bizMvals,sumByUnit,bizMetricCard,numerosView,
  openBizMval,saveBizMval,clearBizMval,openBizMetric,saveBizMetric,delBizMetric,confirmDelBizMetric,pickBmPeriod,
  IDEA_STATUS,bizIdea,captureIdea,setIdeaStatus,ideasSorted,openPromoteIdea,ideaToProject,ideaToNextAction,ideasView,ideaRow,
  getFocusRun,saveFocusRun,clearFocusRun,focusElapsed,startFocus,stopFocus,discardFocus,
  fmtHrs,fmtClock,focusSeconds,focusWeek,openFocusManual,saveFocusManual,delFocus,pickFocusProj,focusCard,armFocusTimer,focusTick,
  bizReview,hasBizReview,bizWeekFacts,saveBizReview,bizReviewSection,bitacoraList,hasReview,
  __getBIZ:()=>BIZ, __getHOYORDER:()=>HOY_ORDER, __getNEGTAB:()=>NEGTAB, __setNEGTAB:v=>{NEGTAB=v;},
  __getLASTVIEW:()=>LASTVIEW, __setLASTVIEW:v=>{LASTVIEW=v;},
  __setVDAY:v=>{VDAY=v;}, __getVDAY:()=>VDAY, __setVIEW:v=>{VIEW=v;}, __getVIEW:()=>VIEW
});`);

/* ---------- API minima de pruebas ----------
   Las suites imprimen "  ok  <nombre>" por prueba que pasa; el corredor
   cuenta esas lineas y usa el codigo de salida para saber si fallo.
   Una asercion que truena aborta la suite: es lo que se quiere, la
   primera falla es la que importa. */
let _n = 0;
function t(name, fn) { fn(); _n++; console.log("  ok  " + name); }
function count() { return _n; }
function done() { console.log("\n" + _n + " pruebas OK"); }
/* Atajo comodo: casi toda prueba escribe en un campo por id. */
function set(id, v) { document.getElementById(id).value = v == null ? "" : String(v); }
/* Lee un archivo del repo (para las pruebas que escanean el codigo fuente). */
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

module.exports = { ROOT, els, mem, mkEl, resetEls, t, count, done, set, readSrc };
