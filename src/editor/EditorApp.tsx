import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { withBaseUrl } from '../media/baseUrl';
import { LogopedieAvatar } from '../media/logopedie/LogopedieAvatar';
import { avatarSourceChain } from '../media/logopedie/resolveAvatar';
import {
  APP_VERSION,
  type DecisionNode,
  type NodeLayout,
  type OptionQuality,
  type Scenario,
  type StudentOption,
} from '../domain/types';
import { sameNodeLayout } from './nodeLayout';
import { saveNodeLayoutToCase } from './saveNodeLayout';
import { logopedieSaveIssues, nursingSaveIssues } from './saveChecks';
import { cloneScenario } from './cloneScenario';
import { EditorMediaPanel } from './EditorMediaPanel';
import { emptyLogopedieScenario, emptyNursingScenario } from './emptyScenario';
import { downloadEnvelope, parseLogopedieEnvelope, saveEnvelopeToCopy } from './envelope';
import { EDITOR_FACES, faceLabel } from './faces';
import { readLastOpenedModule, writeLastOpenedModule } from './lastOpened';
import { editorSourceLabel, loadEditorStartupScenario } from './loadSavedScenario';
import {
  isBundledNursingExample,
  loadEditorStartupNursing,
  nursingEditorSourceLabel,
} from './loadSavedNursing';
import {
  deleteEditorCaseOnDisk,
  formatCaseSavedAt,
  listEditorCases,
  type EditorCaseListItem,
} from './editorCases';
import { overlayScenarioFileName } from './newCaseFile';
import { saveEnvelopeAsNewCase } from './saveAsCase';
import { saveLogopedieMediaOp, type StagedMediaOp } from './logopedieMedia';
import { NursingEditor, NursingPreviewAside } from './NursingEditor';
import {
  deleteQuestionFolder,
  isQuestionFolderPath,
  questionFolderOnDisk,
  questionTextFiles,
  restoreQuestionFolder,
  sameQuestionTexts,
  saveQuestionFolder,
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
  listNursingMedia,
  saveNursingMediaOp,
  type NursingMediaItem,
  type StagedNursingMediaOp,
} from './nursingMedia';
import {
  editorPackageIssues,
  envelopeTextForModule,
  exportPackageToCopy,
  importPackageMedia,
  parseEditorPackageZip,
  pickZipFileToImport,
  saveExportedZipAs,
} from './scenarioPackage';
import type { NursingScenario } from '../nursing/types';

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

const QUALITY_LABELS: Record<OptionQuality, string> = {
  high: 'Goed antwoord',
  partial: 'Deels goed antwoord',
  inappropriate: 'Verkeerd antwoord',
};

const QUALITIES: OptionQuality[] = ['high', 'partial', 'inappropriate'];

function fieldClass(value: string): string {
  return value.trim() ? 'field' : 'field is-empty';
}

async function quitEditor(): Promise<void> {
  try {
    await fetch(withBaseUrl('/editor-api/quit?immediate=1'), { method: 'POST' });
  } catch {
    // Het venster sluit ook als de server het script niet kon starten.
  }
  window.close();
}

function canSaveToThisCopy(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}

function replaceNode(scenario: Scenario, nodeId: string, next: DecisionNode): Scenario {
  return {
    ...scenario,
    nodes: scenario.nodes.map((node) => (node.id === nodeId ? next : node)),
  };
}

function replaceOption(node: DecisionNode, optionIndex: number, next: StudentOption): DecisionNode {
  const options: DecisionNode['options'] = [node.options[0], node.options[1], node.options[2]];
  options[optionIndex] = next;
  return { ...node, options };
}

type EditorModule = 'logopedie' | 'verpleegkunde';

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function EditorApp() {
  const importPackageRef = useRef<HTMLInputElement>(null);
  const nodeUndoRef = useRef<NodeUndoEntry[]>([]);
  const dirtyRef = useRef(false);
  const nursingDirtyRef = useRef(false);
  const [editorModule, setEditorModule] = useState<EditorModule>(
    () => readLastOpenedModule() ?? 'logopedie',
  );
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
  const [nursingLoadedLabel, setNursingLoadedLabel] = useState(() =>
    nursingEditorSourceLabel('seed'),
  );
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
  const saveOnThisPc = canSaveToThisCopy();
  const activeLoadNotice = editorModule === 'logopedie' ? loadNotice : nursingLoadNotice;
  const activeLoadedLabel = editorModule === 'logopedie' ? loadedLabel : nursingLoadedLabel;

  useEffect(() => {
    let cancelled = false;
    void loadEditorStartupScenario().then((result) => {
      if (cancelled || dirtyRef.current) {
        return;
      }
      setScenario(result.scenario);
      setSelectedNodeId(result.scenario.startNodeId);
      setPreviewOptionIndex(0);
      setLoadedLabel(result.label);
      setLoadNotice(result.notice);
      setLogopedieCaseFile(result.source === 'json' ? 'logopedie.json' : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadEditorStartupNursing().then((result) => {
      if (cancelled || nursingDirtyRef.current) {
        return;
      }
      setNursingDraft(result.scenario);
      setDraftNodeIds([]);
      setSelectedStepId(result.scenario.meta.startStepId);
      setNursingPreviewOptionIndex(0);
      setNursingLoadedLabel(result.label);
      setNursingLoadNotice(result.notice);
      setNursingCaseFile(result.source === 'json' ? 'verpleegkunde.json' : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
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

  function resetToSeed() {
    clearNodeUndo();
    markDirty();
    const seeded = cloneScenario();
    setScenario(seeded);
    setSelectedNodeId(seeded.startNodeId);
    setPreviewOptionIndex(0);
    setOpenError(null);
    setLoadNotice(null);
    setLoadedLabel(editorSourceLabel('seed'));
    setLogopedieCaseFile(null);
    setSaveMessage(null);
    setSaveError(null);
    setStagedMedia([]);
  }

  function resetNursingToSeed() {
    clearNodeUndo();
    markNursingDirty();
    const seeded = emptyNursingScenario();
    setNursingDraft(seeded);
    setDraftNodeIds([]);
    setSelectedStepId(seeded.meta.startStepId);
    setNursingPreviewOptionIndex(0);
    setOpenError(null);
    setNursingLoadNotice(null);
    setNursingLoadedLabel(nursingEditorSourceLabel('seed'));
    setNursingCaseFile(null);
    setSaveMessage(null);
    setSaveError(null);
    setNursingStagedMedia([]);
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
      setNursingLoadedLabel('Nieuw scenario (niet opgeslagen)');
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
      setNursingLoadedLabel(nursingEditorSourceLabel('json', fileName));
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

  async function showCaseChooser(moduleId: EditorModule = editorModule) {
    setOpenError(null);
    try {
      setCaseChooser(await listEditorCases(moduleId));
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
        setNursingLoadedLabel('Niet opgeslagen');
      }
    }
    closeListDelete();
    setCaseChooser((current) => current?.filter((entry) => entry.file !== item.file) ?? current);
    setSaveMessage(null);
    await showCaseChooser(moduleId);
  }

  async function deleteOpenCase() {
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
      setNursingLoadedLabel('Niet opgeslagen');
    }
    setSaveMessage(null);
    await showCaseChooser(moduleId);
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

  function requestSave() {
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
        setNursingLoadedLabel(nursingEditorSourceLabel('json'));
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
      setNursingLoadedLabel(`Geladen: ${fileName}`);
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

  async function extraMediaForExport(): Promise<
    Array<{ relativePath: string; contentBase64: string }>
  > {
    const extra: Array<{ relativePath: string; contentBase64: string }> = [];
    if (editorModule === 'verpleegkunde') {
      for (const op of nursingStagedMedia) {
        if (op.type === 'delete') {
          continue;
        }
        extra.push({
          relativePath: op.relativePath,
          contentBase64: await fileToBase64(op.file),
        });
      }
      return extra;
    }
    for (const op of stagedMedia) {
      if (op.type === 'delete') {
        continue;
      }
      extra.push({
        relativePath: op.relativePath,
        contentBase64: await fileToBase64(op.file),
      });
    }
    return extra;
  }

  async function exportPackage() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    setSaveBlockIssues(null);
    const envelopeText =
      editorModule === 'logopedie'
        ? envelopeTextForModule('logopedie', scenario)
        : envelopeTextForModule('verpleegkunde', nursingDraft);
    const result = await exportPackageToCopy(
      editorModule,
      envelopeText,
      await extraMediaForExport(),
    );
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const chosen = await saveExportedZipAs(result.zip);
    if (chosen === 'saved') {
      setSaveMessage(`Opgeslagen via Opslaan als. Kopie blijft in ${result.zip}.`);
      return;
    }
    setSaveMessage(`Geëxporteerd naar ${result.zip}`);
  }

  async function importPackageFromPicker() {
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
    if (!file) {
      return;
    }
    setSaveError(null);
    setSaveMessage(null);
    setOpenError(null);
    setSaveBlockIssues(null);
    try {
      const parsed = parseEditorPackageZip(new Uint8Array(await file.arrayBuffer()));
      if (!parsed.ok) {
        setOpenError(parsed.error);
        return;
      }
      const issues = editorPackageIssues(parsed);
      if (issues.length > 0) {
        setBlockKind('import');
        setSaveBlockIssues(issues);
        return;
      }
      if (parsed.media.length > 0) {
        const applied = await importPackageMedia(parsed.module, parsed.media);
        if (!applied.ok) {
          setSaveError(applied.error);
          return;
        }
      }
      if (parsed.module === 'logopedie') {
        markDirty();
        setEditorModule('logopedie');
        setScenario(parsed.scenario);
        setSelectedNodeId(parsed.scenario.startNodeId);
        setPreviewOptionIndex(0);
        setStagedMedia([]);
        setLogopedieCaseFile(null);
        setLoadedLabel(`Geladen: ${file.name}`);
        setLoadNotice(null);
      } else {
        markNursingDirty();
        setEditorModule('verpleegkunde');
        setNursingDraft(parsed.scenario);
        setDraftNodeIds([]);
        setSelectedStepId(parsed.scenario.meta.startStepId);
        setNursingPreviewOptionIndex(0);
        setNursingStagedMedia([]);
        setNursingCaseFile(null);
        setNursingLoadedLabel(`Geladen: ${file.name}`);
        setNursingLoadNotice(null);
        try {
          setNursingDiskMedia(await listNursingMedia());
        } catch {
          // preview still uses the written files
        }
      }
      setSaveMessage(`Pakket ${file.name} is geladen in de editor.`);
    } catch {
      setOpenError('Het pakket kon niet worden gelezen.');
    }
  }

  const issues = useMemo(() => logopedieSaveIssues(scenario), [scenario]);
  const node = scenario.nodes.find((item) => item.id === selectedNodeId) ?? scenario.nodes[0];
  const previewOption = node?.options[previewOptionIndex] ?? node?.options[0];
  const previewEmotion = previewOption?.emotion ?? node?.promptEmotion ?? 'neutral';
  const previewAvatarPath = avatarSourceChain(previewEmotion)[0]?.relativePath ?? null;
  const stagedAvatar = stagedMedia.find(
    (op) => op.type !== 'delete' && op.relativePath === previewAvatarPath,
  );
  const avatarOverride =
    stagedAvatar && stagedAvatar.type !== 'delete' ? stagedAvatar.previewUrl : null;

  function updateSelected(next: DecisionNode) {
    markDirty();
    setScenario((current) => replaceNode(current, next.id, next));
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
          <p className="editor-kicker">Los van de studentensimulatie</p>
          <h1>
            {editorModule === 'logopedie'
              ? 'Logopedie-scenariobewerker'
              : 'Gesprekstechnieken-scenariobewerker'}
          </h1>
          <p className="editor-meta">
            {editorModule === 'logopedie'
              ? `${scenario.title} · v${scenario.version}`
              : `${nursingDraft.meta.title} · v${nursingDraft.meta.version}`}
          </p>
          <p className="editor-loaded" data-testid="editor-loaded-source">
            {activeLoadedLabel}
          </p>
        </div>
        <div className="editor-header-side">
          <div className="editor-actions">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-new-scenario"
              onClick={startNewScenario}
            >
              Nieuw scenario
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
            {saveOnThisPc ? (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="btn-save-json"
                onClick={() => requestSave()}
                disabled={saving}
              >
                Opslaan
              </button>
            ) : null}
            {saveOnThisPc ? (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="btn-save-as-case"
                onClick={() => requestSaveAsNewCase()}
                disabled={saving}
              >
                Opslaan als nieuwe casus
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-download-json"
              onClick={() =>
                editorModule === 'logopedie'
                  ? downloadEnvelope(scenario)
                  : downloadNursingEnvelope(nursingDraft)
              }
            >
              Casus downloaden
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-reset-seed"
              onClick={editorModule === 'logopedie' ? resetToSeed : resetNursingToSeed}
            >
              Herstel startkopie
            </button>
            {saveOnThisPc ? (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="btn-import-package"
                onClick={() => void importPackageFromPicker()}
                disabled={saving}
              >
                Importeren
              </button>
            ) : null}
            <input
              ref={importPackageRef}
              type="file"
              accept="application/zip,.zip"
              className="visually-hidden"
              data-testid="input-import-package"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void importPackageFile(file);
              }}
            />
            {saveOnThisPc ? (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="btn-export-package"
                onClick={() => void exportPackage()}
                disabled={saving}
              >
                Exporteren
              </button>
            ) : null}
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
              onClick={() => quitEditor()}
            >
              Afsluiten
            </button>
          </div>
          {editorModule === 'logopedie' ? (
            <aside className="editor-preview editor-header-preview editor-card">
              <h2>Voorbeeld</h2>
              <p className="muted" data-testid="preview-face-label">
                {faceLabel(previewEmotion)}
              </p>
              <div className="editor-preview-stage" data-testid="editor-preview-stage">
                <LogopedieAvatar
                  emotion={previewEmotion}
                  heightPx={240}
                  name={scenario.client.name}
                  srcOverride={avatarOverride}
                />
              </div>
              <p className="muted">{previewOption?.clientResponse.text}</p>
            </aside>
          ) : (
            <NursingPreviewAside
              draft={nursingDraft}
              stagedMedia={nursingStagedMedia}
              selectedStepId={selectedStepId}
              previewOptionIndex={nursingPreviewOptionIndex}
            />
          )}
        </div>
      </header>

      <nav className="editor-module-tabs" aria-label="Module">
        <button
          type="button"
          className={editorModule === 'logopedie' ? 'is-active' : undefined}
          data-testid="editor-module-logopedie"
          onClick={() => selectEditorModule('logopedie')}
        >
          Logopedie
        </button>
        <button
          type="button"
          className={editorModule === 'verpleegkunde' ? 'is-active' : undefined}
          data-testid="editor-module-nursing"
          onClick={() => selectEditorModule('verpleegkunde')}
        >
          Gesprekstechnieken
        </button>
      </nav>

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

      {editorModule === 'verpleegkunde' ? (
        <>
          <NursingEditor
            draft={nursingDraft}
            onChange={(next) => {
              markNursingDirty();
              rememberQuestionFolders(nursingDraft, next);
              setNursingDraft(next);
              setDraftNodeIds((ids) =>
                ids.filter((id) => next.steps.some((step) => step.id === id)),
              );
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
      ) : (
        <>
          <section
            className={`editor-issues${issues.length > 0 ? ' has-issues' : ''}`}
            data-testid="editor-issues"
            aria-live="polite"
          >
            <h2>Controle</h2>
            {issues.length === 0 ? (
              <p data-testid="editor-issues-ok">Geen validatiefouten.</p>
            ) : (
              <ul data-testid="editor-issues-list">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="editor-layout">
            <nav className="editor-nodes" aria-label="Beslissingspunten">
              <h2>Vragen</h2>
              <ol>
                {scenario.nodes.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === node?.id ? 'is-active' : undefined}
                      data-testid={`node-tab-${item.id}`}
                      onClick={() => {
                        setSelectedNodeId(item.id);
                        setPreviewOptionIndex(0);
                      }}
                    >
                      {item.phaseLabel.trim() || `Vraag ${index + 1}`}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            {node ? (
              <main className="editor-main" id="inhoud">
                <section className="editor-card">
                  <h2>Vraag van de cliënt</h2>
                  <div className="field">
                    <label htmlFor="scenario-title">Titel</label>
                    <textarea
                      id="scenario-title"
                      data-testid="scenario-title"
                      rows={1}
                      value={scenario.title}
                      onChange={(event) => {
                        markDirty();
                        setScenario((current) => ({ ...current, title: event.target.value }));
                      }}
                    />
                  </div>
                  <div className={fieldClass(node.prompt.text)}>
                    <label htmlFor="prompt-text">Wat zegt de cliënt?</label>
                    <textarea
                      id="prompt-text"
                      data-testid="prompt-text"
                      rows={3}
                      value={node.prompt.text}
                      onChange={(event) =>
                        updateSelected({
                          ...node,
                          prompt: { ...node.prompt, text: event.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="prompt-context">Wat is zichtbaar?</label>
                    <textarea
                      id="prompt-context"
                      data-testid="prompt-context"
                      rows={2}
                      value={node.prompt.context}
                      onChange={(event) =>
                        updateSelected({
                          ...node,
                          prompt: { ...node.prompt, context: event.target.value },
                        })
                      }
                    />
                  </div>
                </section>

                <div className="editor-option-grid">
                  {node.options.map((option, optionIndex) => (
                    <section
                      key={option.id}
                      className={`editor-card option-card${previewOptionIndex === optionIndex ? ' is-previewed' : ''}`}
                      data-testid={`option-editor-${option.id}`}
                    >
                      <div className="option-card-head">
                        <h2>Antwoord {String(optionIndex + 1)}</h2>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          data-testid={`btn-preview-option-${String(optionIndex)}`}
                          onClick={() => setPreviewOptionIndex(optionIndex)}
                        >
                          Toon gezicht
                        </button>
                      </div>
                      <div className="field">
                        <label htmlFor={`quality-${option.id}`}>Kwaliteit</label>
                        <select
                          id={`quality-${option.id}`}
                          data-testid={`option-quality-${option.id}`}
                          value={option.quality}
                          onChange={(event) =>
                            updateSelected(
                              replaceOption(node, optionIndex, {
                                ...option,
                                quality: event.target.value as OptionQuality,
                              }),
                            )
                          }
                        >
                          {QUALITIES.map((quality) => (
                            <option key={quality} value={quality}>
                              {QUALITY_LABELS[quality]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={fieldClass(option.text)}>
                        <label htmlFor={`option-text-${option.id}`}>Antwoord keuze</label>
                        <textarea
                          id={`option-text-${option.id}`}
                          data-testid={`option-text-${option.id}`}
                          rows={3}
                          value={option.text}
                          onChange={(event) =>
                            updateSelected(
                              replaceOption(node, optionIndex, {
                                ...option,
                                text: event.target.value,
                              }),
                            )
                          }
                        />
                      </div>
                      <div className={fieldClass(option.clientResponse.text)}>
                        <label htmlFor={`client-response-${option.id}`}>
                          Reactie van de cliënt
                        </label>
                        <textarea
                          id={`client-response-${option.id}`}
                          data-testid={`client-response-${option.id}`}
                          rows={2}
                          value={option.clientResponse.text}
                          onChange={(event) =>
                            updateSelected(
                              replaceOption(node, optionIndex, {
                                ...option,
                                clientResponse: {
                                  ...option.clientResponse,
                                  text: event.target.value,
                                },
                              }),
                            )
                          }
                        />
                      </div>
                      <fieldset className="face-picker">
                        <legend>Gezicht na dit antwoord</legend>
                        <div className="face-options">
                          {EDITOR_FACES.map((face) => (
                            <label key={face.emotion} className="face-option">
                              <input
                                type="radio"
                                name={`face-${option.id}`}
                                value={face.emotion}
                                checked={option.emotion === face.emotion}
                                data-testid={`option-face-${option.id}-${face.emotion}`}
                                onChange={() => {
                                  setPreviewOptionIndex(optionIndex);
                                  updateSelected(
                                    replaceOption(node, optionIndex, {
                                      ...option,
                                      emotion: face.emotion,
                                    }),
                                  );
                                }}
                              />
                              {face.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </section>
                  ))}
                </div>
              </main>
            ) : null}
          </div>

          <EditorMediaPanel
            staged={stagedMedia}
            previewPath={previewAvatarPath}
            onStage={(op) => {
              setStagedMedia((current) => {
                const without = current.filter((item) => item.relativePath !== op.relativePath);
                return [...without, op];
              });
            }}
          />
        </>
      )}
    </div>
  );
}
