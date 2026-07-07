"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { generatePositionBetween } from "@/lib/crdt/fractional-indexing";
import {
  db,
  getDocumentLocally,
  saveDocumentLocally,
  saveOperationLocally,
  queueOperationForSync,
  getDocumentOperations,
} from "@/lib/db-client";
import { resolveDocumentState } from "@/lib/crdt/resolver";
import { syncEngine } from "@/lib/sync-engine";
import { Operation, UserRole } from "@/types";
import { Cloud, CloudOff, CloudLightning, RefreshCw, Undo, Redo, Shield } from "lucide-react";

interface TiptapEditorProps {
  documentId: string;
  userId: string;
  role: UserRole;
}

interface CharNode {
  id: string;
  position: string;
  char: string;
}

export default function TiptapEditor({ documentId, userId, role }: TiptapEditorProps) {
  const [title, setTitle] = useState("Loading...");
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline" | "conflict">("synced");
  const [pendingCount, setPendingCount] = useState(0);
  
  const charListRef = useRef<CharNode[]>([]);
  const isApplyingRemoteRef = useRef(false);
  const isUpdatingLocalRef = useRef(false);
  const nextSeqCounterRef = useRef(0);

  // 1. Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure(),
      Placeholder.configure({
        placeholder: "Write something collaborative...",
      }),
    ],
    editable: role !== "VIEWER",
  });

  // 2. Load document content from IndexedDB and build CRDT character registry
  useEffect(() => {
    if (!editor) return;

    let isMounted = true;

    async function loadDocument() {
      // Fetch cached document and operations
      const doc = await getDocumentLocally(documentId);
      const ops = await getDocumentOperations(documentId);

      if (!isMounted) return;

      // Extract current client sequence number to avoid duplicate Lamport keys
      const myOps = ops.filter((o) => o.userId === userId);
      nextSeqCounterRef.current = myOps.length > 0 
        ? Math.max(...myOps.map((o) => parseInt(o.id.split(":")[1] || "0", 10))) + 1
        : 0;

      // Filter and rebuild character registry from operations log
      const deletedIds = new Set<string>();
      const activeInserts: Operation[] = [];
      let resolvedTitle = doc?.title || "Untitled Document";

      const titleOps = ops.filter((o) => o.type === "UPDATE_TITLE");
      if (titleOps.length > 0) {
        titleOps.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        resolvedTitle = titleOps[titleOps.length - 1].value;
      }

      for (const op of ops) {
        if (op.type === "DELETE") {
          deletedIds.add(op.value);
        } else if (op.type === "INSERT") {
          activeInserts.push(op);
        }
      }

      const visibleInserts = activeInserts.filter((o) => !deletedIds.has(o.id));
      visibleInserts.sort((a, b) => {
        if (a.position < b.position) return -1;
        if (a.position > b.position) return 1;
        return a.id < b.id ? -1 : 1;
      });

      // Map operational logs into active character registry
      charListRef.current = visibleInserts.map((op) => ({
        id: op.id,
        position: op.position,
        char: op.value,
      }));

      const text = charListRef.current.map((n) => n.char).join("");

      isApplyingRemoteRef.current = true;
      editor.commands.setContent(text);
      setTitle(resolvedTitle);
      isApplyingRemoteRef.current = false;

      // Register document with Sync Engine
      syncEngine.setActiveDocument(documentId);
    }

    loadDocument().catch(console.error);

    return () => {
      isMounted = false;
      syncEngine.setActiveDocument(null);
    };
  }, [documentId, editor, userId]);

  // 3. Listen to remote operations pulled from the Sync Engine
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = syncEngine.subscribe(documentId, (newOps: Operation[]) => {
      if (isUpdatingLocalRef.current) return; // Ignore our own operations callback

      console.log(`[Editor] Applying ${newOps.length} remote operations...`);
      isApplyingRemoteRef.current = true;

      // Extract current selection to preserve cursor positions after merge
      const { from, to } = editor.state.selection;

      // 1. Process deletions and inserts
      const deletedIds = new Set<string>();
      const insertsToApply: Operation[] = [];

      for (const op of newOps) {
        if (op.type === "DELETE") {
          deletedIds.add(op.value);
        } else if (op.type === "INSERT") {
          insertsToApply.push(op);
        } else if (op.type === "UPDATE_TITLE") {
          setTitle(op.value);
        }
      }

      // Remove tombstones from local registry
      charListRef.current = charListRef.current.filter((char) => !deletedIds.has(char.id));

      // Append new insert operations to registry
      for (const op of insertsToApply) {
        // Avoid adding duplicate characters
        if (charListRef.current.some((c) => c.id === op.id)) continue;

        charListRef.current.push({
          id: op.id,
          position: op.position,
          char: op.value,
        });
      }

      // Sort local registry
      charListRef.current.sort((a, b) => {
        if (a.position < b.position) return -1;
        if (a.position > b.position) return 1;
        return a.id < b.id ? -1 : 1;
      });

      // Render merged state
      const mergedText = charListRef.current.map((c) => c.char).join("");
      editor.commands.setContent(mergedText);

      // Re-apply cursor selection safely
      const maxPos = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(from, maxPos),
        to: Math.min(to, maxPos),
      });

      isApplyingRemoteRef.current = false;
      setSyncStatus("conflict"); // Visual notice that remote conflicts were resolved
      setTimeout(() => setSyncStatus("synced"), 3000);
    });

    return () => {
      unsubscribe();
    };
  }, [documentId, editor]);

  // 4. Periodically monitor offline sync queue size
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!db) return;
      const count = await db.syncQueue.where("documentId").equals(documentId).count();
      setPendingCount(count);
      
      if (!syncEngine.isOnline()) {
        setSyncStatus("offline");
      } else if (count > 0) {
        setSyncStatus("saving");
      } else {
        setSyncStatus("synced");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [documentId]);

  // 5. Intercept local updates from Tiptap and generate CRDT log operations
  const handleEditorUpdate = async () => {
    if (isApplyingRemoteRef.current || !editor) return;

    isUpdatingLocalRef.current = true;

    try {
      const currentText = editor.getText();
      const previousList = [...charListRef.current];

      // A. Linear Diff (Head-Tail Comparison)
      let start = 0;
      while (
        start < previousList.length &&
        start < currentText.length &&
        previousList[start].char === currentText[start]
      ) {
        start++;
      }

      let oldEnd = previousList.length - 1;
      let newEnd = currentText.length - 1;

      while (
        oldEnd >= start &&
        newEnd >= start &&
        previousList[oldEnd].char === currentText[newEnd]
      ) {
        oldEnd--;
        newEnd--;
      }

      const generatedOps: Operation[] = [];

      // Case 1: Deletions occurred
      if (oldEnd >= start) {
        const deletedNodes = previousList.slice(start, oldEnd + 1);
        for (const node of deletedNodes) {
          const opId = `${userId}:${nextSeqCounterRef.current++}`;
          const op: Operation = {
            id: opId,
            documentId,
            userId,
            type: "DELETE",
            position: node.position,
            value: node.id, // target the insert id for tombstone
            createdAt: new Date(),
          };

          await saveOperationLocally(op);
          await queueOperationForSync(documentId, op);
          generatedOps.push(op);
        }
      }

      // Case 2: Insertions occurred
      if (newEnd >= start) {
        const insertedChars = currentText.substring(start, newEnd + 1);
        const tempRegistry = [...previousList];

        // If characters were deleted in this frame, remove them from temp registry
        if (oldEnd >= start) {
          tempRegistry.splice(start, oldEnd - start + 1);
        }

        for (let idx = 0; idx < insertedChars.length; idx++) {
          const char = insertedChars[idx];
          
          // Get left and right boundaries relative to the insert position
          const leftPos = start + idx > 0 ? tempRegistry[start + idx - 1].position : "";
          const rightPos = start + idx < tempRegistry.length ? tempRegistry[start + idx].position : "";

          const position = generatePositionBetween(leftPos, rightPos);
          const opId = `${userId}:${nextSeqCounterRef.current++}`;

          const op: Operation = {
            id: opId,
            documentId,
            userId,
            type: "INSERT",
            position,
            value: char,
            createdAt: new Date(),
          };

          await saveOperationLocally(op);
          await queueOperationForSync(documentId, op);
          generatedOps.push(op);

          // Update temporary registry for sequential insertions
          tempRegistry.splice(start + idx, 0, {
            id: opId,
            position,
            char,
          });
        }
      }

      // B. Update local character registry
      if (oldEnd >= start || newEnd >= start) {
        // Rebuild character list
        const ops = await getDocumentOperations(documentId);
        const deletedIds = new Set<string>();
        const activeInserts: Operation[] = [];

        for (const op of ops) {
          if (op.type === "DELETE") {
            deletedIds.add(op.value);
          } else if (op.type === "INSERT") {
            activeInserts.push(op);
          }
        }

        const visibleInserts = activeInserts.filter((o) => !deletedIds.has(o.id));
        visibleInserts.sort((a, b) => {
          if (a.position < b.position) return -1;
          if (a.position > b.position) return 1;
          return a.id < b.id ? -1 : 1;
        });

        charListRef.current = visibleInserts.map((op) => ({
          id: op.id,
          position: op.position,
          char: op.value,
        }));

        // Cache document title and text locally
        await saveDocumentLocally({
          id: documentId,
          title,
          content: editor.getText(),
          ownerId: "", // Cached placeholder
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Trigger synchronization background upload
        if (syncEngine.isOnline()) {
          syncEngine.sync(documentId).catch(console.error);
        }
      }
    } catch (err) {
      console.error("[Editor] Local mutation calculation error:", err);
    } finally {
      isUpdatingLocalRef.current = false;
    }
  };

  // 6. Handle document title updates
  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    if (role === "VIEWER") return;

    const opId = `${userId}:${nextSeqCounterRef.current++}`;
    const op: Operation = {
      id: opId,
      documentId,
      userId,
      type: "UPDATE_TITLE",
      position: "title",
      value: newTitle,
      createdAt: new Date(),
    };

    await saveOperationLocally(op);
    await queueOperationForSync(documentId, op);

    // Save document state locally
    const doc = await getDocumentLocally(documentId);
    if (doc) {
      await saveDocumentLocally({
        ...doc,
        title: newTitle,
        updatedAt: new Date(),
      });
    }

    if (syncEngine.isOnline()) {
      syncEngine.sync(documentId).catch(console.error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 shadow-2xl">
      {/* Editor Header Panel */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            disabled={role === "VIEWER"}
            className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-full transition-colors duration-150 py-1"
          />
        </div>

        {/* Sync & Role Status Indicators */}
        <div className="flex items-center gap-3">
          {/* User Role Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs text-slate-300">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span className="capitalize">{role.toLowerCase()}</span>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs">
            {syncStatus === "synced" && (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Synced</span>
              </>
            )}
            {syncStatus === "saving" && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400 font-medium">Saving ({pendingCount})</span>
              </>
            )}
            {syncStatus === "offline" && (
              <>
                <CloudOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-medium">Offline</span>
              </>
            )}
            {syncStatus === "conflict" && (
              <>
                <CloudLightning className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-400 font-medium">Merged</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor Controls / Toolbar (Only visible for Owners/Editors) */}
      {role !== "VIEWER" && editor && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-slate-400">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors font-bold ${
              editor.isActive("bold") ? "bg-slate-800 text-indigo-400" : ""
            }`}
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors italic ${
              editor.isActive("italic") ? "bg-slate-800 text-indigo-400" : ""
            }`}
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-3 py-1.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors line-through ${
              editor.isActive("strike") ? "bg-slate-800 text-indigo-400" : ""
            }`}
          >
            S
          </button>
          <span className="w-px h-6 bg-slate-800 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors ${
              editor.isActive("heading", { level: 1 }) ? "bg-slate-800 text-indigo-400" : ""
            }`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1.5 rounded hover:bg-slate-800 hover:text-slate-100 transition-colors ${
              editor.isActive("heading", { level: 2 }) ? "bg-slate-800 text-indigo-400" : ""
            }`}
          >
            H2
          </button>
          <span className="w-px h-6 bg-slate-800 mx-1" />
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30 transition-colors"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30 transition-colors"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div 
        className="flex-1 overflow-y-auto min-h-[300px] prose prose-invert prose-indigo max-w-none text-slate-200 focus:outline-none"
        onKeyUp={handleEditorUpdate}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
