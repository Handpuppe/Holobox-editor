import { useEffect, useRef, useState } from 'react';
import editorBanner from '../../Banner- Editor.png';
import { Dialog } from '../components/Dialog';
import { withBaseUrl } from '../media/baseUrl';
import { APP_VERSION, type NodeLayout, type Scenario } from '../domain/types';
import { downloadBytes } from './downloadFile';
import { canSaveToThisCopy } from './editorHost';
import { EDITOR_QUIT_TAB_MESSAGE, requestEditorQuit } from './editorQuit';
import { sameNodeLayout } from './nodeLayout';
import { saveNodeLayoutToCase } from './saveNodeLayout';
import { logopedieSaveIssues, nursingSaveIssues } from './saveChecks';
import { cloneScenario } from './cloneScenario';
import { emptyLogopedieScenario, emptyNursingScenario } from './emptyScenario';
import { downloadEnvelope, parseLogopedieEnvelope, saveEnvelopeToCopy } from './envelope';
import { writeLastOpenedModule } from './lastOpened';
import { editorSourceLabel } from './loadSavedScenario';
import {
  isBundledNursingExample,
  isGesprekCaseFile,
  loadEditorStartupNursing,
  loadedCaseLabel,
  loadNursingCaseByName,
} from './loadSavedNursing';
import {
  deleteEditorCaseOnDisk,
  formatCaseSavedAt,
  listEditorCases,
  type EditorCaseListItem,
} from './editorCases';
import { newCaseFileName, overlayScenarioFileName } from './newCaseFile';
import { saveEnvelopeAsNewCase } from './saveAsCase';
import { saveLogopedieMediaOp, type StagedMediaOp } from './logopedieMedia';
import { NursingEditor, NursingPreviewAside } from './NursingEditor';
import {
  clearHeldEditorPassword,
  heldEditorPassword,
  holdEditorPassword,
  readEditorLock,
  verifyEditorPassword,
} from './editorLock';
import {
  decryptHoloboxPackage,
  encryptHoloboxPackage,
  fetchHoloboxDiskFiles,
  holoboxExportFileName,
  HOLOBOX_PACKAGE_KEY,
  type HoloboxPackageFile,
  openCasePackageFiles,
  safeCaseFileName,
  safeHoloboxPackageTitle,
  storeHoloboxImport,
} from './holoboxPackage';
import { selectHoloboxImportFiles } from './holoboxImportPaths';
import {
  deleteQuestionFolder,
  isQuestionFolderPath,
  questionFolderOnDisk,
  questionTextFiles,
  resolvedQuestionFolder,
  restoreQuestionFolder,
  sameQuestionTexts,
  saveQuestionFolder,
  startVideoRelative,
  type QuestionFolderBackupFile,
} from './questionFolder';
import { NodeFieldEditor } from './NodeFieldEditor';
import { NodeOverview } from './NodeOverview';
import { NodeQuestionWizard } from './NodeQuestionWizard';
import { appendNursingStep, removeNursingQuestion } from './nursingSteps';
import {
  connectLogopedieFlow,
  connectNursingFlow,
  disconnectLogopedieFlow,
  disconnectNursingFlow,
  logopedieNodeOverview,
  nursingNodeOverview,
} from './nodeBoard';
import { PrintListView } from './PrintListView';
import { ScenarioTest } from './ScenarioTest';
import { nursingPrintList } from './printList';
import {
  downloadNursingEnvelope,
  parseVerpleegkundeEnvelope,
  saveNursingEnvelopeToCopy,
} from './nursingEnvelope';
import { NursingMediaPanel } from './NursingMediaPanel';
import {
  isNursingMediaPath,
  listNursingMedia,
  saveNursingMediaOp,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';
import {
  buildEditorPackageZip,
  envelopeTextForModule,
  parseEditorPackageZip,
  pickZipFileToImport,
  saveZipBytesAs,
  type PackageMediaFile,
} from './scenarioPackage';
import type { NursingScenario } from '../nursing/types';

interface PendingHoloboxImport {
  fileName: string;
  caseFile: string;
  scenario: NursingScenario;
  files: HoloboxPackageFile[];
}

interface FolderBackup {
  folder: string;
  files: QuestionFolderBackupFile[];
}

interface NodeUndoEntry {
  scenario: Scenario;
  nursing: NursingScenario;
  draftNodeIds: string[];
  selectedNodeId: string;
  selectedStepId: string;
  previewOptionIndex: number;
  nursingPreviewOptionIndex: number;
  folders: FolderBackup[];
}

function keepNodeLayout<T extends { nodeLayout?: NodeLayout }>(
  restored: T,
  live: NodeLayout | undefined,
): T {
  if (!live || Object.keys(live).length === 0) {
    return restored;
  }
  return { ...restored, nodeLayout: live };
}

function questionFolders(draft: NursingScenario): string[] {
  const names: string[] = [];
  for (const step of draft.steps) {
    if (!step.questionFolder) {
      continue;
    }
    const disk = questionFolderOnDisk(step.questionFolder);
    if (isQuestionFolderPath(disk)) {
      names.push(disk);
    }
  }
  return names;
}

type EditorModule = 'logopedie' | 'verpleegkunde';

export function EditorApp() {
  const importPackageRef = useRef<HTMLInputElement>(null);
  const nodeUndoRef = useRef<NodeUndoEntry[]>([]);
  const dirtyRef = useRef(false);
  const nursingDirtyRef = useRef(false);
  const gesprekFileRef = useRef('verpleegkunde.json');
  const [editorModule, setEditorModule] = useState<EditorModule>('verpleegkunde');
  const [scenario, setScenario] = useState<Scenario>(() => cloneScenario());
  const [nursingDraft, setNursingDraft] = useState<NursingScenario>(() => emptyNursingScenario());
  const [draftNodeIds, setDraftNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState(scenario.startNodeId);
  const [selectedStepId, setSelectedStepId] = useState(nursingDraft.meta.startStepId);
  const [previewOptionIndex, setPreviewOptionIndex] = useState(0);
  const [nursingPreviewOptionIndex, setNursingPreviewOptionIndex] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [nursingLoadNotice, setNursingLoadNotice] = useState<string | null>(null);
  const [loadedLabel, setLoadedLabel] = useState(() => editorSourceLabel('seed'));
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printListOpen, setPrintListOpen] = useState(false);
  const [nodesOpen, setNodesOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [nodeUndo, setNodeUndo] = useState<NodeUndoEntry[]>([]);
  const [caseChooser, setCaseChooser] = useState<EditorCaseListItem[] | null>(null);
  const [logopedieCaseFile, setLogopedieCaseFile] = useState<string | null>(null);
  const [nursingCaseFile, setNursingCaseFile] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [listDelete, setListDelete] = useState<EditorCaseListItem | null>(null);
  const [listDeleteStep, setListDeleteStep] = useState<0 | 1 | 2>(0);
  const [deletingCase, setDeletingCase] = useState(false);
  const [saveBlockIssues, setSaveBlockIssues] = useState<string[] | null>(null);
  const [blockKind, setBlockKind] = useState<'save' | 'import'>('save');
  const [stagedMedia, setStagedMedia] = useState<StagedMediaOp[]>([]);
  const [nursingStagedMedia, setNursingStagedMedia] = useState<StagedNursingMediaOp[]>([]);
  const [nursingDiskMedia, setNursingDiskMedia] = useState<NursingMediaItem[]>([]);
  const [holoboxReplaceOpen, setHoloboxReplaceOpen] = useState(false);
  const [holoboxPasswordOpen, setHoloboxPasswordOpen] = useState(false);
  const [holoboxPassword, setHoloboxPassword] = useState('');
  const [holoboxPasswordError, setHoloboxPasswordError] = useState<string | null>(null);
  const [holoboxFileName, setHoloboxFileName] = useState<string | null>(null);
  const [quitNotice, setQuitNotice] = useState<string | null>(null);
  const [importReplaceOpen, setImportReplaceOpen] = useState(false);
  const [importReplaceTitle, setImportReplaceTitle] = useState('');
  const holoboxBusy = useRef(false);
  const holoboxExportName = useRef<string | null>(null);
  const pendingImportRef = useRef<PendingHoloboxImport | null>(null);
  const saveOnThisPc = canSaveToThisCopy();

  useEffect(() => {
    document.title = 'Phosaner Casus Editor';
  }, []);
  const activeLoadNotice = editorModule === 'logopedie' ? loadNotice : nursingLoadNotice;
  const activeLoadedLabel =
    editorModule === 'logopedie' ? loadedLabel : loadedCaseLabel(nursingDraft.meta.title);

  useEffect(() => {
    writeLastOpenedModule('verpleegkunde');
    let cancelled = false;
    void loadEditorStartupNursing().then((result) => {
      if (cancelled || nursingDirtyRef.current) {
        return;
      }
      if (result.fileName) {
        gesprekFileRef.current = result.fileName;
      }
      setNursingDraft(result.scenario);
      setDraftNodeIds([]);
      setSelectedStepId(result.scenario.meta.startStepId);
      setNursingPreviewOptionIndex(0);
      setNursingLoadNotice(result.notice);
      setNursingCaseFile(result.source === 'json' ? result.fileName : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canSaveToThisCopy()) {
      return;
    }
    const sendClose = () => {
      const url = withBaseUrl('/editor-api/quit');
      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url);
        return;
      }
      void fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined);
    };
    window.addEventListener('pagehide', sendClose);
    let timer = 0;
    if (import.meta.env.MODE !== 'test' && canSaveToThisCopy()) {
      const ping = () => {
        void fetch(withBaseUrl('/editor-api/editor-alive'), { method: 'POST' }).catch(
          () => undefined,
        );
      };
      ping();
      timer = window.setInterval(ping, 800);
    }
    return () => {
      window.removeEventListener('pagehide', sendClose);
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }
    let cancelled = false;
    void listNursingMedia()
      .then((items) => {
        if (!cancelled) {
          setNursingDiskMedia(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNursingDiskMedia([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function rememberOpenedModule(next: EditorModule) {
    writeLastOpenedModule(next);
  }

  function selectEditorModule(next: EditorModule) {
    setEditorModule(next);
    rememberOpenedModule(next);
    setOpenError(null);
    setSaveError(null);
    setSaveMessage(null);
    setSaveBlockIssues(null);
  }

  function markDirty() {
    dirtyRef.current = true;
    rememberOpenedModule('logopedie');
  }

  function markNursingDirty() {
    nursingDirtyRef.current = true;
    rememberOpenedModule('verpleegkunde');
  }

  function stageNursingMedia(op: StagedNursingMediaOp) {
    markNursingDirty();
    setNursingStagedMedia((current) => {
      const without = current.filter((item) => item.relativePath !== op.relativePath);
      return [...without, op];
    });
  }

  function rememberQuestionFolders(previous: NursingScenario, next: NursingScenario) {
    for (const step of next.steps) {
      if (!step.questionFolder) {
        continue;
      }
      const before = previous.steps.find((item) => item.id === step.id);
      if (
        before?.questionFolder === step.questionFolder &&
        before &&
        sameQuestionTexts(before, step)
      ) {
        continue;
      }
      void saveQuestionFolder(step.questionFolder, questionTextFiles(step));
    }
  }

  function rememberUndo(entry: NodeUndoEntry) {
    const next = [...nodeUndoRef.current, entry].slice(-40);
    nodeUndoRef.current = next;
    setNodeUndo(next);
  }

  function clearNodeUndo() {
    nodeUndoRef.current = [];
    setNodeUndo([]);
  }

  function snapshotNodeUndo(folders: FolderBackup[] = []): NodeUndoEntry {
    return {
      scenario,
      nursing: nursingDraft,
      draftNodeIds,
      selectedNodeId,
      selectedStepId,
      previewOptionIndex,
      nursingPreviewOptionIndex,
      folders,
    };
  }

  function pushNodeUndo() {
    rememberUndo(snapshotNodeUndo());
  }

  async function undoNodeAction() {
    const entry = nodeUndoRef.current[nodeUndoRef.current.length - 1];
    if (!entry) {
      return;
    }
    const nextStack = nodeUndoRef.current.slice(0, -1);
    nodeUndoRef.current = nextStack;
    setNodeUndo(nextStack);
    const restored = new Set(questionFolders(entry.nursing));
    for (const folder of questionFolders(nursingDraft)) {
      if (restored.has(folder)) {
        continue;
      }
      try {
        await deleteQuestionFolder(folder);
      } catch {
        setSaveError('De vraag is teruggezet. Een nieuwe vraagmap bleef staan.');
      }
    }
    for (const backup of entry.folders) {
      try {
        await restoreQuestionFolder(backup.folder, backup.files);
      } catch {
        setSaveError('De vraag is teruggezet. De map kon niet worden hersteld.');
      }
    }
    setScenario(keepNodeLayout(entry.scenario, scenario.nodeLayout));
    setNursingDraft(keepNodeLayout(entry.nursing, nursingDraft.nodeLayout));
    setDraftNodeIds(entry.draftNodeIds);
    setSelectedNodeId(entry.selectedNodeId);
    setSelectedStepId(entry.selectedStepId);
    setPreviewOptionIndex(entry.previewOptionIndex);
    setNursingPreviewOptionIndex(entry.nursingPreviewOptionIndex);
    rememberQuestionFolders(nursingDraft, entry.nursing);
  }

  function addNodeQuestion() {
    pushNodeUndo();
    const added = appendNursingStep(nursingDraft);
    markNursingDirty();
    rememberQuestionFolders(nursingDraft, added.scenario);
    setNursingDraft(added.scenario);
    setDraftNodeIds((ids) => [...ids, added.step.id]);
    setSelectedStepId(added.step.id);
    setNursingPreviewOptionIndex(0);
  }

  function deleteNodeQuestion(stepId: string) {
    const step = nursingDraft.steps.find((item) => item.id === stepId);
    const next = removeNursingQuestion(nursingDraft, stepId);
    if (next === nursingDraft) {
      return;
    }
    const folder = step?.questionFolder ? questionFolderOnDisk(step.questionFolder) : '';
    rememberUndo(snapshotNodeUndo());
    markNursingDirty();
    setNursingDraft(next);
    setDraftNodeIds((ids) => ids.filter((id) => id !== stepId));
    if (!next.steps.some((item) => item.id === selectedStepId)) {
      setSelectedStepId(next.meta.startStepId);
      setNursingPreviewOptionIndex(0);
    }
    if (!folder || !isQuestionFolderPath(folder)) {
      return;
    }
    const entryIndex = nodeUndoRef.current.length - 1;
    void deleteQuestionFolder(folder)
      .then((files) => {
        const stack = nodeUndoRef.current;
        if (!stack[entryIndex]) {
          return;
        }
        const patched = stack.map((item, index) =>
          index === entryIndex ? { ...item, folders: [{ folder, files }] } : item,
        );
        nodeUndoRef.current = patched;
        setNodeUndo(patched);
      })
      .catch(() => {
        setSaveError('De vraag is weg. De map kon niet worden verwijderd.');
      });
  }

  function connectNodes(from: string, to: string) {
    if (editorModule === 'verpleegkunde') {
      const next = connectNursingFlow(nursingDraft, from, to);
      if (next === nursingDraft) {
        return;
      }
      pushNodeUndo();
      markNursingDirty();
      setNursingDraft(next);
      return;
    }
    const next = connectLogopedieFlow(scenario, from, to);
    if (next === scenario) {
      return;
    }
    pushNodeUndo();
    markDirty();
    setScenario(next);
  }

  function disconnectNodes(from: string) {
    if (editorModule === 'verpleegkunde') {
      const next = disconnectNursingFlow(nursingDraft, from);
      if (next === nursingDraft) {
        return;
      }
      pushNodeUndo();
      markNursingDirty();
      setNursingDraft(next);
      return;
    }
    const next = disconnectLogopedieFlow(scenario, from);
    if (next === scenario) {
      return;
    }
    pushNodeUndo();
    markDirty();
    setScenario(next);
  }

  async function restoreGesprekCase() {
    clearNodeUndo();
    nursingDirtyRef.current = true;
    setOpenError(null);
    setSaveMessage(null);
    setSaveError(null);
    setSaveBlockIssues(null);
    setNursingStagedMedia([]);
    const result = await loadNursingCaseByName(gesprekFileRef.current);
    if (result.fileName) {
      gesprekFileRef.current = result.fileName;
    }
    setNursingDraft(result.scenario);
    setDraftNodeIds([]);
    setSelectedStepId(result.scenario.meta.startStepId);
    setNursingPreviewOptionIndex(0);
    setNursingLoadNotice(result.notice);
    setNursingCaseFile(result.source === 'json' ? result.fileName : null);
  }

  function startNewScenario() {
    clearNodeUndo();
    setOpenError(null);
    setSaveError(null);
    setSaveMessage(null);
    setSaveBlockIssues(null);
    if (editorModule === 'verpleegkunde') {
      setNursingCaseFile(null);
      markNursingDirty();
      const empty = emptyNursingScenario();
      setNursingDraft(empty);
      setDraftNodeIds([]);
      setSelectedStepId(empty.meta.startStepId);
      setNursingPreviewOptionIndex(0);
      setNursingLoadNotice(null);
      setNursingStagedMedia([]);
      return;
    }
    setLogopedieCaseFile(null);
    markDirty();
    const empty = emptyLogopedieScenario();
    setScenario(empty);
    setSelectedNodeId(empty.startNodeId);
    setPreviewOptionIndex(0);
    setLoadNotice(null);
    setLoadedLabel('Nieuw scenario (niet opgeslagen)');
    setStagedMedia([]);
  }

  function openEnvelopeText(text: string, fileName: string) {
    if (editorModule === 'verpleegkunde') {
      const parsed = parseVerpleegkundeEnvelope(text);
      if (!parsed.ok) {
        setOpenError(parsed.error);
        return;
      }
      if (isBundledNursingExample(parsed.scenario)) {
        setOpenError('De voorbeeldcasus ABCDE/SBAR wordt niet geopend.');
        return;
      }
      clearNodeUndo();
      markNursingDirty();
      setNursingDraft(parsed.scenario);
      setDraftNodeIds([]);
      setSelectedStepId(parsed.scenario.meta.startStepId);
      setNursingPreviewOptionIndex(0);
      setOpenError(null);
      setNursingLoadNotice(null);
      rememberOpenCaseFile(fileName);
      return;
    }
    const parsed = parseLogopedieEnvelope(text);
    if (!parsed.ok) {
      setOpenError(parsed.error);
      return;
    }
    clearNodeUndo();
    markDirty();
    setScenario(parsed.scenario);
    setSelectedNodeId(parsed.scenario.startNodeId);
    setPreviewOptionIndex(0);
    setOpenError(null);
    setLoadNotice(null);
    setLoadedLabel(editorSourceLabel('json', fileName));
    rememberOpenCaseFile(fileName);
  }

  function rememberOpenCaseFile(fileName: string) {
    const base = fileName.replaceAll('\\', '/').split('/').pop() || fileName;
    if (editorModule === 'logopedie') {
      setLogopedieCaseFile(base);
    } else {
      setNursingCaseFile(base);
    }
  }

  async function showCaseChooser() {
    setOpenError(null);
    try {
      const cases = await listEditorCases('verpleegkunde');
      setCaseChooser(cases.filter((item) => isGesprekCaseFile(item.file)));
    } catch (error) {
      setCaseChooser(null);
      setOpenError(
        error instanceof Error ? error.message : 'De casussen konden niet worden geladen.',
      );
    }
  }

  function rememberNodeLayout(layout: NodeLayout) {
    const moduleId = editorModule;
    const fileName = moduleId === 'verpleegkunde' ? nursingCaseFile : logopedieCaseFile;
    if (moduleId === 'verpleegkunde') {
      markNursingDirty();
      setNursingDraft((current) =>
        sameNodeLayout(current.nodeLayout, layout) ? current : { ...current, nodeLayout: layout },
      );
    } else {
      markDirty();
      setScenario((current) =>
        sameNodeLayout(current.nodeLayout, layout) ? current : { ...current, nodeLayout: layout },
      );
    }
    if (!fileName) {
      return;
    }
    void saveNodeLayoutToCase(moduleId, fileName, layout).then((result) => {
      if (!result.ok) {
        setSaveError(result.error);
      }
    });
  }

  function closeListDelete() {
    setListDeleteStep(0);
    setListDelete(null);
  }

  async function deleteListedCase() {
    const item = listDelete;
    if (!item) {
      closeListDelete();
      return;
    }
    const moduleId = editorModule;
    const openFile = moduleId === 'logopedie' ? logopedieCaseFile : nursingCaseFile;
    const folders =
      moduleId === 'verpleegkunde' && openFile === item.file ? questionFolders(nursingDraft) : [];
    setDeletingCase(true);
    setSaveError(null);
    const result = await deleteEditorCaseOnDisk(moduleId, item.file, folders);
    setDeletingCase(false);
    if (!result.ok) {
      closeListDelete();
      setSaveError(result.error);
      return;
    }
    if (openFile === item.file) {
      clearNodeUndo();
      if (moduleId === 'logopedie') {
        setLogopedieCaseFile(null);
        setLoadedLabel('Niet opgeslagen');
      } else {
        setNursingCaseFile(null);
      }
    }
    closeListDelete();
    setCaseChooser((current) => current?.filter((entry) => entry.file !== item.file) ?? current);
    setSaveMessage(null);
    await showCaseChooser();
  }

  async function deleteOpenCase() {
    if (!saveOnThisPc) {
      setDeleteStep(0);
      startNewScenario();
      return;
    }
    const moduleId = editorModule;
    const file = moduleId === 'logopedie' ? logopedieCaseFile : nursingCaseFile;
    const folders = moduleId === 'verpleegkunde' ? questionFolders(nursingDraft) : [];
    setDeleteStep(0);
    if (!file) {
      setSaveError('Deze casus is niet opgeslagen. Er is niets verwijderd.');
      return;
    }
    setDeletingCase(true);
    setSaveError(null);
    const result = await deleteEditorCaseOnDisk(moduleId, file, folders);
    setDeletingCase(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    clearNodeUndo();
    if (moduleId === 'logopedie') {
      setLogopedieCaseFile(null);
      setLoadedLabel('Niet opgeslagen');
    } else {
      setNursingCaseFile(null);
    }
    setSaveMessage(null);
    await showCaseChooser();
  }

  async function openListedCase(item: EditorCaseListItem) {
    setCaseChooser(null);
    try {
      const response = await fetch(
        withBaseUrl(`/resources/scenarios/${encodeURIComponent(item.file)}`),
        { cache: 'no-store' },
      );
      if (!response.ok) {
        setOpenError('De casus kon niet worden geladen.');
        return;
      }
      openEnvelopeText(await response.text(), item.file);
    } catch {
      setOpenError('De casus kon niet worden geladen.');
    }
  }

  function currentSaveIssues(): string[] {
    return editorModule === 'verpleegkunde'
      ? nursingSaveIssues(nursingDraft, nursingStagedMedia)
      : logopedieSaveIssues(scenario);
  }

  function downloadCurrentCase(fileName?: string) {
    if (editorModule === 'logopedie') {
      downloadEnvelope(scenario, fileName);
      return;
    }
    downloadNursingEnvelope(nursingDraft, fileName);
  }

  function requestSave() {
    if (!saveOnThisPc) {
      setSaveBlockIssues(null);
      setSaveError(null);
      downloadCurrentCase();
      setSaveMessage('De casus is gedownload.');
      return;
    }
    const found = currentSaveIssues();
    if (found.length > 0) {
      setSaveMessage(null);
      setSaveError(null);
      setBlockKind('save');
      setSaveBlockIssues(found);
      return;
    }
    setSaveBlockIssues(null);
    void saveToCopy();
  }

  function requestSaveAsNewCase() {
    if (!saveOnThisPc) {
      setSaveBlockIssues(null);
      setSaveError(null);
      const title = editorModule === 'logopedie' ? scenario.title : nursingDraft.meta.title;
      downloadCurrentCase(newCaseFileName(editorModule, title));
      setSaveMessage('De casus is gedownload als nieuw bestand.');
      return;
    }
    const found = currentSaveIssues();
    if (found.length > 0) {
      setSaveMessage(null);
      setSaveError(null);
      setBlockKind('save');
      setSaveBlockIssues(found);
      return;
    }
    setSaveBlockIssues(null);
    void saveAsNewCase();
  }

  async function saveToCopy() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    setSaveBlockIssues(null);
    if (editorModule === 'verpleegkunde') {
      const result = await saveNursingEnvelopeToCopy(nursingDraft);
      if (!result.ok) {
        setSaving(false);
        setSaveError(result.error);
        return;
      }
      try {
        for (const op of nursingStagedMedia) {
          await saveNursingMediaOp(op);
        }
        setNursingStagedMedia([]);
        try {
          setNursingDiskMedia(await listNursingMedia());
        } catch {
          // catalog refresh is optional; JSON and files are already written
        }
        setNursingCaseFile(overlayScenarioFileName('verpleegkunde'));
        setNursingLoadNotice(null);
        setSaveMessage(
          'Opgeslagen in deze kopie. Start de simulator opnieuw om de wijziging te zien.',
        );
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Media opslaan is mislukt.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const result = await saveEnvelopeToCopy(scenario);
    if (!result.ok) {
      setSaving(false);
      setSaveError(result.error);
      return;
    }
    try {
      for (const op of stagedMedia) {
        await saveLogopedieMediaOp(op);
      }
      setStagedMedia([]);
      setLoadedLabel(editorSourceLabel('json'));
      setLogopedieCaseFile(overlayScenarioFileName('logopedie'));
      setLoadNotice(null);
      setSaveMessage(
        'Opgeslagen in deze kopie. Start de simulator opnieuw om de wijziging te zien.',
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Media opslaan is mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAsNewCase() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    setSaveBlockIssues(null);
    const envelopeText =
      editorModule === 'logopedie'
        ? envelopeTextForModule('logopedie', scenario)
        : envelopeTextForModule('verpleegkunde', nursingDraft);
    const title = editorModule === 'logopedie' ? scenario.title : nursingDraft.meta.title;
    const result = await saveEnvelopeAsNewCase(editorModule, envelopeText, title);
    if (!result.ok) {
      setSaving(false);
      setSaveError(result.error);
      return;
    }
    rememberOpenedModule(editorModule);
    const fileName = result.file.replaceAll('\\', '/').split('/').pop() ?? result.file;
    if (editorModule === 'verpleegkunde') {
      setNursingCaseFile(fileName);
      setNursingLoadNotice(null);
    } else {
      setLogopedieCaseFile(fileName);
      setLoadedLabel(`Geladen: ${fileName}`);
      setLoadNotice(null);
    }
    setSaving(false);
    setSaveMessage(
      `Opgeslagen als nieuwe casus (${result.file}). ${overlayScenarioFileName(editorModule)} is niet overschreven.`,
    );
  }

  function holoboxCaseTitle(): string {
    return nursingDraft.meta.title.trim();
  }

  async function collectHoloboxFiles() {
    const title = holoboxCaseTitle();
    const folders: string[] = [];
    const extraVideos: string[] = [];
    for (const step of nursingDraft.steps) {
      const folder = resolvedQuestionFolder(title, step);
      if (isQuestionFolderPath(folder) && folder.startsWith('gesprekstechnieken/')) {
        folders.push(folder);
      }
      const start = startVideoRelative(title, step.stepName ?? '');
      if (start) {
        extraVideos.push(start);
      }
    }
    for (const slot of nursingDraft.mediaSlots) {
      if (slot.primaryMedia) {
        extraVideos.push(slot.primaryMedia);
      }
    }
    const listed = await fetchHoloboxDiskFiles(title, folders, extraVideos);
    if (!listed.ok) {
      setSaveError(listed.error);
      return null;
    }
    const disk = new Map<string, Uint8Array>();
    for (const relativePath of listed.files) {
      const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(withBaseUrl(`/resources/${encoded}`), { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }
      disk.set(relativePath, new Uint8Array(await response.arrayBuffer()));
    }
    for (const op of nursingStagedMedia) {
      const relativePath = op.relativePath.replaceAll('\\', '/');
      if (op.type === 'delete') {
        disk.delete(relativePath);
        continue;
      }
      disk.set(relativePath, new Uint8Array(await op.file.arrayBuffer()));
    }
    return openCasePackageFiles(
      nursingDraft,
      safeCaseFileName(nursingCaseFile),
      envelopeTextForModule('verpleegkunde', nursingDraft),
      [...disk.entries()].map(([relativePath, data]) => ({ relativePath, data })),
    );
  }

  async function encryptAndStoreHolobox() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const files = await collectHoloboxFiles();
      if (!files) {
        return;
      }
      const exportName = holoboxExportName.current;
      if (!exportName) {
        setSaveError('De casus heeft geen naam voor een pakket.');
        return;
      }
      const zip = await encryptHoloboxPackage(files, HOLOBOX_PACKAGE_KEY);
      const saved = await saveZipBytesAs(zip, `${exportName}.zip`);
      if (!saved.ok) {
        if (saved.cancelled) {
          return;
        }
        setSaveError(saved.error);
        return;
      }
      setSaveMessage(`Casus geëxporteerd naar ${saved.name}.`);
    } catch {
      setSaveError('Het pakket kon niet worden gemaakt.');
    } finally {
      setSaving(false);
    }
  }

  async function runHoloboxPackage() {
    const record = readEditorLock();
    if (!record) {
      setSaveError('Stel eerst een editorwachtwoord in.');
      return;
    }
    const held = heldEditorPassword();
    if (!held || !(await verifyEditorPassword(record, held))) {
      clearHeldEditorPassword();
      setHoloboxPassword('');
      setHoloboxPasswordError(null);
      setHoloboxPasswordOpen(true);
      return;
    }
    await encryptAndStoreHolobox();
  }

  function stageNursingBytes(files: PackageMediaFile[]) {
    for (const item of nursingStagedMedia) {
      if (item.type !== 'delete') {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    setNursingStagedMedia(
      files.map((file) => {
        const copy = new Uint8Array(file.data.byteLength);
        copy.set(file.data);
        const blob = new Blob([copy]);
        const base = file.relativePath.split('/').pop() || 'media';
        return {
          type: 'add' as const,
          relativePath: file.relativePath,
          file: new File([blob], base),
          previewUrl: URL.createObjectURL(blob),
        };
      }),
    );
  }

  async function collectBrowserMedia(): Promise<PackageMediaFile[]> {
    const files: PackageMediaFile[] = [];
    const seen = new Set<string>();
    const deleted = new Set(
      nursingStagedMedia
        .filter((op) => op.type === 'delete')
        .map((op) => op.relativePath.replaceAll('\\', '/')),
    );
    for (const op of nursingStagedMedia) {
      if (op.type === 'delete') {
        continue;
      }
      const relativePath = op.relativePath.replaceAll('\\', '/');
      if (!isNursingMediaPath(relativePath) || seen.has(relativePath)) {
        continue;
      }
      seen.add(relativePath);
      files.push({ relativePath, data: new Uint8Array(await op.file.arrayBuffer()) });
    }
    const wanted: string[] = [];
    for (const slot of nursingDraft.mediaSlots) {
      for (const value of [slot.primaryMedia, slot.idleMedia, slot.posterImage]) {
        if (!value) {
          continue;
        }
        const relativePath = value.replaceAll('\\', '/');
        if (
          deleted.has(relativePath) ||
          seen.has(relativePath) ||
          !isNursingMediaPath(relativePath)
        ) {
          continue;
        }
        wanted.push(relativePath);
        seen.add(relativePath);
      }
    }
    for (const relativePath of wanted) {
      try {
        const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(withBaseUrl(`/resources/${encoded}`), { cache: 'no-store' });
        if (!response.ok) {
          continue;
        }
        files.push({ relativePath, data: new Uint8Array(await response.arrayBuffer()) });
      } catch {
        // Op GitHub Pages staan de mediabestanden niet op schijf.
      }
    }
    return files;
  }

  async function downloadCaseZipInBrowser() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const moduleId = editorModule;
      const envelope = envelopeTextForModule(
        moduleId,
        moduleId === 'logopedie' ? scenario : nursingDraft,
      );
      const media = moduleId === 'verpleegkunde' ? await collectBrowserMedia() : [];
      const zip = buildEditorPackageZip(moduleId, envelope, media);
      const exportName = holoboxExportFileName() ?? 'casus';
      downloadBytes(zip, `${exportName}.zip`, 'application/zip');
      setSaveMessage('Casus geëxporteerd.');
    } catch {
      setSaveError('Het pakket kon niet worden gemaakt.');
    } finally {
      setSaving(false);
    }
  }

  async function requestHoloboxPackage() {
    if (!saveOnThisPc) {
      if (saving) {
        return;
      }
      await downloadCaseZipInBrowser();
      return;
    }
    if (holoboxBusy.current || saving) {
      return;
    }
    holoboxBusy.current = true;
    setSaveError(null);
    setSaveMessage(null);
    try {
      if (!safeHoloboxPackageTitle(holoboxCaseTitle())) {
        setSaveError('De casus heeft geen naam voor een pakket.');
        return;
      }
      const exportName = holoboxExportFileName();
      holoboxExportName.current = exportName;
      setHoloboxFileName(exportName);
      if (!exportName) {
        setSaveError('De casus heeft geen naam voor een pakket.');
        return;
      }
      await runHoloboxPackage();
    } finally {
      holoboxBusy.current = false;
    }
  }

  async function confirmHoloboxPassword() {
    const record = readEditorLock();
    if (!record || !(await verifyEditorPassword(record, holoboxPassword))) {
      setHoloboxPasswordError('Het editorwachtwoord klopt niet.');
      return;
    }
    const secret = holoboxPassword;
    setHoloboxPassword('');
    setHoloboxPasswordError(null);
    setHoloboxPasswordOpen(false);
    holdEditorPassword(secret);
    await encryptAndStoreHolobox();
  }

  function cancelImportReplace() {
    pendingImportRef.current = null;
    setImportReplaceOpen(false);
    setImportReplaceTitle('');
  }

  function applyImportedCase(pending: PendingHoloboxImport) {
    markNursingDirty();
    setEditorModule('verpleegkunde');
    setNursingDraft(pending.scenario);
    setDraftNodeIds([]);
    setSelectedStepId(pending.scenario.meta.startStepId);
    setNursingPreviewOptionIndex(0);
    setNursingStagedMedia([]);
    setNursingCaseFile(pending.caseFile);
    setNursingLoadNotice(null);
    setSaveMessage(`Casus ${pending.scenario.meta.title} is geïmporteerd.`);
    void listNursingMedia()
      .then((items) => setNursingDiskMedia(items))
      .catch(() => undefined);
  }

  async function finishHoloboxImport(pending: PendingHoloboxImport, replace: boolean) {
    setSaving(true);
    setSaveError(null);
    setOpenError(null);
    try {
      const stored = await storeHoloboxImport(pending.files, replace);
      if (!stored.ok) {
        if (stored.exists && !replace) {
          setImportReplaceTitle(pending.scenario.meta.title);
          setImportReplaceOpen(true);
          return;
        }
        pendingImportRef.current = null;
        setOpenError(stored.error);
        return;
      }
      pendingImportRef.current = null;
      setImportReplaceOpen(false);
      applyImportedCase({ ...pending, caseFile: stored.caseFile });
    } finally {
      setSaving(false);
    }
  }

  async function importJsonInBrowser(file: File) {
    const text = await file.text();
    openEnvelopeText(text, file.name);
  }

  async function importZipInBrowser(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const packed = parseEditorPackageZip(bytes);
    if (packed.ok && packed.module === 'verpleegkunde') {
      if (isBundledNursingExample(packed.scenario)) {
        setOpenError('De voorbeeldcasus ABCDE/SBAR wordt niet geopend.');
        return;
      }
      clearNodeUndo();
      markNursingDirty();
      setEditorModule('verpleegkunde');
      setNursingDraft(packed.scenario);
      setDraftNodeIds([]);
      setSelectedStepId(packed.scenario.meta.startStepId);
      setNursingPreviewOptionIndex(0);
      setNursingLoadNotice(null);
      setNursingCaseFile('verpleegkunde.json');
      stageNursingBytes(packed.media);
      setSaveMessage(`Casus ${packed.scenario.meta.title || file.name} is geïmporteerd.`);
      return;
    }
    if (packed.ok && packed.module === 'logopedie') {
      clearNodeUndo();
      markDirty();
      setEditorModule('logopedie');
      setScenario(packed.scenario);
      setSelectedNodeId(packed.scenario.startNodeId);
      setPreviewOptionIndex(0);
      setLoadNotice(null);
      setLoadedLabel(editorSourceLabel('json', file.name));
      setLogopedieCaseFile('logopedie.json');
      setSaveMessage(`Casus ${file.name} is geïmporteerd.`);
      return;
    }
    const opened = await decryptHoloboxPackage(bytes, HOLOBOX_PACKAGE_KEY);
    if (!opened.ok) {
      setOpenError('De casus kon niet worden geopend.');
      return;
    }
    const planned = selectHoloboxImportFiles(opened.files);
    if (!planned.ok) {
      setOpenError(planned.error);
      return;
    }
    const parsed = parseVerpleegkundeEnvelope(planned.envelopeText);
    if (!parsed.ok || isBundledNursingExample(parsed.scenario)) {
      setOpenError('De casus kon niet worden geopend.');
      return;
    }
    clearNodeUndo();
    markNursingDirty();
    setEditorModule('verpleegkunde');
    setNursingDraft(parsed.scenario);
    setDraftNodeIds([]);
    setSelectedStepId(parsed.scenario.meta.startStepId);
    setNursingPreviewOptionIndex(0);
    setNursingLoadNotice(null);
    setNursingCaseFile(planned.caseFile.split('/').pop() ?? planned.caseFile);
    stageNursingBytes(
      planned.files
        .filter((item) => isNursingMediaPath(item.name))
        .map((item) => ({ relativePath: item.name, data: item.data })),
    );
    setSaveMessage(`Casus ${parsed.scenario.meta.title || file.name} is geïmporteerd.`);
  }

  async function importPackageInBrowser(file: File) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    setOpenError(null);
    setSaveBlockIssues(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.json') || file.type.includes('json')) {
        await importJsonInBrowser(file);
        return;
      }
      if (name.endsWith('.zip')) {
        await importZipInBrowser(file);
        return;
      }
      setOpenError('Kies een JSON- of zip-bestand.');
    } catch {
      setOpenError('De casus kon niet worden geopend.');
    } finally {
      setSaving(false);
    }
  }

  async function importPackageFromPicker() {
    if (!saveOnThisPc) {
      importPackageRef.current?.click();
      return;
    }
    const picked = await pickZipFileToImport();
    if (picked === 'cancelled') {
      return;
    }
    if (picked === 'fallback') {
      importPackageRef.current?.click();
      return;
    }
    await importPackageFile(picked);
  }

  async function importPackageFile(file: File | undefined) {
    if (!file || saving) {
      return;
    }
    if (!saveOnThisPc) {
      await importPackageInBrowser(file);
      return;
    }
    setSaveError(null);
    setSaveMessage(null);
    setOpenError(null);
    setSaveBlockIssues(null);
    pendingImportRef.current = null;
    setImportReplaceOpen(false);
    setImportReplaceTitle('');
    try {
      const record = readEditorLock();
      const held = heldEditorPassword();
      if (!record || !held || !(await verifyEditorPassword(record, held))) {
        setOpenError('De casus kon niet worden geopend.');
        return;
      }
      const opened = await decryptHoloboxPackage(
        new Uint8Array(await file.arrayBuffer()),
        HOLOBOX_PACKAGE_KEY,
      );
      if (!opened.ok) {
        setOpenError('De casus kon niet worden geopend.');
        return;
      }
      const planned = selectHoloboxImportFiles(opened.files);
      if (!planned.ok) {
        setOpenError(planned.error);
        return;
      }
      const parsed = parseVerpleegkundeEnvelope(planned.envelopeText);
      if (
        !parsed.ok ||
        isBundledNursingExample(parsed.scenario) ||
        nursingSaveIssues(parsed.scenario).length > 0
      ) {
        setOpenError('Het pakket bevat geen casus.');
        return;
      }
      const pending: PendingHoloboxImport = {
        fileName: file.name,
        caseFile: planned.caseFile,
        scenario: parsed.scenario,
        files: planned.files,
      };
      pendingImportRef.current = pending;
      await finishHoloboxImport(pending, false);
    } catch {
      pendingImportRef.current = null;
      setOpenError('De casus kon niet worden geopend.');
    }
  }

  if (testOpen) {
    return (
      <ScenarioTest
        module={editorModule}
        scenario={scenario}
        nursing={nursingDraft}
        onClose={() => setTestOpen(false)}
      />
    );
  }

  if (printListOpen) {
    const list =
      editorModule === 'verpleegkunde'
        ? nursingPrintList(nursingDraft)
        : { title: scenario.title.trim(), steps: [] };
    return (
      <div
        className="scenario-editor print-list-page"
        data-testid="screen-scenario-editor"
        lang="nl"
      >
        <PrintListView
          title={list.title}
          steps={list.steps}
          onPrint={() => window.print()}
          onClose={() => setPrintListOpen(false)}
        />
      </div>
    );
  }

  if (nodesOpen) {
    const overview =
      editorModule === 'verpleegkunde'
        ? nursingNodeOverview(nursingDraft, new Set(draftNodeIds))
        : logopedieNodeOverview(scenario);
    return (
      <div
        className="scenario-editor node-overview-page"
        data-testid="screen-scenario-editor"
        lang="nl"
      >
        <NodeOverview
          model={overview}
          onClose={() => setNodesOpen(false)}
          onConnect={connectNodes}
          onDisconnect={disconnectNodes}
          onOpenTasks={() => setPrintListOpen(true)}
          onCreateQuestion={editorModule === 'verpleegkunde' ? addNodeQuestion : undefined}
          onDeleteQuestion={editorModule === 'verpleegkunde' ? deleteNodeQuestion : undefined}
          savedLayout={
            editorModule === 'verpleegkunde' ? nursingDraft.nodeLayout : scenario.nodeLayout
          }
          onLayoutChange={rememberNodeLayout}
          onUndo={() => {
            void undoNodeAction();
          }}
          canUndo={nodeUndo.length > 0}
          renderQuestionWizard={
            editorModule === 'verpleegkunde'
              ? (stepId, close) => (
                  <NodeQuestionWizard
                    stepId={stepId}
                    draft={nursingDraft}
                    onChange={(next) => {
                      pushNodeUndo();
                      markNursingDirty();
                      rememberQuestionFolders(nursingDraft, next);
                      setNursingDraft(next);
                    }}
                    stagedMedia={nursingStagedMedia}
                    onStage={stageNursingMedia}
                    diskMedia={nursingDiskMedia}
                    onSaved={() => {
                      setDraftNodeIds((ids) => ids.filter((id) => id !== stepId));
                      close();
                    }}
                  />
                )
              : undefined
          }
          renderNodeEdit={(target, close) =>
            editorModule === 'verpleegkunde' ? (
              <NodeFieldEditor
                module="verpleegkunde"
                target={target}
                draft={nursingDraft}
                stagedMedia={nursingStagedMedia}
                diskMedia={nursingDiskMedia}
                onStage={stageNursingMedia}
                onClose={close}
                onSave={(next) => {
                  if (JSON.stringify(next) !== JSON.stringify(nursingDraft)) {
                    pushNodeUndo();
                    markNursingDirty();
                    rememberQuestionFolders(nursingDraft, next);
                    setNursingDraft(next);
                  }
                  setSelectedStepId(target.stepId);
                  if (target.quality) {
                    const step = next.steps.find((item) => item.id === target.stepId);
                    const index =
                      step?.options.findIndex((option) => option.quality === target.quality) ?? 0;
                    setNursingPreviewOptionIndex(index >= 0 ? index : 0);
                  }
                  setDraftNodeIds((ids) => ids.filter((id) => id !== target.stepId));
                }}
              />
            ) : (
              <NodeFieldEditor
                module="logopedie"
                target={target}
                scenario={scenario}
                onClose={close}
                onSave={(next) => {
                  if (JSON.stringify(next) !== JSON.stringify(scenario)) {
                    pushNodeUndo();
                    markDirty();
                    setScenario(next);
                  }
                  setSelectedNodeId(target.stepId);
                  if (target.quality) {
                    const node = next.nodes.find((item) => item.id === target.stepId);
                    const index =
                      node?.options.findIndex((option) => option.quality === target.quality) ?? 0;
                    setPreviewOptionIndex(index >= 0 ? index : 0);
                  }
                }}
              />
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="scenario-editor" data-testid="screen-scenario-editor" lang="nl">
      <header className="editor-header">
        <div>
          <img
            className="editor-banner"
            data-testid="editor-banner"
            src={editorBanner}
            alt="Phosaner Casus Editor"
          />
        </div>
        <div className="editor-header-side">
          <div className="editor-actions">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-new-scenario"
              onClick={startNewScenario}
            >
              Nieuwe Casus
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-open-json"
              onClick={() => {
                void showCaseChooser();
              }}
            >
              Casus openen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-nodes"
              onClick={() => setNodesOpen(true)}
            >
              Node Editor
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-start-test"
              onClick={() => setTestOpen(true)}
            >
              Test modus
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-save-json"
              onClick={() => requestSave()}
              disabled={saving}
            >
              Opslaan
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-save-as-case"
              onClick={() => requestSaveAsNewCase()}
              disabled={saving}
            >
              Opslaan als nieuwe casus
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-download-json"
              onClick={() => downloadCurrentCase()}
            >
              Casus downloaden
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-reset-seed"
              onClick={() => {
                void restoreGesprekCase();
              }}
            >
              Herstel startkopie
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-import-package"
              onClick={() => void importPackageFromPicker()}
              disabled={saving}
            >
              Casus importeren
            </button>
            <input
              ref={importPackageRef}
              type="file"
              accept={
                saveOnThisPc
                  ? 'application/zip,.zip'
                  : '.json,application/json,.zip,application/zip'
              }
              className="visually-hidden"
              data-testid="input-import-package"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void importPackageFile(file);
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-holobox-package"
              onClick={() => void requestHoloboxPackage()}
              disabled={saving}
            >
              Casus exporteren
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-delete-case"
              onClick={() => setDeleteStep(1)}
              disabled={deletingCase}
            >
              Casus verwijderen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-editor-quit"
              onClick={() => {
                void requestEditorQuit().then((kind) => {
                  if (kind === 'browser') {
                    setQuitNotice(EDITOR_QUIT_TAB_MESSAGE);
                  }
                });
              }}
            >
              Afsluiten
            </button>
            {quitNotice ? (
              <p className="editor-load-notice" data-testid="editor-quit-notice" role="status">
                {quitNotice}
              </p>
            ) : null}
          </div>
          <NursingPreviewAside
            draft={nursingDraft}
            stagedMedia={nursingStagedMedia}
            selectedStepId={selectedStepId}
            previewOptionIndex={nursingPreviewOptionIndex}
          />
        </div>
      </header>

      <nav className="editor-module-tabs" aria-label="Module">
        <button
          type="button"
          className="is-active"
          data-testid="editor-module-nursing"
          onClick={() => selectEditorModule('verpleegkunde')}
        >
          Gesprekstechnieken
        </button>
      </nav>

      <p className="editor-loaded" data-testid="editor-loaded-source">
        {activeLoadedLabel}
      </p>
      <p className="editor-notice" data-testid="editor-credit">
        {APP_VERSION} Made by Rutger van Horssen
      </p>

      {activeLoadNotice ? (
        <p className="editor-load-notice" data-testid="editor-load-notice" role="status">
          {activeLoadNotice}
        </p>
      ) : null}
      {openError ? (
        <p className="editor-open-error" data-testid="editor-open-error" role="alert">
          Kan JSON niet openen: {openError}
        </p>
      ) : null}
      {saveError ? (
        <p className="editor-open-error" data-testid="editor-save-error" role="alert">
          {saveError}
        </p>
      ) : null}
      {saveMessage ? (
        <p className="editor-save-ok" data-testid="editor-save-ok" role="status">
          {saveMessage}
        </p>
      ) : null}

      {caseChooser && listDeleteStep === 0 ? (
        <Dialog title="Casus openen" testId="dialog-open-case" onClose={() => setCaseChooser(null)}>
          {caseChooser.length === 0 ? (
            <p>Geen casussen gevonden.</p>
          ) : (
            <ul className="editor-case-list" data-testid="editor-case-list">
              {caseChooser.map((item) => (
                <li key={item.file} className="editor-case-row">
                  <button
                    type="button"
                    className="btn btn-secondary editor-case-open"
                    data-testid={`btn-open-case-${item.file}`}
                    onClick={() => {
                      void openListedCase(item);
                    }}
                  >
                    <span>{item.title}</span>
                    {item.savedAt && formatCaseSavedAt(item.savedAt) ? (
                      <span className="editor-case-saved" data-testid={`case-saved-${item.file}`}>
                        {formatCaseSavedAt(item.savedAt)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary editor-case-delete"
                    data-testid={`btn-delete-listed-case-${item.file}`}
                    onClick={() => {
                      setListDelete(item);
                      setListDeleteStep(1);
                    }}
                  >
                    Verwijderen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-open-case-back"
              onClick={() => setCaseChooser(null)}
            >
              Terug
            </button>
          </div>
        </Dialog>
      ) : null}

      {listDelete && listDeleteStep === 1 ? (
        <Dialog
          title="Casus verwijderen"
          testId="dialog-delete-listed-case-1"
          onClose={closeListDelete}
        >
          <p>Wil je &quot;{listDelete.title}&quot; verwijderen? Er gaat nog niets weg.</p>
          <p>Bestand: {listDelete.file}</p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-delete-listed-cancel-1"
              onClick={closeListDelete}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-delete-listed-continue"
              onClick={() => setListDeleteStep(2)}
            >
              Doorgaan
            </button>
          </div>
        </Dialog>
      ) : null}

      {listDelete && listDeleteStep === 2 ? (
        <Dialog
          title="Casus echt verwijderen"
          testId="dialog-delete-listed-case-2"
          onClose={closeListDelete}
        >
          <p>
            Bevestig nog een keer. &quot;{listDelete.title}&quot; en de vraagmappen, inclusief
            video&apos;s en tekstbestanden, worden verwijderd.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-delete-listed-cancel-2"
              onClick={closeListDelete}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-delete-listed-confirm"
              onClick={() => {
                void deleteListedCase();
              }}
              disabled={deletingCase}
            >
              Casus verwijderen
            </button>
          </div>
        </Dialog>
      ) : null}

      {importReplaceOpen ? (
        <Dialog title="Vervangen" testId="dialog-import-replace" onClose={cancelImportReplace}>
          <p>
            Er bestaat al een casus voor &quot;{importReplaceTitle}&quot;. De bestaande casus
            vervangen?
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-import-replace-no"
              onClick={cancelImportReplace}
            >
              Nee
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-import-replace-yes"
              onClick={() => {
                const pending = pendingImportRef.current;
                setImportReplaceOpen(false);
                if (!pending) {
                  return;
                }
                void finishHoloboxImport(pending, true);
              }}
              disabled={saving}
            >
              Ja
            </button>
          </div>
        </Dialog>
      ) : null}

      {holoboxReplaceOpen ? (
        <Dialog
          title="Vervangen"
          testId="dialog-holobox-replace"
          onClose={() => setHoloboxReplaceOpen(false)}
        >
          <p>
            Er bestaat al een pakket met de naam &quot;{holoboxFileName}.zip&quot;. Het hele pakket
            vervangen?
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-holobox-replace-no"
              onClick={() => setHoloboxReplaceOpen(false)}
            >
              Nee
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-holobox-replace-yes"
              onClick={() => {
                setHoloboxReplaceOpen(false);
                void runHoloboxPackage();
              }}
            >
              Ja
            </button>
          </div>
        </Dialog>
      ) : null}

      {holoboxPasswordOpen ? (
        <Dialog
          title="Editorwachtwoord"
          testId="dialog-holobox-password"
          onClose={() => {
            setHoloboxPasswordOpen(false);
            setHoloboxPassword('');
            setHoloboxPasswordError(null);
          }}
        >
          <p>Bevestig het editorwachtwoord om het pakket te maken.</p>
          <div className="field">
            <label htmlFor="holobox-package-password">Editorwachtwoord</label>
            <input
              id="holobox-package-password"
              data-testid="holobox-package-password"
              type="password"
              autoComplete="current-password"
              value={holoboxPassword}
              onChange={(event) => setHoloboxPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirmHoloboxPassword();
                }
              }}
            />
          </div>
          {holoboxPasswordError ? (
            <p className="editor-open-error" data-testid="holobox-password-error" role="alert">
              {holoboxPasswordError}
            </p>
          ) : null}
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-holobox-password-cancel"
              onClick={() => {
                setHoloboxPasswordOpen(false);
                setHoloboxPassword('');
                setHoloboxPasswordError(null);
              }}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-holobox-package-confirm"
              onClick={() => void confirmHoloboxPassword()}
              disabled={saving}
            >
              Pakket maken
            </button>
          </div>
        </Dialog>
      ) : null}

      {deleteStep === 1 ? (
        <Dialog
          title="Casus verwijderen"
          testId="dialog-delete-case-1"
          onClose={() => setDeleteStep(0)}
        >
          <p>
            Wil je &quot;
            {editorModule === 'logopedie'
              ? scenario.title.trim() || 'Logopedie'
              : nursingDraft.meta.title.trim() || 'Gesprekstechnieken'}
            &quot; verwijderen? Er gaat nog niets weg.
          </p>
          <p>
            {(editorModule === 'logopedie' ? logopedieCaseFile : nursingCaseFile)
              ? `Bestand: ${editorModule === 'logopedie' ? logopedieCaseFile : nursingCaseFile}`
              : 'Deze casus is nog niet opgeslagen.'}
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-delete-case-cancel-1"
              onClick={() => setDeleteStep(0)}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-delete-case-continue"
              onClick={() => setDeleteStep(2)}
            >
              Doorgaan
            </button>
          </div>
        </Dialog>
      ) : null}

      {deleteStep === 2 ? (
        <Dialog
          title="Casus echt verwijderen"
          testId="dialog-delete-case-2"
          onClose={() => setDeleteStep(0)}
        >
          <p>
            Bevestig nog een keer. &quot;
            {editorModule === 'logopedie'
              ? scenario.title.trim() || 'Logopedie'
              : nursingDraft.meta.title.trim() || 'Gesprekstechnieken'}
            &quot; en de vraagmappen, inclusief video&apos;s en tekstbestanden, worden verwijderd.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-delete-case-cancel-2"
              onClick={() => setDeleteStep(0)}
            >
              Annuleren
            </button>
            <button
              type="button"
              className="btn"
              data-testid="btn-delete-case-confirm"
              onClick={() => {
                void deleteOpenCase();
              }}
              disabled={deletingCase}
            >
              Casus verwijderen
            </button>
          </div>
        </Dialog>
      ) : null}

      {saveBlockIssues ? (
        <Dialog
          title={blockKind === 'import' ? 'Importeren geblokkeerd' : 'Opslaan geblokkeerd'}
          testId="dialog-save-blocked"
          onClose={() => setSaveBlockIssues(null)}
        >
          <p>
            {blockKind === 'import'
              ? 'Dit pakket is niet compleet. Het is niet in de editor geladen.'
              : 'Dit scenario is niet compleet. Er is niets weggeschreven.'}
          </p>
          <ul data-testid="dialog-save-blocked-list">
            {saveBlockIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-save-blocked-close"
              onClick={() => setSaveBlockIssues(null)}
            >
              Sluiten
            </button>
          </div>
        </Dialog>
      ) : null}

      <>
        <NursingEditor
          draft={nursingDraft}
          onChange={(next) => {
            markNursingDirty();
            rememberQuestionFolders(nursingDraft, next);
            setNursingDraft(next);
            setDraftNodeIds((ids) => ids.filter((id) => next.steps.some((step) => step.id === id)));
          }}
          stagedMedia={nursingStagedMedia}
          onStage={(op) => {
            markNursingDirty();
            setNursingStagedMedia((current) => {
              const without = current.filter((item) => item.relativePath !== op.relativePath);
              return [...without, op];
            });
          }}
          diskMedia={nursingDiskMedia}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          previewOptionIndex={nursingPreviewOptionIndex}
          onPreviewOption={setNursingPreviewOptionIndex}
        />
        <NursingMediaPanel
          staged={nursingStagedMedia}
          previewPath={
            nursingDraft.mediaSlots.find(
              (slot) =>
                slot.slotId ===
                (nursingDraft.steps.find((item) => item.id === selectedStepId)?.options[
                  nursingPreviewOptionIndex
                ]?.mediaSlotId ??
                  nursingDraft.steps.find((item) => item.id === selectedStepId)?.mediaSlotId),
            )?.primaryMedia ?? null
          }
          onStage={(op) => {
            markNursingDirty();
            setNursingStagedMedia((current) => {
              const without = current.filter((item) => item.relativePath !== op.relativePath);
              return [...without, op];
            });
          }}
        />
      </>
    </div>
  );
}
