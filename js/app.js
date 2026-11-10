(function (global) {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = {
    rows: [], headers: [], profiles: {}, fileName: '', target: '', selectedFeatures: new Set(),
    artifact: null, pendingArtifact: null, plotMap: {}, cancelled: false, lastSplit: null,
    predictionOutput: [], predictionRows: [], predictionFileName: '',
    datasetFingerprint: null, datasetFingerprintPromise: null, workerClient: null, dataQuality:null, predictionApplicability:[],
    jobManager: null, activeJob: null, experiments: [], experimentArtifacts: {}, preferredExperimentId: null, comparisonBatchRunning: false, approvedPackage:null, packageVerification:null, appMode:'full',
    monitoringRows:[], monitoringHeaders:[], monitoringFileName:'', monitoringRecord:null, revalidationResult:null, modelChangeAssessment:null, approvalCandidateExperimentId:null
  };
  const ids = [
    'runtimeMode','privacyInfoBtn','privacyDialog','systemIntegrityBtn','systemRecoveryBtn','integrityDialog','recoveryDialog','dataQualityHelpBtn','dataQualityHelpDialog','alertRegion','dropZone','csvFile','chooseCsvBtn','projectFile','modelFile','approvedPackageFile','predictionOnlyModeBtn','forceOfflineMode',
    'datasetSummary','previewWrap','previewTable','dataQualitySummary','dataQualityTable','targetColumn','targetTransform','targetTransformHelp','featureSearch','autoFeaturesBtn','selectAllFeatures','clearFeatures','featureCount','featureList',
    'numericMissing','numericScaling','categoricalMissing','categoricalEncoding','maxCategories','dropFirstCategory','preprocessEstimate',
    'tuningMode','searchTrialsLabel','searchTrials','modelParams','searchSummary','splitStrategy','randomSeed','enableCV','foldsLabel','cvFolds','splitControls','enableUncertainty','intervalLevel','bootstrapSamplesLabel','bootstrapSamples','splitPreview','previewSplitBtn','trainBtn','toggleComparisonToolsBtn','comparisonToolPanel','trainComparisonBtn','comparisonBatchStatus','comparisonQueue','cancelBtn','trainingStatus','progressWrap','progressBar',
    'diagnosticDataset','diagnosticFeature','diagnosticSource','showDiagnosticUncertainty','experimentSummary','validationWorkspace','criterionMaxRmse','criterionMinR2','criterionMinCoverage','criterionMaxCoverage','criterionMaxGroupRmse','validationGroup','criterionNoCritical','evaluateValidationBtn','evaluateAllValidationBtn','downloadValidationBtn','acceptanceSummary','acceptanceTable','groupPerformanceTable','approvalWorkspace','approvalCandidateExperiment','approvalCandidateSummary','openApprovalCandidateBtn','approvalModelName','approvalDeveloper','approvalOwner','approvalReviewer','approvalApprover','approvalReviewerRole','approvalStatus','approvalDecisionDate','approvalReviewDate','approvalIntendedUse','approvalProhibitedUses','approvalLimitations','approvalConditions','approvalNotes','approvalSchemaTable','recordApprovalBtn','downloadValidationReportBtn','downloadGovernanceJsonBtn','downloadApprovalRecordBtn','downloadApprovalHistoryBtn','downloadApprovedPackageBtn','reportIncludeActualPredicted','reportIncludeActualFeature','reportIncludeResidualPredicted','reportIncludeResidualHistogram','reportIncludeQQ','reportIncludeComparison','approvalOperationalSummary','approvalHistoryTable','comparisonWorkspace','comparisonNotice','comparisonDifferencePanel','comparisonTable','comparisonSort','comparisonMetric','comparisonChartScope','comparisonComparableOnly','downloadComparisonBtn','clearComparisonBtn','metricsTable','metricsTableWrap','cvSummary','downloadModelBtn','downloadPredictionsBtn','downloadMetricsBtn','downloadExperimentBtn','downloadProjectBtn','downloadAllPlotsBtn',
    'predictionFile','predictionFeature','predictionSource','showMeasuredTarget','predictionMeasuredTarget','downloadUnknownPredictionsBtn','includeFeaturesInPredictionExport','predictionSummary','predictionApplicabilitySummary','operationModeBadge','approvedPackageSummary',
    'integritySummary','downloadRuntimeManifestBtn','recoveryPanel','recoverySummary','restoreRecoveryBtn','discardRecoveryBtn',
    'monitoringFile','monitoringMapping','monitorMeasuredColumn','monitorPredictedColumn','monitorLowerColumn','monitorUpperColumn','monitorGroupColumn','monitorDateColumn','monitorApplicabilityColumn','analyseMonitoringBtn','monitoringSummary','monitoringGroupTable','downloadMonitoringBtn','monitorMaxRmse','monitorMaxBias','monitorMinCoverage','monitorMaxOutsideRate','monitorReviewDate','evaluateRevalidationBtn','revalidationSummary','revalidationTable','changeReferenceExperiment','compareModelChangeBtn','downloadModelChangeBtn','modelChangeSummary'
  ];
  const els = {};

  function init() {
    ids.forEach(id => { els[id] = $(id); });
    state.jobManager = new global.LRSPlatform.JobManager();
    state.workerClient = global.LRSWorkerClient.create('./js/lrs-worker.js');
    bindEvents(); setupSystemDrawers(); applyAppMode(); updateRuntimeMode(); renderIntegritySummary(); renderRecoveryPanel(); renderModelParams(); renderSplitControls(); updateTransformHelp();
    global.addEventListener('lrs-language-change', () => {
      if (state.rows.length) { renderDataset(); updateFeatureCount(); }
      updateTransformHelp(); updateSearchSummary();
      if (state.artifact) renderResults();
      if (state.predictionOutput.length) renderUnknownPredictionPlot();
    });
    global.LocalRegressionApp = { version: '1.0.11', state, activateExperiment, renderComparisonWorkspace, renderDataQuality, evaluateCurrentValidation, analyseMonitoringData, evaluateRevalidationRules, saveRecoverySnapshot };
  }

  function setupSystemDrawers() {
    const integrityPanel = els.integritySummary && els.integritySummary.closest('.compact-governance-panel');
    const recoveryPanel = els.recoveryPanel;
    const integrityContent = $('integrityDialogContent');
    const recoveryContent = $('recoveryDialogContent');
    if (integrityPanel && integrityContent && !integrityContent.contains(integrityPanel)) integrityContent.appendChild(integrityPanel);
    if (recoveryPanel && recoveryContent && !recoveryContent.contains(recoveryPanel)) recoveryContent.appendChild(recoveryPanel);
    const grid = document.querySelector('#step-upload .governance-grid');
    if (grid) grid.remove();
  }

  function bindEvents() {
    els.privacyInfoBtn.addEventListener('click', () => els.privacyDialog.showModal());
    if (els.systemIntegrityBtn && els.integrityDialog) els.systemIntegrityBtn.addEventListener('click', () => els.integrityDialog.showModal());
    if (els.systemRecoveryBtn && els.recoveryDialog) els.systemRecoveryBtn.addEventListener('click', () => els.recoveryDialog.showModal());
    if (els.dataQualityHelpBtn && els.dataQualityHelpDialog) els.dataQualityHelpBtn.addEventListener('click', () => els.dataQualityHelpDialog.showModal());
    els.chooseCsvBtn.addEventListener('click', event => { event.stopPropagation(); els.csvFile.click(); });
    els.dropZone.addEventListener('click', event => { if (event.target !== els.chooseCsvBtn) els.csvFile.click(); });
    els.dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); els.csvFile.click(); } });
    ['dragenter','dragover'].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(name => els.dropZone.addEventListener(name, event => { event.preventDefault(); els.dropZone.classList.remove('dragover'); }));
    els.dropZone.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (file) loadCsvFile(file); });
    els.csvFile.addEventListener('change', () => { if (els.csvFile.files[0]) loadCsvFile(els.csvFile.files[0]); });
    els.projectFile.addEventListener('change', () => { if (els.projectFile.files[0]) loadProjectFile(els.projectFile.files[0]); });
    els.modelFile.addEventListener('change', () => { if (els.modelFile.files[0]) loadModelFile(els.modelFile.files[0]); });
    els.approvedPackageFile.addEventListener('change', () => { if (els.approvedPackageFile.files[0]) loadApprovedPackageFile(els.approvedPackageFile.files[0]); });
    if (els.predictionOnlyModeBtn) els.predictionOnlyModeBtn.addEventListener('click', toggleAppMode);
    if (els.forceOfflineMode) els.forceOfflineMode.addEventListener('change', () => {
      const url = new URL(location.href);
      if (els.forceOfflineMode.checked) url.searchParams.set('localOnly','1'); else url.searchParams.delete('localOnly');
      location.href = url.toString();
    });
    els.targetColumn.addEventListener('change', () => {
      state.target = els.targetColumn.value; state.selectedFeatures.delete(state.target); renderFeatureList(); estimatePreprocessing(); renderDataQuality(); unlockWorkflow();
    });
    els.targetTransform.addEventListener('change', updateTransformHelp);
    els.featureSearch.addEventListener('input', renderFeatureList);
    els.autoFeaturesBtn.addEventListener('click', autoSelectFeatures);
    els.selectAllFeatures.addEventListener('click', () => {
      state.selectedFeatures = new Set(MLCore.autoSelectFeatures(state.headers, state.target, state.profiles)); renderFeatureList(); estimatePreprocessing(); renderDataQuality(); unlockWorkflow();
    });
    els.clearFeatures.addEventListener('click', () => { state.selectedFeatures.clear(); renderFeatureList(); estimatePreprocessing(); renderDataQuality(); });
    ['numericMissing','numericScaling','categoricalMissing','categoricalEncoding','maxCategories','dropFirstCategory'].forEach(id => els[id].addEventListener('change', estimatePreprocessing));
    document.querySelectorAll('input[name="modelType"]').forEach(input => input.addEventListener('change', () => {
      const type = getModelType();
      if (['linear','ridge','elasticnet','robust','quantile'].includes(type)) els.dropFirstCategory.checked = true;
      else els.dropFirstCategory.checked = false;
      renderModelParams(); updateUncertaintyControls(); estimatePreprocessing();
    }));
    els.tuningMode.addEventListener('change', renderModelParams);
    els.searchTrials.addEventListener('input', updateSearchSummary);
    els.splitStrategy.addEventListener('change', renderSplitControls);
    els.enableCV.addEventListener('change', () => els.foldsLabel.classList.toggle('hidden', !els.enableCV.checked));
    els.previewSplitBtn.addEventListener('click', previewSplit);
    els.trainBtn.addEventListener('click', () => trainAndEvaluate());
    if (els.toggleComparisonToolsBtn) els.toggleComparisonToolsBtn.addEventListener('click', toggleComparisonTools);
    els.trainComparisonBtn.addEventListener('click', trainComparisonSet);
    els.cancelBtn.addEventListener('click', () => { state.cancelled = true; if (state.activeJob) state.activeJob.requestCancel(); setStatus('Cancellation requested…'); });
    els.diagnosticDataset.addEventListener('change', renderDiagnosticPlots);
    els.diagnosticFeature.addEventListener('change', renderDiagnosticPlots);
    els.diagnosticSource.addEventListener('change', renderDiagnosticPlots);
    if (els.showDiagnosticUncertainty) {
      els.showDiagnosticUncertainty.addEventListener('change', renderDiagnosticPlots);
    }
    els.downloadModelBtn.addEventListener('click', downloadModel);
    els.downloadPredictionsBtn.addEventListener('click', downloadSplitPredictions);
    els.downloadMetricsBtn.addEventListener('click', downloadMetrics);
    els.downloadExperimentBtn.addEventListener('click', downloadExperimentRecord);
    els.downloadComparisonBtn.addEventListener('click', downloadComparisonCsv);
    els.clearComparisonBtn.addEventListener('click', clearNonActiveExperiments);
    els.comparisonSort.addEventListener('change', renderComparisonWorkspace);
    if (els.comparisonMetric) els.comparisonMetric.addEventListener('change', renderComparisonWorkspace);
    if (els.comparisonChartScope) els.comparisonChartScope.addEventListener('change', renderComparisonWorkspace);
    els.comparisonComparableOnly.addEventListener('change', renderComparisonWorkspace);
    els.comparisonTable.addEventListener('click', handleComparisonAction);
    ['criterionMaxRmse','criterionMinR2','criterionMinCoverage','criterionMaxCoverage','criterionMaxGroupRmse'].forEach(id => els[id].addEventListener('change', () => evaluateCurrentValidation(false)));
    els.validationGroup.addEventListener('change', () => evaluateCurrentValidation(false));
    els.criterionNoCritical.addEventListener('change', () => evaluateCurrentValidation(false));
    els.evaluateValidationBtn.addEventListener('click', () => evaluateCurrentValidation(true));
    if (els.evaluateAllValidationBtn) els.evaluateAllValidationBtn.addEventListener('click', evaluateAllComparableValidation);
    els.downloadValidationBtn.addEventListener('click', downloadValidationSummary);
    if (els.approvalCandidateExperiment) els.approvalCandidateExperiment.addEventListener('change', () => { state.approvalCandidateExperimentId = els.approvalCandidateExperiment.value || null; renderApprovalWorkspace(); });
    if (els.openApprovalCandidateBtn) els.openApprovalCandidateBtn.addEventListener('click', openApprovalCandidateForReview);
    els.recordApprovalBtn.addEventListener('click', recordApprovalDecision);
    els.downloadValidationReportBtn.addEventListener('click', downloadValidationReport);
    els.downloadApprovedPackageBtn.addEventListener('click', downloadApprovedPackage);
    if (els.downloadApprovalRecordBtn) els.downloadApprovalRecordBtn.addEventListener('click', downloadApprovalRecord);
    if (els.downloadApprovalHistoryBtn) els.downloadApprovalHistoryBtn.addEventListener('click', downloadApprovalHistoryCsv);
    els.downloadGovernanceJsonBtn.addEventListener('click', downloadGovernanceReportJson);
    els.downloadRuntimeManifestBtn.addEventListener('click', downloadRuntimeManifest);
    els.restoreRecoveryBtn.addEventListener('click', restoreRecoverySnapshot);
    els.discardRecoveryBtn.addEventListener('click', discardRecoverySnapshot);
    els.monitoringFile.addEventListener('change', () => { if (els.monitoringFile.files[0]) loadMonitoringFile(els.monitoringFile.files[0]); });
    els.analyseMonitoringBtn.addEventListener('click', analyseMonitoringData);
    els.evaluateRevalidationBtn.addEventListener('click', evaluateRevalidationRules);
    els.downloadMonitoringBtn.addEventListener('click', downloadMonitoringRecord);
    els.changeReferenceExperiment.addEventListener('change', () => { els.compareModelChangeBtn.disabled = !els.changeReferenceExperiment.value || !state.artifact; });
    els.compareModelChangeBtn.addEventListener('click', compareModelChange);
    els.downloadModelChangeBtn.addEventListener('click', downloadModelChangeAssessment);
    els.downloadProjectBtn.addEventListener('click', downloadProject);
    els.downloadAllPlotsBtn.addEventListener('click', downloadAllPlots);
    document.addEventListener('click', event => { const btn = event.target.closest('.export-plot'); if (btn) exportPlot(btn.dataset.plot); });
    els.predictionFile.addEventListener('change', () => { if (els.predictionFile.files[0]) predictUnknownCsv(els.predictionFile.files[0]); });
    els.predictionFeature.addEventListener('change', renderUnknownPredictionPlot);
    els.predictionSource.addEventListener('change', renderUnknownPredictionPlot);
    if (els.showMeasuredTarget) {
      els.showMeasuredTarget.addEventListener('change', () => {
        if (els.predictionMeasuredTarget) {
          els.predictionMeasuredTarget.disabled = !els.showMeasuredTarget.checked;
        }
        renderUnknownPredictionPlot();
      });
    }
    if (els.predictionMeasuredTarget) {
      els.predictionMeasuredTarget.addEventListener('change', renderUnknownPredictionPlot);
    }
    els.downloadUnknownPredictionsBtn.addEventListener('click', downloadUnknownPredictions);
  }

  function updateRuntimeMode() {
    const status = global.__dependencyStatus || { modeRequested:'unknown', libraries:{} };
    const localOnly = status.modeRequested === 'local-only'; if (els.forceOfflineMode) { els.forceOfflineMode.checked = localOnly; els.forceOfflineMode.disabled = Boolean(global.LRS_BUILD_CONFIG && global.LRS_BUILD_CONFIG.forceLocalOnly); }
    const sources = Object.entries(status.libraries).map(([name, value]) => `${name}: ${value.source}`).join(' · ');
    els.runtimeMode.textContent = localOnly ? `Offline mode · ${sources || 'local libraries'}` : `Hybrid mode · ${sources || 'checking libraries'}`;
    els.runtimeMode.className = `status-pill ${localOnly ? 'status-local' : 'status-hybrid'}`;
  }



  function applyAppMode(forcedMode) {
    const buildConfig = global.LRS_BUILD_CONFIG || {};
    const requested = forcedMode || (buildConfig.forcePredictionOnly ? 'prediction' : new URLSearchParams(location.search).get('mode'));
    state.appMode = requested === 'predict' || requested === 'prediction' ? 'prediction' : 'full';
    if (buildConfig.forcePredictionOnly) state.appMode = 'prediction';
    document.body.classList.toggle('prediction-only', state.appMode === 'prediction');
    document.body.classList.toggle('forced-prediction-only', Boolean(buildConfig.forcePredictionOnly));
    if (els.predictionOnlyModeBtn) {
      els.predictionOnlyModeBtn.textContent = state.appMode === 'prediction' ? 'Return to full workspace' : 'Prediction-only mode';
      els.predictionOnlyModeBtn.disabled = Boolean(buildConfig.forcePredictionOnly);
    }
    if (els.operationModeBadge) {
      const edition = buildConfig.edition || (state.appMode === 'prediction' ? 'prediction-only' : 'full-studio');
      els.operationModeBadge.textContent = edition.replace(/-/g,' ');
      els.operationModeBadge.className = `status-pill ${state.appMode === 'prediction' ? 'status-local' : 'status-hybrid'}`;
    }
    renderApprovedPackageSummary();
  }

  function toggleAppMode() {
    if (global.LRS_BUILD_CONFIG && global.LRS_BUILD_CONFIG.forcePredictionOnly) return;
    const next = state.appMode === 'prediction' ? 'full' : 'prediction';
    const url = new URL(location.href);
    if (next === 'prediction') url.searchParams.set('mode','predict'); else url.searchParams.delete('mode');
    history.replaceState(null,'',url.toString());
    applyAppMode(next);
    if (next === 'prediction') $('step-predict').scrollIntoView({behavior:'smooth'});
  }

  async function loadCsvFile(file) {
    clearAlerts();
    try {
      global.LRSSecurity.validateCsvFile(file);
      const csvText = await file.text();
      const parsed = global.CSVEngine.parse(csvText, { header:true, skipEmptyLines:true });
      if (parsed.errors && parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message || 'CSV parsing failed.');
      const rows = parsed.data.filter(row => row && Object.values(row).some(value => String(value ?? '').trim() !== ''));
      const headers = parsed.meta && parsed.meta.fields ? parsed.meta.fields : (rows[0] ? Object.keys(rows[0]) : []);
      const shapeCheck = global.LRSSecurity.validateCsvShape(rows, headers);
      if (!shapeCheck.valid) throw new Error(shapeCheck.issues.map(issue => issue.message).join(' '));
      state.rows = rows; state.headers = headers; state.profiles = MLCore.inferColumns(rows, headers); state.fileName = file.name;
      state.target = ''; state.selectedFeatures.clear(); state.lastSplit = null; state.datasetFingerprint = null; state.dataQuality = null; state.predictionApplicability = [];
      state.datasetFingerprintPromise = calculateDatasetFingerprint(csvText).then(fingerprint => {
        state.datasetFingerprint = fingerprint; renderDataset(); return fingerprint;
      }).catch(error => {
        state.datasetFingerprint = { algorithm:'Unavailable', value:null, error:error.message }; renderDataset(); return state.datasetFingerprint;
      });
      renderDataset(); populateColumnControls(); renderDataQuality(); unlockPanel('step-features');
      if (state.pendingArtifact) { restoreArtifactSettings(state.pendingArtifact, true); state.pendingArtifact = null; }
      alertUser(`Loaded ${formatNumber(rows.length)} rows and ${formatNumber(headers.length)} columns locally.`, 'success');
    } catch (error) { alertUser(error.message, 'error'); }
    finally { els.csvFile.value = ''; }
  }

  async function calculateDatasetFingerprint(csvText) {
    if (state.workerClient && state.workerClient.available) {
      try { return await state.workerClient.request('FINGERPRINT_TEXT', { text:csvText }); }
      catch (_) { /* Fall back to the main thread for file:// and restricted worker contexts. */ }
    }
    return global.LRSPlatform.fingerprintText(csvText);
  }

  async function ensureDatasetFingerprint() {
    if (state.datasetFingerprint && state.datasetFingerprint.value) return state.datasetFingerprint;
    if (state.datasetFingerprintPromise) return state.datasetFingerprintPromise;
    return state.datasetFingerprint;
  }


  function renderDataQuality() {
    if (!els.dataQualitySummary || !els.dataQualityTable || !state.rows.length || !global.LRSValidation) return;
    state.dataQuality = global.LRSValidation.analyseDataQuality(state.rows,state.headers,state.profiles,{target:state.target,selectedFeatures:Array.from(state.selectedFeatures)});
    const c=state.dataQuality.counts;
    els.dataQualitySummary.innerHTML=`<div class="quality-count critical"><strong>${formatNumber(c.critical||0)}</strong><span>Critical</span></div><div class="quality-count warning"><strong>${formatNumber(c.warning||0)}</strong><span>Warnings</span></div><div class="quality-count information"><strong>${formatNumber(c.information||0)}</strong><span>Information</span></div>`;
    els.dataQualityTable.innerHTML=`<thead><tr><th>Severity</th><th>Finding</th><th>Details</th><th>Columns</th><th>Recommendation</th></tr></thead><tbody>${state.dataQuality.findings.map(item=>`<tr><td><span class="severity-badge ${escapeAttr(item.severity)}">${escapeHtml(capitalize(item.severity))}</span></td><td>${escapeHtml(item.title)}</td><td class="wrap-cell">${escapeHtml(item.details)}</td><td class="wrap-cell">${escapeHtml((item.columns||[]).join(', ')||'—')}</td><td class="wrap-cell">${escapeHtml(item.recommendation||'—')}</td></tr>`).join('')}</tbody>`;
  }

  function optionalNumberValue(element) {
    if (!element || String(element.value).trim()==='') return null;
    const value=Number(element.value); return Number.isFinite(value)?value:null;
  }

  function getAcceptanceCriteria() {
    return {maxTestRmse:optionalNumberValue(els.criterionMaxRmse),minTestR2:optionalNumberValue(els.criterionMinR2),minCoverage:optionalNumberValue(els.criterionMinCoverage),maxCoverage:optionalNumberValue(els.criterionMaxCoverage),maxGroupRmse:optionalNumberValue(els.criterionMaxGroupRmse),requireNoCritical:Boolean(els.criterionNoCritical&&els.criterionNoCritical.checked)};
  }

  function setAcceptanceCriteria(criteria) {
    const c=criteria||{};
    const set=(el,value)=>{if(el)el.value=value==null?'':String(value);};
    set(els.criterionMaxRmse,c.maxTestRmse); set(els.criterionMinR2,c.minTestR2); set(els.criterionMinCoverage,c.minCoverage); set(els.criterionMaxCoverage,c.maxCoverage); set(els.criterionMaxGroupRmse,c.maxGroupRmse);
    if(els.criterionNoCritical)els.criterionNoCritical.checked=c.requireNoCritical!==false;
  }

  function syncExperimentValidation() {
    if(!state.artifact)return;
    state.experimentArtifacts[state.artifact.experimentId]=state.artifact;
    const index=state.experiments.findIndex(record=>record.experimentId===state.artifact.experimentId);
    if(index>=0)state.experiments[index]={...state.experiments[index],validation:global.LRSPlatform.cloneJson(state.artifact.validation)};
    if(state.artifact.experimentRecord)state.artifact.experimentRecord.validation=global.LRSPlatform.cloneJson(state.artifact.validation);
  }

  function evaluateCurrentValidation(showAlert) {
    if(!state.artifact||!global.LRSValidation)return null;
    const dataQuality=state.rows.length?global.LRSValidation.analyseDataQuality(state.rows,state.headers,state.profiles,{target:state.artifact.target,selectedFeatures:state.artifact.selectedFeatures}):(state.artifact.validation&&state.artifact.validation.dataQuality)||null;
    const criteria=getAcceptanceCriteria(),groupColumn=els.validationGroup.value||null;
    const acceptance=global.LRSValidation.evaluateAcceptance(state.artifact,dataQuality,criteria,groupColumn);
    state.artifact.validation={dataQuality,criteria,groupColumn,acceptance};
    syncExperimentValidation(); renderValidationWorkspace(); renderComparisonWorkspace();
    if(showAlert)alertUser(acceptance.overall==='pass'?'Configured acceptance criteria passed.':acceptance.overall==='fail'?'One or more configured acceptance criteria failed.':'No measurable acceptance criteria are configured.',acceptance.overall==='pass'?'success':'warning');
    return acceptance;
  }

  function evaluateAllComparableValidation() {
    if(!state.artifact||!global.LRSValidation||!global.LRSComparison) return null;
    const artifacts=experimentArtifacts();
    if(!artifacts.length) return null;
    const criteria=getAcceptanceCriteria(), groupColumn=els.validationGroup.value||null;
    const activeDataQuality=state.rows.length
      ? global.LRSValidation.analyseDataQuality(state.rows,state.headers,state.profiles,{target:state.artifact.target,selectedFeatures:state.artifact.selectedFeatures})
      : (state.artifact.validation&&state.artifact.validation.dataQuality)||null;
    let evaluated=0, failed=0, skipped=0;
    for(const artifact of artifacts){
      const row=global.LRSComparison.leaderboardRow(artifact,state.artifact,state.preferredExperimentId);
      if(!row.comparable && artifact.experimentId!==state.artifact.experimentId){ skipped++; continue; }
      const dataQuality=(artifact.validation&&artifact.validation.dataQuality)||activeDataQuality;
      const acceptance=global.LRSValidation.evaluateAcceptance(artifact,dataQuality,criteria,groupColumn);
      artifact.validation={dataQuality,criteria:global.LRSPlatform.cloneJson(criteria),groupColumn,acceptance};
      if(artifact.experimentRecord)artifact.experimentRecord.validation=global.LRSPlatform.cloneJson(artifact.validation);
      const index=state.experiments.findIndex(record=>record.experimentId===artifact.experimentId);
      if(index>=0)state.experiments[index]={...state.experiments[index],validation:global.LRSPlatform.cloneJson(artifact.validation)};
      evaluated++;
      if(acceptance.overall==='fail') failed++;
    }
    renderValidationWorkspace(); renderComparisonWorkspace();
    alertUser(`Evaluated acceptance criteria for ${evaluated} comparable experiment${evaluated===1?'':'s'}${skipped?`; skipped ${skipped} different-setup experiment${skipped===1?'':'s'}`:''}. ${failed?`${failed} failed.`:'No evaluated comparable experiments failed.'}`, failed?'warning':'success');
    return {evaluated,failed,skipped};
  }

  function formatAcceptanceActual(outcome) {
    if(outcome.actual==null)return '—';
    if(outcome.key==='coverage')return `${(outcome.actual*100).toFixed(1)}%`;
    return formatMetric(outcome.actual);
  }

  function renderValidationWorkspace() {
    if(!state.artifact||!els.validationWorkspace)return;
    const validation=state.artifact.validation||{};
    setAcceptanceCriteria(validation.criteria||{});
    if(els.validationGroup&&validation.groupColumn!=null)els.validationGroup.value=validation.groupColumn;
    const acceptance=validation.acceptance||global.LRSValidation.evaluateAcceptance(state.artifact,validation.dataQuality,validation.criteria||{},validation.groupColumn||'');
    state.artifact.validation={...validation,acceptance};
    const label=acceptance.overall==='pass'?'Passed':acceptance.overall==='fail'?'Failed':'Not evaluated';
    els.acceptanceSummary.className=`acceptance-summary ${acceptance.overall}`;
    els.acceptanceSummary.innerHTML=`<strong>${label}</strong><span>${acceptance.overall==='pass'?'All configured measurable requirements passed.':acceptance.overall==='fail'?'At least one configured requirement failed.':'Enter one or more numeric limits or retain the no-critical-findings requirement.'}</span>`;
    els.acceptanceTable.innerHTML=`<thead><tr><th>Status</th><th>Requirement</th><th>Observed</th><th>Criterion</th><th>Note</th></tr></thead><tbody>${acceptance.outcomes.map(item=>`<tr><td><span class="severity-badge ${item.status==='pass'?'information':item.status==='fail'?'critical':'neutral'}">${item.status==='pass'?'Pass':item.status==='fail'?'Fail':'Not evaluated'}</span></td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(formatAcceptanceActual(item))}</td><td>${escapeHtml(item.requirement)}</td><td class="wrap-cell">${escapeHtml(item.note||'—')}</td></tr>`).join('')}</tbody>`;
    const groups=acceptance.groupPerformance||[];
    els.groupPerformanceTable.innerHTML=groups.length?`<thead><tr><th>Group</th><th>Rows</th><th>RMSE</th><th>MAE</th><th>R²</th><th>Bias</th><th>Coverage</th></tr></thead><tbody>${groups.map(row=>`<tr><td data-i18n-skip="true">${escapeHtml(row.group)}</td><td>${formatNumber(row.count)}</td><td>${formatMetric(row.rmse)}</td><td>${formatMetric(row.mae)}</td><td>${formatMetric(row.r2)}</td><td>${formatMetric(row.bias)}</td><td>${Number.isFinite(row.coverage)?`${(row.coverage*100).toFixed(1)}%`:'—'}</td></tr>`).join('')}</tbody>`:`<tbody><tr><td>Choose a group column to calculate test performance by source, regime or another available column.</td></tr></tbody>`;
  }




  function toggleComparisonTools() {
    if (!els.comparisonToolPanel || !els.toggleComparisonToolsBtn) return;
    const shouldOpen = els.comparisonToolPanel.classList.contains('hidden');
    els.comparisonToolPanel.classList.toggle('hidden', !shouldOpen);
    els.toggleComparisonToolsBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    els.toggleComparisonToolsBtn.textContent = shouldOpen ? 'Hide comparison tools' : 'Show comparison tools';
  }

  function getApprovalCandidateArtifact() {
    if (!state.artifact) return null;
    const artifacts = experimentArtifacts();
    if (!artifacts.length) return state.artifact;
    let candidate = state.approvalCandidateExperimentId ? state.experimentArtifacts[state.approvalCandidateExperimentId] : null;
    if (!candidate && state.preferredExperimentId) candidate = state.experimentArtifacts[state.preferredExperimentId];
    if (!candidate && state.artifact && state.artifact.experimentId) candidate = state.artifact;
    if (!candidate) candidate = artifacts[0];
    state.approvalCandidateExperimentId = candidate && candidate.experimentId || null;
    return candidate || null;
  }

  function approvalCandidateLabel(artifact) {
    if (!artifact) return 'No fitted experiment available';
    const definition = global.LRSPlatform && global.LRSPlatform.getModelDefinition ? global.LRSPlatform.getModelDefinition(artifact.modelType) : null;
    const modelLabel = definition ? definition.label : (artifact.modelType || 'Unknown model');
    const evalTest = artifact.evaluation && artifact.evaluation.test && artifact.evaluation.test.pointMetrics || {};
    const parts = [modelLabel];
    if (artifact.experimentId === state.preferredExperimentId) parts.push('Preferred');
    if (state.artifact && artifact.experimentId === state.artifact.experimentId) parts.push('Active');
    if (Number.isFinite(evalTest.rmse)) parts.push(`Test RMSE ${formatMetric(evalTest.rmse)}`);
    parts.push(shortIdentifier(artifact.experimentId));
    return parts.join(' — ');
  }

  function populateApprovalCandidateSelector(candidate) {
    if (!els.approvalCandidateExperiment) return;
    const artifacts = experimentArtifacts();
    els.approvalCandidateExperiment.innerHTML = artifacts.length
      ? artifacts.map(item => `<option value="${escapeAttr(item.experimentId)}">${escapeHtml(approvalCandidateLabel(item))}</option>`).join('')
      : '<option value="">No fitted experiment available</option>';
    if (candidate && candidate.experimentId) els.approvalCandidateExperiment.value = candidate.experimentId;
  }

  function renderApprovalCandidateSummary(candidate) {
    if (!els.approvalCandidateSummary) return;
    if (!candidate) {
      els.approvalCandidateSummary.className = 'approval-candidate-summary warning';
      els.approvalCandidateSummary.innerHTML = 'Train or open a fitted model before recording an approval decision.';
      return;
    }
    const row = global.LRSComparison.leaderboardRow(candidate, state.artifact, state.preferredExperimentId);
    const differsFromActive = state.artifact && candidate.experimentId !== state.artifact.experimentId;
    const comparableText = row.comparable ? 'Comparable with active diagnostics' : 'Different setup from active diagnostics';
    const warning = differsFromActive ? '<p class="fine-print"><strong>Review warning:</strong> this approval candidate is not the active diagnostics model. Open it for review before recording approval or exporting an approved package.</p>' : '';
    els.approvalCandidateSummary.className = `approval-candidate-summary ${differsFromActive ? 'warning' : 'approved'}`;
    els.approvalCandidateSummary.innerHTML = `<strong>${escapeHtml(approvalCandidateLabel(candidate))}</strong><span>${escapeHtml(comparableText)} · Validation RMSE ${formatMetric(row.validationRmse)} · Test RMSE ${formatMetric(row.testRmse)} · Approval ${escapeHtml(row.approvalStatus || 'draft')}</span>${warning}`;
    if (els.openApprovalCandidateBtn) els.openApprovalCandidateBtn.disabled = !differsFromActive;
  }

  function openApprovalCandidateForReview() {
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) return alertUser('No approval candidate is available.', 'warning');
    if (activateExperiment(candidate.experimentId, true)) {
      state.approvalCandidateExperimentId = candidate.experimentId;
      alertUser('Approval candidate opened as the active model for diagnostics and validation review.', 'success');
    }
  }

  function approvalFormValue(element) { return element ? String(element.value || '') : ''; }

  function collectFeatureMetadata() {
    const featureUnits = {}, featureDescriptions = {};
    if (!els.approvalSchemaTable) return {featureUnits,featureDescriptions};
    els.approvalSchemaTable.querySelectorAll('[data-approval-unit]').forEach(input => { featureUnits[input.dataset.approvalUnit] = input.value.trim(); });
    els.approvalSchemaTable.querySelectorAll('[data-approval-description]').forEach(input => { featureDescriptions[input.dataset.approvalDescription] = input.value.trim(); });
    return {featureUnits,featureDescriptions};
  }

  function collectApprovalForm() {
    const metadata = collectFeatureMetadata();
    return global.LRSApproval.normalizeApproval({
      ...((getApprovalCandidateArtifact() || state.artifact) && (getApprovalCandidateArtifact() || state.artifact).approval || {}),
      modelName:approvalFormValue(els.approvalModelName), developer:approvalFormValue(els.approvalDeveloper), owner:approvalFormValue(els.approvalOwner), reviewer:approvalFormValue(els.approvalReviewer), approver:approvalFormValue(els.approvalApprover), reviewerRole:approvalFormValue(els.approvalReviewerRole)||'reviewer',
      status:approvalFormValue(els.approvalStatus) || 'draft', decisionDate:approvalFormValue(els.approvalDecisionDate), reviewDate:approvalFormValue(els.approvalReviewDate),
      intendedUse:approvalFormValue(els.approvalIntendedUse), prohibitedUses:approvalFormValue(els.approvalProhibitedUses), limitations:approvalFormValue(els.approvalLimitations),
      conditions:approvalFormValue(els.approvalConditions), notes:approvalFormValue(els.approvalNotes), ...metadata
    });
  }

  function setApprovalForm(approvalInput) {
    const approval = global.LRSApproval.normalizeApproval(approvalInput);
    const set=(el,value)=>{if(el)el.value=value||'';};
    set(els.approvalModelName,approval.modelName); set(els.approvalDeveloper,approval.developer); set(els.approvalOwner,approval.owner); set(els.approvalReviewer,approval.reviewer); set(els.approvalApprover,approval.approver); set(els.approvalReviewerRole,approval.reviewerRole);
    set(els.approvalStatus,approval.status); set(els.approvalDecisionDate,approval.decisionDate); set(els.approvalReviewDate,approval.reviewDate);
    set(els.approvalIntendedUse,approval.intendedUse); set(els.approvalProhibitedUses,approval.prohibitedUses); set(els.approvalLimitations,approval.limitations);
    set(els.approvalConditions,approval.conditions); set(els.approvalNotes,approval.notes);
  }

  function syncExperimentApproval(artifactInput) {
    const artifact = artifactInput || getApprovalCandidateArtifact() || state.artifact;
    if(!artifact || !artifact.experimentId)return;
    state.experimentArtifacts[artifact.experimentId]=artifact;
    if(state.artifact && state.artifact.experimentId === artifact.experimentId) state.artifact = artifact;
    const index=state.experiments.findIndex(record=>record.experimentId===artifact.experimentId);
    if(index>=0)state.experiments[index]={...state.experiments[index],approval:global.LRSPlatform.cloneJson(artifact.approval)};
    if(artifact.experimentRecord)artifact.experimentRecord.approval=global.LRSPlatform.cloneJson(artifact.approval);
  }

  function renderApprovalWorkspace() {
    if (!state.artifact || !els.approvalWorkspace) return;
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) return;
    populateApprovalCandidateSelector(candidate);
    renderApprovalCandidateSummary(candidate);
    const approval = global.LRSApproval.normalizeApproval(candidate.approval);
    candidate.approval = approval;
    setApprovalForm(approval);
    const schema = global.LRSApproval.buildInputSchema(candidate,approval);
    els.approvalSchemaTable.innerHTML = `<thead><tr><th>Feature</th><th>Type</th><th>Required</th><th>Training support</th><th>Unit</th><th>Description</th></tr></thead><tbody>${schema.features.map(feature=>{
      const support=feature.type==='numeric'?`${formatMetric(feature.trainingMinimum)} to ${formatMetric(feature.trainingMaximum)}`:(feature.allowedCategories||[]).join(', ')||'No explicit categories';
      return `<tr><td data-i18n-skip="true"><strong>${escapeHtml(feature.name)}</strong></td><td>${escapeHtml(feature.type)}</td><td>Yes</td><td data-i18n-skip="true">${escapeHtml(support)}</td><td><input data-approval-unit="${escapeAttr(feature.name)}" value="${escapeAttr(feature.unit||'')}" aria-label="Unit for ${escapeAttr(feature.name)}"></td><td><input data-approval-description="${escapeAttr(feature.name)}" value="${escapeAttr(feature.description||'')}" aria-label="Description for ${escapeAttr(feature.name)}"></td></tr>`;
    }).join('')}</tbody>`;
    const check = global.LRSApproval.validateApproval(approval,candidate.validation&&candidate.validation.acceptance);
    const expired = global.LRSApproval.isExpired(approval);
    const lifecycleStatus = check.lifecycleStatus || global.LRSGovernance.lifecycleStatus(approval);
    const css = check.operational&&!expired?'approved':['rejected','retired','suspended','expired','validation-failed'].includes(lifecycleStatus)?'rejected':check.errors.length||lifecycleStatus==='under-review'?'warning':'';
    els.approvalOperationalSummary.className=`approval-operational-summary ${css}`;
    const messages=[...check.errors,...check.warnings];
    els.approvalOperationalSummary.innerHTML=`<span class="approval-status-badge ${escapeAttr(lifecycleStatus)}">${escapeHtml(lifecycleStatus)}</span><strong>${check.operational&&!expired?'Eligible for an approved prediction package.':'Not ready for operational export.'}</strong>${expired?`<span>Review date ${escapeHtml(approval.reviewDate)} has passed.</span>`:''}${messages.length?`<ul class="operational-warning-list">${messages.map(message=>`<li>${escapeHtml(message)}</li>`).join('')}</ul>`:'<span>Approval metadata and configured validation requirements are complete.</span>'}`;
    els.downloadApprovedPackageBtn.disabled=!(check.operational&&!expired);
    els.approvalHistoryTable.innerHTML=approval.history.length?`<thead><tr><th>Recorded</th><th>Transition</th><th>Role</th><th>Reviewer / approver</th><th>Review date</th><th>Reason</th></tr></thead><tbody>${approval.history.slice().reverse().map(item=>`<tr><td>${escapeHtml(formatCreated(item.recordedAt))}</td><td>${escapeHtml(item.fromStatus?`${item.fromStatus} → ${item.status}`:item.status)}</td><td>${escapeHtml(item.role||'reviewer')}</td><td>${escapeHtml(item.reviewer||'—')}</td><td>${escapeHtml(item.reviewDate||'—')}</td><td class="wrap-cell">${escapeHtml(item.reason||item.note||'—')}</td></tr>`).join('')}</tbody>`:`<tbody><tr><td>No approval decision has been recorded.</td></tr></tbody>`;
  }

  function recordApprovalDecision() {
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) return alertUser('Train or load a model first.','warning');
    try {
      const proposed=collectApprovalForm();
      if (!proposed.decisionDate) proposed.decisionDate=new Date().toISOString().slice(0,10);
      const check=global.LRSApproval.validateApproval(proposed,candidate.validation&&candidate.validation.acceptance);
      if (!check.valid) throw new Error(check.errors.join(' '));
      candidate.approval=global.LRSApproval.appendDecisionHistory(candidate.approval,proposed);
      candidate.governance=candidate.governance||{};
      candidate.governance.lifecycleStatus=global.LRSGovernance.lifecycleStatus(candidate.approval);
      syncExperimentApproval(candidate); renderApprovalWorkspace(); renderComparisonWorkspace(); renderApprovedPackageSummary(); saveRecoverySnapshot();
      alertUser(`Approval decision recorded for ${approvalCandidateLabel(candidate)} as ${candidate.approval.status}.`,check.operational?'success':'warning');
    } catch(error) { alertUser(error.message,'error'); }
  }

  async function downloadValidationReport() {
    if (!state.artifact) return alertUser('Train or load a model first.','warning');
    const proposed=collectApprovalForm();
    let html=global.LRSApproval.buildValidationReportHtml(state.artifact,proposed);
    const figureSpecs = [
      ['reportIncludeActualPredicted','actualPredicted','Actual vs predicted'],
      ['reportIncludeActualFeature','actualPredictedFeature','Actual and predicted vs selected input feature'],
      ['reportIncludeResidualPredicted','residualPredicted','Residuals vs predicted'],
      ['reportIncludeResidualHistogram','residualHistogram','Residual distribution'],
      ['reportIncludeQQ','qq','Residual Q–Q plot'],
      ['reportIncludeComparison','comparisonRmse','Model-comparison chart']
    ];
    const figures=[];
    for (const [checkboxId, plotKey, title] of figureSpecs) {
      const checkbox = els[checkboxId]; const plot = state.plotMap[plotKey];
      if (checkbox && checkbox.checked && plot && global.Plotly && Plotly.toImage) {
        try { figures.push({title, dataUrl: await Plotly.toImage(plot,{format:'png',width:1100,height:700,scale:1})}); }
        catch(error) { figures.push({title, error:error.message}); }
      }
    }
    if (figures.length) {
      const figureHtml = `<h2>Diagnostic figures</h2><p>Figures are embedded as generated from the active diagnostic controls at report-download time.</p>${figures.map(fig => fig.dataUrl ? `<figure><h3>${escapeHtml(fig.title)}</h3><img src="${fig.dataUrl}" alt="${escapeAttr(fig.title)}" style="max-width:100%;border:1px solid #ccd5dd"></figure>` : `<p><strong>${escapeHtml(fig.title)}</strong>: ${escapeHtml(fig.error||'not available')}</p>`).join('')}`;
      html = html.replace('</body>', `${figureHtml}</body>`);
    }
    downloadBlob(html,`${baseName()}-validation-and-approval-report.html`,'text/html;charset=utf-8');
    alertUser('Validation and approval report downloaded. Open it in a browser to print or save as PDF.','success');
  }

  async function downloadApprovedPackage() {
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) return alertUser('Train or load a model first.','warning');
    try {
      const proposed=collectApprovalForm();
      const check=global.LRSApproval.validateApproval(proposed,candidate.validation&&candidate.validation.acceptance);
      if (!check.valid) throw new Error(check.errors.join(' '));
      candidate.approval=global.LRSApproval.appendDecisionHistory(candidate.approval,proposed);
      syncExperimentApproval(candidate);
      const approvedPackage=await global.LRSApproval.createApprovedPackage(candidate,candidate.approval);
      await saveJsonWithPicker(approvedPackage,`${baseName()}-${shortIdentifier(candidate.experimentId)}.mlpredict.json`,'Approved prediction package');
      renderApprovalWorkspace();
    } catch(error){alertUser(error.message,'error');}
  }

  async function loadApprovedPackageFile(file) {
    clearAlerts();
    try {
      global.LRSSecurity.validateJsonFile(file);
      const parsedPackage=JSON.parse(await file.text()); global.LRSSecurity.validateArtifactEnvelope(parsedPackage,['local-regression-approved-package']);
      const verification=await global.LRSApproval.verifyApprovedPackage(parsedPackage);
      state.approvedPackage=verification.package; state.packageVerification=verification; state.artifact=verification.artifact; state.pendingArtifact=verification.artifact;
      state.experiments=verification.artifact.experimentRecord?[verification.artifact.experimentRecord]:[];
      state.experimentArtifacts=verification.artifact.experimentId?{[verification.artifact.experimentId]:verification.artifact}:{};
      state.approvalCandidateExperimentId=verification.artifact.experimentId||null;
      restoreArtifactSettings(verification.artifact,state.rows.length>0); populateDiagnosticControls(); unlockPanel('step-predict');
      const url=new URL(location.href);url.searchParams.set('mode','predict');history.replaceState(null,'',url.toString());applyAppMode('prediction');
      renderApprovedPackageSummary(); $('step-predict').scrollIntoView({behavior:'smooth'});
      alertUser(`Approved package loaded and verified. ${verification.testVectorResults.passedCount}/${verification.testVectorResults.total} embedded self-tests passed.`,'success');
    } catch(error){alertUser(error.message,'error');}
    finally{els.approvedPackageFile.value='';}
  }

  function renderApprovedPackageSummary() {
    if (!els.approvedPackageSummary) return;
    if (!state.approvedPackage || !state.packageVerification) {
      els.approvedPackageSummary.className='approved-package-summary';
      els.approvedPackageSummary.innerHTML=state.appMode==='prediction'?'<strong>Load an approved prediction package to operate in prediction-only mode.</strong><span class="mode-note">Ordinary fitted-model files are intentionally insufficient for operational prediction-only use.</span>':'No approved prediction package is loaded. Full-workspace users may still predict with the active fitted model.';
      return;
    }
    const approval=state.packageVerification.approval;
    const tests=state.packageVerification.testVectorResults;
    const signature=state.packageVerification.signatureVerification||{present:false,verified:false,status:'not-present'};
    els.approvedPackageSummary.className='approved-package-summary approved';
    els.approvedPackageSummary.innerHTML=`<span class="approval-status-badge ${escapeAttr(lifecycleStatus)}">${escapeHtml(lifecycleStatus)}</span><strong>${escapeHtml(approval.modelName||'Approved model')}</strong><span>Reviewer: ${escapeHtml(approval.reviewer||'—')} · Review date: ${escapeHtml(approval.reviewDate||'—')}</span><span>Integrity: SHA-256 verified · Organizational signature: ${signature.verified?'verified':signature.present?'invalid':'not present'} · Self-tests: ${formatNumber(tests.passedCount)}/${formatNumber(tests.total)} passed</span><span><strong>Intended use:</strong> ${escapeHtml(approval.intendedUse||'—')}</span>${approval.conditions?`<span><strong>Conditions:</strong> ${escapeHtml(approval.conditions)}</span>`:''}<code data-i18n-skip="true">${escapeHtml(state.approvedPackage.packageId)}</code>`;
  }

  function downloadValidationSummary() {
    if(!state.artifact)return alertUser('Train or load a fitted model first.','warning');
    const acceptance=evaluateCurrentValidation(false);
    downloadJson({applicationVersion:'1.0.11',experimentId:state.artifact.experimentId,dataset:state.artifact.dataset,target:state.artifact.target,modelType:state.artifact.modelType,validation:state.artifact.validation,approval:state.artifact.approval,generatedAt:new Date().toISOString()},`${baseName()}-validation-summary.json`);
    if(acceptance)alertUser('Validation summary downloaded.','success');
  }

  function renderPredictionApplicability(includedIndices) {
    if(!els.predictionApplicabilitySummary||!state.predictionApplicability.length)return;
    const summary=global.LRSValidation.summariseApplicability(state.predictionApplicability,includedIndices);
    const c=summary.counts;
    els.predictionApplicabilitySummary.classList.remove('hidden');
    els.predictionApplicabilitySummary.innerHTML=`<h3>Prediction applicability</h3><div class="applicability-counts"><div><strong>${formatNumber(c['within-domain']||0)}</strong><span>Within observed ranges</span></div><div><strong>${formatNumber(c['near-boundary']||0)}</strong><span>Near a boundary</span></div><div><strong>${formatNumber(c.warning||0)}</strong><span>Unseen or imputed values</span></div><div><strong>${formatNumber(c['outside-domain']||0)}</strong><span>Outside observed domain</span></div><div><strong>${formatNumber(c.dropped||0)}</strong><span>Dropped by preprocessing</span></div></div><p class="fine-print">Row-level status and reasons are included in the downloaded prediction CSV. Range checks use the fitted training preprocessor and do not guarantee that a prediction is reliable.</p>`;
  }

  function renderIntegritySummary() {
    if (!els.integritySummary || !global.LRSSecurity) return;
    const report=global.LRSSecurity.runtimeIntegrity(global.__dependencyStatus,global.LRS_BUILD_CONFIG);
    state.runtimeManifest={
      artifactType:'local-regression-runtime-manifest',schemaVersion:1,generatedAt:new Date().toISOString(),
      applicationVersion:'1.0.11',buildConfig:global.LRSPlatform.cloneJson(global.LRS_BUILD_CONFIG||{}),runtime:report,
      schemas:global.LRSPlatform.schemas,userAgent:navigator.userAgent,secureContext:Boolean(global.isSecureContext)
    };
    const statusClass=report.offlineClean?'good':report.networkPolicy==='strict-offline'?'bad':'warning';
    const libraryText=report.libraries.length?report.libraries.map(item=>`${item.name}: ${item.source}${item.version?` (${item.version})`:''}`).join(' · '):'No library status was reported.';
    els.integritySummary.innerHTML=`<span class="integrity-status ${statusClass}">${report.offlineClean?'No remote library loaded':'Hybrid startup used'}</span><div class="integrity-line"><span>Edition</span><strong>${escapeHtml(report.edition)}</strong></div><div class="integrity-line"><span>Network policy</span><strong>${escapeHtml(report.networkPolicy)}</strong></div><div class="integrity-line"><span>Application</span><strong>v1.0.11 · ${escapeHtml((global.LRS_BUILD_CONFIG&&global.LRS_BUILD_CONFIG.buildId)||'governance-release')}</strong></div><div class="integrity-line"><span>Dependencies</span><strong>${escapeHtml(libraryText)}</strong></div>`;
  }

  function downloadRuntimeManifest(){
    if(!state.runtimeManifest)renderIntegritySummary();
    downloadJson(state.runtimeManifest,'local-regression-studio-runtime-manifest.json');
  }

  function recoveryProjectSnapshot(){
    if(!state.artifact)return null;
    const artifacts=experimentArtifacts();
    return {artifactType:'local-regression-project',schemaVersion:global.LRSPlatform.schemas.project,appVersion:'1.0.11',savedAt:new Date().toISOString(),notice:'Browser-local recovery snapshot. The original CSV is not included.',originalCsvIncluded:false,activeExperimentId:state.artifact.experimentId,preferredExperimentId:state.preferredExperimentId,approvalCandidateExperimentId:state.approvalCandidateExperimentId,experiments:state.experiments.length?state.experiments:[state.artifact.experimentRecord],artifacts:artifacts.length?artifacts:[state.artifact],artifact:state.artifact,monitoringRecords:artifacts.flatMap(item=>item.monitoring&&Array.isArray(item.monitoring.records)?item.monitoring.records:[])};
  }

  function saveRecoverySnapshot(){
    if(!global.LRSRecovery||!state.artifact)return;
    const project=recoveryProjectSnapshot();
    if(!project)return;
    try{global.LRSRecovery.save({project});renderRecoveryPanel();}catch(_){/* Recovery must never interrupt modelling. */}
  }

  function renderRecoveryPanel(){
    if(!els.recoverySummary||!global.LRSRecovery)return;
    const meta=global.LRSRecovery.metadata();
    els.restoreRecoveryBtn.disabled=!meta;els.discardRecoveryBtn.disabled=!meta;
    els.recoverySummary.innerHTML=meta?`<strong>Recovery snapshot available</strong><span>Saved ${escapeHtml(formatCreated(meta.savedAt))} · ${formatNumber(meta.artifactCount)} fitted artifact(s) · original CSV excluded</span>`:'<strong>No recovery snapshot was found.</strong><span>A snapshot is saved after successful training, approval, monitoring, or project restoration.</span>';
  }

  function restoreProjectState(projectInput, sourceLabel){
    const project=global.LRSPlatform.migrateProject(projectInput);
    const artifact=project.artifact;state.artifact=artifact;state.pendingArtifact=artifact;state.approvedPackage=null;state.packageVerification=null;
    state.experiments=Array.isArray(project.experiments)?project.experiments:[artifact.experimentRecord];
    state.experimentArtifacts=Object.fromEntries((project.artifacts||[artifact]).map(item=>[item.experimentId,item]));
    state.preferredExperimentId=project.preferredExperimentId||null;
    state.approvalCandidateExperimentId=project.approvalCandidateExperimentId||state.preferredExperimentId||project.activeExperimentId||null;
    restoreArtifactSettings(artifact,state.rows.length>0);
    if(artifact.diagnosticData&&artifact.evaluation){populateDiagnosticControls();renderResults();unlockPanel('step-diagnostics');}
    unlockPanel('step-predict');refreshChangeExperimentOptions();renderApprovedPackageSummary();renderMonitoringRecord();
    if(sourceLabel)alertUser(`${sourceLabel} restored. The original CSV was not stored.`,'success');
    return project;
  }

  function restoreRecoverySnapshot(){
    try{const envelope=global.LRSRecovery.load();if(!envelope||!envelope.snapshot||!envelope.snapshot.project)throw new Error('No valid recovery snapshot is available.');restoreProjectState(envelope.snapshot.project,'Recovery snapshot');}
    catch(error){alertUser(error.message,'error');}
  }

  function discardRecoverySnapshot(){global.LRSRecovery.clear();renderRecoveryPanel();alertUser('Recovery snapshot discarded.','success');}

  function populateMonitoringSelect(select,headers,blank,selected){
    if(!select)return;select.innerHTML=`${blank!=null?`<option value="">${escapeHtml(blank)}</option>`:''}${headers.map(name=>`<option data-i18n-skip="true" value="${escapeAttr(name)}"${name===selected?' selected':''}>${escapeHtml(name)}</option>`).join('')}`;
  }

  async function loadMonitoringFile(file){
    clearAlerts();
    try{
      global.LRSSecurity.validateCsvFile(file);const text=await file.text();const parsed=global.CSVEngine.parse(text,{header:true,skipEmptyLines:true});
      const rows=(parsed.data||[]).filter(row=>row&&Object.values(row).some(value=>String(value??'').trim()!==''));const headers=parsed.meta&&parsed.meta.fields?parsed.meta.fields:(rows[0]?Object.keys(rows[0]):[]);
      const shape=global.LRSSecurity.validateCsvShape(rows,headers);if(!shape.valid)throw new Error(shape.issues.map(issue=>issue.message).join(' '));
      state.monitoringRows=rows;state.monitoringHeaders=headers;state.monitoringFileName=file.name;state.monitoringRecord=null;state.revalidationResult=null;
      const inferred=global.LRSGovernance.inferMapping(headers);
      populateMonitoringSelect(els.monitorMeasuredColumn,headers,null,inferred.measured);populateMonitoringSelect(els.monitorPredictedColumn,headers,null,inferred.predicted);
      populateMonitoringSelect(els.monitorLowerColumn,headers,'Not available',inferred.lower);populateMonitoringSelect(els.monitorUpperColumn,headers,'Not available',inferred.upper);
      populateMonitoringSelect(els.monitorGroupColumn,headers,'No grouping',inferred.group);populateMonitoringSelect(els.monitorDateColumn,headers,'No dates',inferred.date);populateMonitoringSelect(els.monitorApplicabilityColumn,headers,'Not available',inferred.applicability);
      els.monitoringMapping.classList.remove('hidden');els.monitoringSummary.innerHTML=`<strong>${formatNumber(rows.length)} monitoring rows loaded locally.</strong><span>Confirm the measured and predicted columns, then analyse the data.</span>`;
    }catch(error){alertUser(error.message,'error');}
    finally{els.monitoringFile.value='';}
  }

  function currentMonitoringMapping(){return{measured:els.monitorMeasuredColumn.value,predicted:els.monitorPredictedColumn.value,lower:els.monitorLowerColumn.value,upper:els.monitorUpperColumn.value,group:els.monitorGroupColumn.value,date:els.monitorDateColumn.value,applicability:els.monitorApplicabilityColumn.value};}

  function analyseMonitoringData(){
    try{
      const record=global.LRSGovernance.analyseMonitoring(state.monitoringRows,currentMonitoringMapping());record.sourceFileName=state.monitoringFileName||null;record.modelExperimentId=state.artifact&&state.artifact.experimentId||null;record.packageId=state.approvedPackage&&state.approvedPackage.packageId||null;
      state.monitoringRecord=record;state.revalidationResult=null;
      if(state.artifact){state.artifact.monitoring=state.artifact.monitoring||{records:[]};state.artifact.monitoring.records=Array.isArray(state.artifact.monitoring.records)?state.artifact.monitoring.records:[];state.artifact.monitoring.records.push(global.LRSPlatform.cloneJson(record));state.artifact.monitoring.latest=global.LRSPlatform.cloneJson(record);}
      renderMonitoringRecord();saveRecoverySnapshot();alertUser('Monitoring performance calculated.','success');
    }catch(error){alertUser(error.message,'error');}
  }

  function renderMonitoringRecord(){
    if(!els.monitoringSummary)return;
    const record=state.monitoringRecord||(state.artifact&&state.artifact.monitoring&&state.artifact.monitoring.latest);
    if(!record){els.monitoringSummary.innerHTML='Upload an operational-results CSV to calculate performance after deployment.';els.downloadMonitoringBtn.disabled=true;els.evaluateRevalidationBtn.disabled=true;return;}
    state.monitoringRecord=record;const m=record.metrics||{};
    const metrics=[['Rows',record.usableRows],['RMSE',m.rmse],['MAE',m.mae],['R²',m.r2],['Bias',m.bias],['Coverage',m.coverage==null?null:`${(m.coverage*100).toFixed(1)}%`]];
    els.monitoringSummary.innerHTML=`<strong>Operational monitoring record</strong><div class="monitoring-metrics">${metrics.map(([label,value])=>`<div class="monitoring-metric"><strong>${typeof value==='string'?escapeHtml(value):formatMetric(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('')}</div><span>${formatNumber(record.invalidRows||0)} row(s) were excluded because measured or predicted targets were missing or non-numeric.</span>`;
    const groups=record.groupMetrics||[];els.monitoringGroupTable.innerHTML=groups.length?`<thead><tr><th>Group</th><th>Rows</th><th>RMSE</th><th>MAE</th><th>R²</th><th>Bias</th><th>Coverage</th></tr></thead><tbody>${groups.map(row=>`<tr><td data-i18n-skip="true">${escapeHtml(row.group)}</td><td>${formatNumber(row.count)}</td><td>${formatMetric(row.rmse)}</td><td>${formatMetric(row.mae)}</td><td>${formatMetric(row.r2)}</td><td>${formatMetric(row.bias)}</td><td>${row.coverage==null?'—':`${(row.coverage*100).toFixed(1)}%`}</td></tr>`).join('')}</tbody>`:'<tbody><tr><td>No group column was configured.</td></tr></tbody>';
    if(state.artifact&&state.artifact.approval&&state.artifact.approval.reviewDate&&!els.monitorReviewDate.value)els.monitorReviewDate.value=state.artifact.approval.reviewDate;
    els.downloadMonitoringBtn.disabled=false;els.evaluateRevalidationBtn.disabled=false;
  }

  function evaluateRevalidationRules(){
    if(!state.monitoringRecord)return alertUser('Analyse monitoring data first.','warning');
    const rules={maxRmse:els.monitorMaxRmse.value,maxAbsoluteBias:els.monitorMaxBias.value,minCoverage:els.monitorMinCoverage.value,maxOutsideRate:els.monitorMaxOutsideRate.value,reviewDate:els.monitorReviewDate.value};
    const result=global.LRSGovernance.evaluateRevalidation(state.monitoringRecord,rules);state.revalidationResult=result;
    if(state.artifact){state.artifact.monitoring=state.artifact.monitoring||{};state.artifact.monitoring.rules=global.LRSPlatform.cloneJson(result.rules);state.artifact.monitoring.revalidation=global.LRSPlatform.cloneJson(result);}
    renderRevalidationResult();saveRecoverySnapshot();alertUser(result.overall==='fail'?'One or more revalidation triggers failed. Human review is required.':'Revalidation triggers evaluated.',result.overall==='fail'?'warning':'success');
  }

  function renderRevalidationResult(){
    const result=state.revalidationResult||(state.artifact&&state.artifact.monitoring&&state.artifact.monitoring.revalidation);if(!result)return;
    state.revalidationResult=result;els.revalidationSummary.className=`acceptance-summary ${result.overall}`;els.revalidationSummary.innerHTML=`<strong>${result.overall==='fail'?'Review required':result.overall==='pass'?'Continue with monitoring':'Not evaluated'}</strong><span>${result.overall==='fail'?'At least one operational trigger failed. The app does not automatically retrain, approve, or suspend the model.':'No configured trigger failed.'}</span>`;
    els.revalidationTable.innerHTML=result.outcomes.length?`<thead><tr><th>Status</th><th>Trigger</th><th>Observed</th><th>Requirement</th><th>Note</th></tr></thead><tbody>${result.outcomes.map(item=>`<tr><td><span class="severity-badge ${item.status==='fail'?'critical':'information'}">${item.status}</span></td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(formatMetric(item.actual))}</td><td>${escapeHtml(item.requirement)}</td><td class="wrap-cell">${escapeHtml(item.note||'—')}</td></tr>`).join('')}</tbody>`:'<tbody><tr><td>No trigger was configured.</td></tr></tbody>';
  }

  function downloadMonitoringRecord(){if(state.monitoringRecord)downloadJson(state.monitoringRecord,`${baseName()}-monitoring-record.json`);}

  function refreshChangeExperimentOptions(){
    if(!els.changeReferenceExperiment)return;const current=state.artifact&&state.artifact.experimentId;const options=experimentArtifacts().filter(item=>item.experimentId!==current);
    const selected=els.changeReferenceExperiment.value;els.changeReferenceExperiment.innerHTML=`<option value="">Choose saved experiment…</option>${options.map(item=>`<option value="${escapeAttr(item.experimentId)}"${item.experimentId===selected?' selected':''}>${escapeHtml(global.LRSComparison.experimentLabel(item))}</option>`).join('')}`;
    els.compareModelChangeBtn.disabled=!els.changeReferenceExperiment.value||!state.artifact;
  }

  function compareModelChange(){
    try{const reference=state.experimentArtifacts[els.changeReferenceExperiment.value];if(!reference||!state.artifact)throw new Error('Choose a reference experiment.');state.modelChangeAssessment=global.LRSGovernance.modelChangeComparison(reference,state.artifact);renderModelChangeAssessment();els.downloadModelChangeBtn.disabled=false;}
    catch(error){alertUser(error.message,'error');}
  }

  function renderModelChangeAssessment(){
    const a=state.modelChangeAssessment;if(!a)return;const c=a.changes,p=a.performance;
    els.modelChangeSummary.innerHTML=`<strong>Proposed replacement assessment</strong><div class="model-change-grid"><div class="model-change-item"><strong>${c.modelType.changed?'Changed':'Unchanged'}</strong><span>Algorithm: ${escapeHtml(c.modelType.old)} → ${escapeHtml(c.modelType.new)}</span></div><div class="model-change-item"><strong>${c.datasetFingerprintChanged?'Changed':'Unchanged'}</strong><span>Training-dataset fingerprint</span></div><div class="model-change-item"><strong>${c.preprocessingChanged?'Changed':'Unchanged'}</strong><span>Preprocessing configuration</span></div><div class="model-change-item"><strong>${formatMetric(p.delta.rmse)}</strong><span>Test RMSE change (new − old)</span></div><div class="model-change-item"><strong>${formatMetric(p.delta.r2)}</strong><span>Test R² change (new − old)</span></div><div class="model-change-item"><strong>${formatNumber(c.addedFeatures.length)} / ${formatNumber(c.removedFeatures.length)}</strong><span>Added / removed features</span></div></div><p class="fine-print">Algorithm, feature, preprocessing, data-scope, or performance changes normally require documented revalidation and reapproval.</p>`;
  }

  function downloadModelChangeAssessment(){if(state.modelChangeAssessment)downloadJson(state.modelChangeAssessment,`${baseName()}-model-change-assessment.json`);}



  function currentApprovalRecord() {
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) throw new Error('Train or load a model first.');
    const approval = global.LRSApproval.normalizeApproval(collectApprovalForm());
    return {
      artifactType:'local-regression-approval-record', schemaVersion:1, applicationVersion:'1.0.11', generatedAt:new Date().toISOString(),
      experimentId:candidate.experimentId, modelType:candidate.modelType, dataset:candidate.dataset,
      validation:candidate.validation && candidate.validation.acceptance ? candidate.validation.acceptance : null,
      approval, governance:candidate.governance || null
    };
  }

  function downloadApprovalRecord(){
    try { downloadJson(currentApprovalRecord(), `${baseName()}-approval-record.json`); }
    catch(error) { alertUser(error.message,'warning'); }
  }

  function downloadApprovalHistoryCsv(){
    const candidate = getApprovalCandidateArtifact();
    if (!candidate) return alertUser('Train or load a model first.','warning');
    const approval = global.LRSApproval.normalizeApproval(candidate.approval || collectApprovalForm());
    const rows = (approval.history || []).map(item => ({
      recorded_at:item.recordedAt || '', from_status:item.fromStatus || '', to_status:item.status || '', role:item.role || item.reviewerRole || '', reviewer:item.reviewer || '', approver:item.approver || '', review_date:item.reviewDate || '', reason:item.reason || item.note || '', application_version:item.applicationVersion || ''
    }));
    if (!rows.length) rows.push({ recorded_at:'', from_status:'', to_status:approval.status || 'draft', role:approval.reviewerRole || '', reviewer:approval.reviewer || '', approver:approval.approver || '', review_date:approval.reviewDate || '', reason:'No recorded approval-history entries yet.', application_version:'1.0.11' });
    downloadBlob(global.CSVEngine.unparse(global.LRSSecurity.protectCsvRows(rows)), `${baseName()}-approval-history.csv`, 'text/csv;charset=utf-8');
  }

  function downloadGovernanceReportJson(){
    const candidate = getApprovalCandidateArtifact();
    if(!candidate)return alertUser('Train or load a model first.','warning');
    const report={artifactType:'local-regression-governance-report',schemaVersion:1,applicationVersion:'1.0.11',generatedAt:new Date().toISOString(),experimentId:candidate.experimentId,dataset:candidate.dataset,modelType:candidate.modelType,validation:candidate.validation,approval:collectApprovalForm(),monitoring:candidate.monitoring||null,governance:candidate.governance||null,runtimeManifest:state.runtimeManifest||null};
    downloadJson(report,`${baseName()}-${shortIdentifier(candidate.experimentId)}-governance-report.json`);
  }

  function renderDataset() {
    const numeric = state.headers.filter(h => state.profiles[h].type === 'numeric').length;
    const categorical = state.headers.length - numeric;
    const fingerprintValue = state.datasetFingerprint && state.datasetFingerprint.value
      ? `${state.datasetFingerprint.value.slice(0,12)}…`
      : state.datasetFingerprint && state.datasetFingerprint.error ? 'Unavailable' : 'Calculating…';
    els.datasetSummary.innerHTML = [
      ['Rows', state.rows.length, false], ['Columns', state.headers.length, false], ['Numeric columns', numeric, false], ['Categorical columns', categorical, false], ['Dataset fingerprint', fingerprintValue, true]
    ].map(([label,value,isText]) => `<div class="summary-item"><strong${label === 'Dataset fingerprint' ? ' title="SHA-256 dataset fingerprint"' : ''}>${isText ? escapeHtml(value) : formatNumber(value)}</strong><span>${label}</span></div>`).join('');
    els.datasetSummary.classList.remove('hidden');
    const preview = state.rows.slice(0, 12);
    els.previewTable.innerHTML = `<thead><tr>${state.headers.map(h => `<th data-i18n-skip="true">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${preview.map(row => `<tr>${state.headers.map(h => `<td data-i18n-skip="true">${escapeHtml(shortValue(row[h]))}</td>`).join('')}</tr>`).join('')}</tbody>`;
    els.previewWrap.classList.remove('hidden');
  }

  function populateColumnControls() {
    const numericHeaders = state.headers.filter(h => state.profiles[h].type === 'numeric');
    els.targetColumn.innerHTML = `<option value="">Choose target…</option>${numericHeaders.map(h => `<option data-i18n-skip="true" value="${escapeAttr(h)}">${escapeHtml(h)}</option>`).join('')}`;
    populateSelect(els.diagnosticSource, state.headers, 'No source grouping');
    populateSelect(els.validationGroup, state.headers, 'No group requirement', els.validationGroup.value);
    renderFeatureList(); renderSplitControls();
  }

  function populateSelect(select, values, blankLabel, selected) {
    select.innerHTML = `${blankLabel != null ? `<option value="">${escapeHtml(blankLabel)}</option>` : ''}${values.map(v => `<option data-i18n-skip="true" value="${escapeAttr(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('')}`;
  }

  function renderFeatureList() {
    const filter = els.featureSearch.value.trim().toLowerCase();
    const visible = state.headers.filter(h => h !== state.target && (!filter || h.toLowerCase().includes(filter)));
    els.featureList.innerHTML = visible.map(name => {
      const p = state.profiles[name] || {}; const checked = state.selectedFeatures.has(name);
      return `<label class="feature-option"><input type="checkbox" data-feature="${escapeAttr(name)}" ${checked ? 'checked' : ''}><span data-i18n-skip="true">${escapeHtml(name)}</span><span class="meta">${escapeHtml(p.type || '')} · ${formatNumber(p.unique || 0)} unique${p.idLike ? ' · ID-like' : ''}</span></label>`;
    }).join('') || '<p class="fine-print">No columns match the filter.</p>';
    els.featureList.querySelectorAll('input[data-feature]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) state.selectedFeatures.add(input.dataset.feature); else state.selectedFeatures.delete(input.dataset.feature);
      updateFeatureCount(); estimatePreprocessing(); renderDataQuality(); unlockWorkflow();
    }));
    updateFeatureCount();
  }

  function autoSelectFeatures() {
    if (!state.target) return alertUser('Choose a target column first.', 'warning');
    state.selectedFeatures = new Set(MLCore.autoSelectFeatures(state.headers, state.target, state.profiles));
    renderFeatureList(); estimatePreprocessing(); unlockWorkflow();
  }

  function updateFeatureCount() { els.featureCount.textContent = `${state.selectedFeatures.size} selected`; }

  function updateTransformHelp() {
    const messages = {
      none:'No target transformation. Metrics and predictions remain on the original scale.',
      log:'Natural log requires strictly positive target values. Original-scale point predictions use a training-based smearing correction.',
      log10:'Log base 10 requires strictly positive target values. Original-scale point predictions use a training-based smearing correction.',
      sqrt:'Square root requires non-negative target values.',
      boxcox:'Box–Cox requires strictly positive target values. Lambda is estimated from the training set only.',
      yeojohnson:'Yeo–Johnson supports negative, zero and positive values. Lambda is estimated from the training set only.'
    };
    els.targetTransformHelp.textContent = `${messages[els.targetTransform.value]} Predictions and intervals are converted back to the original target scale.`;
  }

  function getPreprocessConfig() {
    return {
      numericMissing: els.numericMissing.value, numericScaling: els.numericScaling.value,
      categoricalMissing: els.categoricalMissing.value, categoricalEncoding: els.categoricalEncoding.value,
      maxCategories: Number(els.maxCategories.value) || 50, dropFirstCategory: els.dropFirstCategory.checked
    };
  }

  function estimatePreprocessing() {
    if (!state.rows.length || !state.target || !state.selectedFeatures.size) {
      els.preprocessEstimate.textContent = 'Select a target and at least one feature to estimate the processed feature count.'; return;
    }
    try {
      const sample = state.rows.slice(0, Math.min(5000, state.rows.length));
      const pre = MLCore.fitPreprocessor(sample, Array.from(state.selectedFeatures), getPreprocessConfig(), state.profiles);
      const references = pre.features.filter(f => f.baseline).map(f => `${f.name}: ${f.baseline}`);
      els.preprocessEstimate.innerHTML = `Estimated processed features: <strong>${formatNumber(pre.outputNames.length)}</strong>.${references.length ? ` Reference categories: ${escapeHtml(references.join('; '))}.` : ''}`;
    } catch (error) { els.preprocessEstimate.textContent = error.message; }
  }

  function getModelType() { const checked = document.querySelector('input[name="modelType"]:checked'); return checked ? checked.value : 'linear'; }
  function numericField(id, label, value, min, max, step, className = '') {
    return `<label class="${escapeAttr(className)}">${escapeHtml(label)}<input id="${id}" type="number" value="${value}"${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''}${step != null ? ` step="${step}"` : ''}></label>`;
  }
  function selectField(id, label, value, options, className = '') {
    return `<label class="${escapeAttr(className)}">${escapeHtml(label)}<select id="${id}">${options.map(([v,t]) => `<option value="${v}"${v === value ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>`;
  }
  function rangeRow(name, label, min, max, count, spacing, type, className = '') {
    const grid = els.tuningMode.value === 'grid';
    return `<section class="tuning-range-card ${escapeAttr(className)}" data-range-name="${escapeAttr(name)}">
      <h4>${escapeHtml(label)}</h4>
      <div class="tuning-range-controls ${grid ? 'grid-layout' : 'random-layout'}">
        <label>Minimum<input id="range_${name}_min" type="number" value="${min}" step="any"></label>
        <label>Maximum<input id="range_${name}_max" type="number" value="${max}" step="any"></label>
        <label class="${grid ? '' : 'hidden'}">Grid points<input id="range_${name}_count" type="number" min="2" max="20" value="${count}"></label>
        <label>Spacing<select id="range_${name}_spacing"><option value="linear"${spacing === 'linear' ? ' selected' : ''}>Linear</option><option value="log"${spacing === 'log' ? ' selected' : ''}>Logarithmic</option></select><input id="range_${name}_type" type="hidden" value="${type}"></label>
      </div>
    </section>`;
  }

  function renderModelParams() {
    const type = getModelType(), tuning = els.tuningMode.value;
    els.searchTrialsLabel.classList.toggle('hidden', tuning === 'manual' || tuning === 'grid' || type === 'linear');
    let manual = '', ranges = '';
    if (type === 'linear') manual = '<p class="fine-print">Linear regression has no model hyperparameters.</p>';
    if (type === 'ridge') {
      manual = `<div class="form-grid three">${numericField('lambda','Ridge strength (lambda)',1,0,null,'any')}</div>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('lambda','Ridge strength',0.001,100,8,'log','continuous')}</div>`;
    }
    if (type === 'elasticnet') {
      manual = `<div class="form-grid four">${numericField('elasticLambda','Overall penalty (lambda)',0.1,0,null,'any')}${numericField('elasticL1Ratio','L1 mixing ratio',0.5,0,1,0.05)}${numericField('elasticIterations','Maximum coordinate-descent iterations',500,10,5000,10)}${numericField('elasticTolerance','Convergence tolerance',0.000001,0.0000000001,1,'any')}</div><p class="fine-print">L1 ratio 0 behaves like ridge; L1 ratio 1 behaves like lasso. Standardised numeric features are recommended.</p>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('lambda','Overall penalty',0.0001,10,7,'log','continuous')}${rangeRow('l1Ratio','L1 mixing ratio',0,1,6,'linear','continuous')}</div>`;
    }
    if (type === 'robust') {
      manual = `<div class="form-grid four">${numericField('robustDelta','Huber threshold',1.345,0.2,10,0.05)}${numericField('robustIterations','Maximum IRLS iterations',80,5,500,5)}${numericField('robustTolerance','Convergence tolerance',0.000001,0.0000000001,1,'any')}${numericField('robustRidge','Numerical ridge stabiliser',0.00000001,0,1,'any')}</div><p class="fine-print">Smaller Huber thresholds downweight moderate residuals more strongly; larger values approach ordinary least squares.</p>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('huberDelta','Huber threshold',0.8,3,6,'linear','continuous')}${rangeRow('ridge','Numerical ridge stabiliser',0.00000001,0.01,5,'log','continuous')}</div>`;
    }
    if (type === 'tree') {
      manual = `<div class="form-grid four">${numericField('maxDepth','Maximum depth',8,1,30,1)}${numericField('minLeaf','Minimum rows per leaf',5,2,100,1)}${numericField('maxThresholds','Candidate thresholds per feature',24,4,64,1)}${selectField('maxFeatures','Features considered per split','all',[['all','All'],['sqrt','Square root'],['log2','Log2']])}</div>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('maxDepth','Maximum depth',3,15,5,'linear','integer')}${rangeRow('minLeaf','Minimum rows per leaf',2,30,5,'linear','integer')}</div>`;
    }
    if (type === 'forest') {
      manual = `<div class="form-grid four">${numericField('nTrees','Number of trees',40,5,160,1)}${numericField('maxDepth','Maximum depth',8,1,30,1)}${numericField('minLeaf','Minimum rows per leaf',5,2,100,1)}${numericField('sampleRate','Row sampling fraction',0.8,0.3,1,0.05)}${numericField('maxThresholds','Candidate thresholds per feature',20,4,64,1)}${selectField('maxFeatures','Features considered per split','sqrt',[['all','All'],['sqrt','Square root'],['log2','Log2']])}</div>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('nTrees','Number of trees',10,100,5,'linear','integer')}${rangeRow('maxDepth','Maximum depth',4,14,4,'linear','integer')}${rangeRow('minLeaf','Minimum rows per leaf',2,20,4,'linear','integer')}${rangeRow('sampleRate','Row sampling fraction',0.5,1,4,'linear','continuous')}</div>`;
    }
    if (type === 'gboost') {
      manual = `<div class="form-grid four">${numericField('gbEstimators','Boosting stages',80,5,300,1)}${numericField('gbLearningRate','Boosting learning rate',0.05,0.001,1,'any')}${numericField('gbMaxDepth','Tree depth per stage',3,1,8,1)}${numericField('gbMinLeaf','Minimum rows per leaf',5,2,100,1)}${numericField('gbSampleRate','Row subsampling fraction',0.8,0.3,1,0.05)}${numericField('gbThresholds','Candidate thresholds per feature',20,4,64,1)}</div><p class="fine-print">More stages with a smaller learning rate usually produce a smoother, slower fit. Use validation loss to detect overfitting.</p>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('nEstimators','Boosting stages',30,180,6,'linear','integer')}${rangeRow('learningRate','Boosting learning rate',0.01,0.2,6,'log','continuous')}${rangeRow('maxDepth','Tree depth per stage',1,5,5,'linear','integer')}${rangeRow('minLeaf','Minimum rows per leaf',2,20,4,'linear','integer')}${rangeRow('sampleRate','Row subsampling fraction',0.5,1,4,'linear','continuous')}</div>`;
    }
    if (type === 'knn') {
      manual = `<div class="form-grid four">${numericField('knnK','Number of neighbours (k)',7,1,500,1)}${selectField('knnWeighting','Neighbour weighting','distance',[['distance','Inverse distance'],['uniform','Uniform']])}${selectField('knnDistancePower','Distance metric','2',[['2','Euclidean (L2)'],['1','Manhattan (L1)']])}${numericField('knnMaxRows','Maximum stored training rows',25000,100,100000,100)}</div><p class="fine-print">Numeric scaling is strongly recommended because distance is calculated in processed feature space. Prediction time grows with stored training rows.</p>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('k','Number of neighbours',2,40,8,'linear','integer')}</div>`;
    }
    if (type === 'quantile') {
      manual = `<div class="form-grid four">${numericField('quantileCentral','Central quantile',0.5,0.01,0.99,0.01)}${numericField('quantileIterations','Iterations per fitted quantile',1500,100,10000,100)}${numericField('quantileLearningRate','Optimisation learning rate',0.03,0.00001,1,'any')}${numericField('quantileL2','L2 regularisation',0.0001,0,1,'any')}</div><p class="fine-print">The lower and upper quantiles are set automatically from the requested interval coverage during final fitting. This model estimates conditional linear quantiles rather than a conditional mean.</p>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('learningRate','Optimisation learning rate',0.001,0.1,6,'log','continuous')}${rangeRow('l2','L2 regularisation',0.000001,0.01,5,'log','continuous')}</div>`;
    }
    if (type === 'gp') {
      manual = `<div class="form-grid four">
        ${selectField('gpMode','GP training mode','exact',[['exact','Exact GP'],['subset','Representative-subset GP'],['auto','Automatically optimise subset size']],'gp-always')}
        ${selectField('gpKernel','Kernel','rbf',[['rbf','RBF / squared exponential'],['matern32','Matérn 3/2'],['matern52','Matérn 5/2'],['rq','Rational quadratic'],['linear','Linear kernel']],'gp-always')}
        ${numericField('gpLengthScale','Length scale',1,0.000001,null,'any','gp-kernel-length')}
        ${numericField('gpSignalVariance','Signal variance',1,0.000001,null,'any','gp-always')}
        ${numericField('gpNoiseStd','Observation-noise standard deviation',0.1,0.000001,null,'any','gp-always')}
        ${numericField('gpJitter','Numerical jitter',0.00000001,0.000000000001,null,'any','gp-always')}
        ${numericField('gpOptimizeIterations','Stochastic kernel-search iterations',8,0,30,1,'gp-always')}
        <p class="fine-print gp-always">Uses seeded random multiplicative proposals and keeps changes that reduce negative log marginal likelihood. It does not use gradients, so no learning rate is required.</p>
        ${numericField('gpRqAlpha','Rational-quadratic alpha',1,0.0001,null,'any','gp-kernel-rq')}
        ${numericField('gpSubsetSize','Representative subset size',500,20,2000,1,'gp-mode-subset')}
        ${selectField('gpSubsetMethod','Subset selection','farthest',[['farthest','Farthest-point sampling'],['kmeanspp','K-means++ representative sampling'],['random','Random sampling']],'gp-mode-subset-or-auto')}
        ${numericField('gpAutoSubsetMin','Automatic subset minimum',100,20,2000,1,'gp-mode-auto')}
        ${numericField('gpAutoSubsetMax','Automatic subset maximum',1000,20,2000,1,'gp-mode-auto')}
        ${numericField('gpAutoSubsetCount','Subset sizes evaluated',5,2,8,1,'gp-mode-auto')}
        ${numericField('gpSubsetTolerance','Validation tolerance for smaller subset',0.01,0,0.25,0.005,'gp-mode-auto')}
      </div><div id="gpWorkload" class="info-box model-workload"></div>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('lengthScale','Length scale',0.1,10,6,'log','continuous','gp-range-length')}${rangeRow('signalVariance','Signal variance',0.1,10,5,'log','continuous','gp-range-always')}${rangeRow('noiseStd','Observation-noise standard deviation',0.001,1,6,'log','continuous','gp-range-always')}${rangeRow('rqAlpha','Rational-quadratic alpha',0.1,10,5,'log','continuous','gp-range-rq')}</div>`;
    }
    if (type === 'ann') {
      manual = `<div class="form-grid four">
        ${numericField('annHidden1','Hidden layer 1 neurons',64,1,512,1)}
        ${numericField('annHidden2','Hidden layer 2 neurons',32,0,512,1)}
        ${numericField('annHidden3','Hidden layer 3 neurons',0,0,512,1)}
        ${selectField('annActivation','Activation function','relu',[['relu','ReLU'],['leakyRelu','Leaky ReLU'],['tanh','Tanh'],['sigmoid','Sigmoid']])}
        ${selectField('annOptimizer','Optimiser','adam',[['adam','Adam'],['sgd','Stochastic gradient descent']])}
        ${numericField('annLearningRate','Learning rate',0.001,0.000001,1,'any')}
        ${numericField('annBatchSize','Batch size',32,1,2048,1)}
        ${numericField('annEpochs','Maximum epochs',150,1,1000,1)}
        ${numericField('annDropout','Dropout rate',0.1,0,0.8,0.01)}
        ${numericField('annL2','L2 regularisation',0.0001,0,1,'any')}
        ${numericField('annPatience','Early-stopping patience',20,1,200,1)}
        ${numericField('annMinDelta','Minimum validation improvement',0.00001,0,1,'any')}
        ${selectField('annUncertaintyMethod','ANN uncertainty method','mc',[['mc','Monte Carlo dropout'],['ensemble','Small deep ensemble']])}
        ${numericField('annMcPasses','Monte Carlo dropout passes',50,10,300,1)}
        ${numericField('annEnsembleSize','Ensemble members',3,2,7,1)}
      </div><div id="annWorkload" class="info-box model-workload"></div>`;
      if (tuning !== 'manual') ranges = `<div class="tuning-range-list">${rangeRow('hidden1','Hidden layer 1 neurons',16,128,5,'linear','integer')}${rangeRow('hidden2','Hidden layer 2 neurons',0,64,4,'linear','integer')}${rangeRow('hidden3','Hidden layer 3 neurons',0,32,3,'linear','integer')}${rangeRow('learningRate','Learning rate',0.0001,0.01,6,'log','continuous')}${rangeRow('dropout','Dropout rate',0,0.4,5,'linear','continuous')}${rangeRow('l2','L2 regularisation',0.000001,0.01,5,'log','continuous')}</div>`;
    }
    els.modelParams.innerHTML = `${manual}${ranges}`;
    els.modelParams.querySelectorAll('input,select').forEach(input => input.addEventListener('input', () => { updateSearchSummary(); updateAdvancedWorkload(); }));
    if (type === 'gp') {
      $('gpMode').addEventListener('change', updateGpControlVisibility);
      $('gpKernel').addEventListener('change', updateGpControlVisibility);
      updateGpControlVisibility();
    }
    if (type === 'ann') {
      const enforceLayerOrder = () => {
        const hidden2 = Number($('annHidden2').value) || 0;
        const hidden3 = $('annHidden3');
        hidden3.disabled = hidden2 <= 0;
        if (hidden2 <= 0 && Number(hidden3.value) > 0) hidden3.value = 0;
        updateAdvancedWorkload(); updateSearchSummary();
      };
      $('annHidden2').addEventListener('input', enforceLayerOrder);
      enforceLayerOrder();
    }
    updateAdvancedWorkload(); updateSearchSummary();
  }

  function setVisible(selector, visible) {
    els.modelParams.querySelectorAll(selector).forEach(element => element.classList.toggle('hidden', !visible));
  }

  function updateGpControlVisibility() {
    if (getModelType() !== 'gp' || !$('gpMode') || !$('gpKernel')) return;
    const mode = $('gpMode').value, kernel = $('gpKernel').value;
    setVisible('.gp-kernel-length', kernel !== 'linear');
    setVisible('.gp-kernel-rq', kernel === 'rq');
    setVisible('.gp-mode-subset', mode === 'subset');
    setVisible('.gp-mode-subset-or-auto', mode === 'subset' || mode === 'auto');
    setVisible('.gp-mode-auto', mode === 'auto');
    setVisible('.gp-range-length', kernel !== 'linear');
    setVisible('.gp-range-rq', kernel === 'rq');
    updateAdvancedWorkload(); updateSearchSummary();
  }

  function getModelParameters() {
    const type = getModelType();
    if (type === 'linear') return {};
    if (type === 'ridge') return { lambda: Number($('lambda').value) || 1 };
    if (type === 'elasticnet') return { lambda:Number.isFinite(Number($('elasticLambda').value)) ? Number($('elasticLambda').value) : 0.1, l1Ratio:Number($('elasticL1Ratio').value), maxIterations:Number($('elasticIterations').value)||500, tolerance:Number($('elasticTolerance').value)||1e-6 };
    if (type === 'robust') return { huberDelta:Number($('robustDelta').value)||1.345, maxIterations:Number($('robustIterations').value)||80, tolerance:Number($('robustTolerance').value)||1e-6, ridge:Number.isFinite(Number($('robustRidge').value)) ? Number($('robustRidge').value) : 1e-8 };
    if (type === 'gboost') return { nEstimators:Number($('gbEstimators').value)||80, learningRate:Number($('gbLearningRate').value)||0.05, maxDepth:Number($('gbMaxDepth').value)||3, minLeaf:Number($('gbMinLeaf').value)||5, sampleRate:Number($('gbSampleRate').value)||0.8, maxThresholds:Number($('gbThresholds').value)||20 };
    if (type === 'knn') return { k:Number($('knnK').value)||7, weighting:$('knnWeighting').value, distancePower:Number($('knnDistancePower').value)||2, maxRows:Number($('knnMaxRows').value)||25000 };
    if (type === 'quantile') return { quantile:Number($('quantileCentral').value)||0.5, lowerQuantile:0.025, upperQuantile:0.975, iterations:Number($('quantileIterations').value)||1500, learningRate:Number($('quantileLearningRate').value)||0.03, l2:Number.isFinite(Number($('quantileL2').value)) ? Number($('quantileL2').value) : 0.0001 };
    if (type === 'gp') return {
      gpMode:$('gpMode').value, kernel:$('gpKernel').value,
      lengthScale:Number($('gpLengthScale').value)||1, signalVariance:Number($('gpSignalVariance').value)||1,
      noiseStd:Number($('gpNoiseStd').value)||0.1, jitter:Number($('gpJitter').value)||1e-8,
      optimizeIterations:Number($('gpOptimizeIterations').value)||0, rqAlpha:Number($('gpRqAlpha').value)||1,
      subsetSize:Number($('gpSubsetSize').value)||500, subsetMethod:$('gpSubsetMethod').value,
      autoSubsetMin:Number($('gpAutoSubsetMin').value)||100, autoSubsetMax:Number($('gpAutoSubsetMax').value)||1000,
      autoSubsetCount:Number($('gpAutoSubsetCount').value)||5, subsetTolerance:Number($('gpSubsetTolerance').value)||0.01,
      gpHardLimit:2000
    };
    if (type === 'ann') return {
      hidden1:Number($('annHidden1').value)||64, hidden2:Number($('annHidden2').value)||0, hidden3:Number($('annHidden3').value)||0,
      activation:$('annActivation').value, optimizer:$('annOptimizer').value,
      learningRate:Number($('annLearningRate').value)||0.001, batchSize:Number($('annBatchSize').value)||32,
      epochs:Number($('annEpochs').value)||150, dropout:Number($('annDropout').value)||0,
      l2:Number($('annL2').value)||0, patience:Number($('annPatience').value)||20,
      minDelta:Number($('annMinDelta').value)||1e-5, earlyStopping:true,
      uncertaintyMethod:$('annUncertaintyMethod').value, mcPasses:Number($('annMcPasses').value)||50,
      ensembleSize:Number($('annEnsembleSize').value)||3, annHardLimit:1000000
    };
    const common = { maxDepth:Number($('maxDepth').value)||8, minLeaf:Number($('minLeaf').value)||5, maxThresholds:Number($('maxThresholds').value)||24, maxFeatures:$('maxFeatures').value };
    if (type === 'tree') return common;
    return { ...common, nTrees:Number($('nTrees').value)||40, sampleRate:Number($('sampleRate').value)||0.8, maxRowsPerTree:20000 };
  }

  function getTuningConfig() {
    const type = getModelType(), mode = els.tuningMode.value, ranges = {};
    let names = type === 'ridge' ? ['lambda'] : type === 'elasticnet' ? ['lambda','l1Ratio'] : type === 'robust' ? ['huberDelta','ridge'] : type === 'tree' ? ['maxDepth','minLeaf'] : type === 'forest' ? ['nTrees','maxDepth','minLeaf','sampleRate'] : type === 'gboost' ? ['nEstimators','learningRate','maxDepth','minLeaf','sampleRate'] : type === 'knn' ? ['k'] : type === 'quantile' ? ['learningRate','l2'] : type === 'ann' ? ['hidden1','hidden2','hidden3','learningRate','dropout','l2'] : [];
    if (type === 'gp') {
      const kernel = $('gpKernel') ? $('gpKernel').value : 'rbf';
      names = ['signalVariance','noiseStd'];
      if (kernel !== 'linear') names.unshift('lengthScale');
      if (kernel === 'rq') names.push('rqAlpha');
    }
    if (mode !== 'manual') for (const name of names) {
      const minEl = $(`range_${name}_min`), maxEl = $(`range_${name}_max`), countEl = $(`range_${name}_count`), spacingEl = $(`range_${name}_spacing`), typeEl = $(`range_${name}_type`);
      if (minEl) ranges[name] = { min:Number(minEl.value), max:Number(maxEl.value), count:countEl ? Number(countEl.value) : 3, spacing:spacingEl.value, type:typeEl.value };
    }
    return { mode, trials:Number(els.searchTrials.value)||12, ranges };
  }

  function updateAdvancedWorkload() {
    const type=getModelType();
    if(type==='ann' && $('annWorkload')) {
      let inputCount=state.artifact?.preprocessor?.outputNames?.length || 0;
      if(!inputCount && state.rows.length && state.target && state.selectedFeatures.size) {
        try { inputCount=MLCore.fitPreprocessor(state.rows.slice(0,Math.min(5000,state.rows.length)),Array.from(state.selectedFeatures),getPreprocessConfig(),state.profiles).outputNames.length; } catch (_) {}
      }
      const hidden=[Number($('annHidden1')?.value)||64,Number($('annHidden2')?.value)||0,Number($('annHidden3')?.value)||0].filter(v=>v>0);
      const count=inputCount && MLCore.annParameterCount ? MLCore.annParameterCount(inputCount,hidden) : 0;
      let message=count ? `<strong>${formatNumber(count)} trainable parameters</strong>` : '<strong>ANN size estimate unavailable until features are selected.</strong>';
      const deviceMemory=Number(navigator.deviceMemory)||0, mobile=matchMedia('(max-width: 760px)').matches;
      if(count>1000000)message+=' Training is blocked above 1,000,000 parameters.';
      else if(count>500000)message+=' Very large browser workload; reduce layer sizes.';
      else if(count>250000)message+=' Large model: desktop use only and tuning may be slow.';
      else if(count>50000)message+=' Medium model suitable for most desktops.';
      else if(count)message+=' Small model suitable for ordinary tabular data.';
      if(count && (mobile || (deviceMemory && deviceMemory<=4)) && count>100000) message+=' This device appears memory-constrained; keep the network below about 100,000 parameters.';
      $('annWorkload').innerHTML=message;
    }
    if(type==='gp' && $('gpWorkload')) {
      const rows=state.lastSplit?.training?.length || state.rows.length || 0;
      const mode=$('gpMode')?.value || 'exact', deviceMemory=Number(navigator.deviceMemory)||0;
      const matrixInfo = n => n ? `${formatNumber(n)} × ${formatNumber(n)} · approximately ${(n*n*8/1024/1024).toFixed(1)} MB per dense matrix before working copies` : 'unknown until data are loaded';
      if (mode === 'exact') {
        const used=rows;
        $('gpWorkload').innerHTML=`<strong>Exact GP covariance matrix: ${matrixInfo(used)}</strong>${used>1000?' Consider representative-subset mode for responsive browser training.':''}${deviceMemory && deviceMemory<=4 && used>600?' This device appears memory-constrained; use a representative subset.':''}`;
      } else if (mode === 'subset') {
        const subset=Math.min(rows || Infinity, Math.max(20,Number($('gpSubsetSize')?.value)||500));
        $('gpWorkload').innerHTML=`<strong>Representative-subset covariance matrix: ${matrixInfo(Number.isFinite(subset)?subset:0)}</strong>${deviceMemory && deviceMemory<=4 && subset>600?' This device appears memory-constrained; use a smaller subset.':''}`;
      } else {
        const min=Math.max(20,Number($('gpAutoSubsetMin')?.value)||100), max=Math.max(20,Number($('gpAutoSubsetMax')?.value)||1000), count=Math.max(2,Number($('gpAutoSubsetCount')?.value)||5);
        if (min > max) {
          $('gpWorkload').innerHTML='<strong>Automatic subset range is invalid.</strong> Minimum subset size must not exceed maximum subset size.';
        } else {
          const cappedMax=rows ? Math.min(rows,max) : max, cappedMin=rows ? Math.min(rows,min) : min;
          $('gpWorkload').innerHTML=`<strong>Automatic subset candidates: ${formatNumber(cappedMin)} to ${formatNumber(cappedMax)} rows across ${formatNumber(count)} sizes</strong>Largest covariance matrix: ${matrixInfo(cappedMax)}.${deviceMemory && deviceMemory<=4 && cappedMax>600?' This device appears memory-constrained; lower the automatic maximum.':''}`;
        }
      }
    }
  }

  function updateSearchSummary() {
    try {
      const mode = els.tuningMode.value, type = getModelType();
      const gpAuto = type === 'gp' && getModelParameters().gpMode === 'auto';
      if ((mode === 'manual' && !gpAuto) || type === 'linear') { els.searchSummary.textContent = 'Manual configuration selected. The validation set is not used to choose hyperparameters.'; return; }
      const tuningConfig = getTuningConfig();
      const candidates = MLCore.candidateParams(type, mode, getModelParameters(), tuningConfig, Number(els.randomSeed.value)||42);
      const wording = gpAuto && mode === 'manual' ? 'candidate subset sizes' : mode === 'grid' ? 'grid configurations' : mode === 'lhs' ? 'unique Latin hypercube configurations' : 'unique ordinary-random configurations';
      let details = '';
      if (mode === 'grid') {
        const fullGrid = Object.values(tuningConfig.ranges || {}).reduce((product, spec) => product * MLCore.axisValues(spec).length, 1);
        details = ` Full grid combinations: ${formatNumber(fullGrid)}. Configurations evaluated: ${formatNumber(candidates.length)}.${fullGrid > candidates.length ? ' The capped configurations are spread across the full grid.' : ''}`;
      } else if (mode === 'random' || mode === 'lhs') {
        details = ` Requested samples: ${formatNumber(tuningConfig.trials)}. Unique valid configurations: ${formatNumber(candidates.length)}.`;
      }
      els.searchSummary.innerHTML = `<strong>${candidates.length}</strong> ${wording} will be evaluated on the validation set.${details}`;
    } catch (error) { els.searchSummary.textContent = error.message; }
  }

  function updateUncertaintyControls() {
    const ridge = getModelType() === 'ridge';
    els.bootstrapSamplesLabel.classList.toggle('hidden', !ridge);
  }

  function percentageControls(prefix) {
    return `<div class="form-grid three">
      <label>Training percentage<input id="${prefix}TrainPct" type="number" min="1" max="98" value="60"></label>
      <label>Validation percentage<input id="${prefix}ValidationPct" type="number" min="1" max="98" value="20"></label>
      <label>Test percentage<input id="${prefix}TestPct" type="number" min="1" max="98" value="20"></label>
    </div>`;
  }

  function columnOptions(preferCategorical) {
    const headers = preferCategorical ? state.headers.slice().sort((a,b) => (state.profiles[a]?.type === 'categorical' ? -1 : 1) - (state.profiles[b]?.type === 'categorical' ? -1 : 1)) : state.headers;
    return `<option value="">Choose column…</option>${headers.map(h => `<option data-i18n-skip="true" value="${escapeAttr(h)}">${escapeHtml(h)}</option>`).join('')}`;
  }

  function assignmentControls(column, prefix, noun) {
    if (!column || !state.rows.length) return `<div class="info-box">Choose a ${escapeHtml(noun.toLowerCase())} column to assign held-out values.</div>`;
    const values = Array.from(new Set(state.rows.map(row => String(row[column])))).sort((a,b)=>a.localeCompare(b)).slice(0,500);
    const options = values.map(v => `<option data-i18n-skip="true" value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
    return `<div class="assignment-grid">
      <label>Validation ${escapeHtml(noun.toLowerCase())} values<select id="${prefix}ValidationValues" multiple>${options}</select><small>Hold Ctrl/Cmd to select more than one.</small></label>
      <label>Test ${escapeHtml(noun.toLowerCase())} values<select id="${prefix}TestValues" multiple>${options}</select><small>All unselected values go to training automatically.</small></label>
    </div>`;
  }

  function renderSplitControls() {
    const strategy = els.splitStrategy.value;
    if (strategy === 'random') els.splitControls.innerHTML = `<h3>Naive random split</h3>${percentageControls('random')}`;
    if (strategy === 'source') els.splitControls.innerHTML = `<h3>Metadata/source-grouped split</h3><div class="form-grid two"><label>Source column<select id="sourceColumn">${columnOptions(true)}</select></label></div><div id="sourceAssignments"></div>`;
    if (strategy === 'regime') els.splitControls.innerHTML = `<h3>Regime-aware split</h3><div class="form-grid two"><label>Regime column<select id="regimeColumn">${columnOptions(true)}</select></label><label>Regime split mode<select id="regimeMode"><option value="proportional">Proportional split within each regime</option><option value="heldout">Hold out complete regimes</option></select></label></div><div id="regimeDetails">${percentageControls('regime')}</div>`;
    if (strategy === 'time') els.splitControls.innerHTML = `<h3>Time-based split</h3><div class="form-grid two"><label>Time or sequence column<select id="timeColumn">${columnOptions(false)}</select></label><label>Sort direction<select id="timeDirection"><option value="ascending">Earliest/lowest first</option><option value="descending">Latest/highest first</option></select></label></div>${percentageControls('time')}`;
    const sourceColumn = $('sourceColumn'); if (sourceColumn) sourceColumn.addEventListener('change', () => { $('sourceAssignments').innerHTML = assignmentControls(sourceColumn.value,'source','Source'); });
    const regimeColumn = $('regimeColumn'), regimeMode = $('regimeMode');
    if (regimeColumn && regimeMode) {
      const update = () => { $('regimeDetails').innerHTML = regimeMode.value === 'heldout' ? assignmentControls(regimeColumn.value,'regime','Regime') : percentageControls('regime'); };
      regimeColumn.addEventListener('change', update); regimeMode.addEventListener('change', update);
    }
    els.splitControls.querySelectorAll('input,select').forEach(el => el.addEventListener('change', () => { els.splitPreview.textContent = 'Split settings changed. Select “Preview split” to inspect the new assignment.'; }));
  }

  function selectedValues(select) { return select ? Array.from(select.selectedOptions).map(o => o.value) : []; }
  function percentages(prefix) { return { training:Number($(`${prefix}TrainPct`).value), validation:Number($(`${prefix}ValidationPct`).value), test:Number($(`${prefix}TestPct`).value) }; }

  function getSplitConfig() {
    const strategy = els.splitStrategy.value, config = { strategy, seed:Number(els.randomSeed.value)||42 };
    if (strategy === 'random') config.percentages = percentages('random');
    if (strategy === 'source') {
      config.sourceColumn = $('sourceColumn').value; config.validationValues = selectedValues($('sourceValidationValues')); config.testValues = selectedValues($('sourceTestValues'));
    }
    if (strategy === 'regime') {
      config.regimeColumn = $('regimeColumn').value; config.regimeMode = $('regimeMode').value;
      if (config.regimeMode === 'heldout') { config.validationValues = selectedValues($('regimeValidationValues')); config.testValues = selectedValues($('regimeTestValues')); }
      else config.percentages = percentages('regime');
    }
    if (strategy === 'time') { config.timeColumn = $('timeColumn').value; config.timeDirection = $('timeDirection').value; config.percentages = percentages('time'); }
    return config;
  }

  function splitSummaryHtml(split, config) {
    const total = split.training.length + split.validation.length + split.test.length;
    const cards = [['Training',split.training.length],['Validation',split.validation.length],['Test',split.test.length]].map(([name,n]) => `<div class="summary-item"><strong>${formatNumber(n)}</strong><span>${name} (${(100*n/total).toFixed(1)}%)</span></div>`).join('');
    let extra = '';
    const groupColumn = config.strategy === 'source' ? config.sourceColumn : config.strategy === 'regime' ? config.regimeColumn : null;
    if (groupColumn) extra = `<p><strong>${escapeHtml(groupColumn)}:</strong> ${['training','validation','test'].map(key => `${key} ${new Set(split[key].map(e=>String(e.row[groupColumn]))).size} unique`).join(' · ')}</p>`;
    if (config.strategy === 'time' && config.timeColumn) extra = `<p><strong>${escapeHtml(config.timeColumn)}:</strong> ordered ${escapeHtml(config.timeDirection)} with no shuffling.</p>`;
    return `<div class="summary-grid">${cards}</div>${extra}`;
  }

  function previewSplit() {
    try {
      validateBasicInputs(); const config = getSplitConfig(), split = MLCore.splitRows(state.rows, state.target, config); state.lastSplit = split;
      els.splitPreview.innerHTML = splitSummaryHtml(split, config); return split;
    } catch (error) { alertUser(error.message, 'error'); els.splitPreview.textContent = error.message; return null; }
  }

  function validateBasicInputs() {
    if (!state.rows.length) throw new Error('Upload a CSV first.');
    if (!state.target) throw new Error('Choose a target column.');
    if (!state.selectedFeatures.size) throw new Error('Choose at least one input feature.');
    if (state.selectedFeatures.has(state.target)) throw new Error('The target column cannot also be an input feature.');
  }

  function ensureTransformedSets(sets) {
    for (const [name, set] of Object.entries(sets)) if (!set.X.length) throw new Error(`No ${name} rows remain after preprocessing. Adjust the missing-value rules or split.`);
  }

  async function trainAndEvaluate(options = {}) {
    const batchMode = Boolean(options.batchMode);
    const manageLock = options.manageLock !== false;
    if (!batchMode) clearAlerts();
    if (!batchMode) state.cancelled = false;
    if (manageLock) lockTraining(true);
    state.plotMap = batchMode ? state.plotMap : {};
    let jobHandle = null;
    let completedArtifact = null;
    const isCancelled = () => state.cancelled || Boolean(jobHandle && jobHandle.isCancellationRequested());
    const reportProgress = (value, message) => {
      if (typeof options.onProgress === 'function') options.onProgress(value, message);
      else setProgress(value, message);
    };
    try {
      validateBasicInputs();
      const modelType = options.modelTypeOverride || getModelType();
      jobHandle = state.jobManager.start(batchMode ? 'comparison-model' : 'train-model', { modelType, fileName:state.fileName, rowCount:state.rows.length });
      state.activeJob = jobHandle;
      const datasetFingerprint = await ensureDatasetFingerprint();
      reportProgress(.02, 'Creating independent training, validation and test sets…');
      const splitConfig = getSplitConfig(), split = MLCore.splitRows(state.rows, state.target, splitConfig); state.lastSplit = split;
      els.splitPreview.innerHTML = splitSummaryHtml(split, splitConfig);
      const selectedFeatures = Array.from(state.selectedFeatures), preprocessConfig = getPreprocessConfig();
      const raw = {
        training: split.training.map(e => e.row), validation: split.validation.map(e => e.row), test: split.test.map(e => e.row)
      };
      const preprocessor = MLCore.fitPreprocessor(raw.training, selectedFeatures, preprocessConfig, state.profiles);
      if (!preprocessor.outputNames.length) throw new Error('No processed features remain. Check categorical encoding and feature selection.');
      const transformed = {
        training: MLCore.transformRows(raw.training, preprocessor, state.target, true),
        validation: MLCore.transformRows(raw.validation, preprocessor, state.target, true),
        test: MLCore.transformRows(raw.test, preprocessor, state.target, true)
      };
      ensureTransformedSets(transformed);
      const targetTransform = MLCore.fitTargetTransform(transformed.training.y, els.targetTransform.value);
      const yTransformed = {
        training: MLCore.applyTargetTransform(transformed.training.y, targetTransform),
        validation: MLCore.applyTargetTransform(transformed.validation.y, targetTransform),
        test: MLCore.applyTargetTransform(transformed.test.y, targetTransform)
      };
      const manualParams = options.manualParamsOverride || getModelParameters();
      const tuningConfig = options.tuningConfigOverride || getTuningConfig();
      const automaticSubsetSearch = modelType === 'gp' && manualParams.gpMode === 'auto';
      reportProgress(.08, (tuningConfig.mode === 'manual' && !automaticSubsetSearch) || modelType === 'linear' ? 'Using manual hyperparameters…' : 'Tuning on the validation set…');
      const tuning = await MLCore.tuneModel(
        modelType, transformed.training.X, yTransformed.training, transformed.validation.X, yTransformed.validation,
        tuningConfig.mode, manualParams, tuningConfig, Number(els.randomSeed.value)||42,
        (p,m) => reportProgress(.08 + p*.30, m), isCancelled
      );
      if (isCancelled()) throw new Error('Training cancelled.');
      reportProgress(.40, 'Fitting the selected model on training data only…');
      const uncertaintyEnabled = els.enableUncertainty.checked;
      const intervalLevel = Number(els.intervalLevel.value)||.95;
      const finalParams = { ...tuning.bestParams };
      if (modelType === 'quantile') { finalParams.lowerQuantile = Math.max(0.001,(1-intervalLevel)/2); finalParams.upperQuantile = Math.min(0.999,1-(1-intervalLevel)/2); }
      if (['tree','forest','ann','gboost'].includes(modelType)) {
        finalParams._validationX = transformed.validation.X;
        finalParams._validationY = yTransformed.validation;
      }
      if (modelType === 'ann') {
        finalParams.ensembleSize = uncertaintyEnabled && finalParams.uncertaintyMethod === 'ensemble'
          ? Math.max(2, Number(finalParams.ensembleSize) || 3) : 1;
      }
      const adapter = global.LRSPlatform.getModelAdapter(modelType);
      let model = await adapter.fit(transformed.training.X, yTransformed.training, finalParams, Number(els.randomSeed.value)||42,
        (p,m) => reportProgress(.40 + p*.18, m), isCancelled);
      MLCore.fitSmearing(targetTransform, yTransformed.training, adapter.predict(model, transformed.training.X));
      if (uncertaintyEnabled && modelType === 'ridge') {
        model = await MLCore.attachBootstrapUncertainty(model, transformed.training.X, yTransformed.training, Number(els.bootstrapSamples.value)||30, Number(els.randomSeed.value)||42,
          (p,m) => reportProgress(.58 + p*.17, m), isCancelled);
      }
      if (isCancelled()) throw new Error('Training cancelled.');
      reportProgress(.76, 'Calculating point and interval diagnostics…');
      const evaluation = {}, diagnosticData = {}; let uncertaintyMethod = 'Disabled'; let uncertaintyNote = '';
      for (const name of ['training','validation','test']) {
        const intervalResult = uncertaintyEnabled ? adapter.predictWithIntervals(model, transformed[name].X, intervalLevel) : { prediction:adapter.predict(model, transformed[name].X), lower:null, upper:null, method:'Disabled', note:'' };
        const prediction = MLCore.inverseTargetTransform(intervalResult.prediction, targetTransform, true);
        let lower = intervalResult.lower ? MLCore.inverseTargetTransform(intervalResult.lower, targetTransform, false) : null;
        let upper = intervalResult.upper ? MLCore.inverseTargetTransform(intervalResult.upper, targetTransform, false) : null;
        if (lower && upper) for (let i=0;i<prediction.length;i++) { const lo=Math.min(lower[i],upper[i],prediction[i]), hi=Math.max(lower[i],upper[i],prediction[i]); lower[i]=lo; upper[i]=hi; }
        const pointMetrics = MLCore.metrics(transformed[name].y, prediction), uncertaintyMetrics = MLCore.intervalMetrics(transformed[name].y, lower, upper, intervalLevel);
        evaluation[name] = { pointMetrics, uncertaintyMetrics };
        uncertaintyMethod = intervalResult.method; uncertaintyNote = intervalResult.note;
        diagnosticData[name] = transformed[name].rowIndices.map((rawPosition, i) => {
          const entry = split[name][rawPosition], row = entry.row;
          const features = {}; selectedFeatures.forEach(feature => { features[feature] = row[feature]; });
          const metadata = {};
          [splitConfig.sourceColumn, splitConfig.regimeColumn, splitConfig.timeColumn].filter(Boolean).forEach(column => { metadata[column] = row[column]; });
          return {
            sourceRow: entry.index + 2, rawIndex: entry.index, actual: transformed[name].y[i], prediction: prediction[i],
            residual: transformed[name].y[i] - prediction[i], lower: lower ? lower[i] : null, upper: upper ? upper[i] : null,
            covered: lower && upper ? transformed[name].y[i] >= lower[i] && transformed[name].y[i] <= upper[i] : null,
            features, metadata
          };
        });
      }
      let crossValidation = null;
      if (els.enableCV.checked && !options.skipCrossValidation) {
        reportProgress(.79, 'Running fold-safe cross-validation on training data…');
        crossValidation = await MLCore.crossValidateRaw(raw.training, state.target, selectedFeatures, preprocessConfig, state.profiles, targetTransform.type,
          modelType, { ...tuning.bestParams, ensembleSize:1, _validationX:undefined, _validationY:undefined }, Number(els.cvFolds.value)||5, Number(els.randomSeed.value)||42,
          (p,m) => reportProgress(.79 + p*.17, m), isCancelled);
      }
      if (isCancelled()) throw new Error('Training cancelled.');
      const splitSummary = Object.fromEntries(['training','validation','test'].map(name => [name, split[name].length]));
      const dataset = {
        fileName: state.fileName || null,
        rowCount: state.rows.length,
        columnCount: state.headers.length,
        fingerprint: datasetFingerprint && datasetFingerprint.value ? datasetFingerprint : null
      };
      jobHandle.complete({ modelType, testRmse:evaluation.test.pointMetrics.rmse, splitSummary });
      const storedModelParameters = { ...finalParams };
      delete storedModelParameters._validationX; delete storedModelParameters._validationY;
      const artifact = {
        artifactType:'local-regression-model', schemaVersion:global.LRSPlatform.schemas.model, appVersion:'1.0.11', createdAt:new Date().toISOString(),
        originalCsvIncluded:false, dataset, target:state.target, targetTransform, selectedFeatures, preprocessor,
        modelType, modelCapabilities:global.LRSPlatform.getModelDefinition(modelType).capabilities,
        modelParameters:storedModelParameters, model,
        tuning:{ ...tuningConfig, bestValidationRmse:tuning.bestValidationRmse, trials:tuning.trials, candidateCount:tuning.candidateCount },
        splitConfig, splitSummary, uncertainty:{ enabled:uncertaintyEnabled, level:intervalLevel, method:uncertaintyMethod, note:uncertaintyNote,
          bootstrapSamples:modelType === 'ridge' ? Number(els.bootstrapSamples.value)||30 : null,
          mcPasses:modelType === 'ann' ? Number(finalParams.mcPasses)||50 : null,
          ensembleSize:modelType === 'ann' ? Number(finalParams.ensembleSize)||1 : null },
        evaluation:{ ...evaluation, crossValidation }, diagnosticData,
        validation:{ dataQuality:global.LRSValidation.analyseDataQuality(state.rows,state.headers,state.profiles,{target:state.target,selectedFeatures}), criteria:getAcceptanceCriteria(), groupColumn:els.validationGroup.value||null, acceptance:null },
        approval:global.LRSApproval.normalizeApproval(null),
        monitoring:{records:[],latest:null,rules:null,revalidation:null},
        governance:{lifecycleStatus:'draft',changeAssessments:[],revalidationTriggers:[]},
        notice:'The original CSV is not included. Upload the original or a compatible CSV to retrain or predict.'
      };
      artifact.validation.acceptance = global.LRSValidation.evaluateAcceptance(artifact,artifact.validation.dataQuality,artifact.validation.criteria,artifact.validation.groupColumn);
      const splitMembership = Object.fromEntries(['training','validation','test'].map(name => [name, split[name].map(entry => entry.index + 2)]));
      const preliminary = global.LRSPlatform.createExperimentRecord({ artifact, dataset, splitMembership, job:jobHandle.snapshot() });
      artifact.experimentId = preliminary.experimentId;
      artifact.experimentRecord = preliminary;
      artifact.comparisonDescriptor = global.LRSComparison.comparisonDescriptor(artifact);
      artifact.comparisonKey = await global.LRSComparison.comparisonKey(artifact, global.LRSPlatform.sha256Hex);
      artifact.experimentLabel = global.LRSComparison.experimentLabel(artifact);
      const experimentRecord = global.LRSPlatform.createExperimentRecord({
        artifact, dataset, splitMembership, job:jobHandle.snapshot(), experimentId:artifact.experimentId,
        comparisonKey:artifact.comparisonKey, comparisonDescriptor:artifact.comparisonDescriptor, label:artifact.experimentLabel
      });
      artifact.experimentRecord = experimentRecord;
      state.artifact = artifact; state.approvedPackage=null; state.packageVerification=null; renderApprovedPackageSummary();
      const currentFingerprint = dataset.fingerprint && dataset.fingerprint.value;
      if (state.experiments.some(record => {
        const value = record && record.dataset && record.dataset.fingerprint && record.dataset.fingerprint.value;
        return currentFingerprint && value && value !== currentFingerprint;
      })) {
        state.experiments = [];
        state.experimentArtifacts = {};
        state.preferredExperimentId = null;
      }
      state.experiments = state.experiments.filter(record => record.experimentId !== experimentRecord.experimentId);
      state.experiments.push(experimentRecord);
      state.experimentArtifacts[experimentRecord.experimentId] = artifact;
      completedArtifact = artifact;
      populateDiagnosticControls(); renderResults(); unlockPanel('step-diagnostics'); unlockPanel('step-predict');
      reportProgress(1, 'Training and evaluation complete.');
      if (!batchMode && !options.suppressAlert) alertUser(`Model trained locally. Final test RMSE: ${formatMetric(evaluation.test.pointMetrics.rmse)}.`, 'success');
      if (!batchMode && !options.suppressScroll) $('step-diagnostics').scrollIntoView({ behavior:'smooth' });
    } catch (error) {
      if (jobHandle) {
        if (isCancelled() || error.message === 'Training cancelled.') jobHandle.cancel(error.message);
        else jobHandle.fail(error);
      }
      setStatus(error.message);
      if (!options.suppressAlert) alertUser(error.message, error.message === 'Training cancelled.' ? 'warning' : 'error');
      if (options.propagateErrors) throw error;
    } finally {
      state.activeJob = null;
      if (manageLock) lockTraining(false);
    }
    return completedArtifact;
  }


  function renderComparisonQueue(modelTypes, statuses) {
    if (!els.comparisonQueue) return;
    if (!modelTypes || !modelTypes.length) { els.comparisonQueue.classList.add('hidden'); els.comparisonQueue.innerHTML=''; return; }
    els.comparisonQueue.classList.remove('hidden');
    const rows = modelTypes.map(type => {
      const label = global.LRSPlatform.getModelDefinition(type).label;
      const item = statuses[type] || { status:'Waiting', note:'Queued' };
      const cls = item.status === 'Running' ? 'queue-status-running' : item.status === 'Completed' ? 'queue-status-completed' : item.status === 'Failed' ? 'queue-status-failed' : 'queue-status-waiting';
      return `<tr><td>${escapeHtml(label)}</td><td class="${cls}">${escapeHtml(item.status)}</td><td>${escapeHtml(item.note || '')}</td></tr>`;
    }).join('');
    els.comparisonQueue.innerHTML = `<table><thead><tr><th>Model</th><th>Status</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
  }


  function showComparisonPresetHelp(modelType) {
    const presets = {
      linear:['Linear regression','Fast ordinary least-squares baseline. It uses the frozen comparison split and has no model-specific hyperparameters.'],
      ridge:['Ridge regression','Linear baseline with L2 shrinkage. Comparison preset uses λ = 1. Useful when processed features are correlated.'],
      elasticnet:['Elastic-net regression','Linear model with mixed L1/L2 shrinkage. Comparison preset uses λ = 0.1 and L1 ratio = 0.5.'],
      robust:['Huber robust regression','Approximately linear model that downweights large residuals. Comparison preset uses Huber threshold 1.345.'],
      tree:['Decision-tree regression','Nonlinear rule model. Comparison preset uses depth 8, minimum leaf 5, and 24 candidate thresholds per feature.'],
      forest:['Random-forest regression','Tree ensemble baseline. Comparison preset uses 40 trees, depth 8, minimum leaf 5, row sample 0.8, and sqrt feature sampling.'],
      gboost:['Gradient-boosted trees','Sequential tree ensemble. Comparison preset uses 80 stages, learning rate 0.05, depth 3, and row sample 0.8.'],
      knn:['k-nearest-neighbour regression','Local similarity model. Comparison preset uses k = 7 with inverse-distance weighting and Euclidean distance.'],
      quantile:['Linear quantile regression','Fits a central quantile and lower/upper bounds based on the requested interval. Comparison preset uses 1500 optimisation iterations.'],
      gp:['Gaussian-process regression','RBF-kernel GP with length scale 1, signal variance 1, noise 0.1, and 8 stochastic kernel-search iterations. It may use a representative subset for larger data.'],
      ann:['Neural-network regression','Feed-forward network with 64 → 32 hidden units, ReLU, Adam, learning rate 0.001, dropout 0.1, and early stopping.']
    };
    const [title, body] = presets[modelType] || ['Comparison preset','This model is trained once with documented baseline settings.'];
    alertUser(`${title}: ${body} All comparison-set models reuse the same frozen target, features, preprocessing, target transformation, split membership, random seed and interval level.`, 'success');
  }

  const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 30));

  async function trainComparisonSet() {
    clearAlerts();
    try {
      validateBasicInputs();
      const modelTypes = Array.from(document.querySelectorAll('input[name="comparisonModel"]:checked')).map(input => input.value);
      if (!modelTypes.length) throw new Error('Select at least one model for the comparison set.');
      const split = previewSplit();
      if (!split) return;
      state.cancelled = false;
      state.comparisonBatchRunning = true;
      lockTraining(true);
      els.comparisonBatchStatus.textContent = `Starting ${modelTypes.length} baseline models on one frozen split…`;
      alertUser('Comparison batch started. All selected baseline models reuse the same target, features, preprocessing, target transformation, exact train/validation/test split membership, random seed and interval level.', 'success');
      const queueStatuses = Object.fromEntries(modelTypes.map(type => [type, { status:'Waiting', note:'Queued' }]));
      renderComparisonQueue(modelTypes, queueStatuses);
      await yieldToBrowser();
      const completed = [];
      const failures = [];
      for (let index = 0; index < modelTypes.length; index++) {
        if (state.cancelled) break;
        const modelType = modelTypes[index];
        const label = global.LRSPlatform.getModelDefinition(modelType).label;
        els.comparisonBatchStatus.textContent = `Training ${index + 1} of ${modelTypes.length}: ${label}`;
        queueStatuses[modelType] = { status:'Running', note:'Training started' };
        renderComparisonQueue(modelTypes, queueStatuses);
        await yieldToBrowser();
        try {
          const artifact = await trainAndEvaluate({
            batchMode:true,
            manageLock:false,
            modelTypeOverride:modelType,
            manualParamsOverride:global.LRSComparison.baselineParameters(modelType, { trainingRows:split.training.length }),
            tuningConfigOverride:{ mode:'manual', trials:1, ranges:{} },
            suppressAlert:true,
            suppressScroll:true,
            propagateErrors:true,
            onProgress:(progress, message) => setProgress((index + progress) / modelTypes.length, `${index + 1}/${modelTypes.length} · ${label}: ${message}`)
          });
          if (artifact) { completed.push(artifact); queueStatuses[modelType] = { status:'Completed', note:`Validation RMSE ${formatMetric(artifact.evaluation.validation.pointMetrics.rmse)}` }; renderComparisonQueue(modelTypes, queueStatuses); await yieldToBrowser(); }
        } catch (error) {
          if (state.cancelled || error.message === 'Training cancelled.') break;
          failures.push(`${label}: ${error.message}`);
          queueStatuses[modelType] = { status:'Failed', note:error.message };
          renderComparisonQueue(modelTypes, queueStatuses);
          await yieldToBrowser();
        }
      }
      if (completed.length) {
        const best = completed.slice().sort((a,b) => {
          const av = a.evaluation.validation.pointMetrics.rmse;
          const bv = b.evaluation.validation.pointMetrics.rmse;
          return av - bv;
        })[0];
        activateExperiment(best.experimentId, false);
        renderComparisonWorkspace();
        unlockPanel('step-diagnostics'); unlockPanel('step-predict');
        $('step-diagnostics').scrollIntoView({ behavior:'smooth' });
      }
      if (state.cancelled) {
        els.comparisonBatchStatus.textContent = `Comparison cancelled after ${completed.length} completed model(s).`;
        alertUser(els.comparisonBatchStatus.textContent, 'warning');
      } else {
        els.comparisonBatchStatus.textContent = `${completed.length} comparison model(s) completed${failures.length ? `; ${failures.length} failed` : ''}.`;
        alertUser(els.comparisonBatchStatus.textContent, failures.length ? 'warning' : 'success');
      }
      failures.forEach(message => alertUser(message, 'warning'));
    } catch (error) {
      alertUser(error.message, 'error');
      els.comparisonBatchStatus.textContent = error.message;
    } finally {
      state.comparisonBatchRunning = false;
      state.activeJob = null;
      lockTraining(false);
    }
  }

  function experimentArtifacts() {
    return Object.values(state.experimentArtifacts || {}).filter(artifact => artifact && artifact.experimentId);
  }

  function activateExperiment(experimentId, scroll = true) {
    const artifact = state.experimentArtifacts[experimentId];
    if (!artifact) {
      alertUser('The full fitted artifact for that experiment is not available in this project.', 'warning');
      return false;
    }
    state.artifact = artifact;
    state.pendingArtifact = artifact;
    state.approvedPackage = null; state.packageVerification = null;
    restoreArtifactSettings(artifact, state.rows.length > 0);
    populateDiagnosticControls();
    renderResults(); renderApprovedPackageSummary();
    unlockPanel('step-diagnostics'); unlockPanel('step-predict');
    if (scroll) $('step-diagnostics').scrollIntoView({behavior:'smooth'});
    return true;
  }

  function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds)) return '—';
    if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }

  function formatCreated(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }

  function renderComparisonWorkspace() {
    if (!els.comparisonWorkspace || !state.artifact) return;
    const artifacts = experimentArtifacts();
    if (!artifacts.length) {
      els.comparisonWorkspace.classList.add('hidden');
      return;
    }
    els.comparisonWorkspace.classList.remove('hidden');
    if (els.comparisonDifferencePanel && !els.comparisonDifferencePanel.dataset.pinned) els.comparisonDifferencePanel.classList.add('hidden');
    const sortKey = els.comparisonSort.value || 'validationRmse';
    const allRows = artifacts.map(artifact => global.LRSComparison.leaderboardRow(artifact, state.artifact, state.preferredExperimentId));
    const comparableCount = allRows.filter(row => row.comparable).length;
    const visibleRows = global.LRSComparison.sortRows(
      els.comparisonComparableOnly.checked ? allRows.filter(row => row.comparable || row.active) : allRows,
      sortKey
    );
    const incompatibleCount = allRows.length - comparableCount;
    els.comparisonNotice.innerHTML = `<strong>${formatNumber(comparableCount)} comparable experiment${comparableCount === 1 ? '' : 's'}</strong> relative to the active model.${incompatibleCount ? ` ${formatNumber(incompatibleCount)} experiment${incompatibleCount === 1 ? '' : 's'} use a different data or evaluation setup and are marked separately. Turn off Comparable only to show them, then use Why different? for details.` : ''} The lowest validation error is useful for selection; keep the independent test metrics for final assessment.`;
    const metricCell = value => Number.isFinite(value) ? formatMetric(value) : '—';
    els.comparisonTable.className = 'comparison-table';
    els.comparisonTable.innerHTML = `<thead><tr><th>Status</th><th>Validation</th><th>Approval</th><th>Model</th><th>Created</th><th>Validation RMSE</th><th>Test RMSE</th><th>Test MAE</th><th>Test R²</th><th>Coverage</th><th>Mean width</th><th>Interval score</th><th>Training time</th><th>Actions</th></tr></thead><tbody>${visibleRows.map(row => {
      const classes = `${row.active ? 'active-experiment' : ''} ${row.comparable ? '' : 'incompatible-experiment'}`.trim();
      const badges = `${row.active ? '<span class="comparison-badge active">Active</span>' : ''}${row.preferred ? '<span class="comparison-badge preferred">Preferred</span>' : ''}${!row.comparable ? '<span class="comparison-badge warning">Different setup</span>' : ''}` || '<span class="comparison-badge">Saved</span>';
      const validationBadge=row.validationStatus==='pass'?'<span class="comparison-badge active">Pass</span>':row.validationStatus==='fail'?'<span class="comparison-badge warning">Fail</span>':'<span class="comparison-badge">Not evaluated</span>';
      const approvalBadge=['approved','approved-with-conditions'].includes(row.approvalStatus)?`<span class="comparison-badge active">${escapeHtml(row.approvalStatus)}</span>`:row.approvalStatus==='rejected'||row.approvalStatus==='retired'?`<span class="comparison-badge warning">${escapeHtml(row.approvalStatus)}</span>`:'<span class="comparison-badge">Draft</span>';
      return `<tr class="${classes}"><td>${badges}</td><td>${validationBadge}</td><td>${approvalBadge}</td><td class="model-cell"><strong>${escapeHtml(row.modelLabel)}</strong><br><code>${escapeHtml(shortIdentifier(row.experimentId))}</code></td><td>${escapeHtml(formatCreated(row.createdAt))}</td><td>${metricCell(row.validationRmse)}</td><td>${metricCell(row.testRmse)}</td><td>${metricCell(row.testMae)}</td><td>${metricCell(row.testR2)}</td><td>${Number.isFinite(row.testCoverage) ? `${(row.testCoverage*100).toFixed(1)}%` : '—'}</td><td>${metricCell(row.meanIntervalWidth)}</td><td>${metricCell(row.intervalScore)}</td><td>${escapeHtml(formatDuration(row.elapsedMs))}</td><td class="action-cell"><button class="button secondary mini" data-comparison-action="activate" data-experiment-id="${escapeAttr(row.experimentId)}" type="button"${row.active ? ' disabled' : ''}>${row.active ? 'Active' : 'Open'}</button><button class="button secondary mini" data-comparison-action="prefer" data-experiment-id="${escapeAttr(row.experimentId)}" type="button">${row.preferred ? 'Unmark' : 'Prefer'}</button>${!row.comparable ? `<button class="button secondary mini" data-comparison-action="why" data-experiment-id="${escapeAttr(row.experimentId)}" type="button">Why different?</button>` : ''}<button class="button secondary mini" data-comparison-action="remove" data-experiment-id="${escapeAttr(row.experimentId)}" type="button">Remove</button></td></tr>`;
    }).join('')}</tbody>`;
    const chartRows = (els.comparisonChartScope && els.comparisonChartScope.value === 'all') ? allRows : allRows.filter(row => row.comparable || row.active);
    renderComparisonPlot(global.LRSComparison.sortRows(chartRows, sortKey));
  }

  function renderComparisonPlot(rows) {
    const metricKey = els.comparisonMetric ? els.comparisonMetric.value || 'validationRmse' : 'validationRmse';
    const meta = {
      validationRmse:['Validation RMSE','Validation RMSE'], testRmse:['Test RMSE','Test RMSE'], testMae:['Test MAE','Test MAE'],
      testR2:['Test R²','Test R²'], testCoverage:['Interval coverage','Coverage'], meanIntervalWidth:['Mean interval width','Width'], intervalScore:['Interval score','Interval score'], elapsedMs:['Training time','Milliseconds']
    };
    const [title, axis] = meta[metricKey] || meta.validationRmse;
    if ($('comparisonChartTitle')) $('comparisonChartTitle').textContent = `${title} by model`;
    const usable = rows.filter(row => Number.isFinite(Number(row[metricKey])));
    if (!usable.length) {
      renderEmptyPlot('plotComparisonRmse', 'Model comparison', `No completed experiments in the selected chart scope have ${title}.`);
      state.plotMap.comparisonRmse = $('plotComparisonRmse');
      return;
    }
    const includesDifferent = usable.some(row => !row.comparable);
    const labels = usable.map(row => `${row.preferred ? '★ ' : ''}${row.modelLabel}${row.comparable ? '' : ' ⚠'}`);
    const values = usable.map(row => metricKey === 'testCoverage' ? 100 * row[metricKey] : row[metricKey]);
    const suffix = metricKey === 'testCoverage' ? '%' : '';
    Plotly.react('plotComparisonRmse', [
      { x:labels, y:values, type:'bar', name:title, hovertemplate:`%{x}<br>${title} %{y}${suffix}<extra></extra>` }
    ], { ...plotLayout(`${title} by ${includesDifferent ? 'selected experiments' : 'comparable model'}`,'Model', metricKey === 'testCoverage' ? 'Percent' : axis), annotations: includesDifferent ? [{text:'⚠ marks experiments with a different data or evaluation setup; use for overview only.',xref:'paper',yref:'paper',x:0,y:1.12,showarrow:false,font:{size:12}}] : [] }, plotConfig());
    state.plotMap.comparisonRmse = $('plotComparisonRmse');
  }

  function handleComparisonAction(event) {
    const button = event.target.closest('[data-comparison-action]');
    if (!button) return;
    const id = button.dataset.experimentId, action = button.dataset.comparisonAction;
    if (action === 'activate') activateExperiment(id);
    if (action === 'prefer') {
      state.preferredExperimentId = state.preferredExperimentId === id ? null : id;
      state.approvalCandidateExperimentId = state.preferredExperimentId || (state.artifact && state.artifact.experimentId) || null;
      renderComparisonWorkspace(); renderApprovalWorkspace();
    }
    if (action === 'why') showComparisonDifferences(id);
    if (action === 'remove') removeExperiment(id);
  }



  function showComparisonDifferences(experimentId) {
    const artifact = state.experimentArtifacts[experimentId];
    if (!artifact || !state.artifact) return alertUser('The comparison details are not available for this experiment.', 'warning');
    const reasons = global.LRSComparison.describeDifferences(artifact, state.artifact);
    const activeLabel = global.LRSComparison.experimentLabel(state.artifact);
    const rowLabel = global.LRSComparison.experimentLabel(artifact);
    const html = `<strong>Why this experiment is different</strong><p>${escapeHtml(rowLabel)} is being compared against active experiment ${escapeHtml(activeLabel)}.</p><ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><p class="fine-print">Different-setup experiments can still be opened and reviewed, but their metrics should not be ranked as a fair model-selection leaderboard unless the setup differences are intentional and documented.</p>`;
    if (els.comparisonDifferencePanel) {
      els.comparisonDifferencePanel.innerHTML = html;
      els.comparisonDifferencePanel.classList.remove('hidden');
      els.comparisonDifferencePanel.dataset.pinned = 'true';
      els.comparisonDifferencePanel.scrollIntoView({behavior:'smooth',block:'nearest'});
    } else {
      alertUser(`Different setup: ${reasons.join('; ')}`, 'warning');
    }
  }

  function removeExperiment(experimentId) {
    const artifacts = experimentArtifacts();
    if (artifacts.length <= 1) return alertUser('Keep at least one fitted experiment in the project.', 'warning');
    delete state.experimentArtifacts[experimentId];
    state.experiments = state.experiments.filter(record => record.experimentId !== experimentId);
    if (state.preferredExperimentId === experimentId) state.preferredExperimentId = null;
    if (state.approvalCandidateExperimentId === experimentId) state.approvalCandidateExperimentId = null;
    if (state.artifact && state.artifact.experimentId === experimentId) {
      const next = experimentArtifacts()[0];
      if (next) activateExperiment(next.experimentId, false);
    }
    renderComparisonWorkspace();
  }

  function clearNonActiveExperiments() {
    if (!state.artifact) return;
    const activeId = state.artifact.experimentId;
    state.experimentArtifacts = { [activeId]:state.artifact };
    state.experiments = state.experiments.filter(record => record.experimentId === activeId);
    if (state.preferredExperimentId !== activeId) state.preferredExperimentId = null;
    state.approvalCandidateExperimentId = activeId;
    renderComparisonWorkspace();
    alertUser('Non-active experiments were removed from the current project.', 'success');
  }

  function comparisonCsvRows() {
    return global.LRSComparison.sortRows(experimentArtifacts().map(artifact => global.LRSComparison.leaderboardRow(artifact, state.artifact, state.preferredExperimentId)), els.comparisonSort.value || 'validationRmse').map(row => ({
      experiment_id:row.experimentId,
      model:row.modelLabel,
      active:row.active,
      preferred:row.preferred,
      comparable_to_active:row.comparable,
      created_at:row.createdAt,
      validation_rmse:row.validationRmse,
      test_rmse:row.testRmse,
      test_mae:row.testMae,
      test_r2:row.testR2,
      test_coverage:row.testCoverage,
      mean_interval_width:row.meanIntervalWidth,
      interval_score:row.intervalScore,
      training_time_seconds:Number.isFinite(row.elapsedMs) ? row.elapsedMs/1000 : null,
      validation_status:row.validationStatus,
      approval_status:row.approvalStatus
    }));
  }

  function downloadComparisonCsv() {
    const rows = comparisonCsvRows();
    if (!rows.length) return alertUser('No experiments are available to export.', 'warning');
    downloadBlob(global.CSVEngine.unparse(global.LRSSecurity.protectCsvRows(rows)), `${replaceExt(state.fileName || 'regression-project.csv','')}-model-comparison.csv`, 'text/csv;charset=utf-8');
  }

  function populateDiagnosticControls() {
    if (!state.artifact) return;
    populateSelect(els.diagnosticFeature, state.artifact.selectedFeatures || [], null, els.diagnosticFeature.value || state.artifact.selectedFeatures[0]);
    const knownSource = state.artifact.splitConfig && (state.artifact.splitConfig.sourceColumn || state.artifact.splitConfig.regimeColumn);
    const columns = state.headers.length ? state.headers : Array.from(new Set(Object.values(state.artifact.diagnosticData || {}).flat().flatMap(r => Object.keys(r.metadata || {}))));
    populateSelect(els.diagnosticSource, columns, 'No source grouping', knownSource || els.diagnosticSource.value);
    populateSelect(els.validationGroup, columns, 'No group requirement', (state.artifact.validation&&state.artifact.validation.groupColumn)||knownSource||els.validationGroup.value);
    populateSelect(els.predictionFeature, state.artifact.selectedFeatures || [], null, state.artifact.selectedFeatures && state.artifact.selectedFeatures[0]);
  }

  function renderResults() {
    if (!state.artifact || !state.artifact.evaluation) return;
    renderExperimentSummary(); renderComparisonWorkspace(); renderValidationWorkspace(); renderApprovalWorkspace(); renderMetricsTable(); renderCvSummary(); renderDiagnosticPlots(); renderMonitoringRecord(); renderRevalidationResult(); refreshChangeExperimentOptions(); saveRecoverySnapshot();
  }

  function renderExperimentSummary() {
    if (!els.experimentSummary || !state.artifact) return;
    const record = state.artifact.experimentRecord;
    if (!record) { els.experimentSummary.classList.add('hidden'); return; }
    const fingerprint = record.dataset && record.dataset.fingerprint && record.dataset.fingerprint.value;
    const execution = record.execution || {};
    const duration = execution.startedAt && execution.finishedAt
      ? formatDuration(new Date(execution.finishedAt) - new Date(execution.startedAt)) : 'Not recorded';
    const items = [
      [shortIdentifier(record.experimentId), 'Experiment ID', true],
      [record.applicationVersion || state.artifact.appVersion || '—', 'Application version', false],
      [fingerprint ? `${fingerprint.slice(0,16)}…` : 'Unavailable', 'Dataset fingerprint', true],
      [`${capitalize(execution.status || record.status || 'completed')} · ${duration}`, 'Training job', false],
      [String(state.experiments.length || 1), 'Saved experiments', false]
    ];
    els.experimentSummary.innerHTML = items.map(([value,label,code]) => {
      const valueHtml = code ? `<code data-i18n-skip="true">${escapeHtml(value)}</code>` : escapeHtml(value);
      return `<div class="experiment-summary-item"><strong data-i18n-skip="true">${valueHtml}</strong><span>${escapeHtml(label)}</span></div>`;
    }).join('');
    els.experimentSummary.classList.remove('hidden');
  }

  function renderMetricsTable() {
    const a = state.artifact, rows = ['training','validation','test'];
    els.metricsTable.innerHTML = `<thead><tr><th>Dataset</th><th>Rows</th><th>R²</th><th>RMSE</th><th>MAE</th><th>Coverage</th><th>Mean interval width</th><th>Normalised width</th><th>Coverage error</th><th>Interval score</th></tr></thead><tbody>${rows.map(name => {
      const point = a.evaluation[name].pointMetrics, interval = a.evaluation[name].uncertaintyMetrics;
      return `<tr${name === 'test' ? ' class="test-row"' : ''}><th>${capitalize(name)}${name === 'test' ? ' · final' : ''}</th><td>${formatNumber(point.n)}</td><td>${formatMetric(point.r2)}</td><td>${formatMetric(point.rmse)}</td><td>${formatMetric(point.mae)}</td><td>${interval ? formatPercent(interval.coverage) : '—'}</td><td>${interval ? formatMetric(interval.meanWidth) : '—'}</td><td>${interval ? formatMetric(interval.normalizedWidth) : '—'}</td><td>${interval ? formatSignedPercent(interval.coverageError) : '—'}</td><td>${interval ? formatMetric(interval.intervalScore) : '—'}</td></tr>`;
    }).join('')}</tbody>`;
  }

  function renderCvSummary() {
    const cv = state.artifact && state.artifact.evaluation && state.artifact.evaluation.crossValidation;
    if (!cv) { els.cvSummary.classList.add('hidden'); return; }
    els.cvSummary.classList.remove('hidden');
    els.cvSummary.innerHTML = `<strong>${cv.folds}-fold cross-validation on training data:</strong> mean R² ${formatMetric(cv.average.r2)}, RMSE ${formatMetric(cv.average.rmse)}, MAE ${formatMetric(cv.average.mae)}.`;
  }

  function plotLayout(title, xTitle, yTitle) {
    return {
      title:{ text:title, font:{ size:16 } }, xaxis:{ title:{ text:xTitle }, automargin:true }, yaxis:{ title:{ text:yTitle }, automargin:true },
      margin:{ l:65, r:30, t:60, b:65 }, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      legend:{ orientation:'h', y:-0.22 }, hovermode:'closest'
    };
  }

  function plotConfig() { return { responsive:true, displaylogo:false, modeBarButtonsToRemove:['lasso2d','select2d'] }; }

  function renderDiagnosticPlots() {
    const artifact = state.artifact; if (!artifact || !artifact.diagnosticData) return;
    const dataset = els.diagnosticDataset.value || 'test', feature = els.diagnosticFeature.value || artifact.selectedFeatures[0], sourceColumn = els.diagnosticSource.value;
    const all = artifact.diagnosticData[dataset] || [], idx = sampleIndices(all.length, 10000, 741), data = idx.map(i => all[i]);
    if (!data.length) return;
    const label = capitalize(dataset);
    const actual = data.map(r=>r.actual), predicted = data.map(r=>r.prediction), residual = data.map(r=>r.residual);
    const finiteBounds = data.every(r => Number.isFinite(r.lower) && Number.isFinite(r.upper));
    const showIntervals = (!els.showDiagnosticUncertainty || els.showDiagnosticUncertainty.checked) && finiteBounds;
    const intervalLabel = showIntervals
      ? `${Math.round(artifact.uncertainty.level*100)}% ${artifact.uncertainty.method}`
      : '';

    const intervalHelp = $('predictionIntervalHelpText');

    if (intervalHelp) {
      const example = data.find(r =>
        Number.isFinite(r.lower) &&
        Number.isFinite(r.upper) &&
        Number.isFinite(r.prediction) &&
        Number.isFinite(r.actual)
      );

      if (example && artifact.uncertainty) {
        const level = Math.round(artifact.uncertainty.level * 100);
        const coverageText = example.covered === false
          ? 'The actual value falls outside this interval.'
          : 'The actual value falls inside this interval.';

        intervalHelp.textContent =
          `A ${level}% prediction interval, calculated using ${artifact.uncertainty.method}, ` +
          'provides a range of plausible values for an individual prediction. ' +
          `For example, this ${label.toLowerCase()} observation has a predicted value of ` +
          `${formatMetric(example.prediction)}, with an interval from ` +
          `${formatMetric(example.lower)} to ${formatMetric(example.upper)}. ` +
          `Its actual value is ${formatMetric(example.actual)}. ${coverageText} ` +
          'The stated percentage describes the intended coverage across comparable observations, ' +
          'not a guarantee for an individual prediction.';
      } else {
        intervalHelp.textContent =
          'Prediction intervals are not available for this fitted artifact.';
      }
    }
    const errorY = showIntervals ? { type:'data', symmetric:false, array:data.map(r=>r.upper-r.prediction), arrayminus:data.map(r=>r.prediction-r.lower), visible:true } : undefined;
    const min = Math.min(...actual,...predicted), max = Math.max(...actual,...predicted);
    Plotly.react('plotActualPredicted', [
      { x:actual, y:predicted, mode:'markers', type:'scatter', name:`${label} observations`, error_y:errorY, text:data.map(r=>`CSV row ${r.sourceRow}${r.covered === false ? '<br>Outside interval' : ''}`), hovertemplate:'Actual %{x}<br>Predicted %{y}<extra>%{text}</extra>' },
      { x:[min,max], y:[min,max], mode:'lines', name:'Ideal y = x', hoverinfo:'skip' }
    ], plotLayout(`${label}: actual vs predicted${intervalLabel ? ` · ${intervalLabel}` : ''}`,'Actual target','Predicted target'), plotConfig());
    state.plotMap.actualPredicted = $('plotActualPredicted');

    Plotly.react('plotResidualPredicted', [
      { x:predicted, y:residual, mode:'markers', type:'scatter', name:`${label} residuals`, text:data.map(r=>`CSV row ${r.sourceRow}`), hovertemplate:'Predicted %{x}<br>Residual %{y}<extra>%{text}</extra>' },
      { x:[Math.min(...predicted),Math.max(...predicted)], y:[0,0], mode:'lines', name:'Zero residual', hoverinfo:'skip' }
    ], plotLayout(`${label}: residuals vs predicted`,'Predicted target','Residual (actual − predicted)'), plotConfig());
    state.plotMap.residualPredicted = $('plotResidualPredicted');

    Plotly.react('plotResidualHistogram', [{ x:residual, type:'histogram', name:`${label} residuals`, nbinsx:35 }], plotLayout(`${label}: residual distribution`,'Residual (actual − predicted)','Count'), plotConfig());
    state.plotMap.residualHistogram = $('plotResidualHistogram');

    const sortedResidual = residual.slice().sort((a,b)=>a-b), sd = Math.sqrt(MLCore.variance(sortedResidual,true)) || 1, mu = MLCore.mean(sortedResidual);
    const theoretical = sortedResidual.map((_,i)=>MLCore.inverseNormal((i+.5)/sortedResidual.length));
    const standardized = sortedResidual.map(v=>(v-mu)/sd), qMin=Math.min(...theoretical,...standardized), qMax=Math.max(...theoretical,...standardized);
    Plotly.react('plotQQ', [
      { x:theoretical, y:standardized, mode:'markers', type:'scatter', name:`${label} residual quantiles` },
      { x:[qMin,qMax], y:[qMin,qMax], mode:'lines', name:'Normal reference', hoverinfo:'skip' }
    ], plotLayout(`${label}: residual Q–Q plot`,'Theoretical normal quantile','Standardised residual quantile'), plotConfig());
    state.plotMap.qq = $('plotQQ');

    renderActualPredictedFeaturePlot(data, feature, label);
    renderResidualFeaturePlot(data, feature, label);
    renderResidualSourcePlot(data, sourceColumn, label);

    if (showIntervals) {
      const widths = data.map(r=>r.upper-r.lower);
      Plotly.react('plotIntervalWidth', [{ x:predicted, y:widths, mode:'markers', type:'scatter', name:intervalLabel, text:data.map(r=>r.covered ? 'Covered' : 'Not covered'), hovertemplate:'Prediction %{x}<br>Interval width %{y}<br>%{text}<extra></extra>' }],
        plotLayout(`${label}: interval width vs prediction`,'Predicted target','Prediction-interval width'), plotConfig());
    } else if (els.showDiagnosticUncertainty && !els.showDiagnosticUncertainty.checked) {
      renderEmptyPlot('plotIntervalWidth', `${label}: interval width`, 'Uncertainty display is turned off.');
    } else {
      renderEmptyPlot('plotIntervalWidth', `${label}: interval width`, 'Prediction intervals are not available for this fitted artifact.');
    }
    state.plotMap.intervalWidth = $('plotIntervalWidth');

    renderTrainingHistoryPlot(artifact);

    const importance = MLCore.featureImportance(artifact.model, artifact.preprocessor.outputNames).slice(0,20).reverse();
    if (importance.length) {
      Plotly.react('plotImportance', [{ x:importance.map(x=>x.value), y:importance.map(x=>x.name), type:'bar', orientation:'h', name:'Relative importance' }],
        plotLayout('Model feature importance','Relative importance','Processed feature'), plotConfig());
    } else {
      renderEmptyPlot('plotImportance', 'Model feature importance', 'Native feature importance is not available for this model. Use validation-based permutation importance in a future release.');
    }
    state.plotMap.importance = $('plotImportance');
  }

  function renderTrainingHistoryPlot(artifact) {
    const model=artifact.model, history=model && model.trainingHistory;
    if(history && history.length) {
      if(model.kind==='ann' || model.kind==='ann-ensemble') {
        const traces=[
          {x:history.map(h=>h.epoch),y:history.map(h=>h.trainLoss),mode:'lines',type:'scatter',name:'Training loss'},
          {x:history.map(h=>h.epoch),y:history.map(h=>h.validationLoss),mode:'lines',type:'scatter',name:'Validation loss'}
        ];
        Plotly.react('plotTrainingHistory',traces,plotLayout(`ANN learning curve · best epoch ${model.bestEpoch || '—'}`,'Epoch','Mean squared loss'),plotConfig());
      } else if(model.kind==='gp') {
        Plotly.react('plotTrainingHistory',[{x:history.map(h=>h.iteration),y:history.map(h=>h.negativeLogMarginalLikelihood),mode:'lines+markers',type:'scatter',name:'Negative log marginal likelihood'}],
          plotLayout('Gaussian-process kernel optimisation','Optimisation iteration','Negative log marginal likelihood'),plotConfig());
      } else if(model.kind==='gboost') {
        Plotly.react('plotTrainingHistory',[
          {x:history.map(h=>h.estimators),y:history.map(h=>h.trainLoss),mode:'lines',type:'scatter',name:'Training loss'},
          {x:history.map(h=>h.estimators),y:history.map(h=>h.validationLoss),mode:'lines',type:'scatter',name:'Validation loss'}
        ],plotLayout('Gradient-boosting learning curve','Boosting stages','Mean squared loss'),plotConfig());
      } else if(model.kind==='elasticnet' || model.kind==='robust' || model.kind==='quantile') {
        Plotly.react('plotTrainingHistory',[{x:history.map(h=>h.iteration),y:history.map(h=>h.trainLoss),mode:'lines+markers',type:'scatter',name:'Training objective'}],
          plotLayout(`${model.kind==='elasticnet'?'Elastic-net':model.kind==='robust'?'Robust-regression':'Quantile-regression'} optimisation`,'Iteration','Training objective'),plotConfig());
      } else if(model.kind==='forest') {
        Plotly.react('plotTrainingHistory',[
          {x:history.map(h=>h.trees),y:history.map(h=>h.trainLoss),mode:'lines',type:'scatter',name:'Training loss'},
          {x:history.map(h=>h.trees),y:history.map(h=>h.validationLoss),mode:'lines',type:'scatter',name:'Validation loss'}
        ],plotLayout('Random-forest growth curve','Number of trees','Mean squared loss'),plotConfig());
      } else if(model.kind==='tree') {
        Plotly.react('plotTrainingHistory',[
          {x:history.map(h=>h.depth),y:history.map(h=>h.trainLoss),mode:'lines+markers',type:'scatter',name:'Training loss'},
          {x:history.map(h=>h.depth),y:history.map(h=>h.validationLoss),mode:'lines+markers',type:'scatter',name:'Validation loss'}
        ],plotLayout('Decision-tree complexity curve','Maximum tree depth','Mean squared loss'),plotConfig());
      }
      state.plotMap.trainingHistory=$('plotTrainingHistory'); return;
    }
    const trials=artifact.tuning && artifact.tuning.trials || [];
    if(trials.length) {
      Plotly.react('plotTrainingHistory',[{x:trials.map((_,i)=>i+1),y:trials.map(t=>t.validationRmse),mode:'lines+markers',type:'scatter',name:'Validation RMSE'}],
        plotLayout('Hyperparameter-search history','Candidate trial','Validation RMSE'),plotConfig());
      state.plotMap.trainingHistory=$('plotTrainingHistory'); return;
    }
    renderEmptyPlot('plotTrainingHistory','Training and optimisation history','This model was fitted directly and has no iterative learning history.');
    state.plotMap.trainingHistory=$('plotTrainingHistory');
  }

  function renderActualPredictedFeaturePlot(data, feature, label) {
    if (!feature) return renderEmptyPlot('plotActualPredictedFeature', `${label}: actual and predicted vs feature`, 'Choose an input feature.');
    const values = data.map(r=>r.features ? r.features[feature] : null), numericValues = values.map(MLCore.toNumber), numericRatio = numericValues.filter(Number.isFinite).length / Math.max(1,values.length);
    if (numericRatio >= .9) {
      const x=[],actual=[],predicted=[],text=[]; values.forEach((v,i)=>{ const n=MLCore.toNumber(v); if(Number.isFinite(n)){x.push(n);actual.push(data[i].actual);predicted.push(data[i].prediction);text.push(`CSV row ${data[i].sourceRow}`);} });
      Plotly.react('plotActualPredictedFeature', [
        { x, y:actual, mode:'markers', type:'scatter', name:'Actual', text, hovertemplate:`${escapeHtml(feature)} %{x}<br>Actual %{y}<extra>%{text}</extra>` },
        { x, y:predicted, mode:'markers', type:'scatter', name:'Predicted', text, hovertemplate:`${escapeHtml(feature)} %{x}<br>Predicted %{y}<extra>%{text}</extra>` }
      ], plotLayout(`${label}: actual and predicted vs ${feature}`, feature, state.artifact.target || 'Target'), plotConfig());
    } else {
      const groups = new Map(); values.forEach((v,i)=>{ const key=String(v ?? 'Missing'); if(!groups.has(key))groups.set(key,{actual:[],predicted:[]}); groups.get(key).actual.push(data[i].actual); groups.get(key).predicted.push(data[i].prediction); });
      const traces=[]; for (const [name,items] of Array.from(groups.entries()).slice(0,25)) { traces.push({y:items.actual,name:`${name} · actual`,type:'box',boxpoints:false}); traces.push({y:items.predicted,name:`${name} · predicted`,type:'box',boxpoints:false}); }
      Plotly.react('plotActualPredictedFeature', traces, plotLayout(`${label}: actual and predicted by ${feature}`, feature, state.artifact.target || 'Target'), plotConfig());
    }
    state.plotMap.actualPredictedFeature = $('plotActualPredictedFeature');
  }

  function renderResidualFeaturePlot(data, feature, label) {
    if (!feature) return renderEmptyPlot('plotResidualFeature', `${label}: residuals vs feature`, 'Choose an input feature.');
    const values = data.map(r=>r.features ? r.features[feature] : null), numericValues = values.map(MLCore.toNumber), numericRatio = numericValues.filter(Number.isFinite).length / Math.max(1,values.length);
    if (numericRatio >= .9) {
      const x=[],y=[],text=[]; values.forEach((v,i)=>{ const n=MLCore.toNumber(v); if(Number.isFinite(n)){x.push(n);y.push(data[i].residual);text.push(`CSV row ${data[i].sourceRow}`);} });
      Plotly.react('plotResidualFeature', [{ x,y,mode:'markers',type:'scatter',name:`Residuals vs ${feature}`,text,hovertemplate:`${escapeHtml(feature)} %{x}<br>Residual %{y}<extra>%{text}</extra>` },
        { x:[Math.min(...x),Math.max(...x)],y:[0,0],mode:'lines',name:'Zero residual',hoverinfo:'skip' }], plotLayout(`${label}: residuals vs ${feature}`,feature,'Residual (actual − predicted)'), plotConfig());
    } else {
      const groups = new Map(); values.forEach((v,i)=>{ const key=String(v ?? 'Missing'); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(data[i].residual); });
      const traces = Array.from(groups.entries()).slice(0,25).map(([name,y])=>({y,name,type:'box',boxpoints:'outliers'}));
      Plotly.react('plotResidualFeature', traces, plotLayout(`${label}: residuals by ${feature}`,feature,'Residual (actual − predicted)'), plotConfig());
    }
    state.plotMap.residualFeature = $('plotResidualFeature');
  }

  function sourceValue(row, column) {
    if (!column) return null;
    if (row.metadata && Object.prototype.hasOwnProperty.call(row.metadata,column)) return row.metadata[column];
    if (state.rows.length && Number.isInteger(row.rawIndex) && state.rows[row.rawIndex]) return state.rows[row.rawIndex][column];
    return null;
  }

  function renderResidualSourcePlot(data, sourceColumn, label) {
    if (!sourceColumn) { renderEmptyPlot('plotResidualSource', `${label}: residuals by source`, 'Choose a source column to group residuals.'); state.plotMap.residualSource=$('plotResidualSource'); return; }
    const groups = new Map(); data.forEach(row=>{ const key=String(sourceValue(row,sourceColumn) ?? 'Missing'); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(row.residual); });
    const traces = Array.from(groups.entries()).sort((a,b)=>b[1].length-a[1].length).slice(0,30).map(([name,y])=>({y,name,type:'box',boxpoints:'outliers'}));
    Plotly.react('plotResidualSource', traces, plotLayout(`${label}: residuals by ${sourceColumn}`,sourceColumn,'Residual (actual − predicted)'), plotConfig());
    state.plotMap.residualSource = $('plotResidualSource');
  }

  function renderEmptyPlot(id, title, message) {
    Plotly.react(id, [], { ...plotLayout(title,'',''), annotations:[{ text:message, x:.5,y:.5,xref:'paper',yref:'paper',showarrow:false }], xaxis:{visible:false},yaxis:{visible:false} }, plotConfig());
  }

  function normalizeArtifact(artifact) {
    return global.LRSPlatform.migrateModelArtifact(artifact);
  }

  async function loadProjectFile(file) {
    clearAlerts();
    try {
      global.LRSSecurity.validateJsonFile(file); const parsedProject=JSON.parse(await file.text()); global.LRSSecurity.validateArtifactEnvelope(parsedProject,['local-regression-project']);
      const project = global.LRSPlatform.migrateProject(parsedProject);
      const artifact = project.artifact; state.artifact = artifact; state.pendingArtifact = artifact; state.approvedPackage=null; state.packageVerification=null;
      state.experiments = Array.isArray(project.experiments) ? project.experiments : [artifact.experimentRecord];
      state.experimentArtifacts = Object.fromEntries((project.artifacts || [artifact]).map(item => [item.experimentId, item]));
      state.preferredExperimentId = project.preferredExperimentId || null;
      state.approvalCandidateExperimentId = project.approvalCandidateExperimentId || state.preferredExperimentId || project.activeExperimentId || null;
      restoreArtifactSettings(artifact, state.rows.length > 0);
      if (artifact.diagnosticData && artifact.evaluation) { populateDiagnosticControls(); renderResults(); unlockPanel('step-diagnostics'); }
      unlockPanel('step-predict');
      const migrated = project.migration && project.migration.fromSchemaVersion < project.migration.toSchemaVersion;
      alertUser(migrated
        ? `Project migrated from schema ${project.migration.fromSchemaVersion} to ${project.migration.toSchemaVersion}. The original CSV was not stored.`
        : 'Project restored. The original CSV was not stored; upload it again to retrain or restore data-dependent controls.', 'warning');
      renderApprovedPackageSummary(); renderMonitoringRecord(); refreshChangeExperimentOptions(); saveRecoverySnapshot();
      if (artifact.diagnosticData) $('step-diagnostics').scrollIntoView({behavior:'smooth'});
    } catch (error) { alertUser(error.message, 'error'); }
    finally { els.projectFile.value = ''; }
  }

  async function loadModelFile(file) {
    clearAlerts();
    try {
      global.LRSSecurity.validateJsonFile(file); const parsedModel=JSON.parse(await file.text()); global.LRSSecurity.validateArtifactEnvelope(parsedModel,['local-regression-model']);
      const artifact = normalizeArtifact(parsedModel); state.artifact = artifact; state.pendingArtifact = artifact; state.approvedPackage=null; state.packageVerification=null;
      state.experiments = artifact.experimentRecord ? [artifact.experimentRecord] : [];
      state.experimentArtifacts = artifact.experimentId ? { [artifact.experimentId]:artifact } : {};
      state.preferredExperimentId = null;
      restoreArtifactSettings(artifact, state.rows.length > 0); populateDiagnosticControls();
      if (artifact.diagnosticData && artifact.evaluation) { renderResults(); unlockPanel('step-diagnostics'); }
      unlockPanel('step-predict');
      const migrated = artifact.migration && artifact.migration.fromSchemaVersion < artifact.migration.toSchemaVersion;
      alertUser(migrated
        ? `Fitted model migrated from schema ${artifact.migration.fromSchemaVersion} to ${artifact.migration.toSchemaVersion}. Step 7 can now predict a compatible CSV.`
        : 'Fitted model loaded. Step 7 can now predict a compatible unknown CSV.', 'success');
      renderApprovedPackageSummary(); renderMonitoringRecord(); refreshChangeExperimentOptions(); saveRecoverySnapshot();
      $('step-predict').scrollIntoView({behavior:'smooth'});
    } catch (error) { alertUser(error.message, 'error'); }
    finally { els.modelFile.value = ''; }
  }

  function restoreArtifactSettings(a, hasDataset) {
    state.target = a.target || '';
    state.selectedFeatures = new Set((a.selectedFeatures || []).filter(name => !hasDataset || state.headers.includes(name)));
    if (hasDataset) {
      if (state.headers.includes(state.target)) els.targetColumn.value = state.target;
      renderFeatureList();
    }
    els.targetTransform.value = a.targetTransform && a.targetTransform.type ? a.targetTransform.type : 'none'; updateTransformHelp();
    const pc = a.preprocessor && a.preprocessor.config ? a.preprocessor.config : {};
    if (pc.numericMissing) els.numericMissing.value = pc.numericMissing;
    if (pc.numericScaling) els.numericScaling.value = pc.numericScaling;
    if (pc.categoricalMissing) els.categoricalMissing.value = pc.categoricalMissing;
    if (pc.categoricalEncoding) els.categoricalEncoding.value = pc.categoricalEncoding;
    if (pc.maxCategories) els.maxCategories.value = pc.maxCategories;
    if (typeof pc.dropFirstCategory === 'boolean') els.dropFirstCategory.checked = pc.dropFirstCategory;
    if (a.modelType) { const radio=document.querySelector(`input[name="modelType"][value="${String(a.modelType).replace(/[^a-z]/gi,'')}"]`); if(radio)radio.checked=true; }
    els.tuningMode.value = a.tuning && a.tuning.mode ? a.tuning.mode : 'manual'; renderModelParams();
    const parameterIdMap = {
      gpMode:'gpMode',kernel:'gpKernel',lengthScale:'gpLengthScale',signalVariance:'gpSignalVariance',noiseStd:'gpNoiseStd',jitter:'gpJitter',
      optimizeIterations:'gpOptimizeIterations',rqAlpha:'gpRqAlpha',subsetSize:'gpSubsetSize',subsetMethod:'gpSubsetMethod',
      autoSubsetMin:'gpAutoSubsetMin',autoSubsetMax:'gpAutoSubsetMax',autoSubsetCount:'gpAutoSubsetCount',subsetTolerance:'gpSubsetTolerance',
      hidden1:'annHidden1',hidden2:'annHidden2',hidden3:'annHidden3',activation:'annActivation',optimizer:'annOptimizer',
      batchSize:'annBatchSize',epochs:'annEpochs',dropout:'annDropout',patience:'annPatience',minDelta:'annMinDelta',
      uncertaintyMethod:'annUncertaintyMethod',mcPasses:'annMcPasses',ensembleSize:'annEnsembleSize',
      l1Ratio:'elasticL1Ratio',huberDelta:'robustDelta',nEstimators:'gbEstimators',k:'knnK',weighting:'knnWeighting',
      distancePower:'knnDistancePower',maxRows:'knnMaxRows',quantile:'quantileCentral'
    };
    if (a.modelType === 'ridge') parameterIdMap.lambda='lambda';
    if (a.modelType === 'elasticnet') { parameterIdMap.lambda='elasticLambda'; parameterIdMap.maxIterations='elasticIterations'; parameterIdMap.tolerance='elasticTolerance'; }
    if (a.modelType === 'robust') { parameterIdMap.maxIterations='robustIterations'; parameterIdMap.tolerance='robustTolerance'; parameterIdMap.ridge='robustRidge'; }
    if (a.modelType === 'gboost') { parameterIdMap.learningRate='gbLearningRate'; parameterIdMap.maxDepth='gbMaxDepth'; parameterIdMap.minLeaf='gbMinLeaf'; parameterIdMap.sampleRate='gbSampleRate'; parameterIdMap.maxThresholds='gbThresholds'; }
    if (a.modelType === 'quantile') { parameterIdMap.learningRate='quantileLearningRate'; parameterIdMap.l2='quantileL2'; parameterIdMap.iterations='quantileIterations'; }
    if (a.modelType === 'ann') { parameterIdMap.learningRate='annLearningRate'; parameterIdMap.l2='annL2'; }
    for (const [key,value] of Object.entries(a.modelParameters || {})) { const input=$(parameterIdMap[key] || key); if(input && value != null && typeof value !== 'object') input.value=value; }
    if (a.modelType === 'gp') updateGpControlVisibility();
    if (a.modelType === 'ann' && $('annHidden2') && $('annHidden3')) {
      const hasSecondLayer = Number($('annHidden2').value) > 0;
      $('annHidden3').disabled = !hasSecondLayer;
      if (!hasSecondLayer) $('annHidden3').value = 0;
    }
    updateAdvancedWorkload(); updateSearchSummary();
    if (a.splitConfig) {
      els.splitStrategy.value = a.splitConfig.strategy || 'random'; if (a.splitConfig.seed != null) els.randomSeed.value=a.splitConfig.seed; renderSplitControls();
      restoreSplitControls(a.splitConfig);
    }
    if (a.evaluation && a.evaluation.crossValidation) { els.enableCV.checked=true; els.foldsLabel.classList.remove('hidden'); els.cvFolds.value=a.evaluation.crossValidation.folds || 5; }
    if (a.uncertainty) { els.enableUncertainty.checked=Boolean(a.uncertainty.enabled); els.intervalLevel.value=String(a.uncertainty.level || .95); if(a.uncertainty.bootstrapSamples)els.bootstrapSamples.value=a.uncertainty.bootstrapSamples; }
    updateUncertaintyControls(); if(a.validation){setAcceptanceCriteria(a.validation.criteria||{});if(els.validationGroup&&a.validation.groupColumn!=null)els.validationGroup.value=a.validation.groupColumn;} estimatePreprocessing(); if (hasDataset){renderDataQuality();unlockWorkflow();}
  }

  function restoreSplitControls(config) {
    const setValue = (id,value) => { const el=$(id); if(el && value != null)el.value=value; };
    if (config.strategy === 'random' && config.percentages) setPercentages('random',config.percentages);
    if (config.strategy === 'source') {
      setValue('sourceColumn',config.sourceColumn); if($('sourceAssignments'))$('sourceAssignments').innerHTML=assignmentControls(config.sourceColumn,'source','Source');
      setMultiple($('sourceValidationValues'),config.validationValues); setMultiple($('sourceTestValues'),config.testValues);
    }
    if (config.strategy === 'regime') {
      setValue('regimeColumn',config.regimeColumn); setValue('regimeMode',config.regimeMode || 'proportional');
      if(config.regimeMode === 'heldout') { $('regimeDetails').innerHTML=assignmentControls(config.regimeColumn,'regime','Regime'); setMultiple($('regimeValidationValues'),config.validationValues); setMultiple($('regimeTestValues'),config.testValues); }
      else if(config.percentages)setPercentages('regime',config.percentages);
    }
    if (config.strategy === 'time') { setValue('timeColumn',config.timeColumn); setValue('timeDirection',config.timeDirection); if(config.percentages)setPercentages('time',config.percentages); }
  }
  function setPercentages(prefix,p){ if($(`${prefix}TrainPct`))$(`${prefix}TrainPct`).value=p.training; if($(`${prefix}ValidationPct`))$(`${prefix}ValidationPct`).value=p.validation; if($(`${prefix}TestPct`))$(`${prefix}TestPct`).value=p.test; }
  function setMultiple(select,values){ if(!select)return; const set=new Set((values||[]).map(String)); Array.from(select.options).forEach(o=>{o.selected=set.has(o.value);}); }

  async function predictUnknownCsv(file) {
    if (!state.artifact || !state.artifact.model || !state.artifact.preprocessor) return alertUser('Train or load a fitted model first.', 'warning');
    clearAlerts();
    try {
      global.LRSSecurity.validateCsvFile(file);
      const parsed = global.CSVEngine.parse(await file.text(), {header:true,skipEmptyLines:true});
      const rows = parsed.data.filter(row=>row && Object.values(row).some(v=>String(v??'').trim()!==''));
      const headers = parsed.meta && parsed.meta.fields ? parsed.meta.fields : (rows[0]?Object.keys(rows[0]):[]);
      const shapeCheck=global.LRSSecurity.validateCsvShape(rows,headers);if(!shapeCheck.valid)throw new Error(shapeCheck.issues.map(issue=>issue.message).join(' '));
      const required = state.artifact.preprocessor.inputFeatures || state.artifact.selectedFeatures || [], missing = required.filter(h=>!headers.includes(h));
      if (missing.length) throw new Error(`The unknown CSV is missing required columns: ${missing.join(', ')}`);
      if (state.appMode === 'prediction' && !state.approvedPackage) throw new Error('Prediction-only mode requires an approved prediction package.');
      const inputSchema = state.approvedPackage && state.approvedPackage.inputSchema ? state.approvedPackage.inputSchema : global.LRSApproval.buildInputSchema(state.artifact,state.artifact.approval);
      const schemaCheck = global.LRSApproval.validateInputCsv(headers,rows,inputSchema);
      if (!schemaCheck.valid) throw new Error(schemaCheck.missingColumns.length ? `The CSV is missing approved-package columns: ${schemaCheck.missingColumns.join(', ')}` : schemaCheck.issues.map(issue=>issue.message).join(' '));
      const applicability = global.LRSValidation.assessApplicability(rows,state.artifact.preprocessor);
      state.predictionApplicability = applicability;
      const transformed = MLCore.transformRows(rows,state.artifact.preprocessor,null,false);
      if (!transformed.X.length) throw new Error('No rows remain after applying the fitted preprocessing rules.');
      const interval = state.artifact.uncertainty && state.artifact.uncertainty.enabled ? MLCore.predictWithIntervals(state.artifact.model,transformed.X,state.artifact.uncertainty.level) : {prediction:MLCore.predict(state.artifact.model,transformed.X),lower:null,upper:null,method:'Disabled'};
      const prediction=MLCore.inverseTargetTransform(interval.prediction,state.artifact.targetTransform||{type:'none'},true);
      let lower=interval.lower?MLCore.inverseTargetTransform(interval.lower,state.artifact.targetTransform||{type:'none'},false):null;
      let upper=interval.upper?MLCore.inverseTargetTransform(interval.upper,state.artifact.targetTransform||{type:'none'},false):null;
      if(lower&&upper)for(let i=0;i<prediction.length;i++){const lo=Math.min(lower[i],upper[i],prediction[i]),hi=Math.max(lower[i],upper[i],prediction[i]);lower[i]=lo;upper[i]=hi;}
      state.predictionRows=rows; state.predictionFileName=file.name;
      state.predictionOutput=transformed.rowIndices.map((rowIndex,i)=>({
        source_row:rowIndex+2,prediction:prediction[i],lower_bound:lower?lower[i]:null,upper_bound:upper?upper[i]:null,
        interval_level:lower?state.artifact.uncertainty.level:null,uncertainty_method:lower?interval.method:'Unavailable',rawIndex:rowIndex,
        applicability_status:applicability[rowIndex]?applicability[rowIndex].status:'not-assessed', applicability_issue_count:applicability[rowIndex]?applicability[rowIndex].issueCount:0, applicability_notes:applicability[rowIndex]?applicability[rowIndex].issues.map(issue=>issue.message).join(' | '):'',
        package_id:state.approvedPackage?state.approvedPackage.packageId:null, approval_status:state.artifact.approval&&state.artifact.approval.status||'unapproved', review_date:state.artifact.approval&&state.artifact.approval.reviewDate||null, integrity_verified:state.packageVerification?state.packageVerification.integrityVerified:false,
        features:Object.fromEntries((state.artifact.selectedFeatures||[]).map(f=>[f,rows[rowIndex][f]]))
      }));
      populateSelect(els.predictionFeature,state.artifact.selectedFeatures||[],null,els.predictionFeature.value||state.artifact.selectedFeatures[0]);
      populateSelect(els.predictionSource,headers,'No grouping',els.predictionSource.value);
      if (els.predictionMeasuredTarget) {
        const preferredMeasuredTarget = headers.includes(state.artifact.target) ? state.artifact.target : '';
        populateSelect(els.predictionMeasuredTarget,headers,'Choose measured target…',preferredMeasuredTarget);
      }
      if (els.showMeasuredTarget) {
        els.showMeasuredTarget.disabled = false;
        els.showMeasuredTarget.checked = false;
      }
      if (els.predictionMeasuredTarget) els.predictionMeasuredTarget.disabled = true;
      renderUnknownPredictionPlot(); renderPredictionApplicability(transformed.rowIndices); els.downloadUnknownPredictionsBtn.disabled=false;
      els.predictionSummary.innerHTML=`Generated <strong>${formatNumber(state.predictionOutput.length)}</strong> predictions locally.${transformed.dropped.length?` ${formatNumber(transformed.dropped.length)} rows were dropped by preprocessing rules.`:''} ${lower?`Intervals: ${Math.round(state.artifact.uncertainty.level*100)}% · ${escapeHtml(interval.method)}.`:'No uncertainty interval is available.'}`;
      if (schemaCheck.unexpectedColumns.length) alertUser(`Prediction completed. Extra columns were ignored: ${schemaCheck.unexpectedColumns.join(', ')}`, 'warning');
      else alertUser('Unknown-data predictions are ready in Step 7.', 'success');
    } catch(error){alertUser(error.message,'error');}
    finally{els.predictionFile.value='';}
  }

  function renderUnknownPredictionPlot() {
    if (!state.predictionOutput.length || !state.artifact) {
      return renderEmptyPlot('plotUnknownPrediction','Prediction results','Upload a prediction CSV to display predictions.');
    }

    const feature = els.predictionFeature.value || state.artifact.selectedFeatures[0];
    const sourceColumn = els.predictionSource.value;
    const rows = state.predictionOutput;

    const showMeasured = Boolean(
      els.showMeasuredTarget &&
      els.showMeasuredTarget.checked &&
      els.predictionMeasuredTarget &&
      els.predictionMeasuredTarget.value
    );
    const measuredColumn = els.predictionMeasuredTarget ? els.predictionMeasuredTarget.value : '';

    const xRaw = rows.map(row => row.features[feature]);
    const xNumeric = xRaw.map(MLCore.toNumber);
    const numericRatio = xNumeric.filter(Number.isFinite).length / Math.max(1, xRaw.length);
    const hasIntervals = rows.every(row => Number.isFinite(row.lower_bound) && Number.isFinite(row.upper_bound));

    const measuredValues = rows.map(row => {
      if (!showMeasured || !state.predictionRows[row.rawIndex]) return NaN;
      return MLCore.toNumber(state.predictionRows[row.rawIndex][measuredColumn]);
    });
    const hasMeasuredValues = showMeasured && measuredValues.some(Number.isFinite);

    const intervalDescription = hasIntervals
      ? ` · ${Math.round(state.artifact.uncertainty.level*100)}% ${state.artifact.uncertainty.method}`
      : '';
    const measuredDescription = hasMeasuredValues ? ` · measured ${measuredColumn} shown` : '';
    const title = `Predicted ${state.artifact.target} vs ${feature}${intervalDescription}${measuredDescription}`;
    const traces = [];

    if (sourceColumn) {
      const groups = new Map();
      rows.forEach((row,index) => {
        const sourceName = String(state.predictionRows[row.rawIndex][sourceColumn] ?? 'Missing');
        if (!groups.has(sourceName)) groups.set(sourceName, []);
        groups.get(sourceName).push({ row, index });
      });

      for (const [sourceName, items] of Array.from(groups.entries()).slice(0,30)) {
        const x = items.map(item => numericRatio >= .9 ? xNumeric[item.index] : xRaw[item.index]);
        traces.push({
          x,
          y:items.map(item => item.row.prediction),
          mode:'markers',
          type:'scatter',
          name:`${sourceName} — predicted`,
          error_y:hasIntervals ? {
            type:'data', symmetric:false,
            array:items.map(item => item.row.upper_bound-item.row.prediction),
            arrayminus:items.map(item => item.row.prediction-item.row.lower_bound),
            visible:true
          } : undefined,
          text:items.map(item => `CSV row ${item.row.source_row}`),
          hovertemplate:`${escapeHtml(feature)} %{x}<br>Prediction %{y}<extra>%{text}</extra>`
        });

        if (hasMeasuredValues) {
          const measuredItems = items.filter(item => Number.isFinite(measuredValues[item.index]));
          if (measuredItems.length) {
            traces.push({
              x:measuredItems.map(item => numericRatio >= .9 ? xNumeric[item.index] : xRaw[item.index]),
              y:measuredItems.map(item => measuredValues[item.index]),
              mode:'markers',
              type:'scatter',
              name:`${sourceName} — measured`,
              marker:{ symbol:'x', size:9 },
              text:measuredItems.map(item => `CSV row ${item.row.source_row}`),
              hovertemplate:`${escapeHtml(feature)} %{x}<br>Measured ${escapeHtml(measuredColumn)} %{y}<extra>%{text}</extra>`
            });
          }
        }
      }
    } else if (numericRatio >= .9) {
      const ordered = rows.map((row,index) => ({ row, index, x:xNumeric[index] }))
        .filter(item => Number.isFinite(item.x))
        .sort((a,b) => a.x-b.x);

      if (hasIntervals) {
        traces.push({
          x:ordered.map(item => item.x),
          y:ordered.map(item => item.row.lower_bound),
          mode:'lines', line:{width:0}, name:'Lower interval bound', hoverinfo:'skip'
        });
        traces.push({
          x:ordered.map(item => item.x),
          y:ordered.map(item => item.row.upper_bound),
          mode:'lines', fill:'tonexty', line:{width:0}, name:'Pointwise uncertainty band',
          hovertemplate:'Upper bound %{y}<extra></extra>'
        });
      }

      traces.push({
        x:ordered.map(item => item.x),
        y:ordered.map(item => item.row.prediction),
        mode:'markers', type:'scatter', name:'Predicted values',
        text:ordered.map(item => `CSV row ${item.row.source_row}`),
        hovertemplate:`${escapeHtml(feature)} %{x}<br>Prediction %{y}<extra>%{text}</extra>`
      });

      if (hasMeasuredValues) {
        const measuredItems = ordered.filter(item => Number.isFinite(measuredValues[item.index]));
        traces.push({
          x:measuredItems.map(item => item.x),
          y:measuredItems.map(item => measuredValues[item.index]),
          mode:'markers', type:'scatter', name:`Measured ${measuredColumn}`,
          marker:{ symbol:'x', size:9 },
          text:measuredItems.map(item => `CSV row ${item.row.source_row}`),
          hovertemplate:`${escapeHtml(feature)} %{x}<br>Measured ${escapeHtml(measuredColumn)} %{y}<extra>%{text}</extra>`
        });
      }
    } else {
      traces.push({
        x:xRaw.map(value => String(value ?? 'Missing')),
        y:rows.map(row => row.prediction),
        mode:'markers', type:'scatter', name:'Predicted values',
        error_y:hasIntervals ? {
          type:'data', symmetric:false,
          array:rows.map(row => row.upper_bound-row.prediction),
          arrayminus:rows.map(row => row.prediction-row.lower_bound),
          visible:true
        } : undefined,
        text:rows.map(row => `CSV row ${row.source_row}`),
        hovertemplate:`${escapeHtml(feature)} %{x}<br>Prediction %{y}<extra>%{text}</extra>`
      });

      if (hasMeasuredValues) {
        const measuredIndices = rows.map((_,index) => index).filter(index => Number.isFinite(measuredValues[index]));
        traces.push({
          x:measuredIndices.map(index => String(xRaw[index] ?? 'Missing')),
          y:measuredIndices.map(index => measuredValues[index]),
          mode:'markers', type:'scatter', name:`Measured ${measuredColumn}`,
          marker:{ symbol:'x', size:9 },
          text:measuredIndices.map(index => `CSV row ${rows[index].source_row}`),
          hovertemplate:`${escapeHtml(feature)} %{x}<br>Measured ${escapeHtml(measuredColumn)} %{y}<extra>%{text}</extra>`
        });
      }
    }

    Plotly.react('plotUnknownPrediction', traces, plotLayout(title, feature, state.artifact.target), plotConfig());
    state.plotMap.unknownPrediction = $('plotUnknownPrediction');
  }

  async function downloadModel() {
    if(!state.artifact)return;
    const copy=global.LRSPlatform.migrateModelArtifact(state.artifact); delete copy.diagnosticData; delete copy.evaluation;
    if (copy.experimentRecord) copy.experimentRecord = global.LRSPlatform.compactExperimentRecord(copy.experimentRecord);
    copy.exportProfile = 'prediction-model';
    await saveJsonWithPicker(copy,baseName()+'.mlmodel.json','Fitted regression model');
  }
  function downloadSplitPredictions() {
    if(!state.artifact||!state.artifact.diagnosticData)return;
    const rows=[]; for(const dataset of ['training','validation','test'])for(const r of state.artifact.diagnosticData[dataset]||[])rows.push({dataset,source_row:r.sourceRow,actual:r.actual,prediction:r.prediction,residual:r.residual,lower_bound:r.lower,upper_bound:r.upper,covered:r.covered});
    downloadBlob(global.CSVEngine.unparse(global.LRSSecurity.protectCsvRows(rows)),baseName()+'-split-predictions.csv','text/csv;charset=utf-8');
  }
  function downloadMetrics() {
    if(!state.artifact)return;
    downloadJson({appVersion:state.artifact.appVersion,experimentId:state.artifact.experimentId,dataset:state.artifact.dataset,modelType:state.artifact.modelType,modelParameters:state.artifact.modelParameters,target:state.artifact.target,targetTransform:state.artifact.targetTransform,tuning:state.artifact.tuning,splitConfig:state.artifact.splitConfig,splitSummary:state.artifact.splitSummary,uncertainty:state.artifact.uncertainty,evaluation:state.artifact.evaluation,validation:state.artifact.validation,approval:state.artifact.approval},baseName()+'-metrics.json');
  }
  async function downloadExperimentRecord() {
    if(!state.artifact)return;
    const record=state.artifact.experimentRecord || global.LRSPlatform.createExperimentRecord({artifact:state.artifact,dataset:state.artifact.dataset});
    await saveJsonWithPicker(record,baseName()+'.mlexperiment.json','Regression experiment record');
  }
  async function downloadProject() {
    if(!state.artifact)return;
    const artifacts=experimentArtifacts();
    const project={artifactType:'local-regression-project',schemaVersion:global.LRSPlatform.schemas.project,appVersion:'1.0.11',savedAt:new Date().toISOString(),notice:'The original CSV is not included. Upload it again to retrain or restore raw-data views.',originalCsvIncluded:false,activeExperimentId:state.artifact.experimentId,preferredExperimentId:state.preferredExperimentId,approvalCandidateExperimentId:state.approvalCandidateExperimentId,experiments:state.experiments.length?state.experiments:[state.artifact.experimentRecord],artifacts:artifacts.length?artifacts:[state.artifact],artifact:state.artifact,monitoringRecords:artifacts.flatMap(item=>item.monitoring&&Array.isArray(item.monitoring.records)?item.monitoring.records:[]),governance:{lifecycleEvents:artifacts.flatMap(item=>item.approval&&Array.isArray(item.approval.history)?item.approval.history:[]),changeAssessments:state.modelChangeAssessment?[state.modelChangeAssessment]:[]}};
    await saveJsonWithPicker(project,baseName()+'.mlproject','Regression project');
  }
  function downloadUnknownPredictions() {
    if(!state.predictionOutput.length)return;
    const includeFeatures = !els.includeFeaturesInPredictionExport || els.includeFeaturesInPredictionExport.checked;
    const output=state.predictionOutput.map(({rawIndex,features,...row})=>{
      const base={record_id:`row-${row.source_row}`, ...row};
      if (includeFeatures) for (const [key,value] of Object.entries(features||{})) base[`input_${key}`]=value;
      return base;
    });
    downloadBlob(global.CSVEngine.unparse(global.LRSSecurity.protectCsvRows(output)),replaceExt(state.predictionFileName||'unknown.csv','-predictions.csv'),'text/csv;charset=utf-8');
  }

  async function exportPlot(key) {
    const el=state.plotMap[key]; if(!el)return alertUser('That plot is not available yet.','warning');
    try{const dataUrl=await Plotly.toImage(el,{format:'png',width:1200,height:800,scale:1});downloadDataUrl(dataUrl,`${baseName()}-${key}.png`);}catch(error){alertUser(`Plot export failed: ${error.message}`,'error');}
  }
  async function downloadAllPlots(){for(const key of Object.keys(state.plotMap)){await exportPlot(key);await new Promise(r=>setTimeout(r,200));}}

  function unlockWorkflow() {
    if(state.rows.length)unlockPanel('step-features');
    if(state.target)unlockPanel('step-preprocess');
    if(state.target&&state.selectedFeatures.size){unlockPanel('step-model');unlockPanel('step-split');}
    if(state.artifact)unlockPanel('step-predict');
  }
  function unlockPanel(id){const el=$(id);if(!el)return;el.classList.remove('locked');el.setAttribute('aria-disabled','false');}
  function lockTraining(active){els.trainBtn.disabled=active; if(els.trainComparisonBtn)els.trainComparisonBtn.disabled=active; els.cancelBtn.classList.toggle('hidden',!active);if(!active)els.progressWrap.classList.add('hidden');}
  function setProgress(value,message){els.progressWrap.classList.remove('hidden');els.progressBar.style.width=`${Math.max(0,Math.min(1,value))*100}%`;if(state.activeJob)state.activeJob.update(value,message);setStatus(message);}
  function setStatus(message){els.trainingStatus.textContent=message||'';}
  function alertUser(message,type='warning'){const div=document.createElement('div');div.className=`alert ${type}`;div.textContent=message;els.alertRegion.appendChild(div);setTimeout(()=>div.remove(),type==='error'?15000:10000);}
  function clearAlerts(){els.alertRegion.innerHTML='';}
  function sampleIndices(n,max,seed){if(n<=max)return Array.from({length:n},(_,i)=>i);return MLCore.shuffle(Array.from({length:n},(_,i)=>i),MLCore.mulberry32(seed)).slice(0,max).sort((a,b)=>a-b);}
  function downloadJson(value,name){downloadBlob(JSON.stringify(value,null,2),name,'application/json');}
  async function saveJsonWithPicker(value,suggestedName,description){
    suggestedName=global.LRSSecurity.sanitizeDownloadName(suggestedName,'local-regression-artifact.json');
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
    if(typeof global.showSaveFilePicker==='function'&&global.isSecureContext){
      try{const handle=await global.showSaveFilePicker({suggestedName,types:[{description,accept:{'application/json':['.json','.mlproject']}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();alertUser(`Saved ${suggestedName}.`,'success');return;}
      catch(error){if(error&&error.name==='AbortError')return;alertUser('Save As was unavailable; using the browser download location instead.','warning');}
    }
    downloadBlob(blob,suggestedName,'application/json');
  }
  function downloadBlob(content,name,type){name=global.LRSSecurity.sanitizeDownloadName(name,'download');const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function downloadDataUrl(url,name){name=global.LRSSecurity.sanitizeDownloadName(name,'plot.png');const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
  function baseName(){return(state.fileName?state.fileName.replace(/\.csv$/i,''):state.artifact&&state.artifact.target?state.artifact.target+'-regression':'regression-project').replace(/[^a-z0-9_-]+/gi,'-');}
  function replaceExt(name,suffix){return name.replace(/\.csv$/i,'')+suffix;}
  function shortIdentifier(value){const text=String(value||'—');return text.length>24?`${text.slice(0,12)}…${text.slice(-8)}`:text;}
  function formatDuration(milliseconds){if(!Number.isFinite(milliseconds)||milliseconds<0)return 'Not recorded';if(milliseconds<1000)return `${Math.round(milliseconds)} ms`;if(milliseconds<60000)return `${(milliseconds/1000).toFixed(milliseconds<10000?1:0)} s`;const minutes=Math.floor(milliseconds/60000),seconds=Math.round((milliseconds%60000)/1000);return `${minutes} min ${seconds} s`;}
  function currentLocale(){return global.LRSI18n ? global.LRSI18n.locale : undefined;}
  function formatNumber(v){return Number(v).toLocaleString(currentLocale());}
  function formatMetric(v){return Number.isFinite(Number(v))?Number(v).toLocaleString(currentLocale(),{maximumFractionDigits:6}):'—';}
  function formatPercent(v){return Number.isFinite(Number(v))?new Intl.NumberFormat(currentLocale(),{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)):'—';}
  function formatSignedPercent(v){if(!Number.isFinite(Number(v)))return '—';const value=Number(v)*100;return `${value>=0?'+':''}${value.toLocaleString(currentLocale(),{minimumFractionDigits:1,maximumFractionDigits:1})} pp`;}
  function capitalize(v){return String(v||'').charAt(0).toUpperCase()+String(v||'').slice(1);}
  function shortValue(v){const s=String(v??'');return s.length>45?s.slice(0,42)+'…':s;}
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function escapeAttr(v){return escapeHtml(v);}

  init();
})(window);
